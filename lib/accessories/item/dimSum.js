/* Dim sum, held: a piece found at The Peak Tower, Hong Kong (find 77: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { hold, paint, ink, steam } = K.AccKit;

  // Victoria Peak: dim sum, two buns in a bamboo steamer.
  function dimSum(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    steam(ctx, env, -4.2, 3.4);
    for (const x of [-2.2, 2.2]) {
      paint(ctx, env, U.rgb('#FBF6EC'), () => {
        ctx.moveTo(x - 2.4, -0.6);
        ctx.bezierCurveTo(x - 2.4, -3.6, x - 0.6, -4.4, x, -4.6);
        ctx.bezierCurveTo(x + 0.6, -4.4, x + 2.4, -3.6, x + 2.4, -0.6);
        ctx.closePath();
      });
      ink(ctx, env, U.rgb('#E2D7C2'), 0.3, () => {
        for (const k of [-1, -0.4, 0.4, 1]) {
          ctx.moveTo(x, -4.4);
          ctx.quadraticCurveTo(x + k * 1.2, -2.8, x + k * 1.9, -0.8);
        }
      });
    }
    paint(ctx, env, U.rgb('#D9B47A'), () => U.rr(ctx, -6, -1.2, 12, 6, 1.2));
    ink(ctx, env, U.rgb('#A8814A'), 0.35, () => {
      for (const y of [0.6, 2.4]) {
        ctx.moveTo(-5.6, y);
        ctx.lineTo(5.6, y);
      }
    });
    paint(ctx, env, U.rgb('#C49A5E'), () => U.rr(ctx, -6.2, -1.6, 12.4, 1, 0.5));
    ctx.restore();
  }

  K.registerFind(77, { id: 'dimSum', label: 'Dim sum', slot: 'item', place: { name: 'The Peak Tower', city: 'Hong Kong', lat: 22.2714, lon: 114.1499, radius: 600 } }, dimSum);
})(window.Bud);
