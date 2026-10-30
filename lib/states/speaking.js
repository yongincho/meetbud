/* Speaking: state 3, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, blink } = K.util;

  K.registerState(3, { id: 'speaking', label: 'Speaking', group: 'Conversation', key: '4', loop: 2.0, hint: 'Answers out loud: bounces with its voice, turns violet.' }, {
    base(p, tt, L, x) {
      const syll = Math.abs(osc(tt, L, 5));
      const phrase = 0.62 + 0.38 * osc(tt, L, 1, 0.1);
      const v = syll * phrase;
      p.ex.voice = v;
      p.mouthOpen = 0.12 + 0.55 * v;
      p.mouthCurve = 0.3;
      p.sy = 1 + 0.025 * v;
      p.y = -0.9 * v;
      p.wide = 0.12;
      p.lookX = 0.12 * osc(tt, L, 1);
      p.eyeOpen = blink(x, [1.5]);
      p.blush = 0.65;
      p.tintKey = 'speaking';
      p.tintAmt = 1;
      p.glow = 0.85;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.h = 1 + 0.06 * e.voice;
      e.talk = 1;
      e.perk = 0.4;
      p.y += 0.6 * e.voice;
    },
  });
})(window.Bud);
