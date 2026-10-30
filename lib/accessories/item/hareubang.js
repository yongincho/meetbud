/* Hareubang, held: a piece found at Jeju Stone Park, Jeju (find 67: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint } = K.AccKit;

  // Jeju Stone Park: a little dol hareubang, Jeju's stone grandfather.
  function hareubang(ctx, a, env) {
    hold(ctx, a, env, 1.6, 0.25);
    const rock = U.rgb('#7E838E');
    paint(ctx, env, rock, () => U.rr(ctx, -3.8, -2.4, 7.6, 8.6, 3));
    paint(ctx, env, U.darken(rock, 0.12), () => {
      U.ellipse(ctx, 0, -6.4, 3.6, 2.8);
      U.ellipse(ctx, 0, -4.2, 4.2, 0.9);
    });
    paint(ctx, env, rock, () => U.ellipse(ctx, 0, -2.2, 3.4, 2.6));
    paint(ctx, env, U.darken(rock, 0.3), () => {
      ctx.arc(-1.4, -2.8, 0.9, 0, TAU);
      ctx.arc(1.4, -2.8, 0.9, 0, TAU);
    });
    paint(ctx, env, U.lighten(rock, 0.2), () => U.ellipse(ctx, 0, -1.6, 0.8, 1.3));
    paint(ctx, env, U.darken(rock, 0.25), () => {
      U.rr(ctx, -3, 1.6, 3, 1.1, 0.5);
      U.rr(ctx, 0.2, 2.8, 3, 1.1, 0.5);
    });
    ctx.fillStyle = env.c(U.darken(rock, 0.35), 0.5);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(-3 + U.hash(i) * 6, -7.6 + U.hash(i + 5) * 13, 0.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(67, { id: 'hareubang', label: 'Hareubang', kr: '돌하르방', slot: 'item', place: { name: 'Jeju Stone Park', city: 'Jeju', lat: 33.4495, lon: 126.6597, radius: 900 } }, hareubang);
})(window.Bud);
