/* Petals, ambience 4 (its outfit code): drawn in front of Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, fract } = U;

  K.registerAmbient(4, { id: 'petals', label: 'Petals' }, {
    front(ctx, t, env, { B, W, H, rate, wave }) {
      for (let i = 0; i < 11; i++) {
        const sp = 5 + 5 * U.hash(i * 2.1);
        const u = fract(U.hash(i * 4.7) + t * rate(sp / (H + 10)));
        const x = B.x0 + fract(U.hash(i * 3.3) + u * 0.35) * W + 3 * wave(0.207, (i * 2) / TAU);
        const y = B.y0 - 5 + u * (H + 10);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(TAU * rate((1 + U.hash(i)) / TAU) * t + i);
        ctx.scale(1, 0.55 + 0.45 * wave(0.35, i / TAU));
        ctx.fillStyle = env.c([255, 183, 210], 0.9);
        ctx.beginPath();
        U.ellipse(ctx, 0, 0, 2.3, 1.4);
        ctx.fill();
        ctx.restore();
      }
    },
  });
})(window.Bud);
