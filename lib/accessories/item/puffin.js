/* Puffin, held: a piece found at Old Harbour, Reykjavik (find 94: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint, ink } = K.AccKit;

  // Reykjavik's harbor: a puffin, its beak in stripes.
  function puffin(ctx, a, env) {
    hold(ctx, a, env, 2.4, 0.4);
    paint(ctx, env, C.beak, () => {
      U.ellipse(ctx, -1.6, 6.1, 1.4, 0.55);
      U.ellipse(ctx, 1.6, 6.1, 1.4, 0.55);
    });
    paint(ctx, env, P.ink, () => U.ellipse(ctx, 0, 1.2, 4.2, 5.2));
    paint(ctx, env, C.cup, () => U.ellipse(ctx, 0, 2.6, 2.8, 3.6));
    paint(ctx, env, P.ink, () => ctx.arc(0, -3.8, 3.6, 0, TAU));
    paint(ctx, env, C.cup, () => U.ellipse(ctx, -0.6, -3.4, 2.6, 2.2));
    paint(ctx, env, U.rgb('#E8542C'), () => {
      ctx.moveTo(-2.6, -4.2);
      ctx.quadraticCurveTo(-5.8, -3.6, -5, -2);
      ctx.quadraticCurveTo(-4, -1.8, -2.6, -2.6);
      ctx.closePath();
    });
    paint(ctx, env, U.rgb('#FFD84D'), () => ctx.rect(-3.3, -4.3, 0.6, 2), 0.95);
    paint(ctx, env, U.rgb('#5B6F8A'), () => ctx.rect(-2.75, -4.3, 0.4, 1.8));
    paint(ctx, env, C.lens, () => ctx.arc(-0.6, -4.2, 0.5, 0, TAU));
    ink(ctx, env, U.rgb('#E8542C'), 0.3, () => ctx.arc(-0.6, -4.2, 0.75, 0, TAU));
    ctx.restore();
  }

  K.registerFind(94, { id: 'puffin', label: 'Puffin', slot: 'item', place: { name: 'Old Harbour', city: 'Reykjavik', lat: 64.1513, lon: -21.9429, radius: 600 } }, puffin);
})(window.Bud);
