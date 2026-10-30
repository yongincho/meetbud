/* Rain, ambience 5 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { fract } = U;

  K.registerAmbient(5, { id: 'rain', label: 'Rain' }, {
    back(ctx, t, env, { B, W, H, rate }) {
      ctx.lineCap = 'round';
      for (let i = 0; i < 20; i++) {
        const sp = 42 + 20 * U.hash(i * 1.7);
        const u = fract(U.hash(i * 5.3) + t * rate(sp / (H + 12)));
        const x = B.x0 + U.hash(i * 2.3) * (W + 6) - u * 4;
        const y = B.y0 - 6 + u * (H + 12);
        ctx.strokeStyle = env.c([150, 200, 255], 0.3 + 0.3 * U.hash(i * 9.1));
        ctx.lineWidth = 0.7 + 0.4 * U.hash(i * 4.4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 1.1, y + 4.6);
        ctx.stroke();
      }
    },
  });
})(window.Bud);
