// An app outfit ({ theme, head, face, neck, item, ambient }, ids, '' for none) as Bud's codes
// (Capability.Outfits: OutfitSet and OutfitState) and back. Built-in pieces are their place in the
// look catalog's accessories, plus 1; the app's own pieces (place finds, Best buds) are the keys of
// their recorded drawings (pieces.mjs), which Bud must have before it can draw them.
import { LookCatalog } from './protocol/looks.mjs';

export const SLOTS = ['head', 'face', 'neck', 'item'];
export const OFF = Object.freeze({ active: false, theme: 0, ambient: 0, head: 0, face: 0, neck: 0, item: 0 });

/** Bud's codes for an app outfit, or null if a piece is unknown here. `pieces` maps an app piece's id to { key, slot }. */
export function outfitCodes(outfit, pieces = {}) {
  const theme = LookCatalog.themes.findIndex((t) => t.id === (outfit.theme || 'classic'));
  const ambient = outfit.ambient ? LookCatalog.ambients.findIndex((a) => a.id === outfit.ambient) + 1 : 0;
  if (theme < 0 || ambient < 0) return null;
  const codes = { active: true, theme, ambient };
  for (const slot of SLOTS) {
    const id = outfit[slot];
    if (!id) { codes[slot] = 0; continue; }
    const builtIn = LookCatalog.accessories.findIndex((a) => a.id === id && a.slot === slot);
    if (builtIn >= 0) { codes[slot] = builtIn + 1; continue; }
    const piece = pieces[id];
    if (!piece || piece.slot !== slot) return null;
    codes[slot] = piece.key;
  }
  return codes;
}

/** The app outfit Bud wears (from its OutfitState), or null when it wears its look or has a piece this app doesn't know. */
export function outfitFromCodes(state, pieces = {}) {
  if (!state?.active) return null;
  const theme = LookCatalog.themes[state.theme]?.id;
  const ambient = state.ambient ? LookCatalog.ambients[state.ambient - 1]?.id : '';
  if (!theme || ambient === undefined) return null;
  const outfit = { theme, head: '', face: '', neck: '', item: '', ambient };
  for (const slot of SLOTS) {
    const code = state[slot];
    if (!code) continue;
    if (code < 0x80000000) {
      const accessory = LookCatalog.accessories[code - 1];
      if (!accessory || accessory.slot !== slot) return null;
      outfit[slot] = accessory.id;
      continue;
    }
    const id = Object.keys(pieces).find((k) => pieces[k].key === code);
    if (!id) return null;
    outfit[slot] = id;
  }
  return outfit;
}

export function sameCodes(a, b) {
  return !!a && !!b && a.active === b.active && a.theme === b.theme && a.ambient === b.ambient &&
    SLOTS.every((slot) => a[slot] === b[slot]);
}

/** The app's pieces an outfit wears that Bud doesn't keep yet (by Bud's PieceList keys). */
export function missingPieces(codes, kept, pieces = {}) {
  const have = new Set(kept || []);
  return Object.entries(pieces).filter(([, p]) => SLOTS.some((slot) => codes[slot] === p.key) && !have.has(p.key))
    .map(([id, p]) => ({ id, ...p }));
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Base64 to bytes (the generated pieces are kept as base64). */
export function fromBase64(text) {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0, value = 0, at = 0;
  for (const c of clean) {
    const v = B64.indexOf(c);
    if (v < 0) throw new RangeError('Invalid base64');
    value = (value << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; out[at++] = (value >> bits) & 255; }
  }
  return out;
}
