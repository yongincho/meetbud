/* Waffle, held: a piece found at Grand-Place, Brussels (find 85: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, WHITE, hold, paint } = K.AccKit;

  // Grand-Place: a Brussels waffle with a strawberry and cream.
  function waffle(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    const dough = U.rgb('#E7B062');
    paint(ctx, env, U.darken(dough, 0.15), () => U.rr(ctx, -5.4, -3.2, 10.8, 8, 1.4));
    paint(ctx, env, dough, () => U.rr(ctx, -5.4, -3.8, 10.8, 8, 1.4));
    ctx.fillStyle = env.c(U.darken(dough, 0.22));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(-4.6 + c * 2.5, -3 + r * 2.4, 1.7, 1.6);
    paint(ctx, env, WHITE, () => {
      ctx.arc(1.4, -4.2, 1.6, 0, TAU);
      ctx.arc(3, -4.4, 1.2, 0, TAU);
    });
    paint(ctx, env, U.rgb('#E2374F'), () => {
      ctx.moveTo(-1.2, -6.4);
      ctx.quadraticCurveTo(-3.6, -5.6, -2, -2.6);
      ctx.quadraticCurveTo(0.6, -4.6, -1.2, -6.4);
    });
    paint(ctx, env, P.leaf, () => U.ellipse(ctx, -1.4, -6.4, 0.9, 0.35, -0.3));
    ctx.restore();
  }

  K.registerFind(85, { id: 'waffle', label: 'Waffle', slot: 'item', place: { name: 'Grand-Place', city: 'Brussels', lat: 50.8467, lon: 4.3525, radius: 400 } }, waffle);
})(window.Bud);
