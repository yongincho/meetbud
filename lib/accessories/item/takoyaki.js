/* Takoyaki, held: a piece found at Dotonbori, Osaka (find 72: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, hold, paint, ink } = K.AccKit;

  // Dotonbori: takoyaki in a little boat, sauce, mayo and bonito flakes.
  function takoyaki(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ink(ctx, env, C.stick, 0.4, () => {
      ctx.moveTo(2.8, -1.6);
      ctx.lineTo(5.2, -7.6);
    });
    for (const [x, y] of [[-3.2, -0.8], [0, -1.2], [3.2, -0.8], [-1.6, -2.8], [1.6, -2.8]]) {
      paint(ctx, env, U.rgb('#C98242'), () => ctx.arc(x, y, 1.9, 0, TAU));
      paint(ctx, env, U.rgb('#5A2E14'), () => U.ellipse(ctx, x, y - 0.6, 1.5, 0.8), 0.9);
    }
    ink(ctx, env, U.rgb('#FFF8E0'), 0.35, () => {
      ctx.moveTo(-4.6, -1.6);
      for (let i = 0; i < 6; i++) ctx.lineTo(-3.4 + i * 1.6, i % 2 ? -3.4 : -1.2);
    });
    paint(ctx, env, U.rgb('#F2A5A0'), () => {
      for (const [x, y, r] of [[-1.6, -4, 0.4], [1, -3.6, -0.6], [2.4, -2.4, 0.3]]) U.ellipse(ctx, x, y, 0.8, 0.3, r);
    }, 0.9);
    paint(ctx, env, U.rgb('#D9B47A'), () => {
      ctx.moveTo(-5.8, 0);
      ctx.lineTo(5.8, 0);
      ctx.lineTo(4.4, 4.2);
      ctx.lineTo(-4.4, 4.2);
      ctx.closePath();
    });
    ink(ctx, env, U.rgb('#B48E55'), 0.3, () => {
      ctx.moveTo(-5, 1.6);
      ctx.lineTo(5, 1.6);
    });
    ctx.restore();
  }

  K.registerFind(72, { id: 'takoyaki', label: 'Takoyaki', slot: 'item', place: { name: 'Dotonbori', city: 'Osaka', lat: 34.6688, lon: 135.5014, radius: 500 } }, takoyaki);
})(window.Bud);
