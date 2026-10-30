/* Bubble tea, held: a piece found at Shilin Night Market, Taipei (find 78: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, WHITE, paint, ink, gleam, steamingCup } = K.AccKit;

  // Shilin Night Market: bubble tea, pearls at the bottom, a big straw.
  function bubbleTea(ctx, a, env) {
    steamingCup(ctx, a, env, () => {
      ink(ctx, env, P.pink, 1.2, () => {
        ctx.moveTo(1.2, -3);
        ctx.lineTo(2.6, -10.6);
      });
      paint(ctx, env, P.glass, () => {
        ctx.moveTo(-4, -4.4);
        ctx.lineTo(4, -4.4);
        ctx.lineTo(3.2, 6);
        ctx.lineTo(-3.2, 6);
        ctx.closePath();
      }, 0.55);
      paint(ctx, env, U.rgb('#D7A979'), () => {
        ctx.moveTo(-3.85, -2.6);
        ctx.lineTo(3.85, -2.6);
        ctx.lineTo(3.2, 6);
        ctx.lineTo(-3.2, 6);
        ctx.closePath();
      });
      ctx.fillStyle = env.c(U.rgb('#3A2418'));
      for (const [x, y] of [[-2.2, 4.8], [-0.7, 5], [0.8, 4.8], [2.2, 5], [-1.5, 3.6], [0.1, 3.7], [1.6, 3.5]]) {
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, TAU);
        ctx.fill();
      }
    }, () => {
      paint(ctx, env, P.glass, () => {
        ctx.moveTo(-4.2, -4.4);
        ctx.bezierCurveTo(-4, -7.6, 4, -7.6, 4.2, -4.4);
        ctx.closePath();
      }, 0.5);
      ink(ctx, env, WHITE, 0.4, () => ctx.rect(-4.1, -4.6, 8.2, 0.4), 0.7);
      gleam(ctx, env, -2.4, 0.4, 0.5, 2.6, 0.1, 0.35);
    }, false);
  }

  K.registerFind(78, { id: 'bubbleTea', label: 'Bubble tea', slot: 'item', place: { name: 'Shilin Night Market', city: 'Taipei', lat: 25.0875, lon: 121.5248, radius: 500 } }, bubbleTea);
})(window.Bud);
