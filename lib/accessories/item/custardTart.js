/* Custard tart, held: a piece found at Belém Tower, Lisbon (find 93: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint, ink } = K.AccKit;

  // Belém: a custard tart, caramelized in spots, a dust of cinnamon.
  function custardTart(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    paint(ctx, env, P.crust, () => {
      ctx.moveTo(-5.4, -1.4);
      ctx.lineTo(5.4, -1.4);
      ctx.lineTo(4.2, 3.6);
      ctx.lineTo(-4.2, 3.6);
      ctx.closePath();
    });
    ink(ctx, env, U.darken(P.crust, 0.2), 0.35, () => {
      for (let i = -3; i <= 3; i++) {
        ctx.moveTo(i * 1.4, -1.2);
        ctx.lineTo(i * 1.15, 3.4);
      }
    }, 0.7);
    paint(ctx, env, U.rgb('#FFD86B'), () => U.ellipse(ctx, 0, -1.4, 5.2, 1.6));
    ctx.fillStyle = env.c(U.rgb('#7A4A1E'), 0.75);
    for (const [x, y, r] of [[-2.2, -1.6, 0.8], [1.4, -1.2, 0.6], [2.8, -1.8, 0.45], [-0.4, -2, 0.4], [0.4, -0.8, 0.35]]) {
      ctx.beginPath();
      U.ellipse(ctx, x, y, r, r * 0.55);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(93, { id: 'custardTart', label: 'Custard tart', slot: 'item', place: { name: 'Belém Tower', city: 'Lisbon', lat: 38.6916, lon: -9.216, radius: 1200 } }, custardTart);
})(window.Bud);
