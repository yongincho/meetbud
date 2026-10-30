// Bud's own speaker. Bud's voice arrives as 24 kHz 16-bit PCM from the voice server and goes to
// the board as 16 kHz IMA ADPCM packets (firmware/platform/esp32/speaker.h).
// - A reply is one utterance however many sentences it comes in (open(), then play() for each,
//   then end()): the board turns its amplifier on once and off at the end, so no word is lost to
//   it switching. Silence pads both ends, and fills a short wait for the next sentence.
// - Packets go out paced, a little ahead of playback. iOS drops a write without response that
//   comes before the link has room for it, and each lost packet is a 20 ms hole in a word.
// - With the app in the background (the phone locked, "Hey Bud"), iOS stretches every wait: its
//   timers ran 100 to 300 ms late and a native 10 ms sleep took about 90 (both measured), so Bud
//   got a fifth of the packets it needed. There packets go in batches with no wait between them,
//   the last one acknowledged by the board (writeMany): its answer wakes the app, where a timer
//   would wake it late. The board is kept further ahead, and the one timer left, when it holds
//   plenty, only eats into that margin when it is late.
import { AudioCodec, encodeSamples } from './protocol/audio.mjs';

const IN_RATE = 24000;
const OUT_RATE = 16000;
const PACKET = 320; // samples of 16 kHz audio: 20 ms
const PACKET_MS = 20;
const AHEAD_MS = 400; // most queued on the board ahead of playback (it holds 1.5 s)
const LOW_MS = 160; // waiting for the next sentence with less than this queued: silence fills in
const FILL_MS = 3000; // a longer wait than this lets the board stop (it starts again for more)
const GAP_MS = 10; // between packets at least: twice real time, which the link keeps up with
const START_MS = 120; // the board starts playing once it holds this much
const LINK_MS = 30; // from a write to the board having it
const LEAD_MS = 100; // silence first, while the amplifier comes on
const TRAIL_MS = 200; // silence last: the end of the last word plays before it goes off
const TAIL_MS = 150; // after the last sample is due, before the microphone may take over
const STOP_MS = 450; // run dry this long and the board stops (it waits 500 ms), to start again
// Louder than the voice server's level, since the board's codec plays at 0 dB, but only as loud as
// each voice needs: a quiet one (OpenAI's) gets up to about +8 dB, a loud one (Fish Audio's) less.
// The gain drops at once when a peak would pass 65% of full scale and comes back up over about
// half a second, so speech stays below the rounding (tanh past 70%), which only catches a stray
// spike; nothing is ever clipped. (A fixed +8 dB on a
// loud voice pushed most syllables into the rounding: the voice crackled.)
const GAIN_MAX = 2.5;
const GAIN_START = 1.6;
const CEILING = 0.65 * 32767;
const RELEASE = 1 / (0.5 * 16000); // of the way back up, each sample
const KNEE = 0.7 * 32767;
const soft = (v) => {
  const a = Math.abs(v);
  if (a <= KNEE) return Math.round(v);
  return Math.sign(v) * Math.round(KNEE + (32767 - KNEE) * Math.tanh((a - KNEE) / (32767 - KNEE)));
};
const HOLD_MS = 240; // of a reply's first words gathered before they go: a slow start can't leave gaps
// In the background: a batch is up to BATCH packets (200 ms of audio), sent while the board holds
// under BULK_HIGH (of its 1.5 s). When it holds under BULK_LOW, or hasn't started, a batch goes as
// soon as BATCH_LOW are ready.
const BATCH = 10;
const BATCH_LOW = 4;
const BULK_LOW = 600;
const BULK_HIGH = 1100;
const BULK_FILL = 400; // between sentences, silence keeps this much queued

// 24 kHz in, 16 kHz out: each output sample sits 1.5 input samples on from the last, so at a
// whole sample or halfway between two. A windowed sinc (cut off at 7.2 kHz, 16 taps) for each of
// the two, so speech keeps its consonants and nothing above 8 kHz folds back as hiss.
const TAPS = 8; // on each side
const KERNELS = [0, 0.5].map((phase) => {
  const w = [];
  for (let k = -TAPS + 1; k <= TAPS; k++) {
    const x = k - phase;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * 0.6 * x) / (Math.PI * 0.6 * x);
    const window = 0.42 + 0.5 * Math.cos((Math.PI * x) / TAPS) + 0.08 * Math.cos((2 * Math.PI * x) / TAPS); // Blackman
    w.push(sinc * Math.max(0, window));
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return Float32Array.from(w, (v) => v / sum);
});

const Kind = Object.freeze({ Audio: 1, End: 2, Stop: 3 });

function packet(kind, sequence, state = null, payload = null, count = 0) {
  const bytes = new Uint8Array(kind === Kind.Audio ? 8 + payload.length : 3);
  const view = new DataView(bytes.buffer);
  bytes[0] = kind;
  view.setUint16(1, sequence & 0xffff, true);
  if (kind === Kind.Audio) {
    view.setInt16(3, state.predictor, true);
    bytes[5] = state.stepIndex;
    view.setUint16(6, count, true);
    bytes.set(payload, 8);
  }
  return bytes;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => performance.now();
const SILENCE = new Int16Array(PACKET);

export class BudSpeaker {
  // write(bytes) sends one packet to the board (DeviceClient.speak). writeMany(packets) sends
  // several (all but the last of one size) at once and resolves when the board has acknowledged
  // the last; background() says when waits run late (the app is in the background). Without both,
  // every packet goes on its own.
  constructor(write, { writeMany = null, background = () => false } = {}) {
    this.write = write;
    this.writeMany = writeMany;
    this.background = background;
    this.gen = 0;
  }

  // Silence whatever Bud is saying.
  stop() {
    this.gen++;
    Promise.resolve().then(() => this.write(packet(Kind.Stop, 0))).catch(() => {});
  }

  // One utterance, played a stream at a time: play(body) for each sentence, then end().
  open(current = () => true) {
    return new Talk(this, current);
  }

  // Plays a 24 kHz PCM stream (a fetch body) on Bud as an utterance of its own. Resolves about
  // when Bud has finished saying it, early if current() turns false; rejects if the board cannot
  // be reached.
  async play(body, current = () => true) {
    const talk = this.open(current);
    await talk.play(body);
    await talk.end();
  }

  // A friend's voice clip (clip.mjs blocks) on Bud as an utterance of its own.
  async playClip(blocks, current = () => true) {
    const talk = this.open(current);
    await talk.playClip(blocks);
    await talk.end();
  }
}

class Talk {
  constructor(speaker, current) {
    this.speaker = speaker;
    this.current = current;
    this.gen = speaker.gen;
    this.open = false; // an utterance is under way on the board
    this.streams = 0; // sentences arriving now
    this.lock = Promise.resolve(); // one packet at a time, in order
    this.batch = []; // packets waiting to go together (in the background)
    this.waiting = 0; // packets queued behind the one being made
  }
  bulk() {
    return !!this.speaker.writeMany && this.speaker.background();
  }
  live() {
    return this.gen === this.speaker.gen && this.current();
  }
  // How much the board holds that it hasn't played yet, in ms.
  ahead() {
    return this.sentMs - (this.playAt ? Math.max(0, now() - this.playAt) : 0);
  }

  begin() {
    if (this.open) return;
    Object.assign(this, { open: true, sequence: 0, state: { predictor: 0, stepIndex: 0 }, sentMs: 0, playAt: 0, lastAt: 0, filled: 0, gain: GAIN_START, started: false });
    // how this utterance went, for Bud's server log (stats())
    this.seen = { at: now(), packets: 0, late: 0, write: 0, wait: 0, behind: 0, dry: 0, ms: 0, batches: 0, reading: 0 };
    this.lead();
    void this.fill();
  }
  // Silence for the amplifier to come on with.
  lead() {
    for (let ms = 0; ms < LEAD_MS; ms += PACKET_MS) void this.send(SILENCE);
  }
  // Keeps the clock true when the board ran dry: it played silence meanwhile, so what comes next
  // plays that much later; after STOP_MS it stopped, and starts again once it holds START_MS.
  catchUp() {
    const short = -this.ahead();
    if (!this.playAt || short <= 0) return false;
    this.seen.dry += short;
    if (short < STOP_MS) {
      this.playAt += short;
      return false;
    }
    this.playAt = 0;
    this.sentMs = 0;
    return true;
  }

  // One packet of 16 kHz samples, paced: GAP_MS apart at least, and never more than AHEAD_MS ahead.
  // In the background it joins a batch instead (later()), padded to a whole packet: a batch is cut
  // into packets by size, and the padding is under 20 ms of silence at a sentence's end.
  send(samples) {
    return this.queue((bulk) => {
      let some = samples;
      if (bulk && samples.length < PACKET) {
        some = new Int16Array(PACKET);
        some.set(samples);
      }
      const before = { ...this.state };
      const { bytes, state } = encodeSamples(AudioCodec.ImaAdpcm, some, this.state);
      this.state = state;
      return { before, bytes, count: some.length };
    });
  }
  // One block already in ADPCM with its own starting state (a friend's voice clip), paced the same.
  sendBlock(block) {
    return this.queue(() => ({ before: block.state, bytes: block.payload, count: block.count }));
  }
  queue(make) {
    this.waiting++;
    const go = async () => {
      this.waiting--;
      if (!this.live()) return false;
      this.catchUp();
      if (this.bulk()) return this.later(make(true));
      if (this.batch.length && !(await this.flushNow())) return false; // back in front: what waits goes first
      const wait = Math.max(this.lastAt + GAP_MS - now(), this.ahead() - AHEAD_MS);
      const due = now() + Math.max(0, wait);
      if (wait > 0) await sleep(wait);
      if (!this.live()) return false;
      const late = now() - due;
      if (late > this.seen.late) this.seen.late = late;
      const { before, bytes, count } = make(false);
      const writing = now();
      await this.speaker.write(packet(Kind.Audio, this.sequence++, before, bytes, count));
      this.lastAt = now();
      if (this.lastAt - writing > this.seen.write) this.seen.write = this.lastAt - writing;
      this.seen.packets++;
      this.sentMs += (count / PACKET) * PACKET_MS;
      if (!this.playAt && this.sentMs >= START_MS) this.playAt = this.lastAt + LINK_MS;
      return true;
    };
    return this.chain(go);
  }
  chain(go) {
    const sent = this.lock.then(go);
    this.lock = sent.catch(() => false);
    return sent;
  }

  // In the background: the packet waits in the batch, which goes when it is full, or sooner when
  // the board is about to run low and no more packets are queued. A short one (a clip's last block)
  // goes after the batch, alone.
  async later({ before, bytes, count }) {
    const made = packet(Kind.Audio, this.sequence++, before, bytes, count);
    if (count < PACKET) {
      if (!(await this.flushNow())) return false;
      this.batch.push(made);
      return this.flushNow();
    }
    this.batch.push(made);
    const low = !this.playAt || this.ahead() < BULK_LOW;
    if (this.batch.length < BATCH && !(low && this.batch.length >= BATCH_LOW && !this.waiting)) return true;
    return this.flushNow();
  }
  // Whatever is in the batch goes now (in order with the packets before it).
  flush() {
    return this.chain(() => this.flushNow());
  }
  async flushNow() {
    while (this.batch.length) {
      if (!this.live()) {
        this.batch = [];
        return false;
      }
      this.catchUp();
      const n = Math.min(this.batch.length, BATCH);
      // the board holds plenty: wait until this batch fits under BULK_HIGH (late only eats margin)
      const wait = this.playAt ? this.ahead() + n * PACKET_MS - BULK_HIGH : 0;
      if (wait > 0) {
        const due = now() + wait;
        await sleep(wait);
        if (now() - due > this.seen.late) this.seen.late = now() - due;
        continue;
      }
      const list = this.batch.splice(0, n);
      const writing = now();
      for (const made of list) {
        this.sentMs += ((made[6] | (made[7] << 8)) / PACKET) * PACKET_MS; // its sample count
        if (!this.playAt && this.sentMs >= START_MS) this.playAt = writing + LINK_MS;
      }
      await this.speaker.writeMany(list); // back once the board has the last one
      this.lastAt = now();
      if (this.lastAt - writing > this.seen.write) this.seen.write = this.lastAt - writing;
      this.seen.packets += list.length;
      this.seen.batches++;
    }
    return true;
  }

  // Between sentences: silence keeps the board playing (and its clock true) for up to FILL_MS.
  // In the background, where this wakes late, it tops the board up to BULK_FILL at once.
  async fill() {
    while (this.open && this.live()) {
      await sleep(PACKET_MS);
      const bulk = this.bulk();
      if (this.streams || !this.open || !this.playAt || this.ahead() >= (bulk ? BULK_FILL : LOW_MS) || this.filled >= FILL_MS) continue;
      const add = bulk ? Math.ceil((BULK_FILL - Math.max(0, this.ahead())) / PACKET_MS) : 1;
      for (let i = 0; i < add; i++) {
        this.filled += PACKET_MS;
        void this.send(SILENCE).catch(() => {});
      }
      if (bulk) await this.flush().catch(() => {});
      else await this.lock;
    }
  }

  // Plays one 24 kHz PCM stream (a fetch body). Resolves once it is all sent to the board.
  async play(body) {
    if (!this.live()) return;
    if (this.open && this.catchUp()) this.lead(); // the board stopped while it waited: on again
    this.begin();
    this.streams++;
    this.filled = 0;
    const reader = body.getReader();
    let input = new Float32Array(TAPS); // starts with silence before the first sample
    let at = TAPS; // where the next output sample sits, in input samples
    let carry = null; // a byte split across two chunks
    const out = new Int16Array(PACKET);
    let n = 0;
    const held = []; // the reply's first words, until HOLD_MS of them are here
    const asked = now();
    let first = 0; // when the first audio arrived
    let heard = 0; // samples of it so far
    try {
      for (;;) {
        const asking = now();
        const { done, value } = await reader.read();
        this.seen.reading += now() - asking;
        if (!this.live()) return;
        if (done) break;
        // how far the voice server's stream fell behind real time
        if (!first) {
          first = now();
          if (first - asked > this.seen.wait) this.seen.wait = first - asked;
        }
        heard += value.length / 2;
        const behind = now() - first - (heard / IN_RATE) * 1000;
        if (behind > this.seen.behind) this.seen.behind = behind;
        let bytes = value;
        if (carry) {
          const joined = new Uint8Array(carry.length + bytes.length);
          joined.set(carry);
          joined.set(bytes, carry.length);
          bytes = joined;
          carry = null;
        }
        if (bytes.length & 1) {
          carry = bytes.slice(-1);
          bytes = bytes.subarray(0, bytes.length - 1);
        }
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const fresh = new Float32Array(input.length + bytes.length / 2);
        fresh.set(input);
        for (let i = 0; i < bytes.length / 2; i++) fresh[input.length + i] = view.getInt16(i * 2, true);
        input = fresh;
        while (at + TAPS < input.length) {
          const i = Math.floor(at);
          const kernel = KERNELS[at - i ? 1 : 0];
          let y = 0;
          for (let k = 0; k < kernel.length; k++) y += input[i - TAPS + 1 + k] * kernel[k];
          out[n++] = this.level(y);
          at += IN_RATE / OUT_RATE;
          if (n === PACKET) {
            n = 0;
            if (!(await this.sendSpeech(out.slice(), held))) return;
          }
        }
        // drop what is behind us, keeping what the filter still reads
        const keep = Math.floor(at) - TAPS;
        if (keep > 0) {
          input = input.slice(keep);
          at -= keep;
        }
      }
      if (n && !(await this.sendSpeech(out.slice(0, n), held))) return;
      if (held.length && !(await this.release(held))) return;
      if (!(await this.flush())) return; // the end of the sentence goes now, whatever comes next
    } finally {
      this.streams--;
      reader.cancel().catch(() => {}); // a no-op once the stream has ended
    }
  }

  // Plays a friend's voice clip (clip.mjs blocks: 16 kHz ADPCM already, so it goes as it is).
  // Resolves once it is all sent to the board.
  async playClip(blocks) {
    if (!this.live()) return;
    if (this.open && this.catchUp()) this.lead();
    this.begin();
    this.streams++;
    this.filled = 0;
    try {
      for (const block of blocks) if (!(await this.sendBlock(block))) return;
    } finally {
      this.streams--;
    }
  }

  // One sample, louder: the gain falls at once for a peak and recovers slowly (see GAIN_MAX).
  level(x) {
    const a = Math.abs(x);
    if (a * this.gain > CEILING) this.gain = Math.max(0.5, CEILING / a);
    else this.gain += (GAIN_MAX - this.gain) * RELEASE;
    return soft(x * this.gain);
  }
  // Speech goes out at once, except a reply's first words, which wait until HOLD_MS are here.
  async sendSpeech(samples, held) {
    if (this.started) return this.pace(this.send(samples));
    held.push(samples);
    if (held.reduce((ms, s) => ms + (s.length / PACKET) * PACKET_MS, 0) < HOLD_MS) return true;
    return this.release(held);
  }
  async release(held) {
    this.started = true;
    while (held.length) if (!(await this.pace(this.send(held.shift())))) return false;
    return true;
  }
  // In the background, a sentence's packets queue up without waiting for each other, up to a batch,
  // so a batch takes all that's ready. Waiting for each, a batch went with 4 packets (80 ms) per
  // answer from the board, slower than Bud speaks when an answer took over 80 ms: on 2026-10-28,
  // with the phone locked, Bud's speaker ran dry for 613 ms of a 7 s reply.
  pace(sent) {
    if (!this.bulk() || this.waiting >= BATCH) return sent;
    sent.catch(() => {}); // a write that failed fails the next one too, and that one is waited for
    return this.live();
  }

  // How the utterance went, in a few words (ms): the longest a packet went out late, a write took,
  // the voice took to start a sentence and its stream fell behind real time, and how long in all
  // Bud's speaker ran dry as far as the timing shows.
  stats() {
    const s = this.seen;
    if (!s) return '';
    const r = (v) => Math.max(0, Math.round(v));
    return `packets=${s.packets} late=${r(s.late)} write=${r(s.write)} wait=${r(s.wait)} behind=${r(s.behind)} dry=${r(s.dry)} ms=${r(now() - s.at)} batches=${s.batches} reading=${r(s.reading)}`;
  }

  // The utterance is over: silence to finish on, then the board plays the rest and stops.
  // Resolves about when Bud has finished saying it.
  async end() {
    if (!this.open) return;
    for (let ms = 0; ms < TRAIL_MS; ms += PACKET_MS) await this.send(SILENCE);
    await this.flush();
    this.open = false;
    if (!this.live()) return;
    await this.lock;
    await this.speaker.write(packet(Kind.End, this.sequence++));
    if (!this.playAt) this.playAt = now(); // a short one starts on the end
    const left = this.playAt + this.sentMs + TAIL_MS - now();
    if (left > 0) await sleep(left);
  }
}
