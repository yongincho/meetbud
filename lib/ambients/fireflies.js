/* Fireflies, ambience 1 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const F = K.Face;

  K.registerAmbient(1, { id: 'fireflies', label: 'Fireflies' }, {
    back(ctx, t, env, { B, W, H, wave }) {
      for (let i = 0; i < 7; i++) {
        const x = B.x0 + W * (0.5 + 0.42 * wave((0.21 + 0.1 * U.hash(i)) / TAU, (i * 2.3) / TAU));
        const y = B.y0 + H * (0.5 + 0.4 * wave((0.17 + 0.08 * U.hash(i + 4)) / TAU, (i * 1.7) / TAU));
        const tw = 0.5 + 0.5 * wave((2 + U.hash(i + 2) * 2) / TAU, i / TAU);
        F.glow(ctx, x, y, 6, [232, 255, 120], 0.45 * tw, env);
        ctx.fillStyle = env.c([245, 255, 190], 0.6 + 0.4 * tw);
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, TAU);
        ctx.fill();
      }
    },
  });
})(window.Bud);
