/* Sparkles, ambience 2 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;

  K.registerAmbient(2, { id: 'sparkles', label: 'Sparkles' }, {
    back(ctx, t, env, { B, W, H, wave }) {
      for (let i = 0; i < 7; i++) {
        const x = B.x0 + W * (0.08 + 0.84 * U.hash(i * 9.1));
        const y = B.y0 + H * (0.06 + 0.5 * U.hash(i * 2.9));
        const s = Math.max(0, wave(0.255, (i * 2.1) / TAU));
        if (s < 0.02) continue;
        ctx.fillStyle = env.c([255, 214, 102], 0.9 * s);
        ctx.beginPath();
        U.star4(ctx, x, y, 0.6 + 2.4 * s);
        ctx.fill();
      }
    },
  });
})(window.Bud);
