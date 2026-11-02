// Product-audio packet candidates for bench evaluation; no shipping format selected.
export const AudioLimits = Object.freeze({ HeaderBytes: 34, EndBytes: 38,
  MaxPacketBytes: 256, MaxPayloadBytes: 222 });
export const AudioKind = Object.freeze({ Data: 1, End: 2 });
export const AudioCodec = Object.freeze({ Pcm16: 0, ImaAdpcm: 1 });
export const AudioChannel = Object.freeze({ Mic1: 0, Mic2: 1, Mix: 2 });

const steps = [7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,
  66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,
  371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,
  1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,
  5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,
  16818,18500,20350,22385,24623,27086,29794,32767];
const indexSteps = [-1,-1,-1,-1,2,4,6,8,-1,-1,-1,-1,2,4,6,8];
const bad = message => { throw new RangeError(message); };
const integer = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sizeFor = (codec, count) => codec === AudioCodec.Pcm16 ? count * 2 : Math.ceil(count / 2);
function checkState(state) {
  if (!state || !integer(state.predictor, -32768, 32767) || !integer(state.stepIndex, 0, 88)) bad('invalid IMA state');
  return { predictor: state.predictor, stepIndex: state.stepIndex };
}
function common(p) {
  if (!p || ![1,2].includes(p.kind) || ![0,1].includes(p.codec) ||
      ![8,16].includes(p.rateKhz) || ![0,1,2].includes(p.channel) ||
      !integer(p.session, 1, 0xffffffff) || !integer(p.request, 1, 0xffffffff) ||
      !integer(p.recording, 1, 0xffffffff) || !integer(p.sequence, 0, 0xffffffff) ||
      !integer(p.firstSample, 0, 0xffffffff) || !integer(p.sampleCount, 0, 65535) ||
      !integer(p.predictor, -32768, 32767) || !integer(p.stepIndex, 0, 255)) bad('invalid audio packet field');
  const payload = p.payload ?? new Uint8Array();
  if (!(payload instanceof Uint8Array)) bad('payload must be Uint8Array');
  const dropped = p.droppedPackets ?? 0;
  if (!integer(dropped, 0, 0xffffffff)) bad('invalid droppedPackets');
  if (p.kind === AudioKind.End) {
    if (p.sampleCount || p.predictor || p.stepIndex || payload.length || dropped > p.sequence ||
        (p.sequence === 0 && (p.firstSample || dropped)) ||
        (p.sequence !== 0 && p.firstSample === 0)) bad('invalid End packet');
  } else {
    if (!p.sequence || !p.sampleCount || p.firstSample + p.sampleCount > 0xffffffff || dropped ||
        (p.codec === AudioCodec.Pcm16 && (p.predictor || p.stepIndex)) ||
        (p.codec === AudioCodec.ImaAdpcm && p.stepIndex > 88) ||
        payload.length !== sizeFor(p.codec, p.sampleCount) || payload.length > AudioLimits.MaxPayloadBytes ||
        (p.codec === AudioCodec.ImaAdpcm && (p.sampleCount & 1) && (payload.at(-1) & 0xf0)))
      bad('invalid Data packet');
  }
  return { payload, dropped };
}

export function encode(packet) {
  const {payload, dropped} = common(packet);
  const end = packet.kind === AudioKind.End;
  const bytes = new Uint8Array(end ? AudioLimits.EndBytes : AudioLimits.HeaderBytes + payload.length);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42; bytes[1] = 0x41; bytes[2] = 1;
  bytes[3] = packet.kind; bytes[4] = packet.codec; bytes[5] = packet.rateKhz; bytes[6] = packet.channel;
  view.setUint32(8, packet.session, true); view.setUint32(12, packet.request, true);
  view.setUint32(16, packet.recording, true); view.setUint32(20, packet.sequence, true);
  view.setUint32(24, packet.firstSample, true); view.setUint16(28, packet.sampleCount, true);
  view.setInt16(30, packet.predictor, true); bytes[32] = packet.stepIndex;
  if (end) view.setUint32(34, dropped, true);
  else bytes.set(payload, AudioLimits.HeaderBytes);
  return bytes;
}

export function decode(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < AudioLimits.HeaderBytes ||
      bytes.length > AudioLimits.MaxPacketBytes) bad('invalid audio length');
  if (bytes[0] !== 0x42 || bytes[1] !== 0x41 || bytes[2] !== 1 || bytes[7] || bytes[33])
    bad('invalid audio header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kind = bytes[3];
  if (kind === AudioKind.End && bytes.length !== AudioLimits.EndBytes) bad('invalid End length');
  const packet = { kind, codec: bytes[4], rateKhz: bytes[5], channel: bytes[6],
    session: view.getUint32(8, true), request: view.getUint32(12, true),
    recording: view.getUint32(16, true), sequence: view.getUint32(20, true),
    firstSample: view.getUint32(24, true), sampleCount: view.getUint16(28, true),
    predictor: view.getInt16(30, true), stepIndex: bytes[32],
    droppedPackets: kind === AudioKind.End ? view.getUint32(34, true) : 0,
    payload: kind === AudioKind.Data ? bytes.slice(AudioLimits.HeaderBytes) : new Uint8Array() };
  common(packet);
  return packet;
}

function advance(state, code, delta) {
  state.predictor = clamp(state.predictor + ((code & 8) ? -delta : delta), -32768, 32767);
  state.stepIndex = clamp(state.stepIndex + indexSteps[code], 0, 88);
}
function encodeNibble(state, sample) {
  let currentStep = steps[state.stepIndex];
  let diff = sample - state.predictor;
  let code = 0;
  if (diff < 0) { code = 8; diff = -diff; }
  let delta = currentStep >> 3;
  if (diff >= currentStep) { code |= 4; diff -= currentStep; delta += currentStep; }
  currentStep >>= 1;
  if (diff >= currentStep) { code |= 2; diff -= currentStep; delta += currentStep; }
  currentStep >>= 1;
  if (diff >= currentStep) { code |= 1; delta += currentStep; }
  advance(state, code, delta);
  return code;
}
function decodeNibble(state, code) {
  const currentStep = steps[state.stepIndex];
  let delta = currentStep >> 3;
  if (code & 4) delta += currentStep;
  if (code & 2) delta += currentStep >> 1;
  if (code & 1) delta += currentStep >> 2;
  advance(state, code, delta);
  return state.predictor;
}

export function encodeSamples(codec, samples, state) {
  const next = checkState(state);
  if (![0,1].includes(codec) || !(samples instanceof Int16Array) || !samples.length ||
      (codec === AudioCodec.Pcm16 && (next.predictor || next.stepIndex)) ||
      samples.length > (codec === AudioCodec.Pcm16 ? 111 : 444)) bad('invalid samples');
  const bytes = new Uint8Array(sizeFor(codec, samples.length));
  if (codec === AudioCodec.Pcm16) {
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; ++i) view.setInt16(i * 2, samples[i], true);
  } else for (let i = 0; i < samples.length; i += 2) {
    const low = encodeNibble(next, samples[i]);
    const high = i + 1 < samples.length ? encodeNibble(next, samples[i + 1]) : 0;
    bytes[i / 2] = low | (high << 4);
  }
  return {bytes, state: next};
}

export function decodeSamples(codec, bytes, count, state) {
  const next = checkState(state);
  if (![0,1].includes(codec) || !(bytes instanceof Uint8Array) ||
      (codec === AudioCodec.Pcm16 && (next.predictor || next.stepIndex)) ||
      !integer(count, 1, codec === AudioCodec.Pcm16 ? 111 : 444) ||
      bytes.length !== sizeFor(codec, count) ||
      (codec === AudioCodec.ImaAdpcm && (count & 1) && (bytes.at(-1) & 0xf0)))
    bad('invalid sample payload');
  const samples = new Int16Array(count);
  if (codec === AudioCodec.Pcm16) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < count; ++i) samples[i] = view.getInt16(i * 2, true);
  } else for (let i = 0; i < count; ++i)
    samples[i] = decodeNibble(next, (bytes[i >> 1] >> ((i & 1) * 4)) & 15);
  return {samples, state: next};
}
