/* Gyeongju bread, held: a piece found at Cheomseongdae, Gyeongju (find 69: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, gleam } = K.AccKit;

  // Cheomseongdae: Gyeongju bread, a round bun stamped with a flower.
  function gyeongjuBread(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    paint(ctx, env, U.darken(P.crust, 0.1), () => U.ellipse(ctx, 0, 1.6, 5.4, 3.4));
    paint(ctx, env, P.crust, () => U.ellipse(ctx, 0, 0.6, 5.2, 3.4));
    paint(ctx, env, U.darken(P.crust, 0.25), () => {
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * TAU;
        U.ellipse(ctx, Math.cos(t) * 1.7, 0.4 + Math.sin(t) * 1.1, 0.6, 0.35, t);
      }
    }, 0.75);
    paint(ctx, env, U.darken(P.crust, 0.3), () => ctx.arc(0, 0.4, 0.55, 0, TAU), 0.8);
    gleam(ctx, env, -2.4, -1.4, 1.4, 0.5, -0.2, 0.3);
    ctx.restore();
  }

  K.registerFind(69, { id: 'gyeongjuBread', label: 'Gyeongju bread', kr: '경주빵', slot: 'item', place: { name: 'Cheomseongdae', city: 'Gyeongju', lat: 35.8347, lon: 129.219, radius: 700 } }, gyeongjuBread);
})(window.Bud);
