/* Confused: state 7, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const U = K.util;
  const { osc, blink } = U;

  K.registerState(7, { id: 'confused', label: 'Confused', group: 'Agent', key: '8', loop: 2.4, hint: 'Did not catch that: head tilt, mismatched eyes, a question mark.' }, {
    base(p, tt, L, x) {
      p.rot = 0.13 + 0.03 * osc(tt, L, 1);
      p.eyeL = 0.8;
      p.eyeR = 1.14;
      p.lookX = 0.42 * osc(tt, L, 1, 0.25);
      p.lookY = -0.15;
      p.mouthCurve = -0.15;
      p.wobble = 0.5;
      p.brow = 0.3;
      p.browTilt = -0.2;
      p.eyeOpen = blink(x, [0.9, 1.15]);
      p.tintKey = 'confused';
      p.tintAmt = 0.9;
      p.glow = 0.6;
      p.fx.question = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.horn = 0.8 * U.osc(tt, L, 1, 0.5);
    },
  });
})(window.Bud);
