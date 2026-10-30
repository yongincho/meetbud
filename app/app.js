/* Bud companion app prototype, plus a Bud emulator.
 *
 * The local design emulator uses BudLink (link.js). A real board and firmware
 * simulator use the binary-v1 DeviceClient. BudAgent runs the selected model.
 * Modes: on a computer the app sits in a phone frame beside the emulator; on a phone the
 * app fills the screen; with #device the page is only the emulator, so another screen
 * (or another phone) can play Bud while this one runs the app.
 * Other agents (ChatGPT, Claude, any MCP client) drive Bud through Bud Connect (connect.js).
 */
(function () {
  'use strict';
  const K = window.Bud;
  const U = K.util;
  const A = window.BudAgent;
  const { Link } = window.BudLink;
  const { Ear, Voice, Sfx } = window.BudVoice;
  const { Connect, newAppKey, validAppKey, cleanServer } = window.BudConnect;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const IN_PREVIEW = !!(window.claude && typeof window.claude.use === 'function');
  const DEVICE_MODE = location.hash === '#device';
  const WIDE = window.matchMedia && window.matchMedia('(min-width: 980px)').matches;

  /* -------------------------------------------------------------- settings */

  const SKEY = 'bud.app.settings.v1';
  const DEFAULTS = {
    provider: IN_PREVIEW ? 'preview' : 'demo', keys: {}, models: {}, speak: true, voice: '', style: 'buddy', engine: 'system', sounds: true,
    mic: true, wake: false, flip: true, timeout: 8, look: '', shell: '#F4F1EC', autoConnect: false,
    budSpeaker: true, room: true,
  };
  const S = (() => {
    let s = null;
    try {
      s = JSON.parse(localStorage.getItem(SKEY));
    } catch (e) {
      s = null;
    }
    const saved = s && typeof s === 'object' ? s : null;
    s = Object.assign({}, DEFAULTS, saved || {});
    if (typeof saved?.deviceSettingsDirty !== 'boolean') {
      s.deviceSettingsDirty = !!saved && (saved.look !== DEFAULTS.look || saved.timeout !== DEFAULTS.timeout);
    }
    if (!A.PROVIDERS[s.provider] || (s.provider === 'preview' && !IN_PREVIEW)) s.provider = DEFAULTS.provider;
    if (IN_PREVIEW && ['anthropic', 'openai', 'gemini'].includes(s.provider)) s.provider = 'preview';
    s.connect = Object.assign({ on: false, server: '', key: '', seenBy: '' }, s.connect && typeof s.connect === 'object' ? s.connect : {});
    if (s.keys.bud && s.provider === 'demo' && !IN_PREVIEW) s.provider = 'bud'; // the passcode means the real Bud
    // Bud has one voice now, a cheerful young man's; settings saved before that move to it once
    if (s.voiceV !== 2) Object.assign(s, { style: 'buddy', voice: '', voiceV: 2 });
    return s;
  })();
  const save = () => {
    try {
      localStorage.setItem(SKEY, JSON.stringify(S));
    } catch (e) {
      /* private mode */
    }
  };

  const LABEL = { idle: 'Ready', hello: 'Hello', listening: 'Listening', thinking: 'Thinking', working: 'Working', needsyou: 'Needs you', speaking: 'Speaking', done: 'Done', confused: 'Hmm', privacy: 'Mic off', sleeping: 'Resting', love: 'Love' };
  const TEAL = '#79F7E6';
  const tintOf = (st) => (st === 'idle' || st === 'hello' || st === 'sleeping' ? TEAL : K.TINTS[st] || TEAL);
  const CALM = new Set(['idle', 'done', 'love', 'hello', 'privacy', 'confused']);
  const LOOKS = [{ id: '', label: 'Classic', theme: 'classic' }].concat(K.PACKS.map((p) => ({ id: p.id, label: p.label, theme: p.theme })));
  const SHELLS = [['Cloud', '#F4F1EC'], ['Charcoal', '#2D2D31'], ['Sand', '#E5D4BC'], ['Sage', '#B7C8B1'], ['Blush', '#F0C8C3'], ['Sky', '#BBD2EA'], ['Butter', '#F2DF9C'], ['Clay', '#C7886A']];
  const lookCfg = (pack) => (pack && K.PACKS.some(item => item.id === pack)
    ? { character: 'skins', base: 'eyes', pack }
    : { character: 'eyes', theme: 'classic', acc: {}, ambient: null });
  const BASE_CFG = { oled: true, glow: true, grid: false, drift: false, shape: { type: 'circle' }, stage: {}, variety: true };

  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('on'), 2800);
  }

  /* ------------------------------------------------------- the Bud device */

  // What the hardware will do: show states, rest its screen when calm, wake on a tap or a flip.
  class Device {
    constructor(el, link, name) {
      this.el = el;
      this.link = link;
      this.name = name;
      this.scr = new K.Screen(el.querySelector('.bud-screen'), { fps: 60, bloom: true });
      this.scr.set(Object.assign({}, BASE_CFG, lookCfg(''), { state: 'idle' }));
      this.target = 'idle';
      this.timeout = 8;
      this.asleep = false;
      link.on((m) => {
        if (m.type === 'show') this.apply(m);
      });
      // a click is a tap; press and hold (half a second) is a hold
      let holdT = 0;
      let held = false;
      el.addEventListener('pointerdown', () => {
        held = false;
        holdT = setTimeout(() => {
          held = true;
          this.input('hold');
        }, 550);
      });
      const up = () => clearTimeout(holdT);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('click', () => {
        if (!held) this.input('tap');
      });
      this.arm();
      setTimeout(() => link.emit({ type: 'hello', device: { name, kind: 'emulator' } }), 300);
    }
    apply(m) {
      if (m.look) {
        this.scr.set(lookCfg(m.look.pack));
        this.el.style.setProperty('--shell', m.look.shell || '#F4F1EC');
      }
      if (m.timeout) this.timeout = m.timeout;
      const next = m.state || 'idle';
      const changed = next !== this.target;
      this.target = next;
      if (this.asleep && (changed || !CALM.has(next))) this.wake(next);
      else if (!this.asleep) this.scr.set({ state: next });
      this.arm();
    }
    arm() {
      clearTimeout(this.sleepT);
      if (CALM.has(this.target) && !this.asleep) this.sleepT = setTimeout(() => this.sleep(), this.timeout * 1000);
    }
    sleep() {
      this.asleep = true;
      this.scr.set({ state: 'sleeping' });
      this.offT = setTimeout(() => this.scr.set({ brightness: 0 }), 1600);
    }
    wake(next) {
      clearTimeout(this.offT);
      this.asleep = false;
      this.scr.set({ brightness: 1 });
      this.scr.set({ state: next || this.target });
      this.arm();
    }
    input(kind) {
      if (this.asleep && (kind === 'flip' || kind === 'tap')) {
        // a flip shows hello, then whatever Bud was last doing
        this.wake('hello');
        clearTimeout(this.backT);
        this.backT = setTimeout(() => this.scr.set({ state: this.target }), 1500);
      }
      if (kind === 'flip') {
        const rig = this.el.closest('.rig');
        if (rig) {
          rig.classList.remove('flipping');
          void rig.offsetWidth;
          rig.classList.add('flipping');
        }
      }
      this.link.emit({ type: 'input', input: kind });
      this.arm();
    }
  }

  /* --------------------------------------------------------------- wiring */

  // A screen is either the app (with the emulator beside it on a computer) or Bud itself.
  // Switching is instant, so nobody has to edit a link: Settings has "Make this screen the Bud".
  const app = $('.app');
  const link = new Link('app');
  const devLink = new Link('device');
  let device = null;
  let mode = '';
  function ensureDevice(name) {
    if (!device) {
      device = new Device($('#rigBud'), devLink, name);
      bindRig(device);
    }
    device.name = name;
    return device;
  }
  const hello = () => devLink.emit({ type: 'hello', device: { name: device.name, kind: 'emulator' } });
  function setMode(next) {
    if (next === mode) return;
    if (next === 'device') {
      ++deviceChoiceEpoch;
      stopAutoReconnect(!!mode); // a new #device tab stops here but keeps the app's saved preference
    }
    if (next === 'device' && firmwareClient) {
      abandonTurn();
      firmwareClient.close();
      firmwareClient = null;
      firmwareKind = 'none';
    }
    mode = next;
    link.close();
    devLink.close();
    const studio = $('#studio');
    if (mode === 'device') {
      keepAwake(true);
      studio.classList.add('device-mode');
      $('#rig').hidden = false;
      $('#backToApp').hidden = false;
      document.title = 'Bud emulator';
      ensureDevice('Bud on another screen');
      $('#rigSub').textContent = 'This screen is Bud now. Use the app on your other screen.';
      devLink.channel();
      $('#rigLink').textContent = IN_PREVIEW ? 'Connecting to your other screens…' : 'Ready for the app in another tab of this browser.';
      devLink.room().then((t) => {
        if (t) $('#rigLink').textContent = 'Ready. Open this same link on your other device, signed in to the same Claude account.';
        hello();
      });
      hello();
      if (!IN_PREVIEW) restartConnect();
      return;
    }
    keepAwake(false);
    studio.classList.remove('device-mode');
    $('#backToApp').hidden = true;
    document.title = 'Bud';
    if (WIDE) {
      ensureDevice('Virtual Bud');
      link.local(devLink);
      devLink.local(link);
      $('#rig').hidden = false;
      $('#rigSub').textContent = 'What the device on the back of your phone shows';
      drawRig();
    } else {
      $('#rig').hidden = true;
    }
    link.channel();
    link.room();
    $('#rigLink').textContent = 'Want Bud on a second screen? Open this page there and choose Settings, then “Make this screen the Bud”.';
    if (T) show(T.state, T.caption);
    if (!IN_PREVIEW) restartConnect();
  }
  // The emulator is the same phone as the app, seen from the back and drawn in millimeters:
  // Bud is 44 mm across, centered below the camera (where the landing page puts it).
  const BUD_MM = 44;
  const BUD_AT = { x: 35.8, y: 74 };
  function drawRig() {
    const box = $('#rigPhone');
    if (mode !== 'app' || !WIDE || !box.clientWidth) return;
    const base = K.phones.get('iphone');
    if (!base) return;
    const ppm = box.clientWidth / base.w;
    const phone = Object.assign({}, base, { h: box.clientHeight / ppm });
    const pad = 1.6; // phoneSvg's margin for the side buttons, in mm
    const art = $('#rigArt');
    art.innerHTML = K.phoneSvg(phone, 'black');
    Object.assign(art.firstElementChild.style, {
      left: `${-pad * ppm}px`,
      top: `${-pad * ppm}px`,
      width: `${(phone.w + pad * 2) * ppm}px`,
      height: `${(phone.h + pad * 2) * ppm}px`,
    });
    const bud = $('#rigBud');
    bud.style.setProperty('--bx', `${BUD_AT.x * ppm}px`);
    bud.style.setProperty('--by', `${Math.min(BUD_AT.y, phone.h - BUD_MM / 2 - 6) * ppm}px`);
    bud.style.setProperty('--bd', `${BUD_MM * ppm}px`);
  }
  window.addEventListener('resize', drawRig);

  // While a phone plays Bud, keep its screen from turning off (a flip or a tap wakes Bud, not the phone).
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && !wakeLock && navigator.wakeLock && !document.hidden) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => (wakeLock = null));
      } else if (!on && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) {
      /* not allowed here: the phone may sleep */
    }
  }
  document.addEventListener('visibilitychange', () => mode === 'device' && !document.hidden && keepAwake(true));

  $('#useAsBud').addEventListener('click', () => setMode('device'));
  $('#backToApp').addEventListener('click', () => setMode('app'));
  if (IN_PREVIEW) $('#emuLink').hidden = true;
  let T = null;

  const mirror = new K.Screen($('#appBud .bud-screen'), { fps: 60, bloom: true });
  mirror.set(Object.assign({}, BASE_CFG, lookCfg(S.look), { state: S.mic ? 'idle' : 'privacy' }));
  $('#appBud').style.setProperty('--shell', S.shell);

  T = { state: 'idle', caption: '', busy: false, listening: false, waking: false, followUp: false, pending: null, rec: null, typing: false, ctrl: null };
  // Bud Connect: agents' questions waiting their turn, the one on screen, answers on their way,
  // and the reading aloud of a question (see below)
  const ext = { asks: [], current: null, sending: new Set(), idle: 0, note: '', faceAt: 0, reading: 0, speaking: false };

  let firmwareClient = null;
  let idleShow = Promise.resolve();
  let firmwareKind = 'none';
  let reconnectCoordinator = null;
  let pendingAutoClient = null;
  let deviceChoiceEpoch = 0;
  let autoSuppressed = false;
  let turnEpoch = 0;
  let budTranscriber = null;
  const audioReceivers = new WeakMap();
  const audioSetups = new WeakMap();
  const settingsTracks = new WeakMap();
  let settingsIntent = 0; // counts explicit look/rest choices
  let deviceLookCatalog = null;
  // The single-file builds (tools/build.mjs) inline this script; they have no ./device/ modules to load.
  const DEVICE_LINK = !!document.currentScript?.src;
  let deviceModules;
  let BudSpeakerType = null; // app/device/speaker.mjs, once a real Bud is set up
  let BudEarsType = null; // app/device/ears.mjs, likewise
  const loadDeviceModules = () => (deviceModules ||= Promise.all([
    import('./device/client.mjs'), import('./device/protocol/v1-ids.mjs'),
    import('./device/audio-receiver.mjs'), import('./device/protocol/looks.mjs'),
    import('./device/speaker.mjs'), import('./device/ears.mjs'),
  ]));
  const readyClient = () => firmwareClient?.snapshot().phase === 'Ready' ? firmwareClient : null;
  const currentTurn = (epoch) => epoch === turnEpoch && T.ctrl && !T.ctrl.signal.aborted;

  function abandonTurn(reason) {
    const request = T.deviceRequest;
    const client = readyClient();
    ++turnEpoch;
    T.followActivation = null;
    if (T.audio) {
      clearTimeout(T.audio.startTimer);
      T.audio.receiver.cancel('Bud audio task stopped.');
      T.audio.early.length = 0;
      T.audio = null;
    }
    T.ctrl?.abort();
    T.ctrl = null;
    Voice.stop();
    ear.pause();
    if (T.listening) ear._switch('off');
    T.pending?.cancel?.();
    T.pending = null;
    T.deviceRequest = 0;
    T.deviceShows = [];
    T.busy = false;
    T.acceptShows = false;
    if (client && request && client.snapshot().request === request) void client.cancel(request).catch(() => {});
    // An abandoned turn never reaches submit's finally, so "Hey Bud" resumes here (after the mic is free).
    setTimeout(() => { if (S.mic && !T.busy && !document.hidden) ear.resume(); }, 300);
    if (reason) {
      show('confused', reason);
      toast(reason);
    }
    // an agent's question (Bud Connect) that waited behind this turn comes back once the screen is free
    if (ext.current || ext.asks.length) setTimeout(() => !T.busy && (ext.current ? calm() : nextAsk()), reason ? 2600 : 0);
    setTimeout(syncEars, 0); // Bud's always-on ears come back
  }

  // The chip at the top says plainly whether a real Bud is connected (and can hear you).
  const CHIP = {
    hearing: 'Bud connected · mic ready',
    connected: 'Bud connected',
    connecting: 'Connecting Bud…',
    disconnected: 'Bud disconnected',
  };
  function paintDeviceChip(state) {
    $('#deviceText').textContent = state === 'hearing' && budEarsReady() ? 'Bud connected · always listening'
      : CHIP[state] || 'No Bud connected';
    $('#deviceChip').dataset.state = state;
  }

  function onFirmwareState(client, snapshot) {
    if (client !== firmwareClient) return;
    const ready = snapshot.phase === 'Ready';
    T.deviceStatus = snapshot.status;
    paintDeviceChip(ready ? (snapshot.configured ? 'hearing' : 'connected')
      : snapshot.phase === 'Connecting' || snapshot.phase === 'Negotiating' ? 'connecting'
      : firmwareKind !== 'none' ? 'disconnected' : 'virtual');
    $('#setDevice').textContent = ready
      ? snapshot.status ? `Bud ${snapshot.configured ? 'audio ready' : 'control'} · logical mute ${snapshot.status.muted ? 'on' : 'off'}${T.settingsNote ? ` · ${T.settingsNote}` : ''}` : 'Bud · status pending'
      : 'Virtual Bud';
    // A link becoming ready never starts host speech input or resumes an old task.
    if (T.audio?.client === client && (snapshot.phase === 'Disconnected' || snapshot.status?.fault ||
        snapshot.status?.captureHealth === 2 || snapshot.status?.muted)) {
      abandonTurn();
      calm();
      toast(snapshot.phase === 'Disconnected' ? 'Bud disconnected. Recording stopped.' :
        'Bud stopped listening.');
    } else if ((snapshot.phase === 'Disconnected' || snapshot.status?.fault || snapshot.status?.captureHealth === 2) &&
        T.deviceRequest) abandonTurn(snapshot.status?.fault ? 'Bud reported a device fault.' : 'Bud disconnected. Request stopped.');
    if (T.audio?.client === client && snapshot.status?.captureHealth === 1) {
      beginBudReceiver(T.audio, snapshot.status);
    }
    if (ready && budTranscriber) maybeConfigureBudAudio(client, snapshot);
    if (ready) ensureDeviceSettings(client, snapshot);
    if (ready && snapshot.status) followBudMute(client, snapshot);
    paintLooksHint(snapshot);
    if (snapshot.phase === 'Disconnected' && firmwareKind === 'bluetooth' && S.autoConnect && !autoSuppressed && mode === 'app') {
      reconnectCoordinator?.lost();
    }
    if (earsOn?.client === client && (!ready || snapshot.status?.muted || snapshot.status?.fault)) earsOn = null;
    syncEars();
  }

  // "Mic off means off": the app's Mic switch and Bud's mute move together, by simple rules. Only the
  // current Bud counts. The app follows a change in the mute Bud reports (its own Hold, or a Mute it
  // applied) and never sends Mute back; a status that repeats Bud's last value does nothing. Off wins
  // while an off is in flight: an unmute reported while a Mute(true) is unacknowledged is not followed.
  // With CaptureControl the switch sends Mute (Mic off after a typed request ends). A Result never
  // moves the Mic, except that a refused unmute turns it off. On connect, off wins.
  const budMutes = new WeakMap(); // client -> { muted (the mute Bud last reported), deferred, muting }
  function syncBudMute(client = readyClient(), always = false) {
    const mute = client && budMutes.get(client);
    const snapshot = mute && client.snapshot();
    const muted = !S.mic;
    if (!snapshot || !(snapshot.capabilities & 4) || (!always && mute.muted === muted)) return;
    if (muted && snapshot.request && !T.audio) { mute.deferred = true; return; } // muting would cancel the typed task
    mute.deferred = false;
    if (muted) mute.muting++; // Mute(true) commands queued or unacknowledged
    client.setMuted(muted).finally(() => { if (muted) mute.muting--; }).catch((error) => {
      if (client !== readyClient()) return; // a retired or lost Bud never moves the Mic
      if (muted) return toast(error.message);
      if (S.mic) setMic(false, true);
      toast('Bud stayed muted, so the Mic is off.');
    });
  }
  function followBudMute(client, snapshot) {
    const mute = budMutes.get(client);
    const muted = snapshot.status.muted;
    if (!mute) { // the first status from a newly adopted Bud
      budMutes.set(client, { muted, deferred: false, muting: 0 });
      if (!(snapshot.capabilities & 4)) return; // a control-only Bud cannot record or be unmuted from here
      if (muted && S.mic) setMic(false, true);
      else syncBudMute(client);
    } else if (mute.muted !== muted) {
      mute.muted = muted;
      if (S.mic === muted && (muted || !mute.muting)) setMic(!muted, true);
    } else if (mute.deferred && !snapshot.request) {
      mute.deferred = false;
      syncBudMute(client);
    }
  }

  async function makeFirmwareClient() {
    const [{ DeviceClient }, ids, { BudAudioReceiver }, { LookCatalog }, { BudSpeaker }, { BudEars }] = await loadDeviceModules();
    BudSpeakerType = BudSpeaker;
    BudEarsType = BudEars;
    deviceLookCatalog = LookCatalog;
    const receiver = budTranscriber ? new BudAudioReceiver({
      transcribe: (args) => {
        if (!budTranscriber) throw new Error('Bud transcription is unavailable.');
        return budTranscriber(args);
      },
      onTranscript: ({ text, identity }) => {
        const context = T.audio;
        if (context?.receiver !== receiver || !currentTurn(context.epoch) ||
            context.generation !== identity.generation || context.session !== identity.session ||
            context.request !== identity.request || context.recording !== identity.recording) return;
        void submit(text, { deviceContext: context });
      },
      onSamples: (samples, rateHz) => {
        const context = T.audio;
        if (context?.receiver === receiver && context.speech) context.speech(samples, rateHz);
      },
      onError: (error) => {
        if (T.audio?.receiver !== receiver) return;
        abandonTurn();
        calm();
        toast(/returned no text/.test(error.message) ? 'Bud didn’t hear anything.' : error.message);
      },
    }) : null;
    const client = new DeviceClient({ capabilities: receiver ? 63 : 43, audioAvailable: !!receiver,
      onState: (snapshot) => onFirmwareState(client, snapshot),
      onError: (error) => { if (client === firmwareClient) toast(error.message); },
      onAudio: (bytes, generation) => receiveBudAudio(client, bytes, generation),
      onEvent: (message) => {
        if (client !== firmwareClient) return;
        if (message.type === ids.Type.Activation) {
          // always listening: Bud opened its next recording
          if (budEarsReady(client)) {
            if (!earsOn && earsWanted(client)) void startEars(client, message);
            return;
          }
          // Bud opens its mic for your answer right after asking (its follow-up), which can land
          // while this turn is still wrapping up: start it when the turn is done.
          if (T.busy) { T.followActivation = { client, message }; return; }
          const configuring = !client.snapshot().configured && audioSetups.get(client);
          if (configuring) void configuring.then(() => startBudCapture(client, message));
          else void startBudCapture(client, message);
          return;
        }
        if (message.type === ids.Type.CaptureStopped) {
          // a tap ends Bud's always-on recording: Bud opens the next one, and the tap means "listen"
          if (earsOn && earsOn.client === client && earsOn.request === message.request) {
            void stopEars();
            return;
          }
          stopBudReceiver(client, message);
          return;
        }
        if (message.type === ids.Type.RequestCancelled) {
          if (earsOn && earsOn.client === client && earsOn.request === message.request) {
            earsOn = null; // Bud ended its always-on recording; it opens the next one
            return;
          }
          if (askOnBud && askOnBud.client === client && askOnBud.request === message.request) {
            askOnBud = null; // Bud let go of an agent's question; its card stays on the phone
            return;
          }
          if (T.busy || T.pending || T.deviceRequest === message.request) {
            abandonTurn();
            calm();
            toast(message.stopReason === ids.StopReason.Timeout
              ? 'Bud stopped this request after a timeout.' : 'Bud cancelled this request.');
          }
          return;
        }
        if (message.type !== ids.Type.Input) return;
        if (message.gesture === ids.Gesture.Tap && budEarsReady(client) && !T.busy && !T.pending) {
          attend(); // always listening: a tap means "this next part is for you"
          return;
        }
        // Raw Input is observation; only the bound offerApproval promise can approve.
        if (message.gesture === ids.Gesture.Tap && !T.busy && !T.pending && !T.listening &&
            !(budTranscriber && client.snapshot().configured &&
              (client.snapshot().capabilities & ids.Capability.AudioStream))) {
          $('#say').focus();
          // say why Bud isn't listening, so the fix is clear
          toast(!budTranscriber ? 'Tap received. To talk to Bud, add the Bud passcode in Agents, then reconnect Bud.'
            : !audioReceivers.get(client) ? 'Tap received. Reconnect Bud so it can use its microphone.'
            : 'Tap received. Bud’s microphone is still setting up. Type your request for now.');
        } else if (message.gesture === ids.Gesture.Flip) toast('Bud woke.');
      },
    });
    if (receiver) audioReceivers.set(client, receiver);
    return client;
  }

  function maybeConfigureBudAudio(client, snapshot) {
    if (client !== firmwareClient || !snapshot.audioOffer || snapshot.configured ||
        audioSetups.has(client) || !(snapshot.capabilities & 16) || !audioReceivers.get(client)) return;
    const offer = snapshot.audioOffer;
    const maxPacketBytes = Math.min(offer.maxPacketBytes, snapshot.audioMaxPacketBytes);
    const codec = offer.codecs & 2 ? 1 : offer.codecs & 1 ? 0 : -1;
    const rateKhz = offer.rates & 2 ? 16 : offer.rates & 1 ? 8 : 0;
    const channel = offer.channels & 1 ? 0 : offer.channels & 2 ? 1 : offer.channels & 4 ? 2 : -1;
    const room = maxPacketBytes - 34;
    const sampleCount = Math.min(rateKhz * 20, codec === 1 ? room * 2 : Math.floor(room / 2));
    if (codec < 0 || !rateKhz || channel < 0 || sampleCount < 1) {
      toast('Bud offered no usable audio format.');
      return;
    }
    const selected = { codec, rateKhz, channel, sampleCount, maxPacketBytes };
    const pending = client.configureAudio(selected).catch((error) => {
      if (client === firmwareClient) toast(error.message);
    });
    audioSetups.set(client, pending);
  }

  function showSettingsNote(client, note) {
    if (client !== firmwareClient) return;
    T.settingsNote = note;
    const snapshot = client.snapshot();
    const base = snapshot.status
      ? `Bud ${snapshot.configured ? 'audio ready' : 'control'} · logical mute ${snapshot.status.muted ? 'on' : 'off'}`
      : 'Bud · status pending';
    $('#setDevice').textContent = `${base}${note ? ` · ${note}` : ''}`;
    paintLooksHint(snapshot);
  }

  function paintLooksHint(snapshot = firmwareClient?.snapshot()) {
    const hint = $('#page-looks > .hint');
    if (!hint) return;
    hint.textContent = snapshot?.phase === 'Ready' && (snapshot.capabilities & 32)
      ? !S.deviceSettingsDirty && T.settingsNote === 'look saved on Bud'
        ? 'This look and screen timeout are saved on Bud.'
        : 'Preview a look. Bud will apply it after confirming the saved settings.'
      : 'Preview looks here. A compatible Bud can save a look and screen timeout.';
  }

  function catalogLook(id) {
    return deviceLookCatalog?.looks.find(entry => entry.id === id) || null;
  }

  function paintLookChoice() {
    $$('#lookGrid .look').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.look === S.look)));
    $('#setTimeout').value = String(S.timeout);
    mirror.set(lookCfg(S.look));
  }

  function ensureDeviceSettings(client, snapshot) {
    if (client !== firmwareClient) return;
    if (!(snapshot.capabilities & 32)) {
      if (S.deviceSettingsDirty) showSettingsNote(client, 'look sync unavailable');
      return;
    }
    const prior = settingsTracks.get(client);
    if (prior?.generation === snapshot.generation) return;
    const track = { generation: snapshot.generation, ready: false, running: false,
      blocked: false, retryRequested: false };
    settingsTracks.set(client, track);
    showSettingsNote(client, 'reading look');
    void client.readSettings().then(applied => {
      if (client !== firmwareClient || settingsTracks.get(client) !== track) return;
      const entry = deviceLookCatalog?.looks[applied.look];
      if (!entry || entry.code !== applied.look || applied.catalogVersion !== deviceLookCatalog.version) {
        track.blocked = true;
        showSettingsNote(client, 'unsupported look catalog');
        toast('Bud reported an unsupported look catalog.');
        return;
      }
      track.ready = true;
      if (S.deviceSettingsDirty) {
        showSettingsNote(client, 'look pending');
        syncDeviceSettings(client, track);
      } else {
        S.look = entry.id;
        S.timeout = applied.restSeconds;
        save();
        paintLookChoice();
        show(T.state, T.caption);
        showSettingsNote(client, 'look saved on Bud');
      }
    }, error => {
      if (client !== firmwareClient || settingsTracks.get(client) !== track) return;
      track.blocked = true;
      showSettingsNote(client, 'look storage unavailable');
      toast(error.message);
    });
  }

  function syncDeviceSettings(client, track) {
    if (client !== firmwareClient || !track.ready || track.running || track.blocked ||
        client.snapshot().generation !== track.generation || !S.deviceSettingsDirty) return;
    track.running = true;
    const run = async () => {
      while (client === firmwareClient && client.snapshot().generation === track.generation &&
          S.deviceSettingsDirty && !track.blocked) {
        const entry = catalogLook(S.look);
        if (!entry || !deviceLookCatalog.restSeconds.includes(S.timeout)) {
          track.blocked = true;
          showSettingsNote(client, 'unsupported look selection');
          toast('Choose a supported Bud look and screen timeout.');
          break;
        }
        const desired = { look: entry.code, restSeconds: S.timeout };
        const intent = settingsIntent;
        const current = client.snapshot().settings;
        if (!current?.storageHealthy || !current.revision) {
          track.blocked = true;
          showSettingsNote(client, 'look storage unavailable');
          toast('Bud could not verify its saved look.');
          break;
        }
        if (current.look === desired.look && current.restSeconds === desired.restSeconds) {
          S.deviceSettingsDirty = false;
          save();
          showSettingsNote(client, 'look saved on Bud');
          break;
        }
        showSettingsNote(client, 'applying look');
        try {
          await client.setSettings(current.revision, desired.look, desired.restSeconds,
            deviceLookCatalog.version);
        } catch (error) {
          if (client !== firmwareClient || client.snapshot().generation !== track.generation ||
              settingsTracks.get(client) !== track) break;
          track.blocked = true;
          if (settingsIntent !== intent) track.retryRequested = true; // a newer choice retries from a fresh read
          if (error.resultCode === 10) {
            try { await client.readSettings(); } catch (_) { /* keep conflict visible */ }
            if (client !== firmwareClient || settingsTracks.get(client) !== track ||
                track.retryRequested) break;
            showSettingsNote(client, 'look conflict · choose again');
          } else showSettingsNote(client, 'look not saved');
          toast(error.message);
          break;
        }
        if (client !== firmwareClient || client.snapshot().generation !== track.generation ||
            settingsTracks.get(client) !== track) break;
        // If the user changed the controls during the write, use the fresh
        // readback revision for the latest choice rather than sending every step.
        if (S.look === entry.id && S.timeout === desired.restSeconds) {
          S.deviceSettingsDirty = false;
          save();
          showSettingsNote(client, 'look saved on Bud');
        }
      }
    };
    void run().finally(() => {
      track.running = false;
      if (client !== firmwareClient || settingsTracks.get(client) !== track) return;
      if (track.retryRequested) {
        settingsTracks.delete(client);
        showSettingsNote(client, 'reading look');
        ensureDeviceSettings(client, client.snapshot());
      } else if (S.deviceSettingsDirty && !track.blocked) {
        syncDeviceSettings(client, track);
      }
    });
  }

  function markDeviceSettingsDirty() {
    S.deviceSettingsDirty = true;
    settingsIntent++;
    save();
    paintLooksHint();
    const client = readyClient();
    if (!client) return;
    const track = settingsTracks.get(client);
    if (track?.blocked) {
      if (track.running) {
        track.retryRequested = true;
        showSettingsNote(client, 'look pending');
        return;
      }
      // A transient read/save failure may have left the cached revision unusable.
      // A new explicit choice starts with a fresh device read before any write.
      settingsTracks.delete(client);
      showSettingsNote(client, 'reading look');
      ensureDeviceSettings(client, client.snapshot());
      return;
    }
    if (track) {
      showSettingsNote(client, 'look pending');
      syncDeviceSettings(client, track);
    } else ensureDeviceSettings(client, client.snapshot());
  }

  function abortBudCapture(context, message) {
    if (T.audio !== context) return;
    abandonTurn();
    calm();
    toast(message);
  }

  function beginBudReceiver(context, status) {
    if (T.audio !== context || context.started || !context.request ||
        status.session !== context.session || status.request !== context.request ||
        !status.recording || context.client.snapshot().generation !== context.generation) return;
    const config = context.client.snapshot().configured;
    if (!config) return abortBudCapture(context, 'Bud audio format was lost.');
    try {
      context.receiver.begin({ session: context.session, request: context.request,
        recording: status.recording, generation: context.generation,
        codec: config.codec, rateKhz: config.rateKhz, channel: config.channel });
      context.recording = status.recording;
      context.started = true;
      context.speech = speechEnd(() => {
        if (T.audio === context) void context.client.finishCapture(context.request).catch(() => {});
      });
      clearTimeout(context.startTimer);
      context.startTimer = 0;
      for (const bytes of context.early) {
        context.receiver.accept(bytes, context.generation);
        if (T.audio !== context) break;
      }
      context.early.length = 0;
      if (T.audio === context && context.pendingStop) {
        context.receiver.stopped(context.pendingStop, context.generation);
        context.pendingStop = null;
      }
    } catch (error) { abortBudCapture(context, error.message); }
  }

  // Bud's mic has nothing to let go of, so the recording ends when you stop talking: a 1.2 s
  // pause after speech, 6 s with no speech at all, or 20 s in any case. Speech is a frame louder
  // than four times the room's hum (the quietest moment so far, drifting up slowly), and only a
  // frame under about twice the hum counts toward the pause, so soft trailing words keep it open.
  function speechEnd(finish, { quietMs = 1200, silentMs = 6000, longestMs = 20000 } = {}) {
    const levels = [];
    let floor = Infinity, total = 0, done = false;
    return (samples, rateHz) => {
      if (done || !samples.length) return;
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      const level = Math.sqrt(sum / samples.length);
      const ms = (samples.length / rateHz) * 1000;
      total += ms;
      levels.push(level);
      floor = Math.min(level, floor * 1.002);
      const speech = Math.max(300, floor * 4), pause = Math.max(200, floor * 2.2); // device/ears.mjs
      let quiet = 0;
      for (let i = levels.length - 1; i >= 0 && levels[i] <= pause; i--) quiet += ms;
      const spoke = levels.reduce((n, l) => n + (l > speech), 0) * ms >= 240;
      if ((spoke && quiet >= quietMs) || (!spoke && total >= silentMs) || total >= longestMs) {
        done = true;
        finish();
      }
    };
  }

  function receiveBudAudio(client, bytes, generation) {
    if (earsOn && earsOn.client === client && earsOn.generation === generation && earsOn.ears) {
      earsOn.ears.accept(bytes);
      rollEars(earsOn);
      return;
    }
    const context = T.audio;
    if (!context || context.client !== client || context.generation !== generation) return;
    if (context.started) {
      context.receiver.accept(bytes, generation);
      return;
    }
    // The ESP32 sends control frames ~200 ms apart, so ~30 packets can precede Running: keep up to ~2 s.
    if (context.early.length >= 100) return abortBudCapture(context, 'Bud sent audio before capture was ready.');
    context.early.push(bytes.slice());
  }

  /* --------------------------------------------------------- Bud's always-on ears */

  // With "Hey Bud" on and a real Bud with a microphone, Bud listens through its own mic: while the
  // app asks (client.listen), the firmware opens a recording whenever Bud is idle. The app cuts it
  // into phrases (device/ears.mjs), turns each into text, and acts on "Hey Bud, ..." (or anything
  // said right after "Hey Bud", a tap, or a question from Bud). The rest is room context. Bud's mic
  // and speaker share wiring, so Bud stops listening while it talks or works on a request.
  let earsOn = null; // { client, session, generation, request, ears } for the recording now
  let earsAsked = null; // { client, on }: what Bud was last told
  let earsHeld = 0; // reasons to stay quiet a moment (Bud speaking, a handoff)
  let earsQueue = Promise.resolve(); // phrases are heard in order
  let earsEnding = Promise.resolve(); // recordings being ended, in order
  const budEarsReady = (client = readyClient()) => !!(client && S.wake && S.mic && budTranscriber && BudEarsType &&
    client.canListen && client.snapshot().configured);
  const earsWanted = (client) => budEarsReady(client) && !earsHeld && !T.busy && !T.audio;

  function syncEars() {
    const client = readyClient();
    const want = !!client && earsWanted(client);
    // the computer's or phone's own "Hey Bud" steps aside while Bud listens itself
    if (canHear()) ear.setWake(S.wake && !budEarsReady(client));
    if (!client) { earsAsked = null; return; }
    // a Bud without its own ears (the firmware simulator) has nothing to turn on or off
    if (client.canListen && (!earsAsked || earsAsked.client !== client || earsAsked.on !== want)) {
      earsAsked = { client, on: want };
      client.listen(want).catch(() => { if (earsAsked?.client === client) earsAsked = null; });
    }
    if (!want && earsOn) void stopEars();
  }

  async function startEars(client, activation) {
    const snapshot = client.snapshot();
    const ctx = { client, session: snapshot.session, generation: snapshot.generation, request: 0, ears: null, opening: null };
    earsOn = ctx;
    try {
      ctx.opening = client.beginRequest();
      ctx.request = await ctx.opening;
      if (earsOn !== ctx) return void client.cancel(ctx.request).catch(() => {});
      ctx.ears = new BudEarsType({ session: ctx.session, request: ctx.request,
        onPhrase: (samples, rateHz) => heardPhrase(samples, rateHz) });
      sendSessionFace(T.state, T.caption, 0); // the face stays as the app shows it
      await client.startCapture(activation.activation, ctx.request);
    } catch (error) {
      if (earsOn !== ctx) return;
      earsOn = null;
      if (ctx.request && client.snapshot().request === ctx.request) client.cancel(ctx.request).catch(() => {});
    }
  }

  // Ends the recording now (Bud opens the next one if it should still listen). Every caller waits
  // for every recording being ended, including one another caller started ending a moment ago.
  function stopEars() {
    const ctx = earsOn;
    earsOn = null;
    if (ctx) {
      earsEnding = earsEnding.then(async () => {
        try { await ctx.opening; } catch { /* it never opened */ }
        const request = ctx.request;
        if (!request || ctx.client.snapshot().request !== request) return;
        try { await ctx.client.cancel(request); } catch { /* the link may be gone */ }
      });
    }
    return earsEnding;
  }
  // Before a turn of its own: Bud's always-on recording, finished or not, must be gone.
  async function freeBud(client) {
    syncEars();
    await stopEars();
    const open = client.snapshot().request;
    if (open && open !== T.deviceRequest && open !== askOnBud?.request) {
      try { await client.cancel(open); } catch { /* the link may be gone */ }
    }
  }

  // A recording lasts under a minute (Bud's limit): end it between phrases, and start the next.
  function rollEars(ctx) {
    if (!ctx.ears.due) return;
    ctx.ears.flush();
    void stopEars();
  }

  function heardPhrase(samples, rateHz) {
    const seconds = (samples.length / rateHz).toFixed(1);
    earsQueue = earsQueue.then(async () => {
      let text = '';
      try { text = String((await budTranscriber({ samples, rateHz })) || '').trim(); } catch (error) {
        console.warn(`Bud heard ${seconds} s but could not make it out:`, error.message);
        return;
      }
      console.info(`Bud heard ${seconds} s: "${text}"`);
      if (!text) return;
      showHeard(text);
      earsHeard(text);
    });
  }
  // What Bud just heard, under its status for a few seconds, so you can see it listening.
  function showHeard(text) {
    if (T.busy || T.state !== 'idle') return;
    const line = $('#statusSub');
    line.textContent = `Heard: “${text.length > 80 ? `${text.slice(0, 77)}…` : text}”`;
    clearTimeout(T.heardT);
    T.heardT = setTimeout(() => { if (T.state === 'idle' && !T.busy) line.textContent = T.caption || idleHint(); }, 5000);
  }

  // "Hey Bud" in what Bud's own mic heard. The transcription service spells it well, so only
  // "hey" or "hi" with "Bud" (or "Buddy") at the start of a sentence counts: unlike the browser's
  // WAKE, never "okay, but" or "hey, but", and never a "hey buddy" in the middle of one.
  const EARS_WAKE = /(?:^|[.!?]\s+|,\s*)(?:(?:hey|hi|hay|heya|hiya|okay|ok|yo|hello)[\s,.!]*(?:buddy|bud's|buds|budd|bud|bod|bot|bug|bub|but(?=\s*(?:[,.!?]|$)))|(?:bud|buddy)(?=\s*[,!?]))\b[\s,.!?]*/i;

  function earsHeard(text) {
    const wake = EARS_WAKE.exec(text);
    const before = wake ? text.slice(0, wake.index).trim() : '';
    const after = wake ? text.slice(wake.index + wake[0].length).replace(/^[\s,.!?]+/, '').trim() : '';
    if (T.busy || T.audio) return overheard(text);
    if (before) overheard(before);
    // a question on screen: a spoken yes or no answers it, but only right after Bud asked it (or
    // after "Hey Bud" or a tap), so a "yeah" in the conversation around Bud never approves anything
    if (T.pending && !wake && T.attentionUntil > Date.now()) {
      const said = answerWord(text);
      if (said !== null) {
        T.attentionUntil = 0;
        return T.pending(said);
      }
    }
    if (wake && !after) return attend();
    const request = wake ? after : T.attentionUntil > Date.now() ? text : '';
    if (!request) return overheard(text);
    T.attentionUntil = 0;
    Sfx.heard();
    void earsRequest(request);
  }

  // "Hey Bud" on its own, a tap, or Bud's own question: the next phrase is for Bud.
  function attend() {
    T.attentionUntil = Date.now() + 8000;
    Sfx.listen();
    show('listening', 'Listening');
    clearTimeout(T.attendT);
    T.attendT = setTimeout(() => {
      if (!T.attentionUntil || T.attentionUntil > Date.now() || T.busy) return;
      T.attentionUntil = 0;
      if (T.state === 'listening') calm();
    }, 8100);
  }

  async function earsRequest(text) {
    earsHeld++;
    try {
      syncEars();
      await stopEars();
    } finally {
      earsHeld--;
    }
    submit(text); // busy from here, so Bud stays quiet until the turn is over
  }

  function stopBudReceiver(client, message) {
    const context = T.audio;
    if (!context || context.client !== client || context.session !== message.session ||
        context.request !== message.request || context.generation !== client.snapshot().generation) return;
    if (message.stopReason !== 0) return abortBudCapture(context, 'Bud stopped the recording.');
    if (context.started) {
      if (message.recording === context.recording) context.receiver.stopped(message, context.generation);
      return;
    }
    context.pendingStop = message;
  }

  async function startBudCapture(client, activation) {
    const snapshot = client.snapshot();
    const receiver = audioReceivers.get(client);
    if (client !== firmwareClient || !receiver || !budTranscriber || !snapshot.configured ||
        !(snapshot.capabilities & 16) || T.busy || T.pending || T.listening) return;
    if (!S.mic) { // a Bud tap never records while the app's Mic is off
      toast('The mic is off. Hold Bud, or turn it on in Settings.');
      return syncBudMute(client);
    }
    const epoch = ++turnEpoch;
    const context = { client, receiver, epoch, session: snapshot.session,
      generation: snapshot.generation, request: 0, recording: 0,
      early: [], started: false, pendingStop: null, startTimer: 0 };
    T.audio = context;
    T.busy = true;
    T.deviceRequest = 0;
    T.deviceShows = [];
    T.deviceError = null;
    T.acceptShows = false;
    T.ctrl = new AbortController();
    ear.pause();
    go('home');
    show('listening', 'Bud is listening');
    try {
      await idleShow;
      if (T.audio !== context || !currentTurn(epoch)) return;
      const request = await client.beginRequest();
      if (T.audio !== context || !currentTurn(epoch)) {
        if (client.snapshot().request === request) void client.cancel(request).catch(() => {});
        return;
      }
      context.request = T.deviceRequest = request;
      await client.startCapture(activation.activation, request);
      if (T.audio !== context || !currentTurn(epoch)) return;
      if (!context.started) context.startTimer = setTimeout(() => {
        abortBudCapture(context, 'Bud did not start recording.');
      }, 5000);
    } catch (error) {
      if (T.audio === context) abortBudCapture(context, error.message);
    }
  }

  function adoptFirmwareClient(client, kind) {
    // Only a turn bound to the old Bud ends; a host-only typed turn carries on.
    if (T.deviceRequest || T.audio) { abandonTurn(); calm(); }
    const old = firmwareClient;
    firmwareClient = null;
    audioReceivers.get(old)?.cancel('Device replaced.');
    old?.close();
    firmwareClient = client;
    firmwareKind = kind;
    T.settingsNote = '';
    onFirmwareState(client, client.snapshot());
  }

  function waitFirmwareReady(client, timeoutMs = 7000, requireCurrent = true) {
    if (client.snapshot().phase === 'Ready') return Promise.resolve(client);
    return new Promise((resolve, reject) => {
      const started = performance.now();
      const poll = () => {
        if ((requireCurrent && client !== firmwareClient) || client.snapshot().phase === 'Disconnected') return reject(new Error('Bud disconnected before it was ready.'));
        if (client.snapshot().phase === 'Ready') return resolve(client);
        if (performance.now() - started >= timeoutMs) {
          client.close();
          return reject(new Error('Bud did not complete its v1 handshake.'));
        }
        setTimeout(poll, 50);
      };
      poll();
    });
  }

  const SAVED_BUD_KEY = 'bud-v1-device-id';
  // Chrome keeps getDevices() behind a flag; without it a saved Bud can only come back through Connect.
  const canReopenBud = () => typeof navigator.bluetooth?.getDevices === 'function';
  const hasSavedBud = () => {
    try { return canReopenBud() && !!localStorage.getItem(SAVED_BUD_KEY); } catch (_) { return false; }
  };
  function stopAutoReconnect(disablePreference = false) {
    autoSuppressed = true;
    reconnectCoordinator?.stop();
    pendingAutoClient?.close();
    pendingAutoClient = null;
    if (disablePreference) { S.autoConnect = false; save(); }
  }
  let reconnectSetup;
  function setupAutoReconnect() {
    return (reconnectSetup ||= import('./device/reconnect.mjs').then(({ ForegroundReconnect }) => {
      reconnectCoordinator = new ForegroundReconnect({
        visible: () => mode === 'app' && !document.hidden,
        online: () => navigator.onLine !== false,
        attempt: async ({ isCurrent }) => {
          const client = await makeFirmwareClient();
          if (!isCurrent()) { client.close(); throw new Error('Saved Bud attempt was replaced.'); }
          pendingAutoClient = client;
          let deadline = 0;
          try {
            const handshake = (async () => {
              await client.reconnect(); // getDevices only; no new chooser
              if (!isCurrent()) throw new Error('Saved Bud attempt was replaced.');
              await waitFirmwareReady(client, 7000, false);
            })();
            await Promise.race([handshake, new Promise((_, reject) => {
              deadline = setTimeout(() => {
                client.close();
                reject(new Error('Saved Bud reconnect attempt timed out.'));
              }, 10000);
            })]);
            if (!isCurrent()) throw new Error('Saved Bud attempt was replaced.');
            return client;
          } catch (error) { client.close(); throw error; }
          finally {
            clearTimeout(deadline);
            if (pendingAutoClient === client) pendingAutoClient = null;
          }
        },
        cancelAttempt: () => { pendingAutoClient?.close(); pendingAutoClient = null; },
        onConnected: (client) => {
          if (client.snapshot().phase !== 'Ready') throw new Error('Saved Bud did not finish its new handshake.');
          adoptFirmwareClient(client, 'bluetooth');
          toast('Saved Bud reconnected.');
        },
        onError: () => {
          if (S.autoConnect && mode === 'app' && !readyClient()) $('#setDevice').textContent = 'Waiting for saved Bud…';
        },
        onState: (state) => {
          if (!state.enabled || state.connected || mode !== 'app' || readyClient()) return;
          $('#setDevice').textContent = state.paused ? 'Saved Bud reconnect paused' : 'Looking for saved Bud…';
        },
      });
      if (S.autoConnect && !autoSuppressed && hasSavedBud() && mode === 'app') {
        reconnectCoordinator.start({ connected: firmwareKind === 'bluetooth' && !!readyClient() });
      }
      return reconnectCoordinator;
    }));
  }

  function show(state, caption, progress) {
    T.state = state;
    T.caption = caption || '';
    mirror.set({ state });
    const led = $('#status .led');
    led.style.setProperty('--c', tintOf(state));
    $('#statusText').textContent = LABEL[state] || state;
    $('#statusSub').textContent = caption || (state === 'idle' ? idleHint() : state === 'privacy' ? 'Not listening' : '');
    link.emit({ type: 'show', state, caption: caption || '', progress: progress || 0, look: { pack: S.look, shell: S.shell }, mic: S.mic, timeout: S.timeout });
    sendSessionFace(state, caption, progress);
  }
  function sendSessionFace(state, caption, progress) {
    const client = readyClient();
    if (!client) return;
    // while Bud's always-on ears record, the face goes to that recording's request
    const open = client.snapshot().request;
    const onEars = !!(earsOn && open && open === earsOn.request);
    // listening too: while the phone's mic hears you, Bud shows it and stays awake
    const face = CALM.has(state) || state === 'listening' || (onEars && state === 'needsyou');
    if ((open !== 0 && !onEars) || !face || T.busy || (T.pending && !onEars) || T.deviceRequest || T.acceptShows) return;
    const epoch = turnEpoch;
    const byte = Math.max(0, Math.min(255, Math.round((Number(progress) || 0) * 255 / 100)));
    try {
      idleShow = client.show(state, byte, caption || '', onEars ? open : 0).catch((error) => {
        // DeviceClient.onError reports the failure; an idle update never revives an old turn.
        if (client !== firmwareClient || epoch !== turnEpoch) return;
        T.deviceError = error;
      });
    } catch (error) {
      if (client === firmwareClient && epoch === turnEpoch) toast(error.message);
    }
  }
  function showTurn(epoch, state, caption = '', progress = 0) {
    if (!currentTurn(epoch) || !T.acceptShows) return;
    show(state, caption, progress);
    const client = readyClient();
    if (!client || !T.deviceRequest) return;
    const byte = Math.max(0, Math.min(255, Math.round((Number(progress) || 0) * 255 / 100)));
    const sent = client.show(state, byte, caption, T.deviceRequest).catch((error) => {
      if (currentTurn(epoch)) {
        T.deviceError = error;
        abandonTurn('Bud could not show this request.');
      }
    });
    T.deviceShows.push(sent);
  }
  async function flushTurnShows(epoch) {
    await Promise.all(T.deviceShows || []);
    if (!currentTurn(epoch)) throw new Error('Turn changed while updating Bud.');
    if (T.deviceError) throw T.deviceError;
  }
  // Bud rests when nothing is going on, unless an agent's question is still open: then it stays pink for it.
  function calm() {
    if (ext.current && !T.busy && !T.listening && !T.followUp) {
      T.pending = ext.current.decide;
      return show('needsyou', ext.current.question);
    }
    show(S.mic ? 'idle' : 'privacy');
  }
  const idleHint = () => (ear.mode === 'wake' ? 'Say “Hey Bud”, or tap Bud' : 'Tap Bud to talk');

  link.on((m) => {
    if (m.type === 'input') input(m.input);
    if (m.type === 'hello') {
      if (!readyClient() && m.device && m.device.kind === 'emulator' && m.device.name !== 'Virtual Bud') {
        paintDeviceChip('connected');
        $('#setDevice').textContent = m.device.name;
        toast(`${m.device.name} connected`);
      }
      show(T.state, T.caption);
    }
  });

  function input(kind) {
    if (kind === 'tap') {
      if (T.followUp) return startTurn(); // Bud just asked you something: the tap is your reply
      if (T.listening) return stopListening();
      if (T.pending && T.state === 'needsyou') return T.pending(true);
      if (T.busy) return;
      return startTurn();
    }
    if (kind === 'hold') {
      if (T.pending && T.state === 'needsyou') return T.pending(false);
      return setMic(!S.mic);
    }
    if (kind === 'flip' && S.flip) toast('Flipped. Bud is awake.');
  }

  /* -------------------------------------------------------------- talking */

  // What Bud overhears while "Hey Bud" listens, for context when someone does say "Hey Bud". Only
  // in this page's memory (gone on reload), the last 20 minutes, and short enough for the brain.
  const ROOM_MS = 20 * 60 * 1000, ROOM_CHARS = 4500;
  const room = [];
  function overheard(text) {
    if (!S.room) return;
    room.push({ at: Date.now(), text });
    let chars = room.reduce((n, r) => n + r.text.length + 1, 0);
    while (room.length && (Date.now() - room[0].at > ROOM_MS || chars > ROOM_CHARS)) chars -= room.shift().text.length + 1;
  }
  const roomText = () => {
    while (room.length && Date.now() - room[0].at > ROOM_MS) room.shift();
    return S.room ? room.map((r) => r.text).join('\n') : '';
  };

  // Voice in needs a page that may use the mic. A claude.ai preview may not, so Bud takes typing there.
  const canHear = () => ear.available && !IN_PREVIEW && !ear.blocked;
  let touched = false; // has the visitor tapped or typed yet (some browsers open the mic only after that)
  const ear = new Ear({
    onState(mode) {
      T.listening = mode === 'turn';
      $('#micBtn').classList.toggle('on', mode === 'turn');
      if (T.state === 'idle') show('idle');
    },
    onWake() {
      // "Hey Bud": wake up and listen for the request
      T.waking = true;
      T.followUp = false;
      // the ear can drop a half-heard "Hey Bud" without a word (page hidden, mic off): don't wait forever
      clearTimeout(T.wakeT);
      T.wakeT = setTimeout(abandonWake, 12000);
      Sfx.listen();
      $('#say').value = '';
      go('home');
      show('listening', 'Listening');
    },
    onInterim(text) {
      $('#say').value = text;
    },
    onHeard(text, how) {
      T.waking = false;
      clearTimeout(T.wakeT);
      if (text) {
        Sfx.heard();
        const said = T.pending ? answerWord(text) : null;
        if (said !== null) {
          $('#say').value = '';
          if (S.mic && !T.busy) ear.resume();
          return T.pending(said);
        }
        if (ext.current && T.pending === ext.current.decide) {
          // an agent's question is up: say yes or no, or type a request (a spoken one could be the question read back)
          $('#say').value = '';
          toast('Answer the question on Bud first: say yes or no, or tap.');
          if (S.mic && !T.busy && !ext.speaking) ear.resume();
          return;
        }
        submit(text);
      } else if (how === 'tap') {
        if (ear.blocked) listenTyping();
        else {
          calm();
          ear.resume();
          nextAsk();
        }
      }
    },
    onAmbient(text) {
      overheard(text);
    },
    onWakeTimeout() {
      T.waking = false;
      clearTimeout(T.wakeT);
      $('#say').value = '';
      if (T.state === 'listening' && !T.busy) calm();
      nextAsk();
    },
    onError(code) {
      if (!touched && code === 'not-allowed') return; // some browsers open the mic only after a tap: try again then
      if (code === 'not-allowed' || code === 'service-not-allowed') toast('Bud is not allowed to use the mic here. Allow it in the browser, or type instead.');
      else if (code === 'audio-capture') toast('No microphone found. Type instead.');
      if (S.wake) {
        S.wake = false;
        save();
        paintListening();
      }
    },
  });

  // "Hey Bud" was heard but the request never came (or the ear was paused): let things go on.
  function abandonWake() {
    if (!T.waking) return;
    T.waking = false;
    clearTimeout(T.wakeT);
    if (T.state === 'listening' && !T.busy && !T.listening) calm();
    nextAsk();
  }

  function startTurn() {
    T.followUp = false;
    if (!S.mic) {
      show('privacy', 'Mic is off');
      toast('The mic is off. Hold Bud, or turn it on in Settings.');
      return;
    }
    go('home');
    Sfx.unlock();
    Sfx.listen();
    if (canHear()) {
      $('#say').value = '';
      show('listening', 'Listening');
      ear.listen();
    } else listenTyping();
  }

  function listenTyping() {
    T.typing = true;
    T.followUp = false;
    typed();
    show('listening', 'Type what you want');
    const box = $('#say');
    box.focus();
    if (!T.typeNote) {
      T.typeNote = true;
      if (IN_PREVIEW) toast('Voice works when the app runs from your computer. Type here for now.');
      else if (!ear.available) toast('This browser has no speech input. Try Chrome or Safari, or type.');
    }
  }
  function stopListening() {
    ear.finish();
  }

  // The natural voice comes from Bud's server when there is a passcode, else from your OpenAI key.
  // Bud's own speaker, when a real Bud with one is connected (its natural voice only).
  let budSpeaker = null;
  const speakerSink = () => {
    const client = readyClient();
    if (!S.budSpeaker || !client || !client.canSpeak) return null;
    if (!budSpeaker || budSpeaker.client !== client) {
      budSpeaker?.stop();
      budSpeaker = Object.assign(new BudSpeakerType((bytes) => client.speak(bytes)), { client });
      // Bud's mic and speaker share wiring: its always-on ears stop while it talks
      const play = budSpeaker.play.bind(budSpeaker);
      budSpeaker.play = async (body, current) => {
        earsHeld++;
        try {
          syncEars();
          await stopEars();
          return await play(body, current);
        } finally {
          earsHeld--;
          syncEars();
        }
      };
    }
    return budSpeaker;
  };
  const voiceOpts = (epoch) => ({
    sink: BudSpeakerType ? speakerSink() : null,
    style: S.style,
    voice: S.voice,
    engine: S.engine === 'openai' && !IN_PREVIEW ? (S.keys.bud ? 'bud' : 'openai') : 'system',
    key: S.keys.bud || S.keys.openai,
    server: budServer(),
    onFallback: (e) => {
      if (epoch !== undefined && !currentTurn(epoch)) return;
      if (e && e.status === 401) return toast('That Bud passcode isn’t right, so Bud used the system voice. Check it in Agents.');
      if (e && e.name === 'NotAllowedError') return toast('Tap Bud once so it can play its voice.');
      if (T.voiceNote) return;
      T.voiceNote = true;
      toast(S.keys.bud ? 'Bud’s voice server didn’t answer, so Bud used the system voice.' : 'The OpenAI voice did not answer, so Bud used the system voice.');
    },
  });
  function speak(text, epoch) {
    if (epoch !== undefined) showTurn(epoch, 'speaking', '');
    else show('speaking', '');
    if (!S.speak) return new Promise((res) => setTimeout(res, Math.min(2200, 900 + text.length * 50)));
    return Voice.say(text, voiceOpts(epoch));
  }

  function approve(req, epoch) {
    return new Promise((resolve) => {
      if (!currentTurn(epoch)) return resolve(false);
      if (T.declined) return resolve(false);
      const client = readyClient();
      const request = T.deviceRequest;
      let timer = 0;
      let deciding = false;
      const card = addAsk(req, (ok) => { void decide(ok); });
      function finish(ok) {
        if (T.pending !== decide || !currentTurn(epoch)) return;
        T.pending = null;
        clearTimeout(timer);
        card.finish(ok);
        if (!ok) T.declined = true;
        showTurn(epoch, 'working', ok ? 'On it' : 'Okay, not doing that');
        resolve(ok);
      }
      async function decide(ok) {
        if (T.pending !== decide || !currentTurn(epoch) || deciding) return;
        if (!client || !request) return finish(ok);
        deciding = true;
        try { await client.resolveApproval(ok); }
        catch (error) {
          if (T.pending === decide && currentTurn(epoch)) {
            toast(error.message);
            finish(false);
          }
        } finally { deciding = false; }
      }
      decide.cancel = () => {
        if (T.pending !== decide) return;
        T.pending = null;
        clearTimeout(timer);
        card.finish(false);
        T.declined = true;
        resolve(false);
      };
      T.pending = decide;
      showTurn(epoch, 'needsyou', req.title);
      Sfx.needs();
      if (S.speak) Voice.say(req.title, voiceOpts(epoch));
      if (client && request) {
        try { client.offerApproval(30000, request).then(finish, () => finish(false)); }
        catch (error) { finish(false); }
      } // a phone-only card has no deadline: it waits for the user (a timeout is not a "not now")
    });
  }

  function friendly(e) {
    const prov = A.PROVIDERS[S.provider];
    if (e && e.code === 'unavailable') return 'Claude only runs here when this page is open on claude.ai. I switched to the demo brain.';
    if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled')) return 'This page is not allowed to use Claude. Allow it, or pick the demo brain in Agents.';
    if (e && e.code === 'rate_limited') return 'Claude is busy for a moment. Try again shortly.';
    if (prov && prov.keyName && !S.keys[S.provider]) return `Add your ${prov.keyName} in Agents, or pick the demo brain.`;
    if (S.provider === 'bud' && e instanceof TypeError) return 'I can’t reach Bud’s server right now. Try again in a moment, or pick the demo brain in Agents.';
    const said = String((e && e.message) || 'unknown error').replace(/\.+$/, '');
    if (S.provider === 'bud' && /passcode/i.test(said)) return 'That Bud passcode isn’t right. Check it in Agents.';
    if (S.provider === 'bud' && /set up/i.test(said)) return `${said}. Pick the demo brain in Agents for now.`;
    return `That did not work: ${said}.`;
  }

  async function submit(text, { deviceContext = null } = {}) {
    text = String(text || '').trim();
    const continuing = deviceContext && T.audio === deviceContext &&
      currentTurn(deviceContext.epoch) && deviceContext.receiver.snapshot().phase === 'Done' &&
      deviceContext.client === readyClient() &&
      deviceContext.client.snapshot().request === deviceContext.request;
    if (!text || (deviceContext && !continuing) || (T.busy && !continuing)) return;
    const epoch = continuing ? deviceContext.epoch : ++turnEpoch;
    if (continuing) {
      clearTimeout(deviceContext.startTimer);
      T.audio = null;
    }
    T.busy = true;
    T.followUp = false;
    let asked = false;
    T.typing = false;
    T.declined = false;
    T.deviceRequest = continuing ? deviceContext.request : 0;
    T.deviceShows = [];
    T.deviceError = null;
    T.acceptShows = true;
    if (!continuing) T.ctrl = new AbortController();
    $('#say').value = '';
    addMsg('from-you', text);
    const prov = A.PROVIDERS[S.provider];
    if (prov.keyName && !S.keys[S.provider]) {
      if (continuing && deviceContext.client.snapshot().request === deviceContext.request) {
        void deviceContext.client.cancel(deviceContext.request).catch(() => {});
      }
      addMsg('from-bud', friendly({}), true);
      show('confused', 'Needs a key');
      setTimeout(() => { if (epoch === turnEpoch) calm(); }, 2400);
      T.busy = false;
      T.deviceRequest = 0;
      T.acceptShows = false;
      T.ctrl = null;
      return;
    }
    ear.pause();
    const client = continuing ? deviceContext.client : readyClient();
    try {
      if (client && !continuing) {
        await freeBud(client); // busy now: Bud stops its always-on recording for this turn
        await idleShow;
        if (!currentTurn(epoch)) return;
        const request = await client.beginRequest();
        if (!currentTurn(epoch)) {
          void client.cancel(request).catch(() => {});
          return;
        }
        T.deviceRequest = request;
      }
      const { reply, wrote } = await A.ask(text, {
        room: roomText(),
        provider: S.provider,
        cfg: { key: S.keys[S.provider], model: S.models[S.provider], server: budServer() },
        signal: T.ctrl.signal,
        onStatus: (st, cap, progress) => {
          if (!currentTurn(epoch)) return;
          showTurn(epoch, st, cap || '', progress);
          if (st === 'working' && cap && cap !== 'On it') addAct(cap, st);
        },
        approve: (request) => approve(request, epoch),
      });
      if (!currentTurn(epoch)) return;
      addMsg('from-bud', reply);
      await speak(reply, epoch);
      if (!currentTurn(epoch)) return;
      T.acceptShows = false;
      if (client && T.deviceRequest) {
        const request = T.deviceRequest;
        await flushTurnShows(epoch);
        if (T.declined) await client.cancel(request);
        else await client.complete(true, request);
        if (!currentTurn(epoch)) return;
        T.deviceRequest = 0;
      }
      asked = !T.declined && /\?\s*$/.test(reply);
      if (T.declined) {
        calm();
      } else if (asked) {
        if (client) await client.show('needsyou', 0, 'Your turn', 0);
        if (currentTurn(epoch)) show('needsyou', 'Your turn');
      } else if (wrote) {
        show('done', 'Done');
        Sfx.done();
        setTimeout(() => epoch === turnEpoch && T.state === 'done' && calm(), 2800);
      } else calm();
    } catch (e) {
      if (!currentTurn(epoch)) return;
      T.acceptShows = false;
      if (client && T.deviceRequest) {
        try { await client.cancel(T.deviceRequest); } catch (_) { /* link may already be gone */ }
        if (!currentTurn(epoch)) return;
        T.deviceRequest = 0;
      }
      if (e && e.code === 'unavailable') {
        S.provider = 'demo';
        save();
        renderProviders();
      }
      addMsg('from-bud', friendly(e), true);
      show('confused', 'Something went wrong');
      setTimeout(() => epoch === turnEpoch && T.state === 'confused' && calm(), 2600);
    } finally {
      if (epoch === turnEpoch) {
        T.busy = false;
        T.ctrl = null;
        T.acceptShows = false;
        if (T.state !== 'done') sendSessionFace(T.state, T.caption, 0);
        if (S.mic && !ext.speaking) ear.resume();
        // an agent's question that waited for your turn comes back now (after Bud's own question, if any)
        if (asked) holdForReply();
        else if (ext.current) calm();
        else nextAsk();
        // Bud asked and opened its own mic for the answer: listen there
        const follow = T.followActivation;
        T.followActivation = null;
        if (budEarsReady()) {
          if (asked) attend(); // always listening: the next phrase answers Bud
        } else if (asked && follow && follow.client === firmwareClient) void startBudCapture(follow.client, follow.message);
        syncEars();
      }
    }
  }

  // Bud just asked you something ("Which one?"). For a few seconds the next tap answers Bud,
  // not an agent's question; then any open agent question comes back.
  function holdForReply() {
    T.followUp = true;
    if (ext.current && T.pending === ext.current.decide) T.pending = null;
    clearTimeout(T.followT);
    T.followT = setTimeout(() => {
      if (!T.followUp || T.busy || T.listening || T.typing) return;
      T.followUp = false;
      if (ext.current) {
        calm();
        Sfx.needs();
      } else nextAsk();
    }, 8000);
  }

  function setMic(on, fromBud = false) {
    S.mic = on;
    save();
    $('#setMic').checked = on;
    if (on) ear.resume();
    else {
      ear.off(); // the Mic switch and Bud's mute both end here: no recognizer may outlive Mic off
      T.waking = false;
    }
    show(on ? 'idle' : 'privacy', on ? 'Mic back on' : 'Mic off');
    toast(on ? 'Mic on. Tap Bud to talk.' : 'Mic off. Bud is not listening.');
    if (!fromBud) syncBudMute(readyClient(), true);
    syncEars();
  }

  function setBudTranscriber(fn) {
    if (fn !== null && typeof fn !== 'function') throw new TypeError('Bud transcriber must be a function or null.');
    if (fn && (T.busy || T.pending || T.audio || T.deviceRequest)) {
      throw new Error('Set Bud transcription while idle.');
    }
    if (!fn && (T.busy || T.pending || T.audio)) {
      abandonTurn();
      calm();
    }
    if (!fn) audioReceivers.get(firmwareClient)?.cancel('Bud transcription cleared.');
    budTranscriber = fn;
    return { available: !!fn, reconnectRequired: !!firmwareClient };
  }

  // Bud's own microphone: what it records becomes text through Bud's server (with the passcode),
  // or straight through your OpenAI key when there is no passcode.
  async function hearOnBud({ samples, rateHz, signal }) {
    const wav = wavFrom(samples, rateHz);
    let res;
    if (S.keys.bud) {
      res = await fetch(`${budServer()}/brain/hear`, { method: 'POST', headers: { 'content-type': 'audio/wav', 'x-bud-pass': S.keys.bud }, body: wav, signal });
    } else {
      const form = new FormData();
      form.append('file', new Blob([wav], { type: 'audio/wav' }), 'bud.wav');
      form.append('model', 'gpt-4o-mini-transcribe');
      res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${S.keys.openai}` }, body: form, signal });
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && S.keys.bud) throw new Error('That Bud passcode isn’t right. Check it in Agents.');
    if (!res.ok) throw new Error((data.error && data.error.message) || 'Bud couldn’t make out what it heard.');
    return String(data.text || '');
  }
  // 16-bit mono PCM as a WAV file.
  function wavFrom(samples, rate) {
    const bytes = new ArrayBuffer(44 + samples.length * 2);
    const v = new DataView(bytes);
    const tag = (at, text) => [...text].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    tag(0, 'RIFF');
    v.setUint32(4, 36 + samples.length * 2, true);
    tag(8, 'WAVE');
    tag(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, rate, true);
    v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    tag(36, 'data');
    v.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, samples[i], true);
    return new Uint8Array(bytes);
  }
  // Hearing is on whenever there is a way to transcribe (the passcode or an OpenAI key).
  function syncHearing() {
    const can = !IN_PREVIEW && !!(S.keys.bud || S.keys.openai);
    if (can === !!budTranscriber) return;
    try {
      const r = setBudTranscriber(can ? hearOnBud : null);
      if (can && r.reconnectRequired) toast('Reconnect Bud in Settings so it can use its microphone.');
    } catch (e) {
      setTimeout(syncHearing, 1500); // busy right now: try again when the turn is over
    }
  }

  /* ------------------------------------------------------------------ feed */

  const feed = $('#feed');
  function scrollFeed() {
    const page = $('#page-home');
    page.scrollTop = page.scrollHeight;
  }
  // Keep the feed to its last couple hundred lines, but never drop a question still waiting.
  function trimFeed() {
    let extra = feed.childElementCount - 200;
    for (const el of [...feed.children]) {
      if (extra <= 0) break;
      if (el.matches('.ask:not(.done)')) continue;
      el.remove();
      extra--;
    }
  }
  function addMsg(who, text, err) {
    $('#tryCard').hidden = true;
    const el = document.createElement('div');
    el.className = `msg ${who}${err ? ' err' : ''}`;
    el.textContent = text;
    feed.append(el);
    trimFeed();
    scrollFeed();
  }
  function addAct(text, st) {
    const el = document.createElement('div');
    el.className = 'act';
    el.innerHTML = '<span class="led"></span>';
    el.querySelector('.led').style.setProperty('--c', tintOf(st));
    el.append(text.replace(/…$/, ''));
    feed.append(el);
    trimFeed();
    scrollFeed();
  }
  function addAsk(req, decide) {
    const el = document.createElement('div');
    el.className = 'ask';
    el.innerHTML = '<p class="ask-t"><span class="led"></span><span></span></p><p class="ask-d"></p><div class="ask-b"><button type="button" class="no">Not now</button><button type="button" class="yes"></button></div><p class="ask-r" hidden></p>';
    el.querySelector('.led').style.setProperty('--c', tintOf('needsyou'));
    el.querySelector('.ask-t span:last-child').textContent = req.title;
    el.querySelector('.ask-d').textContent = req.detail || '';
    el.querySelector('.yes').textContent = req.verb || 'Approve';
    el.querySelector('.yes').onclick = () => decide(true);
    el.querySelector('.no').onclick = () => decide(false);
    feed.append(el);
    scrollFeed();
    return {
      finish(ok) {
        el.classList.add('done');
        const r = el.querySelector('.ask-r');
        r.hidden = false;
        r.textContent = typeof ok === 'string' ? ok : ok ? 'Approved' : 'Not now';
      },
    };
  }

  /* ------------------------------------------------------------- composer */

  // A reply that is only a yes or a no answers the question Bud is asking; anything else is a request.
  const YES = /^(yes|yep|yeah|ok|okay|sure|do it|go ahead|approve)(,? (please|thanks|thank you))?\s*[.!]*$/i;
  const NO = /^(no|nope|not now|cancel|stop|don[’']?t)(,? (thanks|thank you))?\s*[.!]*$/i;
  const answerWord = (text) => (YES.test(text.trim()) ? true : NO.test(text.trim()) ? false : null);

  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#say').value;
    const said = T.pending ? answerWord(text) : null;
    if (said !== null) {
      $('#say').value = '';
      return T.pending(said);
    }
    if (T.listening) return stopListening();
    submit(text);
  });
  // A typing turn holds agents' questions back only while you're actually typing.
  function typed() {
    T.typedAt = Date.now();
    clearTimeout(T.typeT);
    T.typeT = setTimeout(nextAsk, 30500);
  }
  $('#say').addEventListener('input', typed);
  $('#say').addEventListener('blur', () => {
    if (T.typing && !$('#say').value.trim() && !T.busy) {
      T.typing = false;
      if (T.state === 'listening') calm();
    }
    setTimeout(nextAsk, 0); // anything an agent asked while you typed
  });
  $('#micBtn').addEventListener('click', () => {
    if (T.listening) return stopListening();
    if (!canHear()) {
      toast(IN_PREVIEW ? 'Voice works when the app runs from your computer. Type here for now.' : 'No speech input in this browser. Type instead.');
      T.typeNote = true;
      return listenTyping();
    }
    startTurn();
  });
  $('#appBud').addEventListener('click', () => {
    Sfx.unlock();
    input('tap');
  });
  const IDEAS = ['Move my 3pm with Sam to tomorrow', 'Book a table for 4 tonight, somewhere quiet', 'Remind me to call Mom at 6', 'Text Alex I’m 10 minutes late', 'What’s on my calendar tomorrow?', 'Add oat milk and eggs to groceries'];
  IDEAS.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t;
    b.onclick = () => submit(t);
    $('#suggest').append(b);
  });

  /* ----------------------------------------------------------------- tabs */

  function go(page) {
    $$('.page').forEach((p) => (p.hidden = p.id !== `page-${page}`));
    $$('.tabbar button').forEach((b) => (b.getAttribute('data-go') === page ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    app.classList.toggle('not-home', page !== 'home');
  }
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.getAttribute('data-go'))));

  /* ---------------------------------------------------------------- agents */

  function renderProviders() {
    const list = $('#provList');
    list.innerHTML = '';
    const order = ['bud', 'preview', 'anthropic', 'openai', 'gemini', 'demo'];
    order.forEach((id) => {
      const p = A.PROVIDERS[id];
      const off = (id === 'preview' && !IN_PREVIEW) || (IN_PREVIEW && p.keyName);
      const el = document.createElement('label');
      el.className = `prov${S.provider === id ? ' on' : ''}${off ? ' off' : ''}`;
      el.innerHTML = `<input type="radio" name="prov" value="${id}"><b></b><small></small>`;
      el.querySelector('b').textContent = p.label;
      el.querySelector('small').textContent = off
        ? id === 'preview'
          ? 'Available when this page is open on claude.ai.'
          : 'Run the app from your computer to use your own key.'
        : p.note || `Your key. Model: ${S.models[id] || p.defaultModel}`;
      const r = el.querySelector('input');
      r.checked = S.provider === id;
      r.disabled = !!off;
      r.onchange = () => {
        S.provider = id;
        save();
        A.reset();
        renderProviders();
        paintTry();
      };
      list.append(el);
    });
    const p = A.PROVIDERS[S.provider];
    $('#provConfig').hidden = !p.keyName;
    if (p.keyName) {
      $('#provKeyLabel').textContent = p.keyName;
      $('#provKey').placeholder = S.provider === 'bud' ? 'The Bud passcode' : 'Paste your key';
      $('#provKey').value = S.keys[S.provider] || '';
      $('#provModel').value = S.models[S.provider] || p.defaultModel;
      $('#provModel').closest('.field').hidden = !!p.fixedModel; // Bud's server picks its own model
      $('#provNote').textContent = S.provider === 'bud'
        ? 'Ask Jason or Henry for the passcode. It stays in this browser and goes only to Bud’s server.'
        : 'Your key stays in this browser and goes only to that provider. For a real launch, keys live on Bud’s server, not in the app.';
    }
  }
  $('#provKey').addEventListener('change', (e) => {
    S.keys[S.provider] = e.target.value.trim();
    // the passcode brings Bud's natural voice too
    if (S.provider === 'bud' && S.keys.bud && S.engine !== 'openai') {
      S.engine = 'openai';
      if (S.speak) toast('Natural voice on. You can change it in Settings.');
    }
    save();
    paintVoice();
    paintTry();
    syncHearing();
  });
  $('#provModel').addEventListener('change', (e) => {
    S.models[S.provider] = e.target.value.trim();
    save();
    renderProviders();
  });
  renderProviders();

  /* ----------------------------------------------------------------- looks */

  LOOKS.forEach((lk) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'look';
    b.dataset.look = lk.id;
    b.setAttribute('aria-pressed', String(S.look === lk.id));
    b.innerHTML = '<span class="bud"><span class="bud-glass"><span class="bud-screen"></span></span></span><span></span>';
    b.lastChild.textContent = lk.label;
    $('#lookGrid').append(b);
    const scr = new K.Screen(b.querySelector('.bud-screen'), { fps: 24, bloom: false });
    scr.set(Object.assign({}, BASE_CFG, lookCfg(lk.id), { state: 'idle' }));
    b.addEventListener('click', () => {
      S.look = lk.id;
      $$('.look').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      mirror.set(lookCfg(lk.id));
      // The emulator previews the look with a short hello; a real Bud gets it only through SettingsSet.
      const preview = (state, caption) => link.emit({ type: 'show', state, caption, look: { pack: S.look, shell: S.shell }, mic: S.mic, timeout: S.timeout });
      preview('hello', `${lk.label} look`);
      setTimeout(() => preview(T.state, T.caption), 2000);
      markDeviceSettingsDirty();
      if (!readyClient()?.snapshot().settings) toast(`${lk.label} preview selected; Bud will apply it after a settings read.`);
    });
  });
  SHELLS.forEach(([name, hex]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.title = name;
    b.setAttribute('aria-label', `${name} shell`);
    b.style.setProperty('--s', hex);
    b.setAttribute('aria-pressed', String(S.shell === hex));
    b.addEventListener('click', () => {
      S.shell = hex;
      save();
      $$('.swatch').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('#appBud').style.setProperty('--shell', hex);
      show(T.state, T.caption);
      toast('Shell color is a physical shell preview.');
    });
    $('#shellList').append(b);
  });

  /* -------------------------------------------------------------- settings */

  const setSpeak = $('#setSpeak');
  setSpeak.checked = S.speak;
  setSpeak.onchange = () => {
    S.speak = setSpeak.checked;
    save();
  };
  $('#setBudSpeaker').checked = S.budSpeaker;
  $('#setBudSpeaker').onchange = (e) => {
    S.budSpeaker = e.target.checked;
    save();
    if (!S.budSpeaker) budSpeaker?.stop();
  };
  $('#setMic').checked = S.mic;
  $('#setMic').onchange = (e) => setMic(e.target.checked);
  $('#setFlip').checked = S.flip;
  $('#setFlip').onchange = (e) => {
    S.flip = e.target.checked;
    save();
  };
  $('#setTimeout').value = String(S.timeout);
  $('#setTimeout').onchange = (e) => {
    S.timeout = +e.target.value;
    markDeviceSettingsDirty();
    show(T.state, T.caption);
  };
  // Bud's voice: a style (how it sounds), the voice itself (Auto picks the best one here),
  // and OpenAI's natural voices when the app runs on your computer with an OpenAI key.
  Sfx.on = S.sounds;
  Object.keys(Voice.STYLES).forEach((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.style = id;
    b.textContent = Voice.STYLES[id].label;
    b.onclick = () => {
      S.style = id;
      S.voice = ''; // let Auto choose the best voice for this style
      save();
      paintVoice();
      sample();
    };
    $('#setStyle').append(b);
  });
  function paintVoice() {
    $$('#setStyle button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.style === S.style)));
    const sel = $('#setVoice');
    const list = Voice.list(S.style);
    const auto = Voice.pick(S.style, '');
    sel.innerHTML = '';
    sel.add(new Option(auto ? `Auto (${auto.name})` : 'Auto', ''));
    list.forEach((v) => sel.add(new Option(v.name, v.voiceURI)));
    sel.value = list.some((v) => v.voiceURI === S.voice) ? S.voice : '';
    const neural = S.engine === 'openai' && !IN_PREVIEW;
    sel.disabled = !list.length || neural;
    $('#setEngine').checked = neural;
    $('#engineRow').hidden = IN_PREVIEW;
    $('#voiceOutNote').textContent = neural
      ? S.keys.bud
        ? 'Bud speaks with a natural AI voice from Bud’s server.'
        : S.keys.openai
          ? 'Bud speaks with OpenAI’s natural voice (AI-generated), using your OpenAI key from Agents.'
          : 'Add the Bud passcode (Agents › Bud) or your OpenAI key to use the natural voice. Until then Bud uses the system voice.'
      : 'Bright, Buddy and Tiny tune the best voice your device has. On a Mac, Premium voices sound most natural: System Settings › Accessibility › Spoken Content › System Voice › Manage Voices.';
  }
  function sample() {
    if (!S.speak) return;
    Sfx.unlock();
    Voice.say('Hey, I’m Bud. Tap me anytime and I’ll take care of it.', voiceOpts());
  }
  paintVoice();
  if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', paintVoice);
  $('#setVoice').onchange = (e) => {
    S.voice = e.target.value;
    save();
    sample();
  };
  $('#setEngine').onchange = (e) => {
    S.engine = e.target.checked ? 'openai' : 'system';
    save();
    paintVoice();
    if (e.target.checked && (S.keys.bud || S.keys.openai)) sample();
  };
  $('#voiceTest').onclick = () => (S.speak ? sample() : toast('Turn on “Speak replies out loud” first.'));
  const setSounds = $('#setSounds');
  setSounds.checked = S.sounds;
  setSounds.onchange = () => {
    S.sounds = Sfx.on = setSounds.checked;
    save();
    Sfx.unlock();
    Sfx.done();
  };

  // "Hey Bud": the ear keeps listening between requests, only while this page is open
  function paintListening() {
    const row = $('#wakeRow');
    const ok = canHear();
    $('#setWake').checked = S.wake && ok;
    $('#setWake').disabled = !ok;
    row.classList.toggle('off', !ok);
    $('#voiceInNote').textContent = IN_PREVIEW
      ? 'Talking to Bud needs the app running from your computer: claude.ai pages may not use the microphone. Here, tap Bud and type. Bud still talks back.'
      : !ear.available
        ? 'This browser has no speech input. Chrome and Safari have it.'
        : 'With “Hey Bud” on, Bud listens all the time and acts when it hears its name: “Hey Bud, …”. A connected Bud listens through its own mic (its mic light is on, and Bud’s server turns what it hears into text); otherwise this page uses your browser’s speech service (Google’s, in Chrome). With “Remember what’s said nearby” on, it also keeps the last 20 minutes it heard, only in this page, as context for your requests. Hold Bud to turn the mic off.';
    if (T.state === 'idle') show('idle');
  }
  $('#setRoom').checked = S.room;
  $('#setRoom').onchange = (e) => {
    S.room = e.target.checked;
    save();
    if (!S.room) room.length = 0;
  };
  $('#setWake').onchange = (e) => {
    S.wake = e.target.checked;
    save();
    Sfx.unlock();
    ear.setWake(S.wake);
    if (S.wake) toast(S.mic ? 'Say “Hey Bud”, then what you need.' : 'Turn the mic on to use “Hey Bud”.');
    paintListening();
    syncEars();
    if (firmwareClient) onFirmwareState(firmwareClient, firmwareClient.snapshot()); // the chip says so
  };
  paintListening();
  if (!S.mic) ear.pause();
  if (S.wake && canHear()) ear.setWake(true);
  ['pointerdown', 'keydown'].forEach((type) =>
    window.addEventListener(
      type,
      () => {
        if (touched) return;
        touched = true;
        if (S.wake && ear.blocked === 'not-allowed') {
          ear.blocked = '';
          ear.setWake(true);
          paintListening();
        }
      },
      { capture: true }
    )
  );
  // a hidden page stops listening; it picks up again when it comes back
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      ear.pause();
      abandonWake();
    } else if (S.mic && !T.busy && !ext.speaking) ear.resume();
    reconnectCoordinator?.activity();
  });
  window.addEventListener('online', () => reconnectCoordinator?.activity());
  window.addEventListener('offline', () => reconnectCoordinator?.activity());
  $('#resetBtn').addEventListener('click', () => {
    A.World.reset();
    A.reset();
    for (const el of [...feed.children]) if (!el.matches('.ask:not(.done)')) el.remove();
    calm();
    toast('Demo data reset.');
  });
  // The current link stays until the new Bud is Ready, so a cancelled chooser, a missing saved Bud or a
  // failed connect changes nothing. Only the same Bud must drop its link first, so that it says Hello again.
  const adoptWhenChosen = (client, choice) => (device) => {
    if (choice !== deviceChoiceEpoch) throw new Error('Bud choice was replaced.');
    if (client !== firmwareClient && firmwareClient?.snapshot().deviceId === device.id) adoptFirmwareClient(client, 'bluetooth');
  };
  $('#pairBtn').addEventListener('click', async () => {
    const choice = ++deviceChoiceEpoch;
    stopAutoReconnect();
    try {
      const client = await makeFirmwareClient();
      if (choice !== deviceChoiceEpoch) { client.close(); return; }
      await client.bluetooth({ onChosen: adoptWhenChosen(client, choice) });
      await waitFirmwareReady(client, 7000, false);
      if (choice !== deviceChoiceEpoch) { client.close(); return; }
      if (client !== firmwareClient) adoptFirmwareClient(client, 'bluetooth');
      if (!canReopenBud()) { toast('Bud connected. This browser cannot reconnect it later; tap Connect again.'); return; }
      S.autoConnect = true; save();
      autoSuppressed = false;
      (await setupAutoReconnect()).start({ connected: true });
      toast('Bud connected.');
    } catch (e) {
      if (choice !== deviceChoiceEpoch) return;
      toast(e && e.name === 'NotFoundError' ? 'No Bud found nearby.' : (e && e.message) || 'Bluetooth is not available here.');
      if (S.autoConnect && hasSavedBud()) {
        autoSuppressed = false;
        (await setupAutoReconnect()).start({ connected: firmwareKind === 'bluetooth' && !!readyClient() });
      }
    }
  });
  $('#reconnectBudBtn').addEventListener('click', async () => {
    const choice = ++deviceChoiceEpoch;
    stopAutoReconnect();
    if (!canReopenBud()) { toast('This browser cannot reopen a saved Bud. Tap Connect instead.'); return; }
    if (!hasSavedBud()) { toast('No saved Bud. Connect over Bluetooth first.'); return; }
    try {
      const client = await makeFirmwareClient();
      if (choice !== deviceChoiceEpoch) { client.close(); return; }
      await client.reconnect({ onChosen: adoptWhenChosen(client, choice) });
      await waitFirmwareReady(client, 7000, false);
      if (choice !== deviceChoiceEpoch) { client.close(); return; }
      if (client !== firmwareClient) adoptFirmwareClient(client, 'bluetooth');
      S.autoConnect = true; save();
      autoSuppressed = false;
      (await setupAutoReconnect()).start({ connected: true });
      toast('Saved Bud connected.');
    } catch (error) {
      if (choice !== deviceChoiceEpoch) return;
      toast(error.message || 'Saved Bud is unavailable.');
      if (S.autoConnect && hasSavedBud()) {
        autoSuppressed = false;
        (await setupAutoReconnect()).start({ connected: firmwareKind === 'bluetooth' && !!readyClient() });
      }
    }
  });
  $('#disconnectBudBtn').addEventListener('click', () => {
    ++deviceChoiceEpoch;
    stopAutoReconnect(true);
    if (T.deviceRequest || T.audio) { abandonTurn(); calm(); }
    firmwareClient?.close();
    firmwareClient = null;
    firmwareKind = 'none';
    paintDeviceChip('virtual');
    $('#setDevice').textContent = 'Virtual Bud';
    toast('Bud disconnected. Automatic reconnect is off.');
  });
  $('#firmwareSimBtn').addEventListener('click', async () => {
    const choice = ++deviceChoiceEpoch;
    stopAutoReconnect(true);
    try {
      const { openFirmwareSimulator } = await import('./device/simulator.mjs');
      const transport = await openFirmwareSimulator({ url: window.BudFirmwareSimulatorUrl });
      if (choice !== deviceChoiceEpoch) { transport.close(); return; }
      const client = await makeFirmwareClient();
      if (choice !== deviceChoiceEpoch) { client.close(); transport.close(); return; }
      adoptFirmwareClient(client, 'simulator');
      client.attach(transport);
      await waitFirmwareReady(client);
      if (choice !== deviceChoiceEpoch) { client.close(); return; }
      toast('Firmware simulator connected.');
    } catch (e) { if (choice === deviceChoiceEpoch) toast((e && e.message) || 'Firmware simulator did not connect.'); }
  });

  /* ----------------------------------------------------------- Bud Connect */

  // Your other agents reach Bud through a Bud Connect server (connect/): bud_show puts their
  // state on Bud, bud_ask turns Bud pink and waits for your tap. Your own turns come first:
  // while Bud is busy with one, their faces wait and their questions queue.
  const CONNECT_SERVER = 'https://bud-connect.meetbud.workers.dev'; // the hosted server (connect/worker.mjs)
  // Bud's server, home to Bud's hosted brain and voice (connect/brain.mjs). The passcode only goes
  // there, or to a server on this computer while developing, whatever Connect is pointed at.
  function budServer() {
    const own = cleanServer(S.connect.server);
    return own && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(own) ? own : CONNECT_SERVER;
  }
  const CLOSED = { expired: 'Expired', withdrawn: 'Withdrawn', gone: 'No longer open', off: 'Bud Connect off', device: 'This screen is Bud now', moved: 'Link changed' };
  const connect = new Connect({
    onState: paintConnect,
    onHello(d) {
      // the server's open questions are the truth: drop any held here that it no longer has
      const open = new Set((d.asks || []).map((a) => a.id));
      ext.asks = ext.asks.filter((a) => open.has(a.id));
      for (const id of ext.sending) if (!open.has(id)) ext.sending.delete(id); // settled while we were away
      if (ext.current && !open.has(ext.current.id)) ext.current.close('gone');
      for (const a of d.asks || []) if (!knownAsk(a.id)) ext.asks.push(arm(a));
      // catch up on a face this app never showed; one from before this page opened only goes in the feed
      const f = d.face;
      if (f && f.state !== 'idle' && !(f.at <= ext.faceAt)) externalShow(f, !ext.faceAt && ['done', 'hello', 'love'].includes(f.state));
      nextAsk();
    },
    onShow: externalShow,
    onAsk(a) {
      if (knownAsk(a.id)) return;
      ext.asks.push(arm(a));
      nextAsk();
    },
    onSettled({ id, answer }) {
      ext.sending.delete(id);
      ext.asks = ext.asks.filter((a) => a.id !== id);
      if (ext.current && ext.current.id === id) ext.current.close(answer);
    },
  });
  const arm = (a) => Object.assign(a, { until: Date.now() + (a.ttl || 0) }); // its expiry, by this device's clock
  // shown, queued, or answered with the answer still on its way
  const knownAsk = (id) => (ext.current && ext.current.id === id) || ext.asks.some((a) => a.id === id) || ext.sending.has(id);
  // you are in the middle of something: agents' faces and questions wait
  const typingNow = () => T.typing && document.activeElement === $('#say') && Date.now() - (T.typedAt || 0) < 30000;
  const ownTurn = () => T.busy || T.pending || T.listening || T.waking || T.followUp || typingNow();
  // an agent that goes quiet should not leave Bud busy
  function settleLater(state, ms) {
    clearTimeout(ext.idle);
    ext.idle = setTimeout(() => !ownTurn() && T.state === state && calm(), ms);
  }

  function externalShow(f, quiet) {
    if (!f || ownTurn()) return;
    if (f.at) ext.faceAt = Math.max(ext.faceAt, f.at);
    const note = `${f.source || 'Your agent'}: ${f.caption || LABEL[f.state] || f.state}`;
    if (f.state !== 'idle' && note !== ext.note) addAct(note, f.state);
    ext.note = note;
    if (quiet) return;
    show(f.state, f.caption || '', f.progress == null ? 0 : f.progress / 100);
    if (f.state === 'done') {
      Sfx.done();
      settleLater(f.state, 2800);
    } else if (f.state === 'hello' || f.state === 'love') settleLater(f.state, 3000);
    else if (f.state !== 'idle') settleLater(f.state, 90000);
  }

  function nextAsk() {
    if (ext.current || ownTurn()) return;
    let a = ext.asks.shift();
    while (a && a.until <= Date.now()) a = ext.asks.shift(); // ran out while it waited its turn
    if (!a) return;
    const who = a.source || 'Your agent';
    const card = addAsk({ title: a.question, detail: a.detail ? `${who}: ${a.detail}` : `From ${who}`, verb: a.verb || 'Approve' }, (ok) => decide(ok));
    const entry = {
      id: a.id,
      question: a.question,
      decide,
      timer: setTimeout(() => entry.close('expired'), Math.max(0, a.until - Date.now())),
      close(why) {
        if (ext.current !== entry) return;
        if (askOnBud?.entry === entry) releaseAskOnBud();
        clearTimeout(entry.timer);
        stopReading(entry);
        if (T.pending === decide) T.pending = null;
        ext.current = null;
        card.finish(CLOSED[why] || 'Answered elsewhere');
        if (!T.busy && !T.listening) calm();
        nextAsk();
      },
    };
    async function decide(ok) {
      if (ext.current !== entry) return;
      if (askOnBud?.entry === entry) releaseAskOnBud(askOnBud, ok);
      clearTimeout(entry.timer);
      stopReading(entry);
      if (T.pending === decide) T.pending = null;
      ext.current = null;
      card.finish(ok);
      if (!T.busy) {
        if (ok) {
          show('working', 'On it');
          settleLater('working', 90000);
        } else calm();
      }
      ext.sending.add(a.id);
      const sent = await connect.answer(a.id, ok);
      const unsettled = ext.sending.delete(a.id); // false if the server said it settled meanwhile
      if (sent !== 'ok') {
        const undo = !T.busy && T.state === 'working' && T.caption === 'On it';
        if (sent === 'closed') {
          card.finish(CLOSED.gone);
          toast(`That question had already closed, so ${who} did not get your answer.`);
        } else if (!unsettled) {
          card.finish('Answered'); // it settled after all (this answer, or one from another screen)
        } else if (a.until > Date.now() && !knownAsk(a.id)) {
          // still open on the server: bring it back so you can answer again
          card.finish('Not sent');
          ext.asks.unshift(a);
          toast(`Could not reach Bud Connect. ${who}’s question is back, so you can try again.`);
        } else {
          card.finish(CLOSED.expired);
          toast(`Could not reach Bud Connect, and ${who}’s question has expired.`);
        }
        if (undo) calm();
      }
      nextAsk();
    }
    ext.current = entry;
    T.pending = decide;
    show('needsyou', a.question);
    Sfx.needs();
    readAloud(entry);
    void offerAskOnBud(entry, a.until);
  }

  // An agent's question on the real Bud: a request of its own, shown pink, with an approval offer,
  // because Bud only counts a tap as a yes through an offer. A tap says yes, a hold says no, and an
  // answer on the phone (or the question closing) ends it on Bud too. Bud ends a request after
  // 3 minutes, so a longer question goes back to the phone card only.
  let askOnBud = null;
  async function offerAskOnBud(entry, until) {
    const client = readyClient();
    if (!client || askOnBud || T.deviceRequest || client.snapshot().request !== 0 ||
        !(client.snapshot().capabilities & 8)) return; // 8: Approval
    const bound = { entry, client, request: 0, byBud: false };
    askOnBud = bound;
    try {
      await idleShow;
      if (ext.current !== entry || askOnBud !== bound) return releaseAskOnBud(bound);
      bound.request = await client.beginRequest();
      if (ext.current !== entry || askOnBud !== bound) return releaseAskOnBud(bound);
      await client.show('needsyou', 0, entry.question, bound.request);
      if (ext.current !== entry || askOnBud !== bound) return releaseAskOnBud(bound);
      const ttl = Math.max(1000, Math.min(170000, until - Date.now()));
      const ok = await client.offerApproval(ttl, bound.request);
      if (ext.current !== entry || askOnBud !== bound) return;
      bound.byBud = true;
      entry.decide(ok);
    } catch (error) {
      if (askOnBud === bound) releaseAskOnBud(bound); // the phone card still works
    }
  }
  function releaseAskOnBud(bound = askOnBud, ok = false) {
    if (!bound) return;
    if (askOnBud === bound) askOnBud = null;
    const { client, request } = bound;
    if (!request || client !== firmwareClient || client.snapshot().request !== request) return;
    // a yes from Bud's own tap ends happy; anything else just ends the request
    const end = ok && bound.byBud ? client.complete(true, request) : client.cancel(request);
    end.catch(() => client.snapshot().request === request && client.cancel(request).catch(() => {}))
      .finally(() => { if (!T.busy && !T.deviceRequest && !askOnBud) sendSessionFace(T.state, T.caption, 0); });
  }

  // Reading an agent's question aloud. Bud's ear stays off until that reading ends, so it never
  // hears an agent's words as a request, and a reading that was cut short never turns it back on.
  function readAloud(entry) {
    if (!S.speak) return;
    const mine = ++ext.reading;
    entry.reading = mine;
    ext.speaking = true;
    ear.pause();
    const back = () => {
      if (ext.reading !== mine) return;
      ext.speaking = false;
      if (S.mic && !T.busy && !document.hidden) ear.resume();
      if (budEarsReady() && ext.current === entry) attend(); // Bud's own mic: a "yes" right after counts
    };
    Promise.resolve(Voice.say(entry.question, voiceOpts())).then(back, back);
  }
  function stopReading(entry) {
    if (!entry.reading || ext.reading !== entry.reading || !ext.speaking) return;
    ext.reading++;
    ext.speaking = false;
    Voice.stop();
    // back on, unless the next question has started reading by then
    setTimeout(() => !ext.speaking && S.mic && !T.busy && !document.hidden && ear.resume(), 0);
  }

  const CONNECT_NOTE = {
    off: 'Off.',
    'needs-server': 'Add the Bud Connect server address.',
    'bad-server': 'That server address doesn’t look right. It should look like https://bud-connect.example.workers.dev.',
    'needs-https': 'From this page, the server address has to start with https://.',
    connecting: 'Connecting…',
    live: 'On. Agents with your link can show their work on Bud and ask you first.',
    'live-new': 'On, with a new link for this browser. Copy it into your agents: links made in another browser (or before this one’s data was cleared) don’t reach it.',
    retrying: 'Can’t reach the server right now. Retrying…',
    unsupported: 'This browser can’t keep a live connection open.',
    device: 'This screen is Bud now. Bud Connect runs on the screen with the app.',
  };
  function paintConnect(state) {
    $('#connectOn').checked = !!S.connect.on;
    $('#connectConfig').hidden = !S.connect.on;
    let note = S.connect.on && mode === 'device' ? 'device' : state || connect.state;
    if (note === 'live' && S.connect.copied === false) note = 'live-new';
    $('#connectStatus').textContent = CONNECT_NOTE[note] || '';
    connect.link().then((url) => {
      $('#connectUrl').value = url;
      // a short ID, to check against the link your agents have
      $('#connectId').textContent = url ? `Link ID ${url.split('/mcp/bc_')[1].slice(0, 6)}` : '';
    });
  }
  // Writes only the Bud Connect part of the stored settings, so following another tab never
  // writes this tab's older copy of everything else over the newer one.
  function saveConnect() {
    try {
      const stored = JSON.parse(localStorage.getItem(SKEY)) || {};
      if (typeof stored !== 'object' || Array.isArray(stored)) return save();
      stored.connect = S.connect;
      localStorage.setItem(SKEY, JSON.stringify(stored));
    } catch (e) {
      save();
    }
  }
  // Questions from a room this app is leaving can no longer be answered from here.
  function dropAsks(why) {
    ext.asks = [];
    if (ext.current) ext.current.close(why);
  }
  function restartConnect() {
    if (!S.connect.key && S.connect.on && mode === 'app') {
      useKey(newAppKey());
      saveConnect();
      // ask the browser to keep this key: losing it quietly breaks the link agents hold
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    }
    const was = { server: connect.server, key: connect.key };
    connect.configure({ server: S.connect.server || CONNECT_SERVER, key: S.connect.key });
    const live = S.connect.on && mode === 'app';
    if (!live) dropAsks(mode === 'device' ? 'device' : 'off');
    else if (connect.server !== was.server || connect.key !== was.key) dropAsks('moved');
    if (live) {
      connect.start();
      // remember which server has seen this key: a different server gets a new one (see below)
      if (connect.server && !connect.problem && S.connect.seenBy !== connect.server) {
        S.connect.seenBy = connect.server;
        saveConnect();
      }
    } else connect.stop();
    paintConnect();
  }
  function useKey(key) {
    S.connect.key = key;
    S.connect.seenBy = '';
    S.connect.copied = false; // until it's copied, the status says agents don't have it yet
  }

  // A link can hand a tester the Bud passcode (<app>#bp=<passcode>); like #bk, it stays on this device.
  const passLink = /^#bp=([^&]{1,200})$/.exec(location.hash);
  if (passLink && !IN_PREVIEW) {
    history.replaceState(null, '', location.pathname + location.search);
    let pass = '';
    try {
      pass = decodeURIComponent(passLink[1]).trim();
    } catch (e) {
      pass = '';
    }
    if (pass && (pass === S.keys.bud || window.confirm('Use the Bud passcode from this link? Bud will then think with Claude on Bud’s server.'))) {
      S.keys.bud = pass;
      S.provider = 'bud';
      S.engine = 'openai';
      save();
      renderProviders();
      paintVoice();
      toast('Bud’s real brain is on. Ask it anything.');
    }
  }

  // A link from "Use on another device" carries the app key in the fragment, which browsers never send anywhere.
  const carried = /^#bk=([A-Za-z0-9_-]+)(?:&server=([^&]+))?$/.exec(location.hash);
  if (carried) {
    history.replaceState(null, '', location.pathname + location.search);
    let server = '';
    try {
      server = carried[2] ? decodeURIComponent(carried[2]) : '';
    } catch (e) {
      server = null;
    }
    if (server && !cleanServer(server)) server = null;
    if (validAppKey(carried[1]) && server !== null && !IN_PREVIEW && (carried[1] === S.connect.key || window.confirm('Use the Bud Connect link from your other device here? It replaces this device’s link.'))) {
      useKey(carried[1]);
      S.connect.on = true;
      S.connect.server = server; // the link's own server ('' is the hosted one), never this device's
      saveConnect();
      toast('This device now uses your Bud Connect link.');
    }
  }

  $('#connectServer').value = S.connect.server || CONNECT_SERVER;
  $('#connectOn').onchange = (e) => {
    S.connect.on = e.target.checked;
    saveConnect();
    restartConnect();
  };
  $('#connectServer').onchange = (e) => {
    S.connect.server = e.target.value.trim();
    // a key one server has seen is never sent to another one, so a new server means a new link
    const next = cleanServer(S.connect.server || CONNECT_SERVER);
    if (next && S.connect.seenBy && next !== S.connect.seenBy) {
      useKey(newAppKey());
      toast('New server, new connector link. Add it to your agents again.');
    }
    saveConnect();
    restartConnect();
  };
  $('#connectCopy').onclick = async () => {
    const url = $('#connectUrl').value;
    if (!url) return toast('Add the server address first.');
    try {
      await navigator.clipboard.writeText(url);
      toast('Connector link copied.');
    } catch (e) {
      $('#connectUrl').select();
      toast('Select the link and copy it.');
    }
    if (S.connect.copied === false) {
      S.connect.copied = true;
      saveConnect();
      paintConnect();
    }
  };
  $('#connectNew').onclick = () => {
    useKey(newAppKey());
    saveConnect();
    restartConnect();
    toast('New link made. The old one no longer works, so add this one to your agents.');
  };
  $('#connectMove').onclick = async () => {
    const server = S.connect.server ? cleanServer(S.connect.server) : '';
    const url = `${location.origin}${location.pathname}#bk=${S.connect.key}${server && server !== CONNECT_SERVER ? `&server=${encodeURIComponent(server)}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Copied. Open it on your other device to use this same link there. Keep it private.');
    } catch (e) {
      window.prompt('Open this on your other device. Keep it private: it can answer for you.', url);
    }
  };
  // Another tab changed the link: follow it, so a stale tab never writes the old key back.
  window.addEventListener('storage', (e) => {
    if (e.key !== SKEY || !e.newValue || IN_PREVIEW) return;
    let c = null;
    try {
      c = JSON.parse(e.newValue).connect;
    } catch (err) {
      return;
    }
    if (!c || typeof c !== 'object' || (c.key === S.connect.key && c.on === S.connect.on && c.server === S.connect.server)) return;
    S.connect = Object.assign({ on: false, server: '', key: '', seenBy: '' }, c);
    $('#connectServer').value = S.connect.server || CONNECT_SERVER;
    restartConnect();
  });
  // Phones drop sockets in the background: check the link when the page comes back.
  const revive = () => !document.hidden && connect.revive();
  document.addEventListener('visibilitychange', revive);
  window.addEventListener('pageshow', revive);
  window.addEventListener('online', revive);
  if (IN_PREVIEW) {
    $('#connectOn').disabled = true;
    $('#connectStatus').textContent = 'Open the Bud app on its own page to use Bud Connect.';
  } else restartConnect();

  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => Sfx.unlock(), { capture: true, passive: true }));
  syncHearing(); // before any Bud connects, so its microphone is set up when it does
  // On the demo brain, say where the real one is.
  function paintTry() {
    $('#tryDemo').hidden = S.provider !== 'demo' || IN_PREVIEW;
  }
  paintTry();

  paintDeviceChip('virtual');
  setMode(DEVICE_MODE ? 'device' : 'app');
  calm();
  go('home');
  paintLooksHint();
  if (DEVICE_LINK) void setupAutoReconnect().catch((error) => toast(error.message));
  else ['#pairBtn', '#reconnectBudBtn', '#disconnectBudBtn', '#firmwareSimBtn', '#pairNote'].forEach((id) => { $(id).hidden = true; });

  /* ------------------------------------------------------------ emulator */

  function bindRig(dev) {
    $('#rigFlip').onclick = () => dev.input('flip');
    $('#rigTap').onclick = () => dev.input('tap');
    $('#rigHold').onclick = () => dev.input('hold');
    document.addEventListener('keydown', (e) => {
      if (e.target && e.target.closest && e.target.closest('input, textarea, select, button, a, [role=button], [role=switch], [contenteditable]')) return;
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') {
        e.preventDefault();
        dev.input('tap');
      } else if (e.key === 'f' || e.key === 'F') dev.input('flip');
      else if (e.key === 'h' || e.key === 'H') dev.input('hold');
    });
  }

  window.BudApp = { show, submit, input, setBudTranscriber, hearOnBud, wavFrom, settings: S, device: () => device, connect, busy: () => T.busy,
    deviceClient: () => firmwareClient,
    deviceSnapshot: () => firmwareClient?.snapshot() || null,
    attachFixtureTransport: async (transport) => {
      const choice = ++deviceChoiceEpoch;
      stopAutoReconnect(true);
      const client = await makeFirmwareClient();
      if (choice !== deviceChoiceEpoch) { client.close(); transport.close?.(); return null; }
      adoptFirmwareClient(client, 'fixture');
      client.attach(transport);
      await waitFirmwareReady(client);
      if (choice !== deviceChoiceEpoch) { client.close(); return null; }
      return client;
    },
    closeDevice: () => {
      ++deviceChoiceEpoch;
      stopAutoReconnect(true);
      abandonTurn();
      firmwareClient?.close();
      firmwareClient = null;
      firmwareKind = 'none';
    },
  };
})();
