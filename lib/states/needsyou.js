/* Needs you: state 6, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, hop } = K.util;

  K.registerState(6, { id: 'needsyou', label: 'Needs you', group: 'Agent', key: '7', loop: 1.6, hint: 'Bounces and pulses the edge for attention.' }, {
    base(p, tt, L, x) {
      const h = hop(x, 0.0, 0.32) + hop(x, 0.36, 0.68);
      const land = hop(x, 0.32, 0.4) + hop(x, 0.68, 0.8);
      p.y = -5 * h;
      p.sy = 1 + 0.06 * h - 0.07 * land;
      p.sx = 1 - 0.03 * h + 0.06 * land;
      p.rot = 0.07 * osc(tt, L, 2);
      p.wide = 0.55;
      p.sparkle = 1.6;
      p.lookY = -0.12;
      p.mouthOpen = 0.32;
      p.mouthCurve = 0.35;
      p.brow = 0.8;
      p.browTilt = -0.6;
      p.blush = 0.85;
      p.tintKey = 'needsyou';
      p.tintAmt = 1;
      p.glow = 1;
      p.fx.bang = 1;
      p.fx.attn = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.round = 1;
      e.perk = 1;
    },
  });
})(window.Bud);
