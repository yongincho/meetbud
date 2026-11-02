const CHANNEL = 'bud-companion-v1';
const READY_TIMEOUT_MS = 5000;
const HEARTBEAT_MS = 1000;
const HEARTBEAT_TIMEOUT_MS = 3000;
const WRITE_ACK_MS = 1000;

function newNonce(window) {
  const crypto = window.crypto || globalThis.crypto;
  if (!crypto?.getRandomValues) throw new Error('Secure random values are required for the simulator token.');
  return [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function validNonce(value) { return typeof value === 'string' && /^[0-9a-f]{32,64}$/.test(value); }
function validOrigin(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch { return false; }
}

/** Open the simulator on an explicit user gesture, then attach the returned transport to DeviceClient. */
export function openFirmwareSimulator({ url = 'http://127.0.0.1:4173/flow.html',
  window = globalThis.window, timers = globalThis, clock = () => Date.now(), nonce = null } = {}) {
  if (!window?.open || !window?.addEventListener || !validOrigin(window.location?.origin)) {
    return Promise.reject(new Error('A localhost browser window is required.'));
  }
  const token = nonce ?? newNonce(window);
  if (!validNonce(token)) return Promise.reject(new Error('Invalid simulator token.'));
  const popupUrl = new URL(url, window.location.href);
  if (!validOrigin(popupUrl.origin)) return Promise.reject(new Error('Simulator URL needs an HTTP origin.'));
  popupUrl.searchParams.set('mode', 'companion');
  popupUrl.searchParams.set('origin', window.location.origin);
  popupUrl.searchParams.set('token', token);
  const popup = window.open(popupUrl.href, `bud-firmware-companion-${token}`, 'popup,width=1100,height=800');
  if (!popup) return Promise.reject(new Error('The simulator popup was blocked.'));

  return new Promise((resolve, reject) => {
    const subscribers = new Set();
    const audioSubscribers = new Set();
    const disconnectSubscribers = new Set();
    const writes = new Map();
    let closed = false, ready = false, started = false, nextWrite = 1;
    let readyTimer, heartbeatTimer, lastPeerAt = clock();

    const post = (type, fields = {}) => popup.postMessage({ channel: CHANNEL, token, type, ...fields }, popupUrl.origin);
    const end = (reason, notify = true) => {
      if (closed) return;
      closed = true;
      timers.clearTimeout(readyTimer);
      timers.clearInterval(heartbeatTimer);
      window.removeEventListener('message', onMessage);
      window.removeEventListener('pagehide', onPageHide);
      if (!popup.closed) {
        try { post('disconnect'); } catch { /* peer already gone */ }
        popup.close?.();
      }
      for (const { timer, reject: rejectWrite } of writes.values()) {
        timers.clearTimeout(timer);
        rejectWrite(reason);
      }
      writes.clear();
      if (!ready) reject(reason);
      if (notify) for (const listener of [...disconnectSubscribers]) listener(reason);
      subscribers.clear();
      audioSubscribers.clear();
      disconnectSubscribers.clear();
    };
    const onPageHide = () => end(new Error('Simulator owner page closed.'));
    const transport = {
      name: 'Firmware simulator', attPayload: 20, audioMaxPacketBytes: 256,
      subscribe(listener) {
        if (closed) throw new Error('Simulator transport closed.');
        subscribers.add(listener);
        if (!started) {
          started = true;
          // DeviceClient.attach registers its fragment and disconnect handlers before this runs.
          queueMicrotask(() => {
            if (!closed && subscribers.size) {
              try { post('connect'); } catch (error) { end(error); }
            }
          });
        }
        return () => subscribers.delete(listener);
      },
      onDisconnect(listener) { disconnectSubscribers.add(listener); return () => disconnectSubscribers.delete(listener); },
      subscribeAudio(listener) {
        if (closed) throw new Error('Simulator transport closed.');
        if (typeof listener !== 'function') throw new TypeError('Audio listener must be a function.');
        audioSubscribers.add(listener);
        return () => audioSubscribers.delete(listener);
      },
      write(fragment) {
        if (closed || !started || !(fragment instanceof Uint8Array) || fragment.length < 11 ||
            fragment.length > 20 || writes.size >= 1) return Promise.reject(new Error('Invalid or concurrent simulator write.'));
        const id = nextWrite++;
        if (!Number.isSafeInteger(id)) return Promise.reject(new Error('Simulator write IDs exhausted.'));
        return new Promise((yes, no) => {
          const timer = timers.setTimeout(() => {
            writes.delete(id);
            no(new Error('Simulator fragment acknowledgement timed out.'));
          }, WRITE_ACK_MS);
          writes.set(id, { timer, resolve: yes, reject: no });
          try { post('fragment', { id, bytes: fragment.slice() }); }
          catch (error) { timers.clearTimeout(timer); writes.delete(id); no(error); }
        });
      },
      close() { end(new Error('Simulator transport closed.'), false); },
    };
    const onMessage = event => {
      const message = event.data;
      if (closed || event.source !== popup || event.origin !== popupUrl.origin ||
          !message || message.channel !== CHANNEL || message.token !== token) return;
      if (!ready && message.type !== 'ready') return;
      lastPeerAt = clock();
      if (message.type === 'ready') {
        if (ready) return;
        ready = true;
        timers.clearTimeout(readyTimer);
        heartbeatTimer = timers.setInterval(() => {
          if (popup.closed || clock() - lastPeerAt >= HEARTBEAT_TIMEOUT_MS) {
            end(new Error('Simulator popup stopped responding.'));
            return;
          }
          try { post('ping'); } catch (error) { end(error); }
        }, HEARTBEAT_MS);
        resolve(transport);
      } else if (message.type === 'frame') {
        if (!(message.bytes instanceof Uint8Array) || message.bytes.length < 11 || message.bytes.length > 20) return;
        for (const listener of [...subscribers]) listener(message.bytes.slice());
      } else if (message.type === 'audio') {
        if (!Number.isSafeInteger(message.id) || message.id < 1) return;
        const valid = started && message.bytes instanceof Uint8Array &&
          message.bytes.length >= 34 && message.bytes.length <= 256;
        let delivered = valid;
        if (valid) {
          try { for (const listener of [...audioSubscribers]) listener(message.bytes.slice()); }
          catch { delivered = false; }
        }
        try { post('audio-accepted', { id: message.id, ok: delivered }); }
        catch (error) { end(error); }
      } else if (message.type === 'accepted') {
        if (!Number.isSafeInteger(message.id) || message.id < 1 || typeof message.ok !== 'boolean') return;
        const pending = writes.get(message.id);
        if (!pending) return;
        timers.clearTimeout(pending.timer);
        writes.delete(message.id);
        pending.resolve(message.ok);
      } else if (message.type === 'ping') {
        try { post('pong'); } catch (error) { end(error); }
      } else if (message.type === 'closed') end(new Error('Simulator peer disconnected.'));
      // pong only updates lastPeerAt.
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('pagehide', onPageHide);
    readyTimer = timers.setTimeout(() => end(new Error('Simulator did not become ready within five seconds.')),
      READY_TIMEOUT_MS);
    // Detect a popup closed before it could send ready.
    const waitClosed = () => {
      if (closed || ready) return;
      if (popup.closed) end(new Error('Simulator popup closed before it was ready.'));
      else timers.setTimeout(waitClosed, 100);
    };
    timers.setTimeout(waitClosed, 100);
  });
}
