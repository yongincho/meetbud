/* Panda, held: a piece found at Chengdu Panda Base, Chengdu (find 76: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, WHITE, hold, paint, ink, blush } = K.AccKit;

  // The Chengdu panda base: a panda with a bamboo sprig.
  function panda(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.4);
    paint(ctx, env, C.cup, () => U.ellipse(ctx, 0, 2.6, 4.6, 3.8));
    paint(ctx, env, P.ink, () => {
      U.ellipse(ctx, -3.6, 4.6, 1.6, 1.3);
      U.ellipse(ctx, 3.6, 4.6, 1.6, 1.3);
      U.ellipse(ctx, -3.8, 1.4, 1.2, 2, 0.4);
    });
    ink(ctx, env, P.leaf, 0.6, () => {
      ctx.moveTo(4.8, 4.4);
      ctx.lineTo(3.6, -4.6);
    });
    paint(ctx, env, P.leaf, () => {
      U.ellipse(ctx, 5, -3.2, 1.6, 0.5, -0.6);
      U.ellipse(ctx, 2.6, -2.2, 1.4, 0.45, 0.5);
    });
    paint(ctx, env, P.ink, () => U.ellipse(ctx, 3.8, 1.6, 1.2, 1.9, -0.4));
    paint(ctx, env, P.ink, () => {
      ctx.arc(-3.2, -6.6, 1.5, 0, TAU);
      ctx.arc(3.2, -6.6, 1.5, 0, TAU);
    });
    paint(ctx, env, C.cup, () => U.ellipse(ctx, 0, -3.6, 4.4, 3.6));
    paint(ctx, env, P.ink, () => {
      U.ellipse(ctx, -1.6, -3.8, 1.1, 1.4, 0.5);
      U.ellipse(ctx, 1.6, -3.8, 1.1, 1.4, -0.5);
    });
    paint(ctx, env, WHITE, () => {
      ctx.arc(-1.5, -4, 0.4, 0, TAU);
      ctx.arc(1.7, -4, 0.4, 0, TAU);
    });
    paint(ctx, env, P.ink, () => U.ellipse(ctx, 0, -2.2, 0.7, 0.45));
    blush(ctx, env, 0, -1.8, 2.8, 0.6);
    ctx.restore();
  }

  K.registerFind(76, { id: 'panda', label: 'Panda', slot: 'item', place: { name: 'Chengdu Panda Base', city: 'Chengdu', lat: 30.7409, lon: 104.1374, radius: 1000 } }, panda);
})(window.Bud);
