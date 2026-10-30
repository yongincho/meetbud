/* Churro, held: a piece found at Zócalo, Mexico City (find 105: the Americas). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, WHITE, hold, paint, ink } = K.AccKit;

  // The Zócalo: a churro, ridged and sugared.
  function churro(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    ctx.rotate(0.3);
    paint(ctx, env, U.rgb('#F7F3EC'), () => U.rr(ctx, -2.4, 2.4, 4.8, 4, 0.8));
    paint(ctx, env, U.rgb('#3E2418'), () => U.ellipse(ctx, 0, 2.6, 2.2, 0.6));
    paint(ctx, env, P.crust, () => U.rr(ctx, -1.2, -10.4, 2.4, 13, 1.2));
    ink(ctx, env, U.darken(P.crust, 0.25), 0.35, () => {
      for (const x of [-0.6, 0, 0.6]) {
        ctx.moveTo(x, -10);
        ctx.lineTo(x, 2.2);
      }
    });
    ctx.fillStyle = env.c(WHITE, 0.9);
    for (let i = 0; i < 14; i++) ctx.fillRect(-1 + U.hash(i) * 1.8, -9.6 + U.hash(i + 11) * 11, 0.3, 0.3);
    ctx.restore();
  }

  K.registerFind(105, { id: 'churro', label: 'Churro', slot: 'item', place: { name: 'Zócalo', city: 'Mexico City', lat: 19.4327, lon: -99.1331, radius: 500 } }, churro);
})(window.Bud);
