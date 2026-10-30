const DEFAULT_DELAYS = Object.freeze([1000, 5000, 15000, 30000, 60000]);

/** Foreground-only retry policy. `attempt` must return a closeable, ready client. */
export class ForegroundReconnect {
  #attempt;
  #cancelAttempt;
  #onConnected;
  #onError;
  #onState;
  #visible;
  #online;
  #timers;
  #delays;
  #epoch = 0;
  #enabled = false;
  #connected = false;
  #inFlight = false;
  #timer = null;
  #failures = 0;
  #paused = false;

  constructor({ attempt, cancelAttempt = () => {}, onConnected, onError = () => {}, onState = () => {},
    visible = () => true, online = () => true, timers = globalThis, delays = DEFAULT_DELAYS }) {
    if (![attempt, cancelAttempt, onConnected, onError, onState, visible, online].every(fn => typeof fn === 'function') ||
        typeof timers?.setTimeout !== 'function' || typeof timers?.clearTimeout !== 'function' ||
        !Array.isArray(delays) || !delays.length ||
        delays.some(ms => !Number.isInteger(ms) || ms < 1 || ms > 60000)) {
      throw new TypeError('Invalid foreground reconnect policy.');
    }
    this.#attempt = attempt;
    this.#cancelAttempt = cancelAttempt;
    this.#onConnected = onConnected;
    this.#onError = onError;
    this.#onState = onState;
    this.#visible = visible;
    this.#online = online;
    this.#timers = timers;
    this.#delays = [...delays];
  }

  snapshot() {
    return { enabled: this.#enabled, connected: this.#connected,
      inFlight: this.#inFlight, scheduled: this.#timer !== null,
      paused: !this.#visible() || !this.#online(), failures: this.#failures };
  }
  #changed() { this.#onState(this.snapshot()); }
  #clearTimer() {
    if (this.#timer !== null) this.#timers.clearTimeout(this.#timer);
    this.#timer = null;
  }
  #eligible() { return this.#enabled && !this.#connected && this.#visible() && this.#online(); }
  #schedule() {
    if (!this.#eligible() || this.#inFlight || this.#timer !== null) return;
    const delay = this.#delays[Math.min(this.#failures, this.#delays.length - 1)];
    const epoch = this.#epoch;
    this.#timer = this.#timers.setTimeout(() => {
      this.#timer = null;
      void this.#run(epoch);
    }, delay);
    this.#changed();
  }
  async #run(epoch) {
    if (epoch !== this.#epoch || !this.#eligible() || this.#inFlight) return;
    this.#inFlight = true;
    this.#changed();
    const isCurrent = () => epoch === this.#epoch && this.#eligible();
    let candidate;
    try {
      candidate = await this.#attempt({ isCurrent });
      if (!isCurrent()) { candidate?.close?.(); return; }
      this.#onConnected(candidate);
      this.#connected = true;
      this.#failures = 0;
    } catch (error) {
      candidate?.close?.();
      if (isCurrent()) {
        this.#failures++;
        this.#onError(error);
        if (error?.permanent) this.stop(); // e.g. no getDevices(): retrying cannot help
      }
    } finally {
      if (epoch === this.#epoch) {
        this.#inFlight = false;
        this.#changed();
        this.#schedule();
      }
    }
  }

  start({ connected = false } = {}) {
    if (this.#enabled) {
      if (connected) this.markConnected();
      else this.activity();
      return;
    }
    this.#epoch++;
    this.#enabled = true;
    this.#connected = connected;
    this.#failures = 0;
    this.#paused = !this.#visible() || !this.#online();
    this.#changed();
    this.#schedule();
  }
  markConnected() {
    if (!this.#enabled) return;
    this.#clearTimer();
    this.#connected = true;
    this.#failures = 0;
    this.#changed();
  }
  lost() {
    if (!this.#enabled) return;
    this.#connected = false;
    this.#changed();
    this.#schedule();
  }
  activity() {
    if (!this.#enabled) return;
    if (!this.#visible() || !this.#online()) {
      this.#paused = true;
      this.#clearTimer();
      if (this.#inFlight) {
        this.#epoch++;
        this.#inFlight = false;
        this.#cancelAttempt();
      }
      this.#changed();
      return;
    }
    if (this.#paused) {
      this.#paused = false;
      this.#failures = 0; // a return to the foreground gets the initial bounded delay
    }
    this.#schedule();
  }
  stop() {
    this.#epoch++;
    this.#enabled = this.#connected = false;
    this.#clearTimer();
    if (this.#inFlight) this.#cancelAttempt();
    this.#inFlight = false;
    this.#failures = 0;
    this.#paused = false;
    this.#changed();
  }
}
