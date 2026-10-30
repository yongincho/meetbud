/* Dizzy: state 15, a mood Bud shows on its own (the firmware's Mood, never sent by the app). */
(function (K) {
  'use strict';
  const U = K.util;
  const { osc } = U;

  K.registerState(15, { id: 'dizzy', label: 'Dizzy', group: 'Moments', loop: 2.0, hint: 'After a shake: swirly eyes, a wobbly mouth, swaying.' }, {
    base(p, tt, L, x) {
      p.rot = 0.13 * osc(tt, L, 1);
      p.x = 2.4 * osc(tt, L, 1, 0.25);
      p.y = 0.8 * osc(tt, L, 2);
      p.sy = 1 + 0.02 * osc(tt, L, 2, 0.1);
      p.mouthCurve = 0;
      p.wobble = 1;
      p.glow = 0.6;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.spiral = 1;
      e.wave = 1;
      e.horn = 1.2 * U.osc(tt, L, 2);
    },
  });
})(window.Bud);
