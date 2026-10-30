/* Working: state 5, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const U = K.util;
  const { osc, smoothstep } = U;

  K.registerState(5, { id: 'working', label: 'Working', group: 'Agent', key: '6', loop: 3.0, hint: 'Reading line by line while a task runs; progress around the edge.' }, {
    base(p, tt, L, x) {
      const ph = U.fract(tt / 1);
      const line = Math.floor(U.fract(tt / L) * 3);
      p.lookX = -0.6 + 1.2 * smoothstep(0, 0.78, ph) - 1.2 * smoothstep(0.84, 0.97, ph);
      p.lookY = -0.18 + 0.2 * line;
      p.squint = 0.2;
      p.browTilt = 0.18;
      p.sy = 1 + 0.01 * osc(tt, L, 3);
      p.mouthCurve = 0.05;
      p.tintKey = 'working';
      p.tintAmt = 1;
      p.glow = 0.75;
      p.fx.progress = 1;
    },
  });
})(window.Bud);
