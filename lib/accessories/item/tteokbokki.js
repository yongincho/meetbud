/* Tteokbokki, held: a piece found at Dongdaemun Design Plaza, Seoul (find 59: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, P, WHITE, hold, paint, ink, steam } = K.AccKit;

  // Dongdaemun: tteokbokki in a paper cup, a pick in one rice cake.
  function tteokbokki(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    steam(ctx, env, -5.6);
    ink(ctx, env, C.stick, 0.45, () => {
      ctx.moveTo(1.2, -2.6);
      ctx.lineTo(3.6, -8.4);
    });
    paint(ctx, env, P.sauce, () => {
      for (const [x, y] of [[-2.2, -2.8], [0.2, -3.4], [2.2, -2.6]]) U.rr(ctx, x - 1.6, y - 0.7, 3.2, 1.4, 0.7);
    });
    paint(ctx, env, U.rgb('#F2E3D0'), () => {
      ctx.moveTo(-4.4, -2.4);
      ctx.lineTo(4.4, -2.4);
      ctx.lineTo(3.4, 5.8);
      ctx.lineTo(-3.4, 5.8);
      ctx.closePath();
    });
    paint(ctx, env, P.sauce, () => U.ellipse(ctx, 0, -2.4, 4.4, 0.9));
    paint(ctx, env, U.rgb('#E2433B'), () => {
      for (const x of [-2.6, 0, 2.6]) U.rr(ctx, x - 1.1, 0.4, 2.2, 2, 0.8);
    }, 0.85);
    paint(ctx, env, WHITE, () => U.ellipse(ctx, -1.2, -2.6, 0.5, 0.25), 0.7);
    ctx.restore();
  }

  K.registerFind(59, { id: 'tteokbokki', label: 'Tteokbokki', kr: '떡볶이', slot: 'item', place: { name: 'Dongdaemun Design Plaza', city: 'Seoul', lat: 37.567, lon: 127.0097, radius: 450 } }, tteokbokki);
})(window.Bud);
