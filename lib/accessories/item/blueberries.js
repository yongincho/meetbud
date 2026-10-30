/* Blueberries, held: a piece found at Cadillac Mountain, Acadia (find 29: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint, ink, gleam } = K.AccKit;

  // Cadillac Mountain: a tin pail of wild Maine blueberries.
  function blueberries(ctx, a, env) {
    hold(ctx, a, env, 2, 0.4);
    ink(ctx, env, C.steel, 0.4, () => ctx.arc(0, -1.4, 4.4, Math.PI * 1.05, Math.PI * 1.95));
    for (const [x, y] of [[-2.8, -2], [-1, -2.6], [0.9, -2.2], [2.6, -1.8], [-1.8, -0.9], [0.2, -1], [1.9, -0.6]]) {
      paint(ctx, env, U.rgb('#3D4FA8'), () => ctx.arc(x, y, 1.05, 0, TAU));
      paint(ctx, env, U.rgb('#7F8FD8'), () => ctx.arc(x - 0.3, y - 0.35, 0.3, 0, TAU), 0.7);
    }
    paint(ctx, env, C.steel, () => {
      ctx.moveTo(-4.4, -0.6);
      ctx.lineTo(4.4, -0.6);
      ctx.lineTo(3.4, 5.6);
      ctx.lineTo(-3.4, 5.6);
      ctx.closePath();
    });
    ink(ctx, env, U.darken(C.steel, 0.2), 0.4, () => {
      ctx.moveTo(-4.1, 1.4);
      ctx.lineTo(4.1, 1.4);
    });
    paint(ctx, env, P.leaf, () => U.ellipse(ctx, 3.4, -2.8, 1.4, 0.55, -0.5));
    gleam(ctx, env, -2.2, 2.6, 0.5, 1.8, 0.1, 0.35);
    ctx.restore();
  }

  K.registerFind(29, { id: 'blueberries', label: 'Blueberries', slot: 'item', place: { name: 'Cadillac Mountain', city: 'Acadia', lat: 44.3529, lon: -68.2239, radius: 1200 } }, blueberries);
})(window.Bud);
