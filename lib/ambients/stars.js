/* Moon and stars, ambience 8 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const F = K.Face;

  K.registerAmbient(8, { id: 'stars', label: 'Moon and stars' }, {
    back(ctx, t, env, { B, W, H, wave }) {
      const mx = B.x0 + W * 0.25;
      const my = B.y0 + H * 0.25;
      F.glow(ctx, mx, my, 15, [255, 232, 160], 0.35, env);
      ctx.fillStyle = env.c([255, 241, 196]);
      ctx.beginPath();
      ctx.arc(mx, my, 5.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = env.c([226, 206, 150], 0.7);
      ctx.beginPath();
      ctx.arc(mx - 1.6, my - 1.2, 1.2, 0, TAU);
      ctx.arc(mx + 1.8, my + 1.4, 0.9, 0, TAU);
      ctx.arc(mx + 0.6, my - 2.4, 0.6, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 10; i++) {
        const x = B.x0 + W * (0.1 + 0.8 * U.hash(i * 4.3));
        const y = B.y0 + H * (0.08 + 0.6 * U.hash(i * 8.1));
        if (Math.hypot(x - mx, y - my) < 13) continue;
        const tw = 0.5 + 0.5 * wave(0.3 + 0.3 * U.hash(i), i / TAU);
        ctx.fillStyle = env.c([255, 250, 225], 0.3 + 0.65 * tw);
        ctx.beginPath();
        U.star4(ctx, x, y, 0.7 + 1.5 * tw);
        ctx.fill();
      }
    },
  });
})(window.Bud);
