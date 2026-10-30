/* Pretzel, held: a piece found at Marienplatz, Munich (find 87: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, WHITE, hold, ink } = K.AccKit;

  // Marienplatz: a salted pretzel.
  function pretzel(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ink(ctx, env, P.crustDark, 1.9, () => {
      ctx.moveTo(-3.6, 4.2);
      ctx.bezierCurveTo(-6.6, 1, -5.6, -5, -1.6, -4.6);
      ctx.bezierCurveTo(1.6, -4.2, 1.8, 1.2, 0, 1.4);
      ctx.bezierCurveTo(-1.8, 1.2, -1.6, -4.2, 1.6, -4.6);
      ctx.bezierCurveTo(5.6, -5, 6.6, 1, 3.6, 4.2);
      ctx.moveTo(-3.6, 4.2);
      ctx.quadraticCurveTo(0, 2.6, 3.6, 4.2);
    });
    ink(ctx, env, U.lighten(P.crustDark, 0.25), 0.55, () => {
      ctx.moveTo(-4.6, -1.6);
      ctx.quadraticCurveTo(-4.4, -4, -2, -4.3);
    }, 0.6);
    ctx.fillStyle = env.c(WHITE);
    for (const [x, y] of [[-4.8, 0.4], [-3, -4], [3, -4.2], [4.9, 0.2], [-0.4, 3.4], [1.6, 3.5], [0, -0.6]]) {
      ctx.fillRect(x, y, 0.45, 0.45);
    }
    ctx.restore();
  }

  K.registerFind(87, { id: 'pretzel', label: 'Pretzel', slot: 'item', place: { name: 'Marienplatz', city: 'Munich', lat: 48.1373, lon: 11.5755, radius: 400 } }, pretzel);
})(window.Bud);
