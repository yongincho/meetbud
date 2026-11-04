/* Wave: state 18, a friend's Bud waving at yours. Not one Bluetooth sends: the app shows it, and Bud's
 * screen shows Hello for it until Bud's firmware draws the hand (mobile/src/bud/session.ts ON_BUD). */
(function (K) {
  'use strict';
  const { osc } = K.util;

  K.registerState(18, { id: 'wave', label: 'Wave', group: 'Moments', loop: 2.4, hint: 'A friend’s Bud waved: a big smile, and a hand at Bud’s side waving back.' }, {
    base(p, tt, L, x) {
      p.y = -1.2 * osc(tt, L, 2);
      p.rot = -0.03 + 0.025 * osc(tt, L, 2); // swaying with the wave
      p.lookX = 0.25; // toward the hand
      p.happy = 0.85;
      p.blush = 0.8;
      p.mouthOpen = 0.35;
      p.mouthCurve = 1;
      p.glow = 0.85;
      p.fx.hand = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.round = 0.4;
      e.perk = 0.8;
    },
  });
})(window.Bud);
