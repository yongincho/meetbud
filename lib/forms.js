/* Form factors. One data object per form; add a new one by copying a block.
 *
 * Everything is in millimeters relative to the device center, as a function of
 * `s`, the size slider value (device width, or diameter for round forms):
 *   body(s)     -> outline: { type: 'circle' | 'rrect', w, h, r }
 *   screen(s)   -> active display: { type: 'circle' | 'rrect' | 'arch', x, y, w, h, r?, br? }
 *                  (r and br are fractions of the screen's shorter side)
 *   wordmark(s) -> { x, y, size } where the name is printed, or omit for none
 *   ring(s)     -> { outer, inner } diameters for a ring grip, optional
 *   stage       -> where the 100-unit character stage sits in the screen
 *   glass       -> 'face' (cover glass over the whole face) or 'window'
 *   profile     -> side view: { edge: top edge radius mm, dome: glass bulge mm }
 * Bezels, window sizes and radii here are exploration values, not specs.
 */
(function (K) {
  'use strict';

  // Card forms borrow the standard bank card proportions (ISO/IEC 7810 ID-1, 85.60 x 53.98 mm).
  const CARD = 85.6 / 53.98;
  K.CARD_RATIO = CARD;

  K.registerForm({
    id: 'round-full',
    label: 'Round, full screen',
    short: 'Round',
    group: 'Round',
    note: 'The whole face is the display. Biggest character, most lit pixels.',
    body: (s) => ({ type: 'circle', w: s, h: s }),
    screen: (s) => ({ type: 'circle', x: 0, y: 0, w: s - 2.8, h: s - 2.8 }),
    bezel: 0.6,
    glass: 'face',
    profile: { edge: 2.4, dome: 0.35 },
  });

  K.registerForm({
    id: 'round-porthole',
    label: 'Round, half screen (round window)',
    short: 'Porthole',
    group: 'Round',
    note: 'A smaller round window in a matte, fabric or colored shell. Less glass, more material, room for a name.',
    body: (s) => ({ type: 'circle', w: s, h: s }),
    screen: (s) => ({ type: 'circle', x: 0, y: -s * 0.07, w: s * 0.56, h: s * 0.56 }),
    wordmark: (s) => ({ x: 0, y: s * 0.33, size: s * 0.075 }),
    bezel: 0.7,
    glass: 'window',
    profile: { edge: 2.2, dome: 0.15 },
  });

  K.registerForm({
    id: 'round-arch',
    label: 'Round, half screen (arch window)',
    short: 'Arch',
    group: 'Round',
    note: 'An arch-shaped window: the character peeks up from the sill, like a little doorway.',
    body: (s) => ({ type: 'circle', w: s, h: s }),
    screen: (s) => ({ type: 'arch', x: 0, y: -s * 0.06, w: s * 0.6, h: s * 0.48, br: 0.08 }),
    wordmark: (s) => ({ x: 0, y: s * 0.32, size: s * 0.075 }),
    stage: { align: 'bottom', scale: 1, dy: 4 },
    bezel: 0.7,
    glass: 'window',
    profile: { edge: 2.2, dome: 0.15 },
  });

  K.registerForm({
    id: 'squircle-full',
    label: 'Rounded square, full screen',
    short: 'Squircle',
    group: 'Square',
    note: 'Rounded square with the whole face as display. Square pixels fill it with less waste.',
    body: (s) => ({ type: 'rrect', w: s, h: s, r: s * 0.3 }),
    screen: (s) => ({ type: 'rrect', x: 0, y: 0, w: s - 2.8, h: s - 2.8, r: (s * 0.3 - 1.4) / (s - 2.8) }),
    bezel: 0.6,
    glass: 'face',
    profile: { edge: 2.4, dome: 0.3 },
  });

  K.registerForm({
    id: 'card-window',
    label: 'Card with small round window',
    short: 'Card window',
    group: 'Card',
    note: 'Plaud-like card with a small round window. The rest of the face carries the name and material.',
    body: (s) => ({ type: 'rrect', w: s, h: s * CARD, r: s * 0.13 }),
    screen: (s) => ({ type: 'circle', x: 0, y: -s * CARD * 0.17, w: s * 0.52, h: s * 0.52 }),
    wordmark: (s) => ({ x: 0, y: s * CARD * 0.25, size: s * 0.085 }),
    bezel: 0.7,
    glass: 'window',
    profile: { edge: 1.2, dome: 0.1 },
  });

  K.registerForm({
    id: 'card-full',
    label: 'Card, full screen',
    short: 'Card full',
    group: 'Card',
    note: 'Card with the whole face as display. Room for status text under the character.',
    body: (s) => ({ type: 'rrect', w: s, h: s * CARD, r: s * 0.13 }),
    screen: (s) => ({ type: 'rrect', x: 0, y: 0, w: s - 3, h: s * CARD - 3, r: (s * 0.13 - 1.5) / (s - 3) }),
    chrome: true,
    bezel: 0.6,
    glass: 'face',
    profile: { edge: 1.2, dome: 0.15 },
  });

  K.registerForm({
    id: 'round-ring',
    label: 'Round with ring grip',
    short: 'Ring grip',
    group: 'Round',
    note: 'A metal ring around the screen flips out as a phone grip or stand. A daily practical reason to exist.',
    body: (s) => ({ type: 'circle', w: s, h: s }),
    screen: (s) => ({ type: 'circle', x: 0, y: 0, w: s * 0.64, h: s * 0.64 }),
    ring: (s) => ({ outer: s, inner: s * 0.78 }),
    ringText: true,
    bezel: 0.7,
    glass: 'window',
    profile: { edge: 1.6, dome: 0.25, ring: true },
  });
})(window.Bud);
