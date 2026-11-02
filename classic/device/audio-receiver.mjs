import { AudioChannel, AudioCodec, AudioKind, AudioLimits, decode, decodeSamples } from './protocol/audio.mjs';

const MAX_SECONDS = 60;
const DEFAULT_TERMINAL_TIMEOUT_MS = 2000;
const MAX_GENERATION = Number.MAX_SAFE_INTEGER;

const positiveU32 = value => Number.isInteger(value) && value >= 1 && value <= 0xffffffff;
const sameBytes = (a, b) => a?.length === b.length && a.every((value, i) => value === b[i]);
const sameIdentity = (a, b) => a.session === b.session && a.request === b.request && a.recording === b.recording;
const laterIdentity = (a, b) => a.session > b.session ||
  (a.session === b.session && (a.request > b.request ||
    (a.request === b.request && a.recording > b.recording)));

/** One bounded, single-owner Bud recording. Callbacks must supply their captured local generation. */
export class BudAudioReceiver {
  #transcribe;
  #onTranscript;
  #onError;
  #onSamples;
  #clock;
  #timers;
  #terminalTimeoutMs;
  #highestGeneration = 0;
  #lastIdentity = null;
  #epoch = 0;
  #identity = null;
  #format = null;
  #samples = null;
  #abort = null;
  #terminalTimer = null;
  #terminalDeadline = 0;
  #phase = 'Idle';
  #lastError = null;
  #sequence = 0;
  #nextSample = 0;
  #receivedPackets = 0;
  #receivedSamples = 0;
  #duplicatePackets = 0;
  #missingPackets = 0;
  #missingSamples = 0;
  #droppedPackets = 0;
  #lastData = null;
  #lastEnd = null;
  #endSeen = false;
  #stoppedSeen = false;

  constructor({ transcribe, onTranscript = () => {}, onError = () => {}, onSamples = () => {},
    clock = () => Date.now(), timers = globalThis,
    terminalTimeoutMs = DEFAULT_TERMINAL_TIMEOUT_MS } = {}) {
    if (![transcribe, onTranscript, onError, onSamples, clock].every(fn => typeof fn === 'function') ||
        typeof timers?.setTimeout !== 'function' || typeof timers?.clearTimeout !== 'function' ||
        !Number.isInteger(terminalTimeoutMs) || terminalTimeoutMs < 1 || terminalTimeoutMs > 0x7fffffff) {
      throw new TypeError('BudAudioReceiver needs callbacks and a bounded terminal timeout.');
    }
    this.#transcribe = transcribe;
    this.#onTranscript = onTranscript;
    this.#onError = onError;
    this.#onSamples = onSamples;
    this.#clock = clock;
    this.#timers = timers;
    this.#terminalTimeoutMs = terminalTimeoutMs;
  }

  snapshot() {
    return { phase: this.#phase, identity: this.#identity && { ...this.#identity },
      format: this.#format && { ...this.#format }, sequence: this.#sequence,
      nextSample: this.#nextSample, receivedPackets: this.#receivedPackets,
      receivedSamples: this.#receivedSamples, duplicatePackets: this.#duplicatePackets,
      missingPackets: this.#missingPackets, missingSamples: this.#missingSamples,
      droppedPackets: this.#droppedPackets, endSeen: this.#endSeen,
      stoppedSeen: this.#stoppedSeen, lastError: this.#lastError };
  }

  #clear() {
    if (this.#terminalTimer !== null) this.#timers.clearTimeout(this.#terminalTimer);
    this.#terminalTimer = null;
    this.#terminalDeadline = 0;
    this.#abort?.abort();
    this.#abort = null;
    this.#samples = this.#lastData = this.#lastEnd = null;
  }

  begin({ session, request, recording, codec, rateKhz, channel, generation }) {
    const next = { session, request, recording, generation };
    if (![session, request, recording].every(positiveU32) ||
        !Number.isSafeInteger(generation) || generation < 1 || generation < this.#highestGeneration ||
        generation > MAX_GENERATION ||
        (generation === this.#highestGeneration && this.#lastIdentity &&
          !laterIdentity(next, this.#lastIdentity)) ||
        !Object.values(AudioCodec).includes(codec) || ![8, 16].includes(rateKhz) ||
        !Object.values(AudioChannel).includes(channel)) {
      throw new RangeError('Invalid or reused Bud audio identity or format.');
    }
    this.#epoch++;
    this.#clear();
    this.#highestGeneration = generation;
    this.#lastIdentity = this.#identity = next;
    this.#format = { codec, rateKhz, channel };
    this.#samples = new Int16Array(rateKhz * 1000 * MAX_SECONDS);
    this.#abort = new AbortController();
    this.#phase = 'Receiving';
    this.#lastError = null;
    this.#sequence = this.#nextSample = this.#receivedPackets = this.#receivedSamples = 0;
    this.#duplicatePackets = this.#missingPackets = this.#missingSamples = this.#droppedPackets = 0;
    this.#endSeen = this.#stoppedSeen = false;
    return this.snapshot();
  }

  #current(generation) {
    return this.#identity && generation === this.#identity.generation;
  }
  #now() {
    const now = this.#clock();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid Bud audio clock.');
    return now;
  }
  #fail(reason) {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    error.identity = this.#identity && { ...this.#identity };
    this.#lastError = error.message;
    this.#phase = 'Fault';
    this.#epoch++;
    this.#clear();
    this.#onError(error);
    return 'Rejected';
  }
  cancel(reason = 'Bud audio cancelled.') {
    if (!this.#identity || !['Receiving', 'Waiting', 'Transcribing'].includes(this.#phase)) return false;
    this.#epoch++;
    this.#clear();
    this.#phase = 'Cancelled';
    this.#lastError = String(reason);
    return true;
  }

  #armTerminal() {
    if (this.#terminalTimer !== null || this.#phase === 'Transcribing' || this.#phase === 'Done') return;
    const generation = this.#identity.generation;
    const epoch = this.#epoch;
    this.#terminalDeadline ||= this.#now() + this.#terminalTimeoutMs;
    const check = () => {
      this.#terminalTimer = null;
      if (!this.#current(generation) || epoch !== this.#epoch || this.#phase !== 'Waiting') return;
      const remaining = this.#terminalDeadline - this.#now();
      if (remaining > 0) this.#terminalTimer = this.#timers.setTimeout(check, remaining);
      else this.#fail('Bud audio terminal marker was missing.');
    };
    this.#terminalTimer = this.#timers.setTimeout(check, this.#terminalTimeoutMs);
  }

  #finishIfReady() {
    if (!this.#endSeen || !this.#stoppedSeen) {
      this.#phase = 'Waiting';
      this.#armTerminal();
      return 'Accepted';
    }
    if (this.#terminalTimer !== null) this.#timers.clearTimeout(this.#terminalTimer);
    this.#terminalTimer = null;
    this.#terminalDeadline = 0;
    if (!this.#receivedSamples || this.#missingPackets || this.#missingSamples || this.#droppedPackets) {
      return this.#fail('Bud audio recording is empty or incomplete.');
    }
    const identity = { ...this.#identity };
    const epoch = this.#epoch;
    const signal = this.#abort.signal;
    const samples = this.#samples.slice(0, this.#nextSample);
    const rateHz = this.#format.rateKhz * 1000;
    this.#samples = null;
    this.#phase = 'Transcribing';
    Promise.resolve().then(() => {
      if (signal.aborted || epoch !== this.#epoch || !this.#current(identity.generation) ||
          this.#phase !== 'Transcribing') return null;
      return this.#transcribe({ samples, rateHz, signal, identity });
    }).then(text => {
      if (signal.aborted || epoch !== this.#epoch || !this.#current(identity.generation) ||
          this.#phase !== 'Transcribing') return;
      if (typeof text !== 'string' || !text.trim()) {
        this.#fail('Bud audio transcription returned no text.');
        return;
      }
      this.#phase = 'Done';
      try { this.#onTranscript({ text: text.trim(), identity }); }
      catch (error) { this.#fail(error); }
    }, error => {
      if (!signal.aborted && epoch === this.#epoch && this.#current(identity.generation) &&
          this.#phase === 'Transcribing') this.#fail(error);
    });
    return 'Finalizing';
  }

  accept(bytes, generation) {
    if (!this.#current(generation) || !(bytes instanceof Uint8Array)) return 'Ignored';
    if (this.#phase === 'Cancelled' || this.#phase === 'Fault') return 'Ignored';
    if (bytes.length < AudioLimits.HeaderBytes || bytes.length > AudioLimits.MaxPacketBytes) {
      return this.#fail('Invalid Bud audio packet size.');
    }
    let packet;
    try { packet = decode(bytes); }
    catch (error) { return this.#fail(error); }
    if (!sameIdentity(packet, this.#identity)) return 'Ignored';
    if (packet.codec !== this.#format.codec || packet.rateKhz !== this.#format.rateKhz ||
        packet.channel !== this.#format.channel) return this.#fail('Bud audio format changed during recording.');
    if (packet.kind === AudioKind.End) {
      if (this.#lastEnd) {
        if (!sameBytes(this.#lastEnd, bytes)) return this.#fail('Conflicting Bud audio End packet.');
        this.#duplicatePackets++;
        return 'Duplicate';
      }
      if (this.#phase !== 'Receiving' && this.#phase !== 'Waiting') return 'Ignored';
      if (packet.sequence < this.#sequence || packet.firstSample < this.#nextSample) {
        return this.#fail('Bud audio End precedes accepted samples.');
      }
      this.#missingPackets += packet.sequence - this.#sequence;
      this.#missingSamples += packet.firstSample - this.#nextSample;
      this.#droppedPackets = packet.droppedPackets;
      this.#lastEnd = bytes.slice();
      this.#endSeen = true;
      return this.#finishIfReady();
    }
    if (packet.kind !== AudioKind.Data) return this.#fail('Invalid Bud audio packet kind.');
    if (packet.sequence === this.#sequence && this.#lastData && sameBytes(this.#lastData, bytes)) {
      this.#duplicatePackets++;
      return 'Duplicate';
    }
    if (this.#endSeen || (this.#phase !== 'Receiving' && this.#phase !== 'Waiting')) {
      return this.#fail('Bud audio data arrived after the terminal packet.');
    }
    if (packet.sequence <= this.#sequence || packet.firstSample < this.#nextSample) {
      return this.#fail('Stale or overlapping Bud audio data.');
    }
    const end = packet.firstSample + packet.sampleCount;
    if (end > this.#samples.length || end > 960000) return this.#fail('Bud audio exceeded the 60-second sample bound.');
    let decoded;
    try {
      decoded = decodeSamples(packet.codec, packet.payload, packet.sampleCount,
        { predictor: packet.predictor, stepIndex: packet.stepIndex }).samples;
    } catch (error) { return this.#fail(error); }
    if (decoded.length !== packet.sampleCount) return this.#fail('Bud audio decoded sample count changed.');
    this.#missingPackets += packet.sequence - this.#sequence - 1;
    this.#missingSamples += packet.firstSample - this.#nextSample;
    this.#samples.set(decoded, packet.firstSample);
    this.#sequence = packet.sequence;
    this.#nextSample = end;
    this.#receivedPackets++;
    this.#receivedSamples += decoded.length;
    this.#lastData = bytes.slice();
    // each accepted piece as it arrives, so the app can tell when the speaker stops
    try { this.#onSamples(decoded, this.#format.rateKhz * 1000); } catch { /* a listener's problem, not the recording's */ }
    return 'Accepted';
  }

  stopped(event, generation) {
    if (!this.#current(generation) || !event || !sameIdentity(event, this.#identity)) return 'Ignored';
    if (this.#phase === 'Cancelled' || this.#phase === 'Fault') return 'Ignored';
    if (event.stopReason !== 0) {
      this.cancel('Bud capture stopped without Finish.');
      return 'Cancelled';
    }
    if (this.#stoppedSeen) return 'Duplicate';
    if (this.#phase !== 'Receiving' && this.#phase !== 'Waiting') return 'Ignored';
    this.#stoppedSeen = true;
    return this.#finishIfReady();
  }
}
