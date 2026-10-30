/* Done: state 4, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, hop, smoothstep } = K.util;

  K.registerState(4, { id: 'done', label: 'Done', group: 'Conversation', key: '5', loop: 2.4, hint: 'Happy hop, a burst and a check.' }, {
    base(p, tt, L, x) {
      const h = hop(x, 0.05, 0.6);
      const land = hop(x, 0.6, 0.85);
      p.y = -7 * h;
      p.sy = 1 + 0.07 * h - 0.09 * land;
      p.sx = 1 - 0.04 * h + 0.08 * land;
      p.rot = 0.05 * osc(tt, L, 2) * smoothstep(0.85, 1.2, x);
      p.happy = 1;
      p.mouthOpen = 0.65;
      p.mouthCurve = 1;
      p.blush = 1;
      p.brow = 0.7;
      p.tintKey = 'done';
      p.tintAmt = 1 - 0.15 * smoothstep(0.8, 2.0, x);
      p.glow = 1;
      p.fx.sparkles = 1;
      p.fx.burst = 1;
      p.fx.check = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.round = 0.3;
    },
  });
})(window.Bud);
