/* Hot: state 17, a mood Bud shows on its own (the firmware's Mood, never sent by the app). */
(function (K) {
  'use strict';
  const { osc, blink } = K.util;

  K.registerState(17, { id: 'hot', label: 'Hot', group: 'Moments', loop: 2.6, hint: 'A hot room: droopy eyes, a sweat drop sliding down, rosy cheeks, heavy breaths.' }, {
    base(p, tt, L, x) {
      const pant = Math.abs(osc(tt, L, 4));
      p.sleepy = 0.5;
      p.lookY = 0.18;
      p.y = 1.4 + 0.5 * pant;
      p.sy = 0.98 + 0.02 * pant;
      p.sx = 1.02;
      p.eyeOpen = blink(x, [1.9], 0.3);
      p.glow = 0.7;
      p.fx.sweat = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.hot = 1; // no mouth: an open one panting read as talking
      e.droop = 0.45;
      e.h = 0.94;
    },
  });
})(window.Bud);
