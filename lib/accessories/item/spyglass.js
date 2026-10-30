/* Spyglass, held: a piece found at Castillo de San Marcos, St. Augustine (find 53: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint, gleam } = K.AccKit;

  // Castillo de San Marcos: a brass spyglass, pulled out.
  function spyglass(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(-0.7);
    paint(ctx, env, P.brass, () => U.rr(ctx, -6.6, -1, 4.6, 2, 0.5));
    paint(ctx, env, U.darken(P.brass, 0.12), () => U.rr(ctx, -2.4, -1.3, 4.4, 2.6, 0.5));
    paint(ctx, env, U.rgb('#6B4423'), () => U.rr(ctx, 1.6, -1.6, 4.8, 3.2, 0.6));
    paint(ctx, env, P.brass, () => {
      U.rr(ctx, 1.4, -1.7, 0.8, 3.4, 0.3);
      U.rr(ctx, 6, -1.8, 0.9, 3.6, 0.3);
    });
    paint(ctx, env, P.glass, () => U.ellipse(ctx, 6.9, 0, 0.3, 1.3), 0.8);
    gleam(ctx, env, -4.2, -0.5, 1.6, 0.25, 0, 0.4);
    ctx.restore();
  }

  K.registerFind(53, { id: 'spyglass', label: 'Spyglass', slot: 'item', place: { name: 'Castillo de San Marcos', city: 'St. Augustine', lat: 29.8979, lon: -81.3116, radius: 500 } }, spyglass);
})(window.Bud);
