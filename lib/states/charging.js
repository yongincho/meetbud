/* Charging: state 11, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const U = K.util;
  const { osc } = U;

  K.registerState(11, { id: 'charging', label: 'Charging', group: 'Device', loop: 3.0, hint: 'Content and relaxed, green bolt.' }, {
    base(p, tt, L, x) {
      const b = osc(tt, L, 1);
      p.sleepy = 0.35;
      p.happy = 0.25;
      p.sy = 1 + 0.02 * b;
      p.y = 1 + 0.6 * b;
      p.mouthCurve = 0.6;
      p.blush = 0.5;
      p.bright = 0.92;
      p.tintKey = 'charging';
      p.tintAmt = 0.8;
      p.glow = 0.6;
      p.fx.bolt = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      // blissed out while it charges: soft smiling eyes, flat relaxed lids, slow breath
      p.happy = 0.55 + 0.08 * U.osc(tt, L, 1);
      p.sleepy = 0.36;
      p.browTilt = 0.34;
      p.lookY = 0.1;
      e.perk = 0.3;
    },
  });
})(window.Bud);
