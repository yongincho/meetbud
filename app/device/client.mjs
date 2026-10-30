import { decode, encode } from './protocol/v1.mjs';
import { Capability, CapabilityMask, CaptureHealth, Limits, ResultCode, State, Type } from './protocol/v1-ids.mjs';
import { FragmentLimits, FragmentReceiver, FragmentResult, FragmentSender } from './protocol/framing.mjs';
import { AudioLimits } from './protocol/audio.mjs';
import { LookCatalog } from './protocol/looks.mjs';
import { connectBluetooth } from './bluetooth.mjs';

const MAX_QUEUE = 16;
const MAX_COMPLETED_COMMANDS = 32;
const COMMAND_DEADLINE_MS = 5000;
const ACK_WAIT_MS = 700;
const WRITE_RETRY_MS = 50;
const MAX_COMMAND_ATTEMPTS = 3;
const HANDSHAKE_TIMEOUT_MS = 5000;
const SETTINGS_STATE_TIMEOUT_MS = 5000;
const SETTINGS_RECOVERY_READS = 3;
const OUTFIT_STATE_TIMEOUT_MS = 5000;
const REMEMBERED_KEY = 'bud-v1-device-id';
const STATES = new Map(Object.entries(State).map(([name, value]) => [name.toLowerCase(), value]));
const DEVICE_TYPES = new Set([Type.Hello, Type.Input, Type.Result, Type.Activation,
  Type.CaptureStopped, Type.ApprovalResponse, Type.DeviceStatus, Type.RequestCancelled,
  Type.AudioOffer, Type.SettingsState, Type.OutfitState, Type.PieceList]);
const textEncoder = new TextEncoder();

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  promise.catch(() => {}); // callers may choose not to await an invalidated approval
  return { promise, resolve, reject };
}
function u32(value) { return Number.isInteger(value) && value >= 0 && value <= 0xffffffff; }
function positiveU32(value) { return u32(value) && value !== 0; }
function asError(error) { return error instanceof Error ? error : new Error(String(error)); }
function truncateCaption(text, maxBytes) {
  if (typeof text !== 'string' || !text.isWellFormed()) throw new TypeError('Caption must be well-formed text.');
  let result = '', length = 0;
  for (const point of text) {
    const size = textEncoder.encode(point).length;
    if (length + size > maxBytes) break;
    result += point;
    length += size;
  }
  return result;
}
function stateNumber(value) {
  if (typeof value === 'string') {
    const known = STATES.get(value.toLowerCase());
    if (known !== undefined) return known;
  }
  if (Number.isInteger(value) && Object.values(State).includes(value)) return value;
  throw new RangeError('Unknown Bud state.');
}

export class DeviceClient {
  #onEvent;
  #onState;
  #onError;
  #onAudio;
  #clock;
  #timers;
  #bluetooth;
  #storage;
  #transport = null;
  #unsubscribe = null;
  #unsubscribeDisconnect = null;
  #unsubscribeAudio = null;
  #handshakeTimer = null;
  #generation = 0;
  #connectAttempt = 0;
  #lifecycleEpoch = 0;
  #sender = new FragmentSender();
  #receiver = new FragmentReceiver();
  #queue = [];
  #completedCommands = new Map();
  #pumping = 0;
  #session = 0;
  #lastSession = 0;
  #capabilities = 0;
  #peerReceiveLimit = 183;
  #txSequence = 0;
  #rxSequence = 0;
  #requestHigh = 0;
  #request = 0;
  #openingRequest = 0;
  #approvalHigh = 0;
  #approval = null;
  #helloSeen = false;
  #phase = 'Disconnected';
  #status = null;
  #lastError = null;
  #desiredCapabilities;
  #audioAvailable;
  #audioTransportReady = false;
  #audioMaxPacketBytes = 0;
  #audioOffer = null;
  #configuredAudio = null;
  #audioConfiguring = null;
  #settings = null;
  #settingsWaiter = null;
  #settingsBusy = false;
  // Capability.Outfits: what Bud wears (OutfitState) and the app's pieces it keeps (PieceList), each
  // with the sequence it came in, and those waiting for a newer one.
  #outfit = null;
  #pieces = null;
  #outfitWaiters = [];

  constructor({ onEvent = () => {}, onState = () => {}, onError = () => {}, onAudio = () => {},
    clock = () => Math.floor(performance.now()), timers = globalThis, bluetooth = globalThis.navigator?.bluetooth,
    storage = undefined, capabilities = Capability.Display | Capability.Input | Capability.Approval,
    audioAvailable = false } = {}) {
    if (![onEvent, onState, onError, onAudio, clock].every(fn => typeof fn === 'function') ||
        typeof timers?.setTimeout !== 'function' || typeof timers?.clearTimeout !== 'function' ||
        typeof audioAvailable !== 'boolean' ||
        !u32(capabilities) || (capabilities & ~CapabilityMask) !== 0) {
      throw new TypeError('Invalid DeviceClient callbacks, timer or capability mask.');
    }
    this.#onEvent = onEvent;
    this.#onState = onState;
    this.#onError = onError;
    this.#onAudio = onAudio;
    this.#clock = clock;
    this.#timers = timers;
    this.#bluetooth = bluetooth;
    try { this.#storage = storage === undefined && typeof window !== 'undefined' ? window.localStorage : storage; }
    catch { this.#storage = null; } // blocked site data makes the localStorage getter throw
    this.#desiredCapabilities = capabilities;
    this.#audioAvailable = audioAvailable;
  }

  // Bud's own speaker, when its firmware has one (app/device/speaker.mjs makes the packets).
  get canSpeak() { return typeof this.#transport?.speak === 'function'; }
  speak(bytes) {
    if (!this.canSpeak) throw new Error('This Bud has no speaker.');
    return this.#transport.speak(bytes);
  }
  // Several speaker packets at once, the last acknowledged by the board (see speaker.mjs).
  get canSpeakMany() { return typeof this.#transport?.speakMany === 'function'; }
  speakMany(packets) {
    if (!this.canSpeakMany) throw new Error('This Bud has no speaker.');
    return this.#transport.speakMany(packets);
  }
  // Bud's always-on ears (app.js): Bud opens its own recordings while this is on.
  get canListen() { return typeof this.#transport?.listen === 'function'; }
  listen(on) {
    if (!this.canListen) throw new Error('This Bud cannot listen on its own.');
    return this.#transport.listen(!!on);
  }
  snapshot() {
    return { phase: this.#phase, connected: !!this.#transport, deviceId: this.#transport?.deviceId ?? null, session: this.#session,
      capabilities: this.#capabilities, request: this.#request,
      approval: this.#approval?.id ?? 0, status: this.#status, lastError: this.#lastError,
      generation: this.#generation, audioMaxPacketBytes: this.#audioMaxPacketBytes,
      audioOffer: this.#audioOffer && { ...this.#audioOffer },
      configured: this.#configuredAudio && { ...this.#configuredAudio },
      settings: this.#settings && { ...this.#settings },
      outfit: this.#outfit && { ...this.#outfit }, pieces: this.#pieces && { ...this.#pieces, keys: [...this.#pieces.keys] } };
  }
  #state(phase = this.#phase) {
    this.#phase = phase;
    if (phase === 'Ready' && this.#handshakeTimer !== null) {
      this.#timers.clearTimeout(this.#handshakeTimer);
      this.#handshakeTimer = null;
    }
    this.#onState(this.snapshot());
  }
  #error(error) { const e = asError(error); this.#lastError = e.message; this.#onError(e); return e; }
  #now() { const now = this.#clock(); if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid client clock.'); return now; }
  #sleep(ms) { return new Promise(resolve => this.#timers.setTimeout(resolve, ms)); }
  #checkGeneration(generation) {
    if (generation !== this.#generation || !this.#transport) throw new Error('Device connection changed.');
  }
  #invalidateApproval(error) {
    const context = this.#approval;
    if (!context) return;
    this.#approval = null;
    this.#timers.clearTimeout(context.timer);
    context.rejected = true;
    context.decision.reject(asError(error));
  }
  #drop(error, report = true) {
    const reason = asError(error);
    this.#generation++;
    this.#connectAttempt++;
    this.#lifecycleEpoch++;
    if (this.#handshakeTimer !== null) this.#timers.clearTimeout(this.#handshakeTimer);
    this.#handshakeTimer = null;
    this.#invalidateApproval(reason);
    if (this.#settingsWaiter) {
      this.#timers.clearTimeout(this.#settingsWaiter.timer);
      this.#settingsWaiter.reject(reason);
      this.#settingsWaiter = null;
    }
    for (const task of this.#queue) {
      if (task.waiter) { this.#timers.clearTimeout(task.waiter.timer); task.waiter.resolve(null); task.waiter = null; }
      task.done.reject(reason);
    }
    this.#queue = [];
    this.#completedCommands.clear();
    this.#pumping = 0;
    this.#unsubscribe?.(); this.#unsubscribeDisconnect?.(); this.#unsubscribeAudio?.();
    this.#unsubscribe = this.#unsubscribeDisconnect = this.#unsubscribeAudio = null;
    const old = this.#transport;
    this.#transport = null;
    old?.close?.();
    this.#session = this.#capabilities = this.#request = this.#openingRequest = this.#txSequence = this.#rxSequence = 0;
    this.#requestHigh = this.#approvalHigh = 0;
    this.#helloSeen = false;
    this.#status = null;
    this.#audioTransportReady = false;
    this.#audioMaxPacketBytes = 0;
    this.#audioOffer = this.#configuredAudio = this.#audioConfiguring = null;
    this.#settings = null;
    this.#settingsBusy = false;
    this.#outfit = this.#pieces = null;
    for (const waiter of this.#outfitWaiters.splice(0)) { this.#timers.clearTimeout(waiter.timer); waiter.reject(reason); }
    if (report) this.#error(reason);
    this.#state('Disconnected');
  }

  close() { this.#drop(new Error('Device client closed.'), false); }
  attach(transport) {
    if (!transport || typeof transport.write !== 'function' || typeof transport.subscribe !== 'function' ||
        !Number.isInteger(transport.attPayload ?? 20) ||
        (transport.attPayload ?? 20) < FragmentLimits.MinAttPayload ||
        (transport.attPayload ?? 20) > FragmentLimits.MaxAttPayload) {
      throw new TypeError('Transport needs write, subscribe and a bounded ATT payload.');
    }
    if (typeof transport.subscribeAudio === 'function' &&
        (!Number.isInteger(transport.audioMaxPacketBytes) ||
          transport.audioMaxPacketBytes < AudioLimits.EndBytes ||
          transport.audioMaxPacketBytes > AudioLimits.MaxPacketBytes)) {
      throw new TypeError('Audio transport needs a bounded notification packet size.');
    }
    this.#drop(new Error('Device transport replaced.'), false);
    const generation = this.#generation;
    if (!this.#sender.reset(generation) || !this.#receiver.reset(generation)) throw new Error('Connection generation exhausted.');
    this.#transport = transport;
    this.#audioTransportReady = this.#audioAvailable && typeof transport.subscribeAudio === 'function';
    this.#audioMaxPacketBytes = this.#audioTransportReady ? transport.audioMaxPacketBytes : 0;
    this.#lastError = null;
    this.#state('Connecting');
    this.#handshakeTimer = this.#timers.setTimeout(() => {
      if (generation === this.#generation && this.#phase !== 'Ready') {
        this.#drop(new Error('Bud v1 handshake timed out.'));
      }
    }, HANDSHAKE_TIMEOUT_MS);
    try {
      this.#unsubscribe = transport.subscribe(bytes => this.#receiveFragment(generation, bytes));
      if (this.#audioTransportReady) {
        this.#unsubscribeAudio = transport.subscribeAudio(bytes => this.#receiveAudio(generation, bytes));
      }
      if (typeof transport.onDisconnect === 'function') {
        this.#unsubscribeDisconnect = transport.onDisconnect(() => {
          if (generation === this.#generation) this.#drop(new Error('Bud disconnected.'));
        });
      }
    } catch (error) {
      this.#drop(error);
      throw error;
    }
    return this.snapshot();
  }

  async bluetooth({ remembered = false, onChosen = null } = {}) {
    const attempt = ++this.#connectAttempt;
    let transport;
    try {
      const deviceId = remembered ? this.#storage?.getItem?.(REMEMBERED_KEY) : null;
      transport = await connectBluetooth({ bluetooth: this.#bluetooth, remembered, deviceId, onChosen });
      if (attempt !== this.#connectAttempt) {
        transport.close();
        throw new Error('Bluetooth connection attempt was superseded.');
      }
      if (!remembered && transport.deviceId) this.#storage?.setItem?.(REMEMBERED_KEY, transport.deviceId);
      this.attach(transport);
      return this.snapshot();
    } catch (error) {
      if (transport && this.#transport !== transport) transport.close();
      throw this.#error(error);
    }
  }
  async reconnect({ onChosen = null } = {}) {
    const id = this.#storage?.getItem?.(REMEMBERED_KEY);
    if (!id) throw this.#error(new Error('No remembered Bud device.'));
    const started = this.#lifecycleEpoch;
    let last;
    for (const delay of [0, 100, 300]) {
      if (delay) await this.#sleep(delay);
      if (this.#lifecycleEpoch !== started) throw new Error('Reconnect was cancelled.');
      try { return await this.bluetooth({ remembered: true, onChosen }); }
      catch (error) { last = asError(error); }
      if (this.#lifecycleEpoch !== started) throw new Error('Reconnect was cancelled.');
    }
    throw this.#error(last);
  }

  #receiveFragment(generation, bytes) {
    if (generation !== this.#generation || !this.#transport) return;
    try {
      const out = new Uint8Array(183);
      const result = this.#receiver.receive(generation, bytes, this.#transport.attPayload ?? 20,
        this.#now() >>> 0, out);
      if (result.result === FragmentResult.Duplicate || result.result === FragmentResult.Pending) return;
      if (result.result === FragmentResult.Rejected) throw new Error('Rejected v1 fragment.');
      this.#receiveFrame(decode(out.subarray(0, result.length)));
    } catch (error) { this.#drop(error); }
  }
  #receiveAudio(generation, bytes) {
    if (generation !== this.#generation || !this.#transport || !this.#configuredAudio) return;
    if (!(bytes instanceof Uint8Array) || bytes.length < AudioLimits.HeaderBytes ||
        bytes.length > this.#audioMaxPacketBytes) {
      this.#error(new Error('Invalid Bud audio notification size.'));
      return;
    }
    try { this.#onAudio(bytes.slice(), generation); }
    catch (error) { this.#error(error); }
  }
  #receiveFrame(message) {
    if (!DEVICE_TYPES.has(message.type)) throw new Error('Wrong v1 device message direction.');
    if (message.type === Type.Hello) {
      if (this.#helloSeen || this.#session) {
        if (message.session !== this.#session) throw new Error('Stale v1 session.');
        return;
      }
      if (message.session <= this.#lastSession || message.minVersion > 1 || message.maxVersion < 1) {
        throw new Error('Stale or unsupported device Hello.');
      }
      this.#lastSession = this.#session = message.session;
      this.#helloSeen = true;
      this.#peerReceiveLimit = message.receiveLimit;
      this.#capabilities = message.capabilities & this.#desiredCapabilities & CapabilityMask;
      if (!this.#audioTransportReady ||
          (this.#capabilities & (Capability.AudioStream | Capability.CaptureControl)) !==
            (Capability.AudioStream | Capability.CaptureControl)) {
        this.#capabilities &= ~(Capability.AudioStream | Capability.CaptureControl);
      }
      const welcome = encode({ type: Type.Welcome, session: this.#session, request: 0, sequence: 0,
        capabilities: this.#capabilities, receiveLimit: 183 });
      const generation = this.#generation;
      const session = this.#session;
      this.#enqueue(welcome, 0, 0, false).then(() => {
        if (generation === this.#generation && session === this.#session && this.#transport) this.#state('Ready');
      }, error => this.#error(error));
      this.#state('Negotiating');
      return;
    }
    if (!this.#session || message.session !== this.#session) throw new Error('Stale v1 session.');
    if (message.sequence <= this.#rxSequence) return; // no duplicate input or approval side effect
    this.#rxSequence = message.sequence;
    if (message.type === Type.Result) {
      const completed = this.#completedCommands.get(message.ackSequence);
      if (completed) {
        this.#matchResult(completed, message);
        return;
      }
      const task = this.#queue[0];
      if (!task || task.sequence !== message.ackSequence || !task.ack ||
          (!task.dispatched && !task.writingFinal && !task.finalTried && !task.result)) {
        throw new Error('Unexpected v1 Result acknowledgement.');
      }
      const receipt = { request: task.request, code: task.result?.code ?? null };
      this.#matchResult(receipt, message);
      if (task.result) return; // preserve the first receipt, including its event sequence
      task.result = message;
      if (!task.cancelled) task.waiter?.resolve(message);
      return;
    }
    if (message.type === Type.RequestCancelled) {
      const current = this.#request || this.#openingRequest;
      if (message.request !== current) {
        if (message.request <= this.#requestHigh) return; // delayed event from a completed request
        throw new Error('Cancellation names an unknown request.');
      }
      this.#cancelRequest(message.request);
      this.#onEvent(message);
      return;
    }
    if (message.type === Type.AudioOffer) {
      if (!(this.#capabilities & Capability.AudioStream) || this.#audioOffer || this.#configuredAudio) {
        throw new Error('Unexpected Bud audio offer.');
      }
      this.#audioOffer = { maxPacketBytes: message.maxPacketBytes,
        codecs: message.codecs, rates: message.rates, channels: message.channels };
      this.#state();
      this.#onEvent(message);
      return;
    }
    if (message.type === Type.SettingsState) {
      if (!(this.#capabilities & Capability.Settings)) throw new Error('Settings state arrived without capability.');
      this.#settings = { revision: message.revision, look: message.look,
        restSeconds: message.restSeconds, catalogVersion: message.catalogVersion,
        storageHealthy: message.storageHealthy };
      const waiter = this.#settingsWaiter;
      if (waiter) {
        waiter.candidate = { sequence: message.sequence, state: { ...this.#settings } };
        if (waiter.resultSequence !== null && message.sequence > waiter.resultSequence) {
          this.#timers.clearTimeout(waiter.timer);
          this.#settingsWaiter = null;
          waiter.resolve(waiter.candidate.state);
        }
      }
      this.#state();
      this.#onEvent(message);
      return;
    }
    if (message.type === Type.OutfitState || message.type === Type.PieceList) {
      if (!(this.#capabilities & Capability.Outfits)) throw new Error('Outfit state arrived without capability.');
      if (message.type === Type.OutfitState) {
        const { sequence, revision, active, theme, ambient, storageHealthy, head, face, neck, item } = message;
        this.#outfit = { sequence, revision, active, theme, ambient, storageHealthy, head, face, neck, item };
      } else this.#pieces = { sequence: message.sequence, capacity: message.capacity, keys: [...message.keys] };
      for (const waiter of this.#outfitWaiters.filter(w => w.type === message.type && message.sequence > w.after)) {
        this.#outfitWaiters.splice(this.#outfitWaiters.indexOf(waiter), 1);
        this.#timers.clearTimeout(waiter.timer);
        waiter.resolve();
      }
      this.#state();
      this.#onEvent(message);
      return;
    }
    if (message.type === Type.Input) { this.#onEvent(message); return; } // raw input is observation only
    if (message.type === Type.Activation && !(this.#capabilities & Capability.CaptureControl)) {
      throw new Error('Capture activation arrived without negotiated capability.');
    }
    if (message.type === Type.DeviceStatus) {
      this.#status = message;
      if (message.fault || message.captureHealth === CaptureHealth.Unknown) {
        this.#invalidateApproval(new Error('Device capture fault invalidated approval.'));
      }
      this.#state();
    }
    if (message.type === Type.ApprovalResponse) this.#deviceApproval(message);
    this.#onEvent(message);
  }
  #deviceApproval(message) {
    const context = this.#approval;
    if (context && this.#now() >= context.deadline) {
      this.#invalidateApproval(new Error('Device approval expired.'));
      this.#state();
    }
    if (!context || this.#approval !== context || !context.dispatched || message.request !== context.request ||
        message.approval !== context.id) {
      // A late tap, or one that crossed a phone decision or cancel, changes nothing; an ID never offered is an error.
      if (!message.approval || message.approval > this.#approvalHigh || message.request > this.#requestHigh) {
        throw new Error('Unknown device approval response.');
      }
      this.#error(new Error('A late Bud approval was ignored.'));
      return;
    }
    this.#consumeApproval(context, message.approved);
  }
  #consumeApproval(context, approved) {
    if (this.#approval !== context || context.rejected) return false;
    this.#approval = null;
    context.consumed = true;
    context.value = approved;
    this.#timers.clearTimeout(context.timer);
    context.decision.resolve(approved);
    this.#state();
    return true;
  }
  #cancelRequest(request) {
    const reason = new Error('Bud cancelled the current request.');
    reason.cancelled = true;
    this.#request = this.#openingRequest = 0;
    this.#invalidateApproval(reason);
    for (const task of this.#queue) {
      if (task.request !== request) continue;
      task.cancelled = reason;
      if (task.waiter) task.waiter.resolve(null);
      task.done.reject(reason);
    }
    this.#state();
  }
  #checkTask(task, generation) {
    if (!task.cancelled) return;
    // A fragment may have been accepted before cancellation. Retire its local
    // tail without sending it; the next higher START replaces the peer partial.
    while (this.#sender.pending) {
      if (!this.#sender.peek(generation, FragmentLimits.MaxAttPayload) ||
          !this.#sender.accept(generation)) throw new Error('Cancelled fragment could not retire.');
    }
    throw task.cancelled;
  }
  #matchResult(receipt, message) {
    if (message.request !== receipt.request) throw new Error('Result request does not match its command.');
    if (receipt.code !== null && message.code !== receipt.code) throw new Error('Conflicting v1 Result acknowledgement.');
    receipt.code = message.code;
  }
  #rememberCompleted(task) {
    if (!task.ack || (!task.dispatched && !task.result)) return;
    // Cancelled, fully sent commands may receive their first Result later. Its
    // outcome is pinned on arrival, without resolving or reviving the task.
    this.#completedCommands.set(task.sequence, { request: task.request, code: task.result?.code ?? null });
    if (this.#completedCommands.size > MAX_COMPLETED_COMMANDS) {
      this.#completedCommands.delete(this.#completedCommands.keys().next().value);
    }
  }

  #enqueue(bytes, sequence, request, ack = true, onDispatched = null, reconcileResult = null) {
    if (!this.#transport || this.#queue.length >= MAX_QUEUE) throw this.#error(new Error('Device send queue is unavailable or full.'));
    const done = deferred();
    this.#queue.push({ bytes, sequence, request, ack, done, onDispatched, reconcileResult, dispatched: false, writingFinal: false,
      deadline: this.#now() + COMMAND_DEADLINE_MS, attempts: 0, result: null, waiter: null });
    this.#pump(this.#generation);
    return done.promise;
  }
  #command(type, request, fields = {}, onDispatched = null, reconcileResult = null) {
    if (this.#phase !== 'Ready') throw this.#error(new Error('Bud v1 is not ready.'));
    if (this.#txSequence >= 0xfffffffe) { this.#drop(new Error('Device command sequence exhausted.')); throw new Error('Device command sequence exhausted.'); }
    const sequence = ++this.#txSequence;
    const bytes = encode({ type, session: this.#session, request, sequence, ...fields });
    if (bytes.length > this.#peerReceiveLimit) throw this.#error(new Error('Command exceeds Bud receive limit.'));
    return this.#enqueue(bytes, sequence, request, true, onDispatched, reconcileResult);
  }
  async #waitAck(task, generation) {
    if (task.result) return task.result;
    const remaining = task.deadline - this.#now();
    if (remaining <= 0) return null;
    return new Promise(resolve => {
      const timer = this.#timers.setTimeout(() => { task.waiter = null; resolve(null); },
        Math.min(ACK_WAIT_MS, remaining));
      task.waiter = { timer, resolve: value => {
        this.#timers.clearTimeout(timer);
        task.waiter = null;
        resolve(value);
      } };
      if (task.result || generation !== this.#generation) task.waiter.resolve(task.result);
    });
  }
  async #writeBeforeDeadline(task, fragment, generation) {
    const remaining = task.deadline - this.#now();
    if (remaining <= 0) throw new Error('Device write deadline expired.');
    const transport = this.#transport;
    let timer;
    const expired = new Promise((_, reject) => {
      timer = this.#timers.setTimeout(() => {
        const error = new Error('Device write deadline expired with delivery uncertain.');
        error.uncertainWrite = true;
        reject(error);
      }, remaining);
    });
    try {
      const accepted = await Promise.race([Promise.resolve().then(() => {
        this.#checkGeneration(generation);
        this.#checkTask(task, generation);
        // A transport can notify synchronously inside the final fragment write,
        // before its promise reports acceptance to the send loop.
        task.writingFinal = (fragment[1] & 2) !== 0;
        // A refused final write may still have reached Bud; its Result can land during the retry sleep.
        if (task.writingFinal) task.finalTried = true;
        return transport.write(fragment);
      }), expired]);
      // Keep receipt eligibility continuous across the await back to #sendTask.
      if (accepted !== false && task.writingFinal) task.dispatched = true;
      return accepted;
    } finally {
      task.writingFinal = false;
      this.#timers.clearTimeout(timer);
    }
  }
  async #sendTask(task, generation) {
    while (task.attempts < MAX_COMMAND_ATTEMPTS) {
      this.#checkGeneration(generation);
      this.#checkTask(task, generation);
      if (this.#now() >= task.deadline) throw new Error('Device command deadline expired.');
      if (!this.#sender.begin(generation, task.bytes)) throw new Error('Fragment sender could not start.');
      task.attempts++;
      while (this.#sender.pending) {
        this.#checkGeneration(generation);
        this.#checkTask(task, generation);
        if (this.#now() >= task.deadline) throw new Error('Device write deadline expired.');
        const fragment = this.#sender.peek(generation, this.#transport.attPayload ?? 20);
        if (!fragment) throw new Error('Device ATT payload changed below a pending fragment.');
        let accepted = false;
        try { accepted = await this.#writeBeforeDeadline(task, fragment, generation) !== false; }
        catch (error) {
          if (error.uncertainWrite) throw error; // retire the link; late GATT success cannot advance this sender
          task.lastWriteError = asError(error);
        }
        this.#checkGeneration(generation);
        this.#checkTask(task, generation);
        if (!accepted) { await this.#sleep(WRITE_RETRY_MS); continue; }
        if (!this.#sender.accept(generation)) throw new Error('Fragment acceptance lost.');
      }
      task.dispatched = true;
      this.#checkTask(task, generation);
      task.onDispatched?.();
      if (!task.ack) return null;
      const result = await this.#waitAck(task, generation);
      this.#checkGeneration(generation);
      this.#checkTask(task, generation);
      if (result) {
        if (result.code !== ResultCode.Ok) {
          if (task.reconcileResult?.(result)) return result;
          const label = Object.entries(ResultCode).find(([, code]) => code === result.code)?.[0] || result.code;
          const error = new Error(`Bud rejected command ${task.sequence}: ${label}.`);
          error.resultCode = result.code;
          error.nonfatal = true;
          throw error;
        }
        return result;
      }
    }
    throw task.lastWriteError || new Error('Device command was not acknowledged.');
  }
  #pump(generation) {
    if (this.#pumping === generation || !this.#transport) return;
    this.#pumping = generation;
    const run = async () => {
      while (generation === this.#generation && this.#queue.length) {
        const task = this.#queue[0];
        try {
          const result = await this.#sendTask(task, generation);
          if (generation !== this.#generation || this.#queue[0] !== task) break;
          this.#rememberCompleted(task);
          this.#queue.shift();
          task.done.resolve(result);
        } catch (error) {
          if (generation !== this.#generation) break;
          if (this.#queue[0] === task) {
            this.#rememberCompleted(task);
            this.#queue.shift();
          }
          task.done.reject(error);
          if (task.cancelled && !error.uncertainWrite) continue;
          this.#error(error);
          if (!error.nonfatal) { this.#drop(error, false); break; }
        }
      }
      if (this.#pumping === generation) this.#pumping = 0;
    };
    void run();
  }
  #requireCapability(capability) {
    if (!(this.#capabilities & capability)) throw this.#error(new Error('Bud did not negotiate this capability.'));
  }
  #currentRequest(request = this.#request) {
    if (!positiveU32(request) || request !== this.#request) throw this.#error(new Error('No matching current device request.'));
    return request;
  }

  request() { return this.beginRequest(); }
  async beginRequest() {
    if (this.#request || this.#openingRequest) throw this.#error(new Error('Finish or cancel the current request first.'));
    if (this.#requestHigh === 0xffffffff) throw this.#error(new Error('Device request IDs exhausted.'));
    const request = ++this.#requestHigh;
    this.#openingRequest = request;
    try {
      await this.#command(Type.RequestBegin, request);
      if (this.#openingRequest !== request) throw new Error('Bud cancelled the opening request.');
      this.#request = request;
      this.#state();
      return request;
    } finally {
      if (this.#openingRequest === request) this.#openingRequest = 0;
    }
  }
  show(state, progress = 0, caption = '', request = this.#request) {
    this.#requireCapability(Capability.Display);
    if (!u32(request)) throw new RangeError('Invalid Show request.');
    if (!Number.isInteger(progress) || progress < 0 || progress > 255) throw new RangeError('Progress must be 0..255.');
    const text = truncateCaption(caption, Math.min(160, this.#peerReceiveLimit - 23));
    return this.#command(Type.Show, request, { state: stateNumber(state), progress, caption: text });
  }
  startCapture(activation, request = this.#request) {
    this.#requireCapability(Capability.CaptureControl);
    if (!(this.#capabilities & Capability.AudioStream) || !this.#configuredAudio) {
      throw this.#error(new Error('Bud audio format is not configured.'));
    }
    if (!positiveU32(activation)) throw new RangeError('A deliberate activation token is required.');
    return this.#command(Type.CaptureStart, this.#currentRequest(request), { activation });
  }
  async configureAudio(config) {
    this.#requireCapability(Capability.AudioStream);
    if (!this.#audioOffer || !config || this.#audioConfiguring || this.#request) {
      throw this.#error(new Error('Bud audio offer is unavailable or busy.'));
    }
    const { codec, rateKhz, channel, sampleCount, maxPacketBytes } = config;
    const offer = this.#audioOffer;
    const bytes = codec === 0 ? sampleCount * 2 : Math.ceil(sampleCount / 2);
    if (!Number.isInteger(codec) || !Number.isInteger(rateKhz) || !Number.isInteger(channel) ||
        !Number.isInteger(sampleCount) || sampleCount < 1 || !Number.isInteger(maxPacketBytes) ||
        maxPacketBytes < AudioLimits.EndBytes ||
        maxPacketBytes > Math.min(offer.maxPacketBytes, this.#audioMaxPacketBytes) ||
        !(offer.codecs & (1 << codec)) || !(offer.rates & (rateKhz === 8 ? 1 : rateKhz === 16 ? 2 : 0)) ||
        !(offer.channels & (1 << channel)) ||
        AudioLimits.HeaderBytes + bytes > maxPacketBytes) {
      throw new RangeError('Unsupported Bud audio configuration.');
    }
    if (this.#configuredAudio) {
      if (Object.keys(this.#configuredAudio).every(key => this.#configuredAudio[key] === config[key])) return;
      throw this.#error(new Error('Bud audio is already configured.'));
    }
    const generation = this.#generation;
    const selected = { codec, rateKhz, channel, sampleCount, maxPacketBytes };
    const pending = this.#command(Type.AudioConfig, 0, selected);
    this.#audioConfiguring = pending;
    try {
      await pending;
      this.#checkGeneration(generation);
      this.#configuredAudio = selected;
      this.#state();
    } finally {
      if (this.#audioConfiguring === pending) this.#audioConfiguring = null;
    }
  }
  #freshSettingsState() {
    if (this.#settingsWaiter) throw new Error('Settings read is already pending.');
    this.#settingsWaiter = { ...deferred(), timer: null, resultSequence: null, candidate: null };
    this.#settingsDeadline(this.#settingsWaiter);
    return this.#settingsWaiter;
  }
  #settingsDeadline(waiter) { // each Read gets the full wait for its own State
    this.#timers.clearTimeout(waiter.timer);
    waiter.timer = this.#timers.setTimeout(() => {
      if (this.#settingsWaiter !== waiter) return;
      this.#settingsWaiter = null;
      waiter.reject(new Error('Bud settings readback timed out.'));
    }, SETTINGS_STATE_TIMEOUT_MS);
  }
  async #readSettings() {
    // Only a State numbered after its own Read's Result is fresh. A resent Read's Result may be Bud's
    // cached replay, which follows the only State that Read gets. If no fresh State comes soon after
    // it, read again with a new sequence, up to SETTINGS_RECOVERY_READS times, then fail: never guess.
    const waiter = this.#freshSettingsState();
    try {
      for (let recovery = 0; ; recovery++) {
        let sent = 0;
        waiter.resultSequence = null;
        const receipt = await this.#command(Type.SettingsRead, 0, {}, () => { sent++; });
        if (this.#settingsWaiter !== waiter) break;
        waiter.resultSequence = receipt.sequence;
        if (waiter.candidate?.sequence > receipt.sequence) {
          this.#timers.clearTimeout(waiter.timer);
          this.#settingsWaiter = null;
          waiter.resolve(waiter.candidate.state);
          break;
        }
        if (sent === 1) break; // Bud handled this Read once, so its State follows the Result
        await Promise.race([this.#sleep(ACK_WAIT_MS), waiter.promise.catch(() => {})]);
        if (this.#settingsWaiter !== waiter) break;
        if (recovery === SETTINGS_RECOVERY_READS) {
          this.#timers.clearTimeout(waiter.timer);
          this.#settingsWaiter = null;
          waiter.reject(new Error(`Bud settings readback stayed unconfirmed after ${recovery} more Reads.`));
          break;
        }
        this.#settingsDeadline(waiter);
      }
      const result = await waiter.promise;
      if (!result.storageHealthy || !positiveU32(result.revision)) {
        throw new Error('Bud settings storage is unhealthy.');
      }
      return { ...result };
    } finally {
      if (this.#settingsWaiter === waiter) {
        this.#timers.clearTimeout(waiter.timer);
        waiter.reject(new Error('Bud settings read was interrupted.'));
        this.#settingsWaiter = null;
      }
    }
  }
  async readSettings() {
    this.#requireCapability(Capability.Settings);
    if (this.#settingsBusy) throw this.#error(new Error('A Bud settings operation is already pending.'));
    this.#settingsBusy = true;
    try { return await this.#readSettings(); }
    finally { this.#settingsBusy = false; }
  }
  async setSettings(expectedRevision, look, restSeconds, catalogVersion = LookCatalog.version) {
    this.#requireCapability(Capability.Settings);
    if (this.#settingsBusy) throw this.#error(new Error('A Bud settings operation is already pending.'));
    if (!positiveU32(expectedRevision) || !LookCatalog.looks.some(entry => entry.code === look) ||
        !LookCatalog.restSeconds.includes(restSeconds) || catalogVersion !== LookCatalog.version) {
      throw new RangeError('Invalid Bud settings selection or revision.');
    }
    if (!this.#settings?.storageHealthy || !positiveU32(this.#settings.revision)) {
      throw this.#error(new Error('Bud settings storage is unavailable.'));
    }
    this.#settingsBusy = true;
    try {
      await this.#command(Type.SettingsSet, 0, { expectedRevision, look, restSeconds, catalogVersion });
      const applied = await this.#readSettings();
      if (applied.revision < expectedRevision || applied.look !== look ||
          applied.restSeconds !== restSeconds || applied.catalogVersion !== catalogVersion) {
        throw this.#error(new Error('Bud settings readback differs from the requested values.'));
      }
      return applied;
    } finally { this.#settingsBusy = false; }
  }
  // Bud's own copy of the app's outfit (Capability.Outfits). Bud states what it wears after each
  // change; this waits for a statement newer than the command's Result, as a settings read does.
  #newer(type, after) {
    const latest = type === Type.OutfitState ? this.#outfit : this.#pieces;
    if (latest && latest.sequence > after) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter = { type, after, resolve, reject, timer: null };
      waiter.timer = this.#timers.setTimeout(() => {
        const at = this.#outfitWaiters.indexOf(waiter);
        if (at >= 0) this.#outfitWaiters.splice(at, 1);
        reject(new Error('Bud did not say what it wears.'));
      }, OUTFIT_STATE_TIMEOUT_MS);
      this.#outfitWaiters.push(waiter);
    });
  }
  /**
   * Wear an outfit in place of the look, written against Bud's current revision: { active, theme,
   * ambient, head, face, neck, item } (outfits.mjs makes them; OFF takes it off). Resolves with what
   * Bud then wears; a Conflict (Bud's outfit changed elsewhere) rejects with resultCode 10.
   */
  async setOutfit(codes) {
    this.#requireCapability(Capability.Outfits);
    const current = this.#outfit;
    if (!current?.storageHealthy) throw this.#error(new Error('Bud cannot keep an outfit now.'));
    const receipt = await this.#command(Type.OutfitSet, 0, { expectedRevision: current.revision, catalogVersion: LookCatalog.version,
      active: codes.active, theme: codes.theme, ambient: codes.ambient, head: codes.head, face: codes.face, neck: codes.neck, item: codes.item });
    await this.#newer(Type.OutfitState, receipt.sequence);
    return { ...this.#outfit };
  }
  /** What Bud wears now, read afresh (a SettingsRead, which Bud answers with its outfit too). */
  async readOutfit() {
    this.#requireCapability(Capability.Outfits);
    const receipt = await this.#command(Type.SettingsRead, 0, {});
    await this.#newer(Type.OutfitState, receipt.sequence);
    return { ...this.#outfit };
  }
  /**
   * Send one of the app's pieces ({ key, slot, crc, bytes }, pieces.mjs) for Bud to keep: an offer,
   * chunks in order, then a commit that Bud checks. 'kept' when Bud had it already.
   */
  async sendPiece({ key, slot, crc, bytes }) {
    this.#requireCapability(Capability.Outfits);
    if (this.#pieces?.keys.includes(key)) return 'kept';
    const offer = await this.#command(Type.PieceOffer, 0, { key, size: bytes.length, slot, crc }, null,
      result => result.code === ResultCode.Duplicate);
    if (offer.code === ResultCode.Duplicate) return 'kept';
    const most = Math.min(Limits.MaxPieceChunkBytes, this.#peerReceiveLimit - Limits.HeaderBytes - 7);
    for (let at = 0; at < bytes.length; at += most) {
      await this.#command(Type.PieceChunk, 0, { key, at, data: bytes.subarray(at, at + most) });
    }
    const receipt = await this.#command(Type.PieceCommit, 0, { key });
    await this.#newer(Type.PieceList, receipt.sequence);
    return 'sent';
  }
  finishCapture(request = this.#request) {
    this.#requireCapability(Capability.CaptureControl);
    return this.#command(Type.CaptureFinish, this.#currentRequest(request));
  }
  offerApproval(ttlMs = 10000, request = this.#request) {
    this.#requireCapability(Capability.Approval);
    this.#currentRequest(request);
    if (!Number.isInteger(ttlMs) || ttlMs < 1 || ttlMs > 0x7fffffff) throw new RangeError('Invalid approval TTL.');
    if (this.#approval || this.#approvalHigh === 0xffffffff) throw this.#error(new Error('Approval already pending or IDs exhausted.'));
    const decision = deferred();
    const context = { id: ++this.#approvalHigh, session: this.#session, request,
      generation: this.#generation, deadline: Infinity, decision,
      dispatched: false, accepted: false, consumed: false, rejected: false, timer: null };
    // Bud starts its TTL when the offer arrives; the phone starts at Bud's Result, so it never ends first.
    const startTtl = () => {
      context.deadline = this.#now() + ttlMs;
      const expire = () => {
        if (this.#approval !== context) return;
        const left = context.deadline - this.#now();
        // A timer can fire a moment before the clock reaches the deadline: wait out the rest.
        if (left > 0) { context.timer = this.#timers.setTimeout(expire, left); return; }
        this.#invalidateApproval(new Error('Device approval expired.'));
        this.#state();
      };
      context.timer = this.#timers.setTimeout(expire, ttlMs);
    };
    this.#approval = context;
    this.#state();
    try {
      context.acknowledged = this.#command(Type.ApprovalOffer, request, { approval: context.id, ttlMs }, () => { context.dispatched = true; })
        .then(() => { context.accepted = true; if (this.#approval === context) startTtl(); }, error => {
          if (this.#approval === context) this.#invalidateApproval(error);
        });
    } catch (error) { this.#invalidateApproval(error); }
    return decision.promise;
  }
  async resolveApproval(approved) {
    if (typeof approved !== 'boolean') throw new TypeError('Approval decision must be boolean.');
    const context = this.#approval;
    // A phone choice made before the offer's Result waits for that Result instead of failing.
    if (context && !context.accepted) await context.acknowledged;
    if (context && this.#approval === context && this.#now() >= context.deadline) {
      this.#invalidateApproval(new Error('Device approval expired.'));
      this.#state();
    }
    if (!context || !context.accepted || context.generation !== this.#generation ||
        context.session !== this.#session || context.request !== this.#request ||
        this.#approval !== context) throw this.#error(new Error('No current acknowledged approval to resolve.'));
    const reconcile = result => result.code === ResultCode.Expired && context.consumed &&
      context.value === approved && context.generation === this.#generation &&
      context.session === this.#session && context.request === this.#request;
    try { await this.#command(Type.ApprovalResolve, context.request,
      { approval: context.id, approved }, null, reconcile); }
    catch (error) {
      if (error.resultCode === ResultCode.Expired && reconcile({ code: ResultCode.Expired })) return approved;
      if (this.#approval === context) this.#invalidateApproval(error);
      throw error;
    }
    if (context.consumed) {
      if (context.value !== approved) throw this.#error(new Error('Device approval decision conflicted.'));
      return approved;
    }
    if (!this.#consumeApproval(context, approved)) throw this.#error(new Error('Approval changed before resolution.'));
    return approved;
  }
  async complete(succeeded = true, request = this.#request) {
    if (typeof succeeded !== 'boolean') throw new TypeError('Completion must be boolean.');
    if (this.#approval) throw this.#error(new Error('Resolve the pending approval first.'));
    await this.#command(Type.Complete, this.#currentRequest(request), { succeeded });
    if (this.#request === request) this.#request = 0;
    this.#state();
  }
  async cancel(request = this.#request) {
    if (!u32(request) || (request && request !== this.#request)) throw new RangeError('Invalid Cancel request.');
    this.#invalidateApproval(new Error('Device request cancelled.'));
    await this.#command(Type.Cancel, request);
    if (request === this.#request) this.#request = 0;
    this.#state();
  }
  async setMuted(muted) {
    this.#requireCapability(Capability.CaptureControl);
    if (typeof muted !== 'boolean') throw new TypeError('Mute must be boolean.');
    if (muted) this.#invalidateApproval(new Error('Device muted.'));
    await this.#command(Type.Mute, 0, { muted });
    if (muted && this.#request) await this.cancel(this.#request);
  }
}
