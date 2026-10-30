/* Hello: state 9, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { win, hop } = K.util;

  K.registerState(9, { id: 'hello', label: 'Hello', group: 'Moments', key: '0', loop: 2.2, hint: 'Pops up with a wink and a burst of sparkles. No words, so it works in any language.' }, {
    base(p, tt, L, x) {
      const h = hop(x, 0.0, 0.45);
      const land = hop(x, 0.45, 0.62);
      p.y = -5 * h;
      p.sy = 1 + 0.06 * h - 0.07 * land;
      p.sx = 1 - 0.03 * h + 0.06 * land;
      p.wide = 0.45;
      p.sparkle = 1.5;
      p.blush = 0.9;
      p.mouthOpen = 0.45;
      p.mouthCurve = 1;
      p.winkR = win(x, 0.75, 1.45, 0.12);
      p.rot = 0.06 * win(x, 0.75, 1.45, 0.15);
      p.glow = 0.9;
      p.fx.pop = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.round = 0.5;
      e.perk = 1;
    },
  });
})(window.Bud);
