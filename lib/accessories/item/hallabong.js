/* Hallabong, held: a piece found at Seongsan Ilchulbong, Jeju (find 66: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, ink, gleam } = K.AccKit;

  // Seongsan Ilchulbong: a hallabong, Jeju's bumpy-topped tangerine.
  function hallabong(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    const peel = U.rgb('#FF9A1F');
    paint(ctx, env, peel, () => U.ellipse(ctx, 0, 1, 5.4, 4.8));
    paint(ctx, env, peel, () => U.ellipse(ctx, 0, -3.6, 2.2, 1.9));
    paint(ctx, env, U.darken(peel, 0.12), () => U.ellipse(ctx, 0, 3.6, 4.4, 1.8), 0.5);
    ctx.fillStyle = env.c(U.darken(peel, 0.18), 0.5);
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc(-4 + U.hash(i) * 8, -1.5 + U.hash(i + 20) * 6, 0.18, 0, TAU);
      ctx.fill();
    }
    ink(ctx, env, P.leafDark, 0.5, () => {
      ctx.moveTo(0, -5.3);
      ctx.lineTo(0.2, -6.2);
    });
    paint(ctx, env, P.leaf, () => U.ellipse(ctx, 1.6, -6.2, 1.7, 0.7, -0.4));
    gleam(ctx, env, -2.2, -0.6, 1.2, 0.8, -0.5, 0.35);
    ctx.restore();
  }

  K.registerFind(66, { id: 'hallabong', label: 'Hallabong', kr: '한라봉', slot: 'item', place: { name: 'Seongsan Ilchulbong', city: 'Jeju', lat: 33.4584, lon: 126.9414, radius: 800 } }, hallabong);
})(window.Bud);
