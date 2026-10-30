/* Snow, ambience 3 (its outfit code): drawn in front of Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, fract } = U;

  K.registerAmbient(3, { id: 'snow', label: 'Snow' }, {
    front(ctx, t, env, { B, W, H, rate, wave }) {
      for (let i = 0; i < 22; i++) {
        const sp = 5 + 7 * U.hash(i * 1.3);
        const x = B.x0 + U.hash(i * 3.1) * W + 2.6 * wave(0.143, i / TAU);
        const y = B.y0 - 3 + fract(U.hash(i * 7.3) + t * rate(sp / (H + 6))) * (H + 6);
        const r = 0.7 + 1.1 * U.hash(i * 1.7);
        ctx.fillStyle = env.c(U.WHITE, 0.55 + 0.4 * U.hash(i * 5.1));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    },
  });
})(window.Bud);
