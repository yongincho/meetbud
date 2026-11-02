import { Limits } from './v1-ids.mjs';

export const TransportUuids = Object.freeze({
  Service: '6b65626a-1001-4b75-6400-62756464790a',
  Control: '6b65626a-1002-4b75-6400-62756464790a',
  Event: '6b65626a-1003-4b75-6400-62756464790a',
  Audio: '6b65626a-1004-4b75-6400-62756464790a',
  // Outside the framed control path; see docs/transport.md.
  Speaker: '6b65626a-1005-4b75-6400-62756464790a',
  Listen: '6b65626a-1006-4b75-6400-62756464790a',
});
export const FragmentResult = Object.freeze({
  Pending: 'Pending', Complete: 'Complete', Duplicate: 'Duplicate', Rejected: 'Rejected',
});
export const FragmentLimits = Object.freeze({
  Magic: 0xb1, HeaderBytes: 10, MinAttPayload: 11, MaxAttPayload: 514,
  MaxFragmentBytes: 10 + Limits.MaxFrameBytes, DefaultTimeoutMs: 2000,
});

const u32 = n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
const attValid = n => Number.isInteger(n) && n >= FragmentLimits.MinAttPayload && n <= FragmentLimits.MaxAttPayload;

// Null signals that this connection must retire before frame IDs wrap.
export function advanceFrameId(last) {
  return u32(last) && last < 0xffffffff ? last + 1 : null;
}

export class FragmentSender {
  #generation = 0;
  #frameId = 0;
  #frame = new Uint8Array(Limits.MaxFrameBytes);
  #size = 0;
  #offset = 0;
  #pending = false;
  #cached = null;

  get frameId() { return this.#frameId; }
  get pending() { return this.#pending; }
  reset(newGeneration) {
    if (!u32(newGeneration) || newGeneration === 0 || newGeneration <= this.#generation) return false;
    this.#generation = newGeneration;
    this.#frameId = this.#size = this.#offset = 0;
    this.#pending = false;
    this.#cached = null;
    return true;
  }
  begin(generation, frame) {
    if (generation === 0 || generation !== this.#generation || this.#pending || !(frame instanceof Uint8Array) ||
        frame.length < Limits.HeaderBytes || frame.length > Limits.MaxFrameBytes) return false;
    const nextId = advanceFrameId(this.#frameId);
    if (nextId === null) return false;
    this.#frameId = nextId;
    this.#frame.set(frame);
    this.#size = frame.length;
    this.#offset = 0;
    this.#pending = true;
    this.#cached = null;
    return true;
  }
  peek(generation, attPayload) {
    if (generation === 0 || generation !== this.#generation || !this.#pending || !attValid(attPayload)) return null;
    if (this.#cached) return this.#cached.length <= attPayload ? this.#cached.slice() : null;
    const dataSize = Math.min(this.#size - this.#offset, attPayload - FragmentLimits.HeaderBytes);
    const bytes = new Uint8Array(FragmentLimits.HeaderBytes + dataSize);
    const view = new DataView(bytes.buffer);
    bytes[0] = FragmentLimits.Magic;
    bytes[1] = (this.#offset === 0 ? 1 : 0) | (this.#offset + dataSize === this.#size ? 2 : 0);
    view.setUint32(2, this.#frameId, true);
    view.setUint16(6, this.#size, true);
    view.setUint16(8, this.#offset, true);
    bytes.set(this.#frame.subarray(this.#offset, this.#offset + dataSize), FragmentLimits.HeaderBytes);
    this.#cached = bytes;
    return bytes.slice();
  }
  accept(generation) {
    if (generation === 0 || generation !== this.#generation || !this.#pending || !this.#cached) return false;
    this.#offset += this.#cached.length - FragmentLimits.HeaderBytes;
    this.#pending = this.#offset !== this.#size;
    this.#cached = null;
    return true;
  }
}

export class FragmentReceiver {
  #generation = 0;
  #highestId = 0;
  #currentId = 0;
  #lastProgressAt = 0;
  #total = 0;
  #received = 0;
  #active = false;
  #complete = false;
  #frame = new Uint8Array(Limits.MaxFrameBytes);
  #lengths = new Uint16Array(Limits.MaxFrameBytes);
  #flags = new Uint8Array(Limits.MaxFrameBytes);
  #timeoutMs;

  constructor(timeoutMs = FragmentLimits.DefaultTimeoutMs) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 0x7fffffff) {
      throw new RangeError('timeoutMs must be 1..2147483647');
    }
    this.#timeoutMs = timeoutMs;
  }
  reset(newGeneration) {
    if (!u32(newGeneration) || newGeneration === 0 || newGeneration <= this.#generation) return false;
    this.#generation = newGeneration;
    this.#highestId = this.#currentId = this.#total = this.#received = 0;
    this.#active = this.#complete = false;
    return true;
  }
  #matches(offset, flags, data) {
    if (this.#lengths[offset] !== data.length || this.#flags[offset] !== flags) return false;
    for (let i = 0; i < data.length; ++i) if (this.#frame[offset + i] !== data[i]) return false;
    return true;
  }
  receive(generation, fragment, attPayload, nowMs, out) {
    const reject = { result: FragmentResult.Rejected };
    if (generation === 0 || generation !== this.#generation || !attValid(attPayload) || !u32(nowMs) ||
        !(fragment instanceof Uint8Array) || !(out instanceof Uint8Array)) return reject;
    if (this.#active && ((nowMs - this.#lastProgressAt) >>> 0) >= this.#timeoutMs) {
      this.#active = false;
      this.#received = 0;
    }
    if (fragment.length < FragmentLimits.MinAttPayload || fragment.length > attPayload) {
      if (this.#active && fragment.length >= 6 &&
          new DataView(fragment.buffer, fragment.byteOffset, fragment.byteLength).getUint32(2, true) === this.#currentId) {
        this.#active = false;
      }
      return reject;
    }
    const view = new DataView(fragment.buffer, fragment.byteOffset, fragment.byteLength);
    const flags = fragment[1];
    const id = view.getUint32(2, true);
    const total = view.getUint16(6, true);
    const offset = view.getUint16(8, true);
    const data = fragment.subarray(FragmentLimits.HeaderBytes);
    const start = (flags & 1) !== 0;
    const end = (flags & 2) !== 0;
    if (fragment[0] !== FragmentLimits.Magic || (flags & ~3) !== 0 || id === 0 ||
        total < Limits.HeaderBytes || total > Limits.MaxFrameBytes || offset >= total ||
        data.length > total - offset || start !== (offset === 0) || end !== (offset + data.length === total)) {
      if (this.#active && id === this.#currentId) this.#active = false;
      return reject;
    }
    if (id < this.#highestId) return reject;
    if (id > this.#highestId) {
      if (!start || out.length < total) return reject;
      this.#highestId = this.#currentId = id;
      this.#total = total;
      this.#received = 0;
      this.#lastProgressAt = nowMs;
      this.#active = true;
      this.#complete = false;
      this.#lengths.fill(0);
    } else if (this.#complete) {
      return id === this.#currentId && total === this.#total && this.#matches(offset, flags, data)
        ? { result: FragmentResult.Duplicate } : reject;
    } else if (!this.#active) return reject;
    if (id !== this.#currentId || total !== this.#total || out.length < this.#total) {
      this.#active = false;
      return reject;
    }
    if (offset < this.#received) {
      if (this.#matches(offset, flags, data)) return { result: FragmentResult.Duplicate };
      this.#active = false;
      return reject;
    }
    if (offset !== this.#received) {
      this.#active = false;
      return reject;
    }
    this.#frame.set(data, offset);
    this.#lengths[offset] = data.length;
    this.#flags[offset] = flags;
    this.#received += data.length;
    this.#lastProgressAt = nowMs;
    if (!end) return { result: FragmentResult.Pending };
    out.set(this.#frame.subarray(0, this.#total));
    this.#active = false;
    this.#complete = true;
    return { result: FragmentResult.Complete, length: this.#total };
  }
}
