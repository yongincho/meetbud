/* Bagel, held: a piece found at Washington Square Park, New York (find 37: New York). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint } = K.AccKit;

  // Washington Square: a sesame bagel.
  function bagel(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ctx.beginPath();
    U.ellipse(ctx, 0, 0, 5.6, 4.6);
    ctx.fillStyle = env.c(P.crust);
    ctx.fill();
    paint(ctx, env, U.darken(P.crust, 0.15), () => U.ellipse(ctx, 0, 1.4, 5.4, 3.2), 0.6);
    paint(ctx, env, U.lighten(P.crust, 0.15), () => U.ellipse(ctx, 0, -0.9, 4.8, 3.2));
    paint(ctx, env, U.rgb('#8A5A2B'), () => U.ellipse(ctx, 0, -0.2, 1.7, 1.25));
    ctx.fillStyle = env.c(C.cup);
    for (let i = 0; i < 14; i++) {
      const t = (i / 14) * TAU;
      const r = 3.3 + (i % 2) * 0.7;
      ctx.beginPath();
      U.ellipse(ctx, Math.cos(t) * r, Math.sin(t) * r * 0.66 - 0.7, 0.32, 0.18, t);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(37, { id: 'bagel', label: 'Bagel', slot: 'item', place: { name: 'Washington Square Park', city: 'New York', lat: 40.7309, lon: -73.9975, radius: 400 } }, bagel);
})(window.Bud);
