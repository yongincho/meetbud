import { Limits, Type, MaxWelcomeCapabilities, State, Gesture, ResultCode, StopReason, CaptureHealth,
  DisplayMood, MicMarker, PanelState, PresentationState } from './v1-ids.mjs';
import { LookCatalog } from './looks.mjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const types = new Set(Object.values(Type));
const states = new Set(Object.values(State));
const gestures = new Set(Object.values(Gesture));
const resultCodes = new Set(Object.values(ResultCode));
const stopReasons = new Set(Object.values(StopReason));
const captureHealths = new Set(Object.values(CaptureHealth));
const displayMoods = new Set(Object.values(DisplayMood));
const micMarkers = new Set(Object.values(MicMarker));
const panelStates = new Set(Object.values(PanelState));
const presentationStates = new Set(Object.values(PresentationState));
const SLOTS = ['head', 'face', 'neck', 'item'];
const STORED_PIECE = 0x80000000;
const deviceWide = new Set([Type.Mute, Type.Activation, Type.AudioOffer, Type.AudioConfig,
  Type.SettingsRead, Type.SettingsSet, Type.SettingsState, Type.OutfitSet, Type.OutfitState,
  Type.PieceOffer, Type.PieceChunk, Type.PieceCommit, Type.PieceList, Type.ScreenSet, Type.ScreenState]);

function integer(value, name, min, max) {
  if (typeof value !== 'number') throw new TypeError(`${name} must be a number`);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in ${min}..${max}`);
  }
  return value;
}

function enumeration(value, name, values) {
  integer(value, name, 0, 255);
  if (!values.has(value)) throw new RangeError(`Unknown ${name}`);
  return value;
}
function boolean(value, name) {
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`);
  return value;
}
function readBoolean(value, name) {
  if (value > 1) throw new RangeError(`${name} must be 0 or 1`);
  return value === 1;
}

function captionBytes(caption, maxBytes) {
  if (typeof caption !== 'string') throw new TypeError('caption must be a string');
  // Each UTF-16 code unit needs at least one UTF-8 byte. Bound the input before
  // scanning or allocating, including strings that cannot fit on the wire.
  if (caption.length > maxBytes) throw new RangeError('Caption too long');
  if (!caption.isWellFormed()) throw new TypeError('Unpaired caption surrogate');
  const bytes = encoder.encode(caption);
  if (bytes.length > maxBytes) throw new RangeError('Caption too long');
  return bytes;
}
/** A Show's optional accent, 0xRRGGBB, or undefined for none (the field left out, or null). */
function accentColor(accent) {
  return accent === undefined || accent === null ? undefined : integer(accent, 'accent', 0, 0xffffff);
}

function header(message) {
  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    throw new TypeError('message must be an object');
  }
  const type = enumeration(message.type, 'type', types);
  const session = integer(message.session, 'session', 1, 0xffffffff);
  const request = integer(message.request, 'request', 0, 0xffffffff);
  const sequence = integer(message.sequence, 'sequence', 0, 0xffffffff);
  if (type === Type.Hello || type === Type.Welcome) {
    if (request !== 0 || sequence !== 0) throw new RangeError('Handshake identities must be zero');
  } else if (sequence === 0) {
    throw new RangeError('sequence must be nonzero');
  }
  if (deviceWide.has(type) && request !== 0) {
    throw new RangeError('Device-wide control requires request zero');
  }
  if ([Type.RequestBegin, Type.CaptureStart, Type.CaptureRenew, Type.CaptureFinish, Type.ApprovalOffer,
    Type.Complete, Type.CaptureStopped, Type.ApprovalResponse, Type.ApprovalResolve, Type.RequestCancelled].includes(type) && request === 0) {
    throw new RangeError('Request-bound control requires nonzero request');
  }
  return { type, session, request, sequence };
}

/** Payload bytes by type; a Show, PieceChunk or PieceList also carries its variable part (a
 * Show's is its caption, and its accent when it has one). */
function payloadBytes(type, variable = 0) {
  switch (type) {
    case Type.Hello: return 8;
    case Type.Welcome: return 6;
    case Type.Show: return 3 + variable;
    case Type.Input: return 1;
    case Type.Result: return 5;
    case Type.RequestBegin: return 0;
    case Type.CaptureStart: return 4;
    case Type.CaptureRenew: return 4;
    case Type.CaptureFinish: return 0;
    case Type.Cancel: return 0;
    case Type.Mute: return 1;
    case Type.ApprovalOffer: return 8;
    case Type.Complete: return 1;
    case Type.Activation: return 4;
    case Type.CaptureStopped: return 5;
    case Type.ApprovalResponse: return 5;
    case Type.DeviceStatus: return 8;
    case Type.DisplayStatus: return 24;
    case Type.ApprovalResolve: return 5;
    case Type.RequestCancelled: return 1;
    case Type.AudioOffer: return 5;
    case Type.AudioConfig: return 8;
    case Type.SettingsRead: return 0;
    case Type.SettingsSet:
    case Type.SettingsState: return 8;
    case Type.OutfitSet:
    case Type.OutfitState: return 24;
    case Type.PieceOffer: return 12;
    case Type.PieceChunk: return 7 + variable;
    case Type.PieceCommit: return 4;
    case Type.PieceList: return 2 + variable;
    case Type.ScreenSet: return 2;
    case Type.ScreenState: return 3;
  }
}

/** Nothing (0), a built-in accessory worn in this slot, or a stored piece (top bit set). */
function slotCode(value, slot) {
  const code = integer(value, slot, 0, 0xffffffff);
  if (code >= STORED_PIECE || code === 0 || LookCatalog.accessories[code - 1]?.slot === slot) return code;
  throw new RangeError(`${slot} is not a piece for that slot`);
}
function pieceKey(value, name = 'key') {
  return integer(value, name, STORED_PIECE, 0xffffffff);
}

function payload(message, type) {
  switch (type) {
    case Type.Hello: {
      const minVersion = integer(message.minVersion, 'minVersion', 1, 255);
      const maxVersion = integer(message.maxVersion, 'maxVersion', minVersion, 255);
      const capabilities = integer(message.capabilities, 'capabilities', 0, 0xffffffff);
      const receiveLimit = integer(message.receiveLimit, 'receiveLimit', Limits.MinReceiveBytes, Limits.MaxFrameBytes);
      return { minVersion, maxVersion, capabilities, receiveLimit };
    }
    case Type.Welcome: {
      const capabilities = integer(message.capabilities, 'capabilities', 0, 0xffffffff);
      if (capabilities > MaxWelcomeCapabilities) throw new RangeError('Unsupported negotiated capability');
      const receiveLimit = integer(message.receiveLimit, 'receiveLimit', Limits.MinReceiveBytes, Limits.MaxFrameBytes);
      return { capabilities, receiveLimit };
    }
    case Type.Show: {
      const state = enumeration(message.state, 'state', states);
      const progress = integer(message.progress, 'progress', 0, 255);
      // An accent follows the caption, so a caption that has one is AccentBytes shorter.
      const accent = accentColor(message.accent);
      const caption = captionBytes(message.caption,
        Limits.MaxCaptionBytes - (accent === undefined ? 0 : Limits.AccentBytes));
      return { state, progress, caption, accent };
    }
    case Type.Input:
      return { gesture: enumeration(message.gesture, 'gesture', gestures) };
    case Type.Result: {
      const code = enumeration(message.code, 'code', resultCodes);
      const ackSequence = integer(message.ackSequence, 'ackSequence', 1, 0xffffffff);
      return { code, ackSequence };
    }
    case Type.RequestBegin:
    case Type.CaptureFinish:
    case Type.Cancel:
    case Type.SettingsRead: return {};
    case Type.CaptureStart:
    case Type.Activation: return { activation: integer(message.activation, 'activation', 1, 0xffffffff) };
    case Type.CaptureRenew: return { recording: integer(message.recording, 'recording', 1, 0xffffffff) };
    case Type.Mute: return { muted: boolean(message.muted, 'muted') };
    case Type.ApprovalOffer: return {
      approval: integer(message.approval, 'approval', 1, 0xffffffff),
      ttlMs: integer(message.ttlMs, 'ttlMs', 1, 0x7fffffff),
    };
    case Type.Complete: return { succeeded: boolean(message.succeeded, 'succeeded') };
    case Type.CaptureStopped: return {
      recording: integer(message.recording, 'recording', 1, 0xffffffff),
      stopReason: enumeration(message.stopReason, 'stopReason', stopReasons),
    };
    case Type.ApprovalResponse: return {
      approval: integer(message.approval, 'approval', 1, 0xffffffff),
      approved: boolean(message.approved, 'approved'),
    };
    case Type.ApprovalResolve: return {
      approval: integer(message.approval, 'approval', 1, 0xffffffff),
      approved: boolean(message.approved, 'approved'),
    };
    case Type.RequestCancelled: {
      const stopReason = enumeration(message.stopReason, 'stopReason', stopReasons);
      if (stopReason !== StopReason.Cancel && stopReason !== StopReason.Timeout) throw new RangeError('Invalid cancellation reason');
      return { stopReason };
    }
    case Type.DeviceStatus: return {
      captureHealth: enumeration(message.captureHealth, 'captureHealth', captureHealths),
      muted: boolean(message.muted, 'muted'),
      screenResting: boolean(message.screenResting, 'screenResting'),
      fault: boolean(message.fault, 'fault'),
      recording: integer(message.recording, 'recording', 0, 0xffffffff),
    };
    case Type.DisplayStatus: {
      const selectionRevision = integer(message.selectionRevision, 'selectionRevision', 1, 0xffffffff);
      const completedRevision = integer(message.completedRevision, 'completedRevision', 0, 0xffffffff);
      const approval = integer(message.approval, 'approval', 0, 0xffffffff);
      const lastAcceptedShowSequence = integer(message.lastAcceptedShowSequence, 'lastAcceptedShowSequence', 0, 0xffffffff);
      const selectedState = enumeration(message.selectedState, 'selectedState', states);
      const progress = integer(message.progress, 'progress', 0, 255);
      const mood = enumeration(message.mood, 'mood', displayMoods);
      const micMarker = enumeration(message.micMarker, 'micMarker', micMarkers);
      const selectionFlags = integer(message.selectionFlags, 'selectionFlags', 0, 7);
      const panel = enumeration(message.panel, 'panel', panelStates);
      const presentation = enumeration(message.presentation, 'presentation', presentationStates);
      if (completedRevision > selectionRevision) throw new RangeError('Completed revision is newer than selection');
      if (approval !== 0 && message.request === 0) throw new RangeError('Approval needs a request');
      if (completedRevision !== 0 && panel !== PanelState.Ready) throw new RangeError('Completed revision needs a ready panel');
      if (presentation === PresentationState.Complete &&
          (completedRevision !== selectionRevision || panel !== PanelState.Ready))
        throw new RangeError('Complete presentation needs matching revision and a ready panel');
      return { selectionRevision, completedRevision, approval, lastAcceptedShowSequence,
        selectedState, progress, mood, micMarker, selectionFlags, panel, presentation };
    }
    case Type.AudioOffer: return {
      maxPacketBytes: integer(message.maxPacketBytes, 'maxPacketBytes', 38, 256),
      codecs: integer(message.codecs, 'codecs', 1, 3),
      rates: integer(message.rates, 'rates', 1, 3),
      channels: integer(message.channels, 'channels', 1, 7),
    };
    case Type.AudioConfig: {
      const codec = integer(message.codec, 'codec', 0, 1);
      const rateKhz = integer(message.rateKhz, 'rateKhz', 0, 255);
      const channel = integer(message.channel, 'channel', 0, 2);
      const sampleCount = integer(message.sampleCount, 'sampleCount', 1, 65535);
      const maxPacketBytes = integer(message.maxPacketBytes, 'maxPacketBytes', 38, 256);
      if ((rateKhz !== 8 && rateKhz !== 16) ||
          34 + (codec === 0 ? sampleCount * 2 : Math.ceil(sampleCount / 2)) > maxPacketBytes)
        throw new RangeError('Invalid audio configuration');
      return { codec, rateKhz, channel, sampleCount, maxPacketBytes };
    }
    case Type.SettingsSet:
    case Type.SettingsState: {
      const revision = integer(type === Type.SettingsSet ? message.expectedRevision : message.revision,
        type === Type.SettingsSet ? 'expectedRevision' : 'revision', 0, 0xffffffff);
      const look = integer(message.look, 'look', 0, LookCatalog.looks.length - 1);
      const restSeconds = integer(message.restSeconds, 'restSeconds', 0, 255);
      const catalogVersion = integer(message.catalogVersion, 'catalogVersion', 0, 255);
      if (!LookCatalog.restSeconds.includes(restSeconds) || catalogVersion !== LookCatalog.version)
        throw new RangeError('Invalid settings catalog selection');
      if (type === Type.SettingsSet) return { expectedRevision: revision, look, restSeconds, catalogVersion };
      const storageHealthy = boolean(message.storageHealthy, 'storageHealthy');
      if (storageHealthy && revision === 0) throw new RangeError('Healthy settings need a revision');
      return { revision, look, restSeconds, catalogVersion, storageHealthy };
    }
    case Type.OutfitSet:
    case Type.OutfitState: {
      const set = type === Type.OutfitSet;
      const revision = integer(set ? message.expectedRevision : message.revision,
        set ? 'expectedRevision' : 'revision', 0, 0xffffffff);
      const active = boolean(message.active, 'active');
      const theme = integer(message.theme, 'theme', 0, LookCatalog.themes.length - 1);
      const ambient = integer(message.ambient, 'ambient', 0, LookCatalog.ambients.length);
      const pieces = Object.fromEntries(SLOTS.map(slot => [slot, slotCode(message[slot], slot)]));
      if (!active && (theme || ambient || SLOTS.some(slot => pieces[slot])))
        throw new RangeError('An outfit that is off carries nothing');
      if (set) {
        const catalogVersion = integer(message.catalogVersion, 'catalogVersion', 0, 255);
        if (catalogVersion !== LookCatalog.version) throw new RangeError('Invalid outfit catalog');
        return { expectedRevision: revision, active, theme, ambient, catalogVersion, ...pieces };
      }
      const storageHealthy = boolean(message.storageHealthy, 'storageHealthy');
      if (storageHealthy && revision === 0) throw new RangeError('A healthy outfit needs a revision');
      return { revision, active, theme, ambient, storageHealthy, ...pieces };
    }
    case Type.PieceOffer: return {
      key: pieceKey(message.key),
      size: integer(message.size, 'size', 1, Limits.MaxPieceBytes),
      slot: integer(message.slot, 'slot', 0, SLOTS.length - 1),
      crc: integer(message.crc, 'crc', 0, 0xffffffff),
    };
    case Type.PieceChunk: {
      const key = pieceKey(message.key);
      if (!(message.data instanceof Uint8Array)) throw new TypeError('data must be a Uint8Array');
      const data = message.data;
      if (data.length < 1 || data.length > Limits.MaxPieceChunkBytes) throw new RangeError('Invalid piece chunk length');
      const at = integer(message.at, 'at', 0, Limits.MaxPieceBytes - data.length);
      return { key, at, data };
    }
    case Type.PieceCommit: return { key: pieceKey(message.key) };
    case Type.PieceList: {
      const capacity = integer(message.capacity, 'capacity', 0, Limits.MaxPieceKeys);
      if (!Array.isArray(message.keys) || message.keys.length > capacity) throw new RangeError('Invalid piece list');
      const keys = message.keys.map((key, i) => {
        pieceKey(key, 'keys');
        if (i && key <= message.keys[i - 1]) throw new RangeError('Piece keys must ascend');
        return key;
      });
      return { capacity, keys };
    }
    case Type.ScreenSet:
    case Type.ScreenState: {
      const brightness = integer(message.brightness, 'brightness', 1, 255);
      const neverRest = boolean(message.neverRest, 'neverRest');
      if (type === Type.ScreenSet) return { brightness, neverRest };
      return { brightness, neverRest, storageHealthy: boolean(message.storageHealthy, 'storageHealthy') };
    }
    default:
      throw new RangeError('Unknown type');
  }
}

/** Encode one frame without applying session policy or mutating the message. */
export function encode(message) {
  const common = header(message);
  const data = payload(message, common.type);
  const accentBytes = data.accent === undefined ? 0 : Limits.AccentBytes;
  const length = payloadBytes(common.type,
    data.caption ? data.caption.length + accentBytes : data.data?.length ?? (data.keys ? 4 * data.keys.length : 0));
  const bytes = new Uint8Array(Limits.HeaderBytes + length);
  const view = new DataView(bytes.buffer);
  bytes[0] = Limits.Magic0;
  bytes[1] = Limits.Magic1;
  bytes[2] = Limits.Version;
  bytes[3] = common.type;
  view.setUint16(4, length, true);
  view.setUint32(8, common.session, true);
  view.setUint32(12, common.request, true);
  view.setUint32(16, common.sequence, true);
  const offset = Limits.HeaderBytes;
  switch (common.type) {
    case Type.Hello:
      bytes[offset] = data.minVersion;
      bytes[offset + 1] = data.maxVersion;
      view.setUint32(offset + 2, data.capabilities, true);
      view.setUint16(offset + 6, data.receiveLimit, true);
      break;
    case Type.Welcome:
      view.setUint32(offset, data.capabilities, true);
      view.setUint16(offset + 4, data.receiveLimit, true);
      break;
    case Type.Show:
      bytes[offset] = data.state;
      bytes[offset + 1] = data.progress;
      bytes[offset + 2] = data.caption.length;
      bytes.set(data.caption, offset + 3);
      if (data.accent !== undefined) {
        bytes.set([data.accent >> 16, (data.accent >> 8) & 0xff, data.accent & 0xff], offset + 3 + data.caption.length);
      }
      break;
    case Type.Input:
      bytes[offset] = data.gesture;
      break;
    case Type.Result:
      bytes[offset] = data.code;
      view.setUint32(offset + 1, data.ackSequence, true);
      break;
    case Type.RequestBegin:
    case Type.CaptureFinish:
    case Type.Cancel:
    case Type.SettingsRead: break;
    case Type.CaptureStart:
    case Type.Activation: view.setUint32(offset, data.activation, true); break;
    case Type.CaptureRenew: view.setUint32(offset, data.recording, true); break;
    case Type.Mute: bytes[offset] = data.muted ? 1 : 0; break;
    case Type.ApprovalOffer:
      view.setUint32(offset, data.approval, true);
      view.setUint32(offset + 4, data.ttlMs, true);
      break;
    case Type.Complete: bytes[offset] = data.succeeded ? 1 : 0; break;
    case Type.RequestCancelled: bytes[offset] = data.stopReason; break;
    case Type.CaptureStopped:
      view.setUint32(offset, data.recording, true);
      bytes[offset + 4] = data.stopReason;
      break;
    case Type.ApprovalResponse:
      view.setUint32(offset, data.approval, true);
      bytes[offset + 4] = data.approved ? 1 : 0;
      break;
    case Type.ApprovalResolve:
      view.setUint32(offset, data.approval, true);
      bytes[offset + 4] = data.approved ? 1 : 0;
      break;
    case Type.DeviceStatus:
      bytes[offset] = data.captureHealth;
      bytes[offset + 1] = data.muted ? 1 : 0;
      bytes[offset + 2] = data.screenResting ? 1 : 0;
      bytes[offset + 3] = data.fault ? 1 : 0;
      view.setUint32(offset + 4, data.recording, true);
      break;
    case Type.DisplayStatus:
      view.setUint32(offset, data.selectionRevision, true);
      view.setUint32(offset + 4, data.completedRevision, true);
      view.setUint32(offset + 8, data.approval, true);
      view.setUint32(offset + 12, data.lastAcceptedShowSequence, true);
      bytes[offset + 16] = data.selectedState;
      bytes[offset + 17] = data.progress;
      bytes[offset + 18] = data.mood;
      bytes[offset + 19] = data.micMarker;
      bytes[offset + 20] = data.selectionFlags;
      bytes[offset + 21] = data.panel;
      bytes[offset + 22] = data.presentation;
      break;
    case Type.AudioOffer:
      view.setUint16(offset, data.maxPacketBytes, true);
      bytes[offset + 2] = data.codecs;
      bytes[offset + 3] = data.rates;
      bytes[offset + 4] = data.channels;
      break;
    case Type.AudioConfig:
      bytes[offset] = data.codec;
      bytes[offset + 1] = data.rateKhz;
      bytes[offset + 2] = data.channel;
      view.setUint16(offset + 4, data.sampleCount, true);
      view.setUint16(offset + 6, data.maxPacketBytes, true);
      break;
    case Type.SettingsSet:
    case Type.SettingsState:
      view.setUint32(offset, common.type === Type.SettingsSet ? data.expectedRevision : data.revision, true);
      bytes[offset + 4] = data.look;
      bytes[offset + 5] = data.restSeconds;
      bytes[offset + 6] = data.catalogVersion;
      bytes[offset + 7] = common.type === Type.SettingsState && data.storageHealthy ? 1 : 0;
      break;
    case Type.OutfitSet:
    case Type.OutfitState:
      view.setUint32(offset, common.type === Type.OutfitSet ? data.expectedRevision : data.revision, true);
      bytes[offset + 4] = data.active ? 1 : 0;
      bytes[offset + 5] = data.theme;
      bytes[offset + 6] = data.ambient;
      bytes[offset + 7] = common.type === Type.OutfitSet ? data.catalogVersion : data.storageHealthy ? 1 : 0;
      SLOTS.forEach((slot, i) => view.setUint32(offset + 8 + 4 * i, data[slot], true));
      break;
    case Type.PieceOffer:
      view.setUint32(offset, data.key, true);
      view.setUint16(offset + 4, data.size, true);
      bytes[offset + 6] = data.slot;
      view.setUint32(offset + 8, data.crc, true);
      break;
    case Type.PieceChunk:
      view.setUint32(offset, data.key, true);
      view.setUint16(offset + 4, data.at, true);
      bytes[offset + 6] = data.data.length;
      bytes.set(data.data, offset + 7);
      break;
    case Type.PieceCommit: view.setUint32(offset, data.key, true); break;
    case Type.PieceList:
      bytes[offset] = data.capacity;
      bytes[offset + 1] = data.keys.length;
      data.keys.forEach((key, i) => view.setUint32(offset + 2 + 4 * i, key, true));
      break;
    case Type.ScreenSet:
    case Type.ScreenState:
      bytes[offset] = data.brightness;
      bytes[offset + 1] = data.neverRest ? 1 : 0;
      if (common.type === Type.ScreenState) bytes[offset + 2] = data.storageHealthy ? 1 : 0;
      break;
  }
  return bytes;
}

/** Decode exactly one frame into a fresh object; source bytes stay untouched. */
export function decode(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('bytes must be a Uint8Array');
  if (bytes.length < Limits.HeaderBytes || bytes.length > Limits.MaxFrameBytes) {
    throw new RangeError('Invalid frame length');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== Limits.Magic0 || bytes[1] !== Limits.Magic1) throw new RangeError('Invalid magic');
  if (bytes[2] !== Limits.Version) throw new RangeError('Unsupported version');
  if (view.getUint16(6, true) !== 0) throw new RangeError('Reserved header must be zero');
  const length = view.getUint16(4, true);
  if (length !== bytes.length - Limits.HeaderBytes) throw new RangeError('Payload length mismatch');
  const message = header({
    type: bytes[3],
    session: view.getUint32(8, true),
    request: view.getUint32(12, true),
    sequence: view.getUint32(16, true),
  });
  const offset = Limits.HeaderBytes;
  // A Show's, PieceChunk's or PieceList's length depends on its own length byte, when present.
  // A Show may end with an accent after its caption: exactly AccentBytes more.
  const variable = message.type === Type.Show && length >= 3 ? bytes[offset + 2]
    : message.type === Type.PieceChunk && length >= 7 ? bytes[offset + 6]
    : message.type === Type.PieceList && length >= 2 ? 4 * bytes[offset + 1] : 0;
  const accented = message.type === Type.Show && length === payloadBytes(message.type, variable + Limits.AccentBytes);
  if (!accented && length !== payloadBytes(message.type, variable)) throw new RangeError('Invalid message payload length');
  switch (message.type) {
    case Type.Hello:
      message.minVersion = bytes[offset];
      message.maxVersion = bytes[offset + 1];
      message.capabilities = view.getUint32(offset + 2, true);
      message.receiveLimit = view.getUint16(offset + 6, true);
      break;
    case Type.Welcome:
      message.capabilities = view.getUint32(offset, true);
      message.receiveLimit = view.getUint16(offset + 4, true);
      break;
    case Type.Show:
      message.state = bytes[offset];
      message.progress = bytes[offset + 1];
      message.caption = decoder.decode(bytes.subarray(offset + 3, offset + 3 + variable));
      if (accented) {
        const at = offset + 3 + variable;
        message.accent = (bytes[at] << 16) | (bytes[at + 1] << 8) | bytes[at + 2];
      }
      break;
    case Type.Input:
      message.gesture = bytes[offset];
      break;
    case Type.Result:
      message.code = bytes[offset];
      message.ackSequence = view.getUint32(offset + 1, true);
      break;
    case Type.RequestBegin:
    case Type.CaptureFinish:
    case Type.Cancel:
    case Type.SettingsRead: break;
    case Type.CaptureStart:
    case Type.Activation: message.activation = view.getUint32(offset, true); break;
    case Type.CaptureRenew: message.recording = view.getUint32(offset, true); break;
    case Type.Mute: message.muted = readBoolean(bytes[offset], 'muted'); break;
    case Type.ApprovalOffer:
      message.approval = view.getUint32(offset, true);
      message.ttlMs = view.getUint32(offset + 4, true);
      break;
    case Type.Complete: message.succeeded = readBoolean(bytes[offset], 'succeeded'); break;
    case Type.RequestCancelled: message.stopReason = bytes[offset]; break;
    case Type.CaptureStopped:
      message.recording = view.getUint32(offset, true);
      message.stopReason = bytes[offset + 4];
      break;
    case Type.ApprovalResponse:
      message.approval = view.getUint32(offset, true);
      message.approved = readBoolean(bytes[offset + 4], 'approved');
      break;
    case Type.ApprovalResolve:
      message.approval = view.getUint32(offset, true);
      message.approved = readBoolean(bytes[offset + 4], 'approved');
      break;
    case Type.DeviceStatus:
      message.captureHealth = bytes[offset];
      message.muted = readBoolean(bytes[offset + 1], 'muted');
      message.screenResting = readBoolean(bytes[offset + 2], 'screenResting');
      message.fault = readBoolean(bytes[offset + 3], 'fault');
      message.recording = view.getUint32(offset + 4, true);
      break;
    case Type.DisplayStatus:
      if (bytes[offset + 23] !== 0) throw new RangeError('Reserved display status byte must be zero');
      message.selectionRevision = view.getUint32(offset, true);
      message.completedRevision = view.getUint32(offset + 4, true);
      message.approval = view.getUint32(offset + 8, true);
      message.lastAcceptedShowSequence = view.getUint32(offset + 12, true);
      message.selectedState = bytes[offset + 16];
      message.progress = bytes[offset + 17];
      message.mood = bytes[offset + 18];
      message.micMarker = bytes[offset + 19];
      message.selectionFlags = bytes[offset + 20];
      message.panel = bytes[offset + 21];
      message.presentation = bytes[offset + 22];
      break;
    case Type.AudioOffer:
      message.maxPacketBytes = view.getUint16(offset, true);
      message.codecs = bytes[offset + 2];
      message.rates = bytes[offset + 3];
      message.channels = bytes[offset + 4];
      break;
    case Type.AudioConfig:
      if (bytes[offset + 3] !== 0) throw new RangeError('Reserved audio configuration byte must be zero');
      message.codec = bytes[offset];
      message.rateKhz = bytes[offset + 1];
      message.channel = bytes[offset + 2];
      message.sampleCount = view.getUint16(offset + 4, true);
      message.maxPacketBytes = view.getUint16(offset + 6, true);
      break;
    case Type.SettingsSet:
    case Type.SettingsState:
      if (message.type === Type.SettingsSet && bytes[offset + 7] !== 0)
        throw new RangeError('Reserved settings byte must be zero');
      if (message.type === Type.SettingsState && bytes[offset + 7] > 1)
        throw new RangeError('Invalid settings storage health');
      message[message.type === Type.SettingsSet ? 'expectedRevision' : 'revision'] =
        view.getUint32(offset, true);
      message.look = bytes[offset + 4];
      message.restSeconds = bytes[offset + 5];
      message.catalogVersion = bytes[offset + 6];
      if (message.type === Type.SettingsState) message.storageHealthy = bytes[offset + 7] === 1;
      break;
    case Type.OutfitSet:
    case Type.OutfitState:
      if (message.type === Type.OutfitSet) message.expectedRevision = view.getUint32(offset, true);
      else message.revision = view.getUint32(offset, true);
      message.active = readBoolean(bytes[offset + 4], 'active');
      message.theme = bytes[offset + 5];
      message.ambient = bytes[offset + 6];
      if (message.type === Type.OutfitSet) message.catalogVersion = bytes[offset + 7];
      else message.storageHealthy = readBoolean(bytes[offset + 7], 'storageHealthy');
      SLOTS.forEach((slot, i) => { message[slot] = view.getUint32(offset + 8 + 4 * i, true); });
      break;
    case Type.PieceOffer:
      if (bytes[offset + 7] !== 0) throw new RangeError('Reserved piece offer byte must be zero');
      message.key = view.getUint32(offset, true);
      message.size = view.getUint16(offset + 4, true);
      message.slot = bytes[offset + 6];
      message.crc = view.getUint32(offset + 8, true);
      break;
    case Type.PieceChunk:
      message.key = view.getUint32(offset, true);
      message.at = view.getUint16(offset + 4, true);
      message.data = bytes.slice(offset + 7);
      break;
    case Type.PieceCommit: message.key = view.getUint32(offset, true); break;
    case Type.PieceList:
      message.capacity = bytes[offset];
      message.keys = Array.from({ length: bytes[offset + 1] }, (_, i) => view.getUint32(offset + 2 + 4 * i, true));
      break;
    case Type.ScreenSet:
    case Type.ScreenState:
      message.brightness = bytes[offset];
      message.neverRest = readBoolean(bytes[offset + 1], 'neverRest');
      if (message.type === Type.ScreenState) message.storageHealthy = readBoolean(bytes[offset + 2], 'storageHealthy');
      break;
  }
  payload(message, message.type);
  return message;
}
