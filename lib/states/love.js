/* Love: state 10, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { hop } = K.util;

  K.registerState(10, { id: 'love', label: 'Love', group: 'Moments', loop: 2.0, hint: 'Heart eyes and floating hearts, for a thank-you.' }, {
    base(p, tt, L, x) {
      const beat = hop(x, 0.0, 0.18) + 0.7 * hop(x, 0.22, 0.4);
      p.heart = 1;
      p.sy = 1 + 0.05 * beat;
      p.sx = 1 + 0.03 * beat;
      p.y = -0.6 * beat;
      p.blush = 1;
      p.mouthCurve = 0.85;
      p.tintKey = 'love';
      p.tintAmt = 0.9;
      p.glow = 0.9;
      p.fx.hearts = 1;
    },
  });
})(window.Bud);
