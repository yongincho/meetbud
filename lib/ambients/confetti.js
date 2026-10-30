/* Confetti, ambience 6 (its outfit code): drawn in front of Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, fract } = U;

  K.registerAmbient(6, { id: 'confetti', label: 'Confetti' }, {
    front(ctx, t, env, { B, W, H, rate, wave }) {
      const cols = [[255, 92, 138], [255, 216, 77], [74, 168, 255], [74, 222, 128], [169, 139, 255]];
      for (let i = 0; i < 16; i++) {
        const sp = 8 + 6 * U.hash(i * 2.7);
        const u = fract(U.hash(i * 6.1) + t * rate(sp / (H + 10)));
        const x = B.x0 + U.hash(i * 3.9) * W + 2.5 * wave(0.25, i / TAU);
        const y = B.y0 - 5 + u * (H + 10);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(TAU * rate(0.3 + 0.4 * U.hash(i)) * t + i);
        ctx.scale(wave(0.8 + 0.6 * U.hash(i * 1.9), i / TAU), 1);
        ctx.fillStyle = env.c(cols[i % cols.length], 0.95);
        ctx.fillRect(-1.4, -0.85, 2.8, 1.7);
        ctx.restore();
      }
    },
  });
})(window.Bud);
