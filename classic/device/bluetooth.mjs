import { TransportUuids } from './protocol/framing.mjs';

const MAX_EARLY_FRAGMENTS = 64;
const MAX_AUDIO_BYTES = 256;
// Bud's speaker (firmware/platform/esp32/speaker.h): the app writes voice packets here.
const SPEAKER_UUID = '6b65626a-1005-4b75-6400-62756464790a';
// Mic mode (firmware V1Link): one byte. Bit 0: Bud keeps a recording open of its own (always
// listening). Bit 1: walkie-talkie, where only the talk button opens Bud's mic. Bit 2: the talk
// button leaves mute alone (clear: a press while muted unmutes).
const LISTEN_UUID = '6b65626a-1006-4b75-6400-62756464790a';
// Web Bluetooth gives every caller the same BluetoothDevice, and close() cannot abort a pending
// gatt.connect(). Every attempt and open transport is registered on its device; one that ends
// disconnects only if no newer attempt and no open transport still needs the device.
const users = new WeakMap(); // BluetoothDevice -> Set of { order, open }
let attempts = 0;

// Called only by an explicit client.bluetooth() or remembered-device reconnect.
export async function connectBluetooth({ bluetooth, remembered = false, deviceId = null, onChosen = null }) {
  // `permanent` errors cannot succeed on a retry in this browser.
  if (!bluetooth) throw Object.assign(new Error('Web Bluetooth is unavailable in this browser.'), { permanent: true });
  let device;
  if (remembered) {
    if (!deviceId) throw new Error('No remembered Bud device ID.');
    if (typeof bluetooth.getDevices !== 'function') throw Object.assign(new Error('Remembered Web Bluetooth devices are unavailable.'), { permanent: true });
    device = (await bluetooth.getDevices()).find(candidate => candidate.id === deviceId);
    if (!device) throw new Error('The remembered Bud device is no longer available.');
  } else {
    device = await bluetooth.requestDevice({ filters: [{ services: [TransportUuids.Service] }] });
  }
  if (!device?.gatt) throw new Error('The chosen device has no GATT server.');
  onChosen?.(device); // the caller may now retire its old link; it can throw to abort
  const me = { order: ++attempts, open: false };
  if (!users.has(device)) users.set(device, new Set());
  users.get(device).add(me);
  const release = () => { // this attempt or transport is done; may it disconnect the device?
    const others = users.get(device);
    others.delete(me);
    return ![...others].some(other => other.open || other.order > me.order);
  };
  let server;
  let detach = () => {};
  try {
    server = await device.gatt.connect();
    const service = await server.getPrimaryService(TransportUuids.Service);
    const control = await service.getCharacteristic(TransportUuids.Control);
    const event = await service.getCharacteristic(TransportUuids.Event);
    let audio;
    try { audio = await service.getCharacteristic(TransportUuids.Audio); } catch { /* Control-only firmware. */ }
    let speaker;
    try { speaker = await service.getCharacteristic(SPEAKER_UUID); } catch { /* Firmware without a speaker. */ }
    let listenSwitch;
    try { listenSwitch = await service.getCharacteristic(LISTEN_UUID); } catch { /* Firmware without always listening. */ }
    // Chrome runs one GATT operation at a time per device, so control and speaker writes queue.
    let gatt = Promise.resolve();
    const inTurn = (operation) => {
      const next = gatt.then(operation, operation);
      gatt = next.catch(() => {});
      return next;
    };
    const listeners = new Set();
    const audioListeners = new Set();
    const disconnectListeners = new Set();
    const early = [];
    const earlyAudio = [];
    let closed = false, replaying = false, earlyError = null;
    const fail = error => {
      if (closed) return;
      earlyError = error;
      for (const listener of [...disconnectListeners]) listener(error);
      close();
    };
    const onValue = e => {
      const view = e.target?.value;
      if (!view || closed) return;
      const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice();
      if (bytes.length < 11 || bytes.length > 20) {
        fail(new Error('Invalid Bud notification fragment length.'));
        return;
      }
      if (!listeners.size || replaying || early.length) {
        if (early.length === MAX_EARLY_FRAGMENTS) {
          fail(new Error('Bud notification handshake buffer is full.'));
          return;
        }
        early.push(bytes);
        return;
      }
      for (const listener of [...listeners]) listener(bytes);
    };
    const onDisconnect = () => {
      if (closed) return;
      earlyError = new Error('Bud disconnected during notifications.');
      for (const listener of [...disconnectListeners]) listener();
    };
    const onAudio = e => {
      const view = e.target?.value;
      if (!view || closed) return;
      const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice();
      if (bytes.length < 34 || bytes.length > MAX_AUDIO_BYTES) {
        fail(new Error('Invalid Bud audio notification length.'));
        return;
      }
      if (!audioListeners.size || earlyAudio.length) {
        if (earlyAudio.length === MAX_EARLY_FRAGMENTS) {
          fail(new Error('Bud audio handshake buffer is full.'));
          return;
        }
        earlyAudio.push(bytes);
      } else for (const listener of [...audioListeners]) listener(bytes);
    };
    const close = () => {
      if (closed) return;
      closed = true;
      event.removeEventListener('characteristicvaluechanged', onValue);
      audio?.removeEventListener('characteristicvaluechanged', onAudio);
      device.removeEventListener('gattserverdisconnected', onDisconnect);
      listeners.clear(); audioListeners.clear(); disconnectListeners.clear();
      early.length = earlyAudio.length = 0;
      if (release() && device.gatt.connected) device.gatt.disconnect();
    };
    detach = close;
    event.addEventListener('characteristicvaluechanged', onValue);
    device.addEventListener('gattserverdisconnected', onDisconnect);
    if (audio) {
      audio.addEventListener('characteristicvaluechanged', onAudio);
      try { await audio.startNotifications(); }
      catch {
        audio.removeEventListener('characteristicvaluechanged', onAudio);
        audio = null;
        earlyAudio.length = 0;
      }
    }
    // The board emits Hello as soon as its notification CCCD is enabled.
    await event.startNotifications();
    if (earlyError || closed) throw earlyError || new Error('Bud disconnected before Hello.');
    me.open = true;
    return {
      name: device.name || 'Bud', deviceId: device.id, attPayload: 20,
      ...(audio ? {
        audioMaxPacketBytes: MAX_AUDIO_BYTES,
        subscribeAudio(listener) {
          if (closed) throw new Error('Bud audio notifications are closed.');
          audioListeners.add(listener);
          queueMicrotask(() => {
            while (!closed && earlyAudio.length && audioListeners.size) {
              const bytes = earlyAudio.shift();
              for (const current of [...audioListeners]) current(bytes.slice());
            }
          });
          return () => audioListeners.delete(listener);
        },
      } : {}),
      ...(speaker ? {
        async speak(bytes) {
          if (closed || !device.gatt.connected) throw new Error('Bud disconnected.');
          const copy = bytes.slice();
          await inTurn(() => speaker.writeValueWithoutResponse(copy));
        },
      } : {}),
      ...(listenSwitch ? {
        async listen(on, holdToTalk = false, keepMuted = false, talk = false) {
          if (closed || !device.gatt.connected) throw new Error('Bud disconnected.');
          const value = new Uint8Array([(on ? 1 : 0) | (holdToTalk ? 2 : 0) | (keepMuted ? 4 : 0) | (talk ? 0x18 : 0)]);
          await inTurn(() => listenSwitch.writeValueWithResponse(value));
        },
      } : {}),
      subscribe(listener) {
        if (closed) throw earlyError || new Error('Bud notifications are closed.');
        listeners.add(listener);
        replaying = true;
        queueMicrotask(() => {
          while (!closed && early.length && listeners.size) {
            const bytes = early.shift();
            for (const current of [...listeners]) current(bytes.slice());
          }
          replaying = false;
        });
        return () => listeners.delete(listener);
      },
      onDisconnect(listener) { disconnectListeners.add(listener); return () => disconnectListeners.delete(listener); },
      async write(fragment) {
        if (closed || !device.gatt.connected) throw new Error('Bud disconnected.');
        const bytes = fragment.slice();
        await inTurn(() => typeof control.writeValueWithResponse === 'function'
          ? control.writeValueWithResponse(bytes) : control.writeValue(bytes));
        return true;
      },
      close,
    };
  } catch (error) {
    detach();
    if (release() && server && device.gatt.connected) device.gatt.disconnect();
    throw error;
  }
}
