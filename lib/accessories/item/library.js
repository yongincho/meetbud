/* Library book, held: a piece found at Boston Public Library, Boston (find 24: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, star5, P, hold, paint } = K.AccKit;

  // Boston Public Library: a green book with a gold band.
  function library(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(-0.12);
    const cover = U.rgb('#2E7D5B');
    paint(ctx, env, U.rgb('#F7F1E1'), () => U.rr(ctx, -4.2, -5.6, 8.6, 11, 0.6));
    paint(ctx, env, cover, () => U.rr(ctx, -4.8, -6, 8.6, 11.4, 0.8));
    paint(ctx, env, U.darken(cover, 0.25), () => ctx.rect(-4.8, -6, 1.2, 11.4));
    paint(ctx, env, C.gold, () => {
      ctx.rect(-3.2, -3.4, 6.4, 0.9);
      ctx.rect(-3.2, 2, 6.4, 0.5);
    });
    paint(ctx, env, C.gold, () => star5(ctx, 0, -0.5, 1.2));
    paint(ctx, env, P.red, () => {
      ctx.moveTo(1.6, 5.2);
      ctx.lineTo(1.6, 7.4);
      ctx.lineTo(2.2, 6.8);
      ctx.lineTo(2.8, 7.4);
      ctx.lineTo(2.8, 5.2);
      ctx.closePath();
    });
    ctx.restore();
  }

  K.registerFind(24, { id: 'library', label: 'Library book', slot: 'item', place: { name: 'Boston Public Library', city: 'Boston', lat: 42.3493, lon: -71.0783, radius: 350 } }, library);
})(window.Bud);
