/* Sleeping: state 13, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc } = K.util;

  K.registerState(13, { id: 'sleeping', label: 'Sleeping', group: 'Device', loop: 4.0, hint: 'Dimmed, slow breathing, floating Zs.' }, {
    base(p, tt, L, x) {
      const b = osc(tt, L, 1);
      p.closed = 1;
      p.sy = 1 + 0.045 * b;
      p.sx = 1 - 0.028 * b;
      p.y = 3 + 1.2 * b;
      p.rot = -0.04;
      p.mouthOpen = 0.18 + 0.1 * (0.5 + 0.5 * b);
      p.mouthCurve = 0;
      p.blush = 0.35;
      p.glow = 0.25;
      p.bright = 0.5;
      p.desat = 0.25;
      p.fx.zzz = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.droop = 1;
    },
  });
})(window.Bud);
