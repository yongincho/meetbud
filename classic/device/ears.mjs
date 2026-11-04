// Bud's always-on ears: one long recording from Bud's microphone, cut into phrases at the pauses
// between them, so each phrase can be turned into text on its own. A phrase starts a little before
// the first loud frame (so its first word is whole) and ends after a pause, or after 15 s (at the
// softest moment near the end, so no word is cut in two). evenOut() readies a phrase for a speech
// recognizer.
import { AudioKind, decode, decodeSamples } from './protocol/audio.mjs';

const PREROLL_MS = 300; // kept from before the first loud frame
const LONG_PREROLL_MS = 500; // taking notes: a soft voice's first syllable rises slowly
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
// Taking notes, nobody needs Bud to answer, and a voice missed is a line missing from the meeting,
// while a stretch of noise only comes back with no words. So speech is a softer sound there: from
// 55 (240 for "Hey Bud"), or 1.6 times the hum. Someone across the room talking softly measured under
// 300 on Bud's mic, and Bud's notes missed most of a meeting (2026-10-30). On the aluminum 1.75C a
// quiet room is 15 to 50 and Jason's softer words 50 to 120, which a line at 120 still missed
// (2026-10-31). (Those lines were tuned with the hum at nothing, SILENT: in Jason's room, about 35,
// 1.6 times it is the same 55.)
const LONG_LEAST = 55;
const LONG_QUIET_LEAST = 40;
const LONG_TIMES = 1.6;
// The room's hum is never this quiet: Bud's mic as a recording starts. Its first 100 ms are zeros
// (measured on Jason's 1.75C, 2026-10-31), and the hum, the quietest moment so far, then stayed at
// nothing for the whole recording, so Bud's lines were only ever a quiet room's (240 and 200; 55 and
// 40 taking notes). Outside, where the street is louder than that, every bit of it was speech and
// none of it a pause: phrases ran to their 15 s, and "Hey Bud" was lost in them. On the aluminum
// 1.75C a quiet room is 15 to 50.
const SILENT = 8;
const SETTLE_MS = 100; // of a recording's start, not the room's hum either
// A new recording starts from the hum of the one before (`hum`), so what's said as it starts (an
// answer to Bud's question) is heard at once. If the room is louder than that now (out of the door),
// its first second says so: the hum is the quietest of that second.
const KNOW_MS = 1000;
// Wind on Bud's mic is a rumble, almost all of it under 200 Hz, where a voice has little of itself.
// A frame that is mostly that (RUMBLE_SHARE of its sound) is measured by what is over it, and a gust
// hisses there too, so speech in it is GUST_TIMES as loud: a gust is no speech, and a voice in the
// wind still is (Jason, 2026-10-31: outside, Bud took the wind for talk). Seven Mac voices, the
// deepest too, in a quiet room came out exactly as before; a lower share caught more wind but
// changed how their deep syllables were heard.
const RUMBLE_HZ = 200;
const RUMBLE_SHARE = 0.9;
const GUST_TIMES = 2;
// Held less than this, the talk button (or the screen, always listening) was a tap, not talk: "listen",
// not something said (the firmware's kTalkClickMs).
const HELD_LEAST_MS = 300;
// A phrase under way when the talk button is pressed into the recording is kept as the start of
// what's held if it began this recently (you started as you pressed); longer, it was the room's.
const HOLD_KEEP_MS = 1500;

export class BudEars {
  // identity: { session, request } of the recording; onPhrase(samples: Int16Array, rateHz, heard);
  // onSpeech(on), optional: true when a phrase starts, false when it ends (heard or not).
  // `held`: the talk button is holding this recording open (walkie-talkie; always listening, hold()).
  // Everything said while it's held is for Bud, so all of it is one phrase, from the first frame to
  // the end (or 20 s at a time), however softly it was said: on the aluminum 1.75C a voice is often
  // under the 240 that "Hey Bud" listening needs, and a held recording's words were dropped as no
  // speech (2026-10-31).
  // `hum`: the room's hum in Bud's recording before this one (0: none), as this one's to start with.
  constructor({ session, request, onPhrase, onSpeech = () => {}, long = false, rollover = true, held = false, hum = 0 }) {
    this.session = session;
    this.long = long; // may change while it listens
    this.held = held;
    this.heldMs = 0; // audio since it was held
    this.rollover = rollover; // only old peers need a shorter pause before switching recordings
    this.request = request;
    this.recording = 0;
    this.ended = false;
    this.onPhrase = onPhrase;
    this.onSpeech = onSpeech;
    this.rate = 16000;
    this.floor = hum > SILENT ? hum : Infinity;
    this.heardMs = 0; // of the room (not SILENT, after SETTLE_MS)
    this.firstLow = Infinity; // the quietest of the room's first second
    this.recordedMs = 0;
    this.rumble = null; // the filters' state (RUMBLE_HZ)
    this.gust = false; // the last frame was mostly rumble
    this.pre = []; // recent quiet frames, newest last
    this.preMs = 0;
    this.phrase = null; // { frames: [], ms, pre (of ms, the quiet before it), speechMs, quietMs }
    this.sequence = 0;
  }

  // One audio packet from Bud. Returns false for a packet that is not this recording's.
  accept(bytes) {
    if (this.ended) return false;
    let packet;
    try { packet = decode(bytes); } catch { return false; }
    if (packet.session !== this.session || packet.request !== this.request) return false;
    if (this.recording && packet.recording !== this.recording) return false;
    this.recording = packet.recording;
    if (packet.kind !== AudioKind.Data) {
      this.ended = true;
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

  // Always listening, the talk button pressed into this recording: from here it's held. A phrase
  // begun just before goes on into the held one (HOLD_KEEP_MS); otherwise it starts with the moment
  // before the press, for a first syllable said as the button went down. `sinceMs` (walkie-talkie, a
  // press into the notes recording, which Bud tells only once it's held past a click): a phrase whose
  // speech began at most this long ago is the press's first words, kept; one begun before is the
  // meeting's, for the notes.
  hold(sinceMs = null) {
    if (this.held) return;
    const p = this.phrase;
    if (p && (sinceMs === null ? p.ms > HOLD_KEEP_MS : p.ms - p.pre > sinceMs)) this.flush(); // the room's, from before the press
    this.held = true;
    this.heldMs = 0;
  }
  // Walkie-talkie, the talk button let go of the notes recording it was pressed into: what was held
  // ends as its phrase (or, `keep` false, a "not now", goes unheard), and the recording goes on as
  // before (phrases at its pauses, for the notes).
  release(keep = true) {
    if (!this.held) return;
    if (keep) this.flush();
    else if (this.phrase) {
      this.phrase = null;
      this.onSpeech(false);
    }
    this.held = false;
  }

  frame(samples) {
    const ms = (samples.length / this.rate) * 1000;
    this.recordedMs += ms;
    if (this.held) this.heldMs += ms;
    const level = this.levelOf(samples);
    const gust = this.gust;
    // the same measure as a tapped recording's end (app.js speechEnd): the room's hum is the
    // quietest moment so far, drifting up slowly; speech is four times it, a pause about twice.
    // On Bud's mic a quiet room measured about 50 RMS and talking across a table 430 to 1050; a
    // soft "Hey Bud" from across the room can be under 300, so speech starts at 240.
    if (level > SILENT && this.recordedMs > SETTLE_MS) {
      this.floor = Math.min(level, this.floor * 1.002);
      if (this.heardMs < KNOW_MS) {
        this.firstLow = Math.min(this.firstLow, level);
        if (this.heardMs + ms >= KNOW_MS && this.firstLow > this.floor) this.floor = this.firstLow;
      }
      this.heardMs += ms;
    }
    const loud = this.held || this.loud(gust ? level / GUST_TIMES : level);
    const quiet = level <= (this.long ? Math.max(LONG_QUIET_LEAST, Math.min(this.floor * 1.8, this.speechLine() * 0.8))
      : Math.max(200, Math.min(this.floor * 2.2, this.speechLine() * 0.8)));
    if (!this.phrase) {
      if (!loud) {
        this.pre.push(samples);
        this.preMs += ms;
        while (this.preMs - (this.pre[0].length / this.rate) * 1000 >= (this.long ? LONG_PREROLL_MS : PREROLL_MS)) {
          this.preMs -= (this.pre.shift().length / this.rate) * 1000;
        }
        return;
      }
      this.phrase = { frames: this.pre, ms: this.preMs, pre: this.preMs, speechMs: 0, quietMs: 0, tail: 0 };
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
    const pause = this.long ? (this.rollover && this.recordedMs >= LONG_SWITCH_MS ? PAUSE_MS : LONG_PAUSE_MS)
      : p.speechMs <= SHORT_SPEECH_MS ? SHORT_PAUSE_MS : PAUSE_MS;
    if (p.quietMs >= pause) this.flush();
    else if (p.ms >= (this.long || this.held ? LONG_MS : LONGEST_MS)) this.cut();
  }
  loud(level) {
    return level > this.speechLine();
  }
  // How loud a frame is: its RMS, or, when it's mostly rumble (RUMBLE_HZ), the RMS of what's over it.
  levelOf(samples) {
    if (this.rumble?.rate !== this.rate) this.rumble = rumbleFilter(this.rate);
    const f = this.rumble;
    let all = 0, low = 0, high = 0;
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      all += x * x;
      // without its DC (a 20 Hz high-pass), then under and over RUMBLE_HZ (Butterworth filters)
      const d = x - f.x + f.r * f.d;
      f.x = x;
      f.d = d;
      const l = f.low.b0 * d + f.low.b1 * f.d1 + f.low.b0 * f.d2 - f.a1 * f.l1 - f.a2 * f.l2;
      const h = f.high.b0 * d + f.high.b1 * f.d1 + f.high.b0 * f.d2 - f.a1 * f.h1 - f.a2 * f.h2;
      f.d2 = f.d1; f.d1 = d; f.l2 = f.l1; f.l1 = l; f.h2 = f.h1; f.h1 = h;
      low += l * l;
      high += h * h;
    }
    const n = samples.length || 1;
    this.gust = low > RUMBLE_SHARE * (low + high);
    return Math.sqrt((this.gust ? high : all) / n);
  }
  speechLine() {
    if (this.long) return Math.max(LONG_LEAST, this.floor * LONG_TIMES);
    const noisy = Math.min(1, Math.max(0, (this.floor - QUIET_HUM) / (NOISY_HUM - QUIET_HUM)));
    return Math.max(240, this.floor * (QUIET_TIMES - (QUIET_TIMES - NOISY_TIMES) * noisy));
  }
  // The room's hum, for the next recording's `hum` (0: not heard yet).
  get hum() {
    return Number.isFinite(this.floor) ? Math.round(this.floor) : 0;
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
    this.phrase = { frames: rest, ms: rest.reduce((n, f) => n + ms(f), 0), pre: 0, speechMs, quietMs: 0, tail: rest.length, carried: speechMs > 0 };
    this.onSpeech(true);
  }

  // Ends the phrase in progress, if any (the recording is ending).
  flush() {
    const p = this.phrase;
    this.phrase = null;
    if (!p) return;
    this.onSpeech(false);
    if (p.speechMs < MIN_SPEECH_MS && !p.carried) return;
    if (this.held && this.heldMs < HELD_LEAST_MS) return; // a tap
    const frames = p.quietMs > TAIL_MS ? p.frames.slice(0, p.tail) : p.frames;
    const all = new Int16Array(frames.reduce((n, f) => n + f.length, 0));
    let at = 0;
    for (const f of frames) {
      all.set(f, at);
      at += f.length;
    }
    // what Bud's ears made of it, for the session: how much was speech, whether it ran to its longest
    // (no pause to end it), the room's hum, and whether the talk button held it (all of it for Bud)
    this.onPhrase(all, this.rate, { speechMs: Math.round(p.speechMs), capped: !!p.capped, hum: Math.round(this.floor), held: this.held });
  }

  // Between phrases: a moment to end the recording and start a new one without cutting a word.
  get between() { return !this.phrase; }
  // Time to end this recording and start the next (see SWITCH_MS).
  get due() {
    return this.recordedMs >= LAST_MS || (!this.phrase && this.recordedMs >= (this.long ? LONG_SWITCH_MS : SWITCH_MS));
  }
}

// A phrase as a speech recognizer hears best: the rumble under about 100 Hz taken out (a desk, a
// fan), and the speech brought up to an even level, at most ten times, with peaks rounded off under
// full scale. Bud's mic hears a voice across a table at a fiftieth of full scale or less, and a
// recognizer reading a file gets no level control of its own. The level is the loudest third of
// its 20 ms frames, so the pauses in it don't count.
const EVEN_LEVEL = 3000;
const EVEN_MOST = 10;
const EVEN_KNEE = 0.7 * 32767;
export function evenOut(samples, rateHz) {
  const a = Math.exp((-2 * Math.PI * 100) / rateHz);
  const out = new Float32Array(samples.length);
  let px = 0, py = 0;
  for (let i = 0; i < samples.length; i++) {
    py = a * (py + samples[i] - px);
    px = samples[i];
    out[i] = py;
  }
  const step = Math.max(1, Math.round(rateHz / 50));
  const powers = [];
  for (let i = 0; i + step <= out.length; i += step) {
    let sum = 0;
    for (let k = i; k < i + step; k++) sum += out[k] * out[k];
    powers.push(sum / step);
  }
  powers.sort((x, y) => y - x);
  const top = powers.slice(0, Math.max(1, Math.ceil(powers.length / 3)));
  const level = Math.sqrt(top.reduce((n, p) => n + p, 0) / top.length) || 1;
  const gain = Math.min(EVEN_MOST, Math.max(1, EVEN_LEVEL / level));
  return Int16Array.from(out, (v) => {
    const x = v * gain;
    const m = Math.abs(x);
    if (m <= EVEN_KNEE) return Math.round(x);
    return Math.sign(x) * Math.round(EVEN_KNEE + (32767 - EVEN_KNEE) * Math.tanh((m - EVEN_KNEE) / (32767 - EVEN_KNEE)));
  });
}

// RUMBLE_HZ's filters for a rate: a DC blocker at 20 Hz, then second-order Butterworth low- and
// high-passes (the same poles, so one pair of feedback terms).
function rumbleFilter(rate) {
  const w = (2 * Math.PI * RUMBLE_HZ) / rate, alpha = Math.sin(w) / Math.SQRT2, cos = Math.cos(w), a0 = 1 + alpha;
  return {
    rate, r: Math.exp((-2 * Math.PI * 20) / rate), x: 0, d: 0, d1: 0, d2: 0, l1: 0, l2: 0, h1: 0, h2: 0,
    low: { b0: (1 - cos) / 2 / a0, b1: (1 - cos) / a0 }, high: { b0: (1 + cos) / 2 / a0, b1: -(1 + cos) / a0 },
    a1: (-2 * cos) / a0, a2: (1 - alpha) / a0,
  };
}

function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}
