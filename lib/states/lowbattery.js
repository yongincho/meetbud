/* Low battery: state 12, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, win, blink } = K.util;

  K.registerState(12, { id: 'lowbattery', label: 'Low battery', group: 'Device', loop: 3.0, hint: 'Droopy, flickering, battery icon.' }, {
    base(p, tt, L, x) {
      const flick = 1 - 0.55 * (win(x, 0.8, 0.95, 0.03) + win(x, 1.05, 1.18, 0.03) + 0.6 * win(x, 2.3, 2.42, 0.03));
      p.sleepy = 0.55;
      p.lookX = -0.15;
      p.lookY = 0.45;
      p.sy = 0.93 + 0.012 * osc(tt, L, 1);
      p.sx = 1.045;
      p.y = 4;
      p.mouthCurve = -0.35;
      p.wobble = 1;
      p.browTilt = -0.8;
      p.eyeOpen = blink(x, [1.9], 0.38);
      p.bright = 0.82 * flick;
      p.desat = 0.45;
      p.glow = 0.3;
      p.tintKey = 'lowbattery';
      p.tintAmt = 0.3;
      p.fx.battery = 1;
      p.fx.sweat = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.droop = 0.7;
    },
  });
})(window.Bud);
