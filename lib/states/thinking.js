/* Thinking: state 2, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const U = K.util;
  const { osc, blink } = U;

  K.registerState(2, { id: 'thinking', label: 'Thinking', group: 'Conversation', key: '3', loop: 2.4, hint: 'Looks up and away, turns orange, ticks over.' }, {
    base(p, tt, L, x) {
      p.lookX = 0.62 + 0.08 * osc(tt, L, 1);
      p.lookY = -0.72;
      p.asym = 0.6;
      p.rot = -0.05 + 0.025 * osc(tt, L, 1);
      p.x = 1.2 * osc(tt, L, 1, 0.25);
      p.mouthCurve = -0.05;
      p.mouthX = 2.5;
      p.eyeOpen = blink(x, [1.7]);
      p.brow = 0.35;
      p.browTilt = 0.15;
      p.tintKey = 'thinking';
      p.tintAmt = 1;
      p.glow = 0.8;
      p.fx.dots = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.horn = 1.5 * U.osc(tt, L, 2);
    },
  });
})(window.Bud);
