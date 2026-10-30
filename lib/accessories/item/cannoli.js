/* Cannoli, held: a piece found at North End, Boston (find 27: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, gleam } = K.AccKit;

  // The North End: a cannoli, cream and chocolate chips at both ends.
  function cannoli(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    ctx.rotate(-0.5);
    paint(ctx, env, P.cream, () => {
      U.ellipse(ctx, -5.2, 0, 1.6, 2.3);
      U.ellipse(ctx, 5.2, 0, 1.6, 2.3);
    });
    paint(ctx, env, P.crust, () => U.rr(ctx, -4.8, -2.2, 9.6, 4.4, 2.2));
    ctx.fillStyle = env.c(U.darken(P.crust, 0.2), 0.7);
    for (let i = 0; i < 12; i++) ctx.fillRect(-4 + (i % 6) * 1.5, -1.4 + (i < 6 ? 0 : 1.6), 0.45, 0.45);
    paint(ctx, env, U.rgb('#4A2C1B'), () => {
      for (const [x, y] of [[-5.6, -0.6], [-5, 0.9], [5.4, -0.8], [5.8, 0.6], [4.9, 0.2]]) ctx.arc(x, y, 0.32, 0, TAU);
    });
    gleam(ctx, env, -1, -1.3, 2.6, 0.4, 0, 0.3);
    ctx.restore();
  }

  K.registerFind(27, { id: 'cannoli', label: 'Cannoli', slot: 'item', place: { name: 'North End', city: 'Boston', lat: 42.3637, lon: -71.0537, radius: 350 } }, cannoli);
})(window.Bud);
