// A Bud voice clip: a friend's voice message, the same 16 kHz IMA ADPCM Bud's speaker plays, in
// blocks of 20 ms that each carry their own codec state (like the speaker's packets), so a block
// goes to Bud as it is and the phone decodes it to play as a WAV. About 8 KB a second.
//   header  "BUDC", rate u16, block u16 (samples)             8 bytes, little-endian
//   block   predictor i16, step index u8, 0, count u16, then ceil(count / 2) bytes of ADPCM
import { AudioCodec, decodeSamples, encodeSamples } from './protocol/audio.mjs';

export const CLIP_RATE = 16000;
const BLOCK = 320; // 20 ms at 16 kHz, a speaker packet
const MAGIC = [0x42, 0x55, 0x44, 0x43]; // BUDC

export function encodeClip(samples, rate = CLIP_RATE) {
  if (!(samples instanceof Int16Array) || !samples.length) throw new RangeError('A clip needs samples.');
  const blocks = Math.ceil(samples.length / BLOCK);
  const out = new Uint8Array(8 + blocks * 6 + Math.ceil(samples.length / 2) + blocks);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  view.setUint16(4, rate, true);
  view.setUint16(6, BLOCK, true);
  let at = 8;
  let state = { predictor: 0, stepIndex: 0 };
  for (let i = 0; i < samples.length; i += BLOCK) {
    const part = samples.subarray(i, Math.min(i + BLOCK, samples.length));
    const before = state;
    const { bytes, state: after } = encodeSamples(AudioCodec.ImaAdpcm, part, state);
    state = after;
    view.setInt16(at, before.predictor, true);
    out[at + 2] = before.stepIndex;
    view.setUint16(at + 4, part.length, true);
    out.set(bytes, at + 6);
    at += 6 + bytes.length;
  }
  return out.slice(0, at);
}

// The clip's blocks, each { state, count, payload }, ready for Bud's speaker. Throws on a bad clip.
export function clipBlocks(bytes) {
  const { rate } = clipInfo(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  let at = 8;
  while (at < bytes.length) {
    if (at + 6 > bytes.length) throw new RangeError('A clip block is cut short.');
    const count = view.getUint16(at + 4, true);
    const size = Math.ceil(count / 2);
    const stepIndex = bytes[at + 2];
    if (!count || count > BLOCK || stepIndex > 88 || at + 6 + size > bytes.length) throw new RangeError('A clip block is not right.');
    out.push({ state: { predictor: view.getInt16(at, true), stepIndex }, count, payload: bytes.subarray(at + 6, at + 6 + size), rate });
    at += 6 + size;
  }
  return out;
}

export function clipInfo(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 || MAGIC.some((b, i) => bytes[i] !== b)) throw new RangeError('Not a Bud clip.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rate = view.getUint16(4, true);
  if (rate !== CLIP_RATE || view.getUint16(6, true) !== BLOCK) throw new RangeError('A Bud clip is 16 kHz.');
  return { rate };
}

export function decodeClip(bytes) {
  const blocks = clipBlocks(bytes);
  const samples = new Int16Array(blocks.reduce((n, b) => n + b.count, 0));
  let at = 0;
  for (const b of blocks) {
    // the last nibble of an odd block is padding
    const payload = b.count & 1 ? Uint8Array.from(b.payload, (v, i) => (i === b.payload.length - 1 ? v & 0x0f : v)) : b.payload;
    samples.set(decodeSamples(AudioCodec.ImaAdpcm, payload, b.count, b.state).samples, at);
    at += b.count;
  }
  return { rate: CLIP_RATE, samples };
}

export const clipMs = (bytes) => Math.round((clipBlocks(bytes).reduce((n, b) => n + b.count, 0) / CLIP_RATE) * 1000);

// A mono 16-bit WAV, for the phone to play.
export function wavOf(samples, rate = CLIP_RATE) {
  const out = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(out.buffer);
  const text = (at, s) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
  return out;
}

// A WAV the phone recorded (16-bit or float PCM, any rate, mono or stereo): { rate, samples } mono.
// iOS puts other chunks (like FLLR) before the data, so the chunks are walked, not assumed.
export function readWav(bytes) {
  const tag = (at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  if (bytes.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new RangeError('Not a WAV recording.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let fmt = null;
  for (let at = 12; at + 8 <= bytes.length;) {
    const id = tag(at);
    const size = view.getUint32(at + 4, true);
    if (id === 'fmt ') {
      fmt = { format: view.getUint16(at + 8, true), channels: view.getUint16(at + 10, true), rate: view.getUint32(at + 12, true), bits: view.getUint16(at + 22, true) };
    } else if (id === 'data' && fmt) {
      const end = Math.min(bytes.length, at + 8 + size);
      const step = (fmt.bits / 8) * fmt.channels;
      const frames = Math.floor((end - at - 8) / step);
      const samples = new Int16Array(frames);
      for (let f = 0; f < frames; f++) {
        let sum = 0;
        for (let c = 0; c < fmt.channels; c++) {
          const p = at + 8 + f * step + c * (fmt.bits / 8);
          sum += fmt.format === 3 && fmt.bits === 32 ? view.getFloat32(p, true) * 32767 : fmt.bits === 16 ? view.getInt16(p, true) : 0;
        }
        samples[f] = Math.max(-32768, Math.min(32767, Math.round(sum / fmt.channels)));
      }
      return { rate: fmt.rate, samples };
    }
    at += 8 + size + (size & 1);
  }
  throw new RangeError('That recording has no sound in it.');
}

// To 16 kHz (linear: a phone recording is already speech-band).
export function resample(samples, from, to = CLIP_RATE) {
  if (from === to) return samples;
  const out = new Int16Array(Math.floor((samples.length * to) / from));
  for (let i = 0; i < out.length; i++) {
    const at = (i * from) / to;
    const j = Math.floor(at);
    const a = samples[j], b = samples[Math.min(j + 1, samples.length - 1)];
    out[i] = Math.round(a + (b - a) * (at - j));
  }
  return out;
}

// A voice brought up to a clear level: its loudest moment to 70% of full scale, about where Bud's
// own voice peaks on its speaker (speaker.mjs CEILING), but never more than 8 times louder (a
// quiet room's hiss shouldn't roar). Bud's speaker plays a clip as it is, with no gain of its own.
export function louder(samples) {
  let peak = 1;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = Math.min(8, (0.7 * 32767) / peak);
  if (gain <= 1.02) return samples;
  return Int16Array.from(samples, (v) => Math.round(v * gain));
}

// Base64, without the platform's (Hermes has atob and btoa, but a clip is binary and long).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}
export function fromBase64(text) {
  const clean = String(text).replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  const value = (c) => B64.indexOf(c);
  let at = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (value(clean[i]) << 18) | (value(clean[i + 1]) << 12) | ((value(clean[i + 2]) & 63) << 6) | (value(clean[i + 3]) & 63);
    out[at++] = (n >> 16) & 255;
    if (i + 2 < clean.length && at < out.length) out[at++] = (n >> 8) & 255;
    if (i + 3 < clean.length && at < out.length) out[at++] = n & 255;
  }
  return out.slice(0, at);
}
