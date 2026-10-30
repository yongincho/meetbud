/* Mic off: state 14, the number Bluetooth sends. */
(function (K) {
  'use strict';

  K.registerState(14, { id: 'privacy', label: 'Mic off', group: 'Device', loop: 3.0, hint: 'Not listening: eyes lowered, dimmed, mic-off icon.' }, {
    base(p, tt, L, x) {
      p.sleepy = 0.72;
      p.browTilt = 0.67; // cancels the sleepy droop: flat, calm lids
      p.lookY = 0.55;
      p.lookX = -0.1;
      p.y = 2;
      p.sy = 0.98;
      p.mouthCurve = 0;
      p.bright = 0.62;
      p.desat = 0.5;
      p.glow = 0.2;
      p.tintKey = 'privacy';
      p.tintAmt = 0.7;
      p.fx.micoff = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.droop = 0.5;
    },
  });
})(window.Bud);
