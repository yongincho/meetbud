// Bud's always-on ears: one long recording from Bud's microphone, cut into phrases at the pauses
// between them, so each phrase can be turned into text on its own. A phrase starts a little before
// the first loud frame (so its first word is whole) and ends after a pause, or after 15 s (at the
// softest moment near the end, so no word is cut in two).
import { AudioKind, decode, decodeSamples } from './protocol/audio.mjs';

const PREROLL_MS = 300; // kept from before the first loud frame
const PAUSE_MS = 900; // quiet after speech that ends a phrase
// A short one ("Hey Bud" on its own) ends sooner, so Bud shows it's listening sooner. If more words
// follow after that pause, they're the next phrase, and Bud gathers a request from several.
const SHORT_SPEECH_MS = 1200;
const SHORT_PAUSE_MS = 450;
const TAIL_MS = 250; // of that quiet kept at the end
const MIN_SPEECH_MS = 150; // less loud audio than this is a cough or a knock, not a phrase (a quick "Hey Bud" is more)
const LONGEST_MS = 15000;
// Taking notes (`long`): Bud's name needs no quick answer, so a phrase goes on through the short pauses
// inside a sentence and ends at a longer one, or after 20 s: whole sentences, each written down with
// what's around it, not fragments.
const LONG_PAUSE_MS = 1200;
const LONG_MS = 20000;
// A phrase that runs to its longest is cut at the softest moment of its last stretch, most likely
// between two words, and what comes after starts the next phrase.
const CUT_LOOK_MS = 1500;
// A recording lasts under a minute (Bud's limit): the next one starts between phrases after 45 s, or
// at 55 s whatever is said. Taking notes, from 40 s on a phrase ends at a pause between sentences
// (PAUSE_MS, not 1.2 s), so the switch most likely comes in a pause, not in the middle of a sentence.
const SWITCH_MS = 45000;
const LONG_SWITCH_MS = 40000;
const LAST_MS = 55000;
// Speech is four times the room's hum in a quiet room. In a noisy one (a cafe, a street) the hum is
// high and a voice close by is not four times it, so Bud barely heard Jason there (2026-10-30): the
// line eases to two and a half times the hum as the hum goes from QUIET_HUM to NOISY_HUM.
const QUIET_HUM = 100, NOISY_HUM = 300;
const QUIET_TIMES = 4, NOISY_TIMES = 2.5;

export class BudEars {
  // identity: { session, request } of the recording; onPhrase(samples: Int16Array, rateHz, heard);
  // onSpeech(on), optional: true when a phrase starts, false when it ends (heard or not).
  constructor({ session, request, onPhrase, onSpeech = () => {}, long = false }) {
    this.session = session;
    this.long = long; // may change while it listens
    this.request = request;
    this.recording = 0;
    this.onPhrase = onPhrase;
    this.onSpeech = onSpeech;
    this.rate = 16000;
    this.floor = Infinity;
    this.recordedMs = 0;
    this.pre = []; // recent quiet frames, newest last
    this.preMs = 0;
    this.phrase = null; // { frames: [], ms, speechMs, quietMs }
    this.sequence = 0;
  }

  // One audio packet from Bud. Returns false for a packet that is not this recording's.
  accept(bytes) {
    let packet;
    try { packet = decode(bytes); } catch { return false; }
    if (packet.session !== this.session || packet.request !== this.request) return false;
    if (this.recording && packet.recording !== this.recording) return false;
    this.recording = packet.recording;
    if (packet.kind !== AudioKind.Data) {
      this.flush();
      return true;
    }
    if (packet.sequence <= this.sequence) return true; // a repeat
    this.sequence = packet.sequence;
    this.rate = packet.rateKhz * 1000;
    const { samples } = decodeSamples(packet.codec, packet.payload, packet.sampleCount,
      { predictor: packet.predictor, stepIndex: packet.stepIndex });
    this.frame(samples);
    return true;
  }

  frame(samples) {
    const ms = (samples.length / this.rate) * 1000;
    this.recordedMs += ms;
    const level = rms(samples);
    // the same measure as a tapped recording's end (app.js speechEnd): the room's hum is the
    // quietest moment so far, drifting up slowly; speech is four times it, a pause about twice.
    // On Bud's mic a quiet room measured about 50 RMS and talking across a table 430 to 1050; a
    // soft "Hey Bud" from across the room can be under 300, so speech starts at 240.
    this.floor = Math.min(level, this.floor * 1.002);
    const loud = this.loud(level);
    const quiet = level <= Math.max(200, Math.min(this.floor * 2.2, this.speechLine() * 0.8));
    if (!this.phrase) {
      if (!loud) {
        this.pre.push(samples);
        this.preMs += ms;
        while (this.preMs - (this.pre[0].length / this.rate) * 1000 >= PREROLL_MS) {
          this.preMs -= (this.pre.shift().length / this.rate) * 1000;
        }
        return;
      }
      this.phrase = { frames: this.pre, ms: this.preMs, speechMs: 0, quietMs: 0, tail: 0 };
      this.pre = [];
      this.preMs = 0;
      this.onSpeech(true);
    }
    const p = this.phrase;
    p.frames.push(samples);
    p.ms += ms;
    if (loud) p.speechMs += ms;
    // Sound between a pause and speech (a clink, voices further off) neither counts as the pause nor
    // ends it: until 2026-10-30 any of it started the pause over, so in a noisy room a phrase ran to its
    // longest (15 s) and Bud answered late or missed its name in the noise.
    p.quietMs = loud ? 0 : quiet ? p.quietMs + ms : p.quietMs;
    if (p.quietMs <= TAIL_MS) p.tail = p.frames.length;
    const pause = this.long ? (this.recordedMs >= LONG_SWITCH_MS ? PAUSE_MS : LONG_PAUSE_MS)
      : p.speechMs <= SHORT_SPEECH_MS ? SHORT_PAUSE_MS : PAUSE_MS;
    if (p.quietMs >= pause) this.flush();
    else if (p.ms >= (this.long ? LONG_MS : LONGEST_MS)) this.cut();
  }
  loud(level) {
    return level > this.speechLine();
  }
  speechLine() {
    const noisy = Math.min(1, Math.max(0, (this.floor - QUIET_HUM) / (NOISY_HUM - QUIET_HUM)));
    return Math.max(240, this.floor * (QUIET_TIMES - (QUIET_TIMES - NOISY_TIMES) * noisy));
  }

  // A phrase at its longest, still being said: it ends at the softest moment of its last stretch, and
  // the rest starts the next phrase. (Steady sound has no softer moment: it ends where it is.)
  cut() {
    const p = this.phrase;
    let at = p.frames.length - 1;
    let low = Infinity;
    for (let i = p.frames.length - 1, ms = 0; i > 0 && ms < CUT_LOOK_MS; i--) {
      const level = rms(p.frames[i]);
      if (level < low) {
        low = level;
        at = i;
      }
      ms += (p.frames[i].length / this.rate) * 1000;
    }
    const rest = p.frames.splice(at + 1);
    p.quietMs = 0; // all of it is the phrase
    p.capped = true;
    this.flush();
    if (!rest.length) return;
    const ms = (f) => (f.length / this.rate) * 1000;
    const speechMs = rest.reduce((n, f) => n + (this.loud(rms(f)) ? ms(f) : 0), 0);
    // `carried`: the end of something being said, kept even if it's short (the last syllable of a word)
    this.phrase = { frames: rest, ms: rest.reduce((n, f) => n + ms(f), 0), speechMs, quietMs: 0, tail: rest.length, carried: speechMs > 0 };
    this.onSpeech(true);
  }

  // Ends the phrase in progress, if any (the recording is ending).
  flush() {
    const p = this.phrase;
    this.phrase = null;
    if (!p) return;
    this.onSpeech(false);
    if (p.speechMs < MIN_SPEECH_MS && !p.carried) return;
    const frames = p.quietMs > TAIL_MS ? p.frames.slice(0, p.tail) : p.frames;
    const all = new Int16Array(frames.reduce((n, f) => n + f.length, 0));
    let at = 0;
    for (const f of frames) {
      all.set(f, at);
      at += f.length;
    }
    // what Bud's ears made of it, for the session: how much was speech, whether it ran to its longest
    // (no pause to end it), and the room's hum
    this.onPhrase(all, this.rate, { speechMs: Math.round(p.speechMs), capped: !!p.capped, hum: Math.round(this.floor) });
  }

  // Between phrases: a moment to end the recording and start a new one without cutting a word.
  get between() { return !this.phrase; }
  // Time to end this recording and start the next (see SWITCH_MS).
  get due() {
    return this.recordedMs >= LAST_MS || (!this.phrase && this.recordedMs >= (this.long ? LONG_SWITCH_MS : SWITCH_MS));
  }
}

function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}
