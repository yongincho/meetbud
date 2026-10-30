/* Listening: state 1, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc } = K.util;

  K.registerState(1, { id: 'listening', label: 'Listening', group: 'Conversation', key: '2', loop: 1.6, hint: 'Leans in, eyes wide, turns blue, sound ripples.' }, {
    base(p, tt, L, x) {
      const v = 0.5 + 0.5 * osc(tt, L, 3) * osc(tt, L, 2, 0.25);
      p.ex.voice = v;
      p.wide = 0.3 + 0.12 * v;
      p.sy = 1.03 + 0.03 * v;
      p.sx = 1 - 0.015 * v;
      p.rot = 0.06;
      p.lookX = 0.1;
      p.lookY = -0.12;
      p.mouthOpen = 0.14;
      p.mouthCurve = 0.15;
      p.brow = 0.6;
      p.tintKey = 'listening';
      p.tintAmt = 1;
      p.glow = 0.95;
      p.fx.waves = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.h = 1.04 + 0.12 * e.voice;
      e.perk = 0.7;
    },
  });
})(window.Bud);
