/* Bats, ambience 9 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, fract } = U;

  K.registerAmbient(9, { id: 'bats', label: 'Bats' }, {
    back(ctx, t, env, { B, W, H, rate, wave }) {
      for (let i = 0; i < 3; i++) {
        const sp = 0.07 + 0.03 * U.hash(i);
        const u = fract(U.hash(i * 5.5) + t * rate(sp));
        const x = B.x0 - 8 + u * (W + 16);
        const y = B.y0 + H * (0.12 + 0.22 * U.hash(i * 3.7)) + 3 * wave(0.318, i / TAU);
        const f = wave(1.91, (i * 2) / TAU);
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = env.c([150, 120, 210], 0.9);
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.5, 1.9, 0, 0, TAU);
        ctx.moveTo(-1.2, -0.4);
        ctx.quadraticCurveTo(-4, -3.2 * f - 1, -6.4, -0.6 * f);
        ctx.quadraticCurveTo(-4.4, 0.2, -3.2, 1.1);
        ctx.quadraticCurveTo(-2.2, 0.4, -1.2, 0.8);
        ctx.moveTo(1.2, -0.4);
        ctx.quadraticCurveTo(4, -3.2 * f - 1, 6.4, -0.6 * f);
        ctx.quadraticCurveTo(4.4, 0.2, 3.2, 1.1);
        ctx.quadraticCurveTo(2.2, 0.4, 1.2, 0.8);
        ctx.fill();
        ctx.restore();
      }
    },
  });
})(window.Bud);
