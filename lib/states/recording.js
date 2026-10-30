/* Recording: state 8, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, blink } = K.util;

  K.registerState(8, { id: 'recording', label: 'Recording', group: 'Device', key: '9', loop: 2.0, hint: 'Focused, red ring running around the edge.' }, {
    base(p, tt, L, x) {
      p.squint = 0.22;
      p.browTilt = 0.3;
      p.sy = 1 + 0.012 * osc(tt, L, 1);
      p.mouthCurve = 0.1;
      p.eyeOpen = blink(x, [1.45]);
      p.tintKey = 'recording';
      p.tintAmt = 1;
      p.glow = 0.85;
      p.fx.rec = 1;
      p.fx.ring = 1;
    },
  });
})(window.Bud);
