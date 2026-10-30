/* Cold: state 16, a mood Bud shows on its own (the firmware's Mood, never sent by the app). */
(function (K) {
  'use strict';
  const { osc, blink, TAU } = K.util;

  K.registerState(16, { id: 'cold', label: 'Cold', group: 'Moments', loop: 2.4, hint: 'A chilly room: shivers, squeezed eyes, pale blue cheeks, chattering.' }, {
    base(p, tt, L, x) {
      // a quick shiver that comes in waves, huddled a little smaller
      const shiver = Math.sin(TAU * 11 * tt) * (0.55 + 0.45 * Math.abs(osc(tt, L, 1)));
      p.x = 0.9 * shiver;
      p.squint = 0.55;
      p.sy = 0.96;
      p.sx = 0.97;
      p.y = 1;
      p.lookY = 0.12;
      p.eyeOpen = blink(x, [1.6]);
      p.mouthCurve = 0;
      p.wobble = 1;
      p.glow = 0.4;
      p.bright = 0.92;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.cold = 1;
      e.wave = 1;
      e.droop = 0.25;
    },
  });
})(window.Bud);
