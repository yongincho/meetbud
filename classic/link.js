/* The JSON link between the app and its design emulator.
 *
 * One small protocol, several transports:
 *   app -> Bud   { v: 1, type: 'show', state, caption, progress, look: { pack, shell }, mic, seq }
 *   Bud -> app   { v: 1, type: 'input', input: 'tap' | 'hold' | 'flip' }
 *                { v: 1, type: 'hello', device: { name, kind } }   (when a Bud connects)
 *
 * Transports: a Bud on the same page (the emulator beside the app), other tabs of
 * this browser (BroadcastChannel), other devices on a claude.ai preview (the room),
 * The real binary-v1 Bluetooth route is owned by app/device/client.mjs.
 */
(function (root) {
  'use strict';

  class Link {
    constructor(role) {
      this.role = role; // 'app' or 'device'
      this.handlers = new Set();
      this.transports = [];
      this.peers = 0;
      this.seq = 0;
      this.gen = 0;
    }
    /** Drop every transport (used when a screen switches between being the app and being Bud). */
    close() {
      this.gen++;
      this.transports.forEach((t) => t.close && t.close());
      this.transports = [];
    }
    on(fn) {
      this.handlers.add(fn);
      return () => this.handlers.delete(fn);
    }
    emit(msg) {
      msg = Object.assign({ v: 1, seq: ++this.seq, from: this.role }, msg);
      this.transports.forEach((t) => t.send(msg));
      return msg;
    }
    deliver(msg) {
      if (!msg || msg.v !== 1 || msg.from === this.role) return;
      this.handlers.forEach((fn) => fn(msg));
    }

    /** Same page: app and emulator side by side. */
    local(other) {
      const t = { name: 'local', send: (m) => setTimeout(() => other.deliver(m), 0) };
      this.transports.push(t);
      return t;
    }

    /** Other tabs and windows of this browser. */
    channel() {
      if (!('BroadcastChannel' in root)) return null;
      const bc = new BroadcastChannel('bud-link-v1');
      bc.onmessage = (e) => this.deliver(e.data);
      const t = { name: 'tabs', send: (m) => bc.postMessage(m), close: () => bc.close() };
      this.transports.push(t);
      return t;
    }

    /** Other devices with the same claude.ai preview open. */
    async room() {
      if (!(root.claude && root.claude.use)) return null;
      const gen = this.gen;
      const room = await root.claude.use('room').catch(() => null);
      if (!room || gen !== this.gen) return null;
      const off = room.on('bud.link', (m) => {
        if (!m.sameTab) this.deliver(m.data);
      });
      const t = { name: 'room', send: (m) => room.emit('bud.link', m).catch(() => {}), close: () => off && off() };
      this.transports.push(t);
      return t;
    }

  }

  root.BudLink = { Link };
})(window);
