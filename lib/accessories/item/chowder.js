/* Chowder, held: a piece found at Faneuil Hall, Boston (find 26: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, gleam, steam } = K.AccKit;

  // Faneuil Hall: clam chowder in a bread bowl, an oyster cracker on top.
  function chowder(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    steam(ctx, env, -4.2);
    paint(ctx, env, P.crust, () => {
      ctx.moveTo(-5.6, -2.6);
      ctx.bezierCurveTo(-6, 3.8, -2.6, 5.6, 0, 5.6);
      ctx.bezierCurveTo(2.6, 5.6, 6, 3.8, 5.6, -2.6);
      ctx.closePath();
    });
    paint(ctx, env, U.lighten(P.crust, 0.2), () => U.ellipse(ctx, 0, -2.6, 5.6, 1.6));
    paint(ctx, env, P.cream, () => U.ellipse(ctx, 0, -2.5, 4.6, 1.15));
    ctx.fillStyle = env.c(U.rgb('#E9D49A'));
    for (const [x, y] of [[-2.2, -2.6], [1.3, -2.2], [2.6, -2.8], [-0.6, -2.1]]) ctx.fillRect(x, y, 0.7, 0.55);
    paint(ctx, env, P.leaf, () => {
      for (const [x, y] of [[-1.4, -2.9], [0.4, -2.7], [2, -2.4]]) ctx.arc(x, y, 0.22, 0, TAU);
    });
    paint(ctx, env, U.rgb('#F5DFA8'), () => ctx.arc(-3, -3.4, 0.9, 0, TAU));
    gleam(ctx, env, -3.4, 1.6, 0.7, 1.8, 0.3, 0.2);
    ctx.restore();
  }

  K.registerFind(26, { id: 'chowder', label: 'Chowder', slot: 'item', place: { name: 'Faneuil Hall', city: 'Boston', lat: 42.36, lon: -71.0562, radius: 300 } }, chowder);
})(window.Bud);
