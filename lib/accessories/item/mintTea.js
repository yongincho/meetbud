/* Mint tea, held: a piece found at Jemaa el-Fnaa, Marrakesh (find 99: Africa). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, P, paint, ink, steamingCup } = K.AccKit;

  // Jemaa el-Fnaa: mint tea in a gold-rimmed glass, sprigs on top.
  function mintTea(ctx, a, env) {
    steamingCup(ctx, a, env, () => {
      paint(ctx, env, P.glass, () => {
        ctx.moveTo(-3.2, -4.2);
        ctx.lineTo(3.2, -4.2);
        ctx.lineTo(2.4, 5.4);
        ctx.lineTo(-2.4, 5.4);
        ctx.closePath();
      }, 0.5);
      paint(ctx, env, U.rgb('#D49A3A'), () => {
        ctx.moveTo(-3, -2);
        ctx.lineTo(3, -2);
        ctx.lineTo(2.4, 5.4);
        ctx.lineTo(-2.4, 5.4);
        ctx.closePath();
      }, 0.9);
      ink(ctx, env, C.gold, 0.6, () => {
        ctx.moveTo(-3.2, -4.2);
        ctx.lineTo(3.2, -4.2);
        ctx.moveTo(-2.7, 0.8);
        ctx.lineTo(2.7, 0.8);
      });
      paint(ctx, env, C.gold, () => {
        for (const x of [-1.6, 0, 1.6]) U.ellipse(ctx, x, 2.6, 0.45, 0.7);
      }, 0.9);
    }, () => {
      for (const [x, r] of [[-1, -0.5], [0.8, 0.4], [0, 0]]) {
        paint(ctx, env, P.mint, () => U.ellipse(ctx, x, -5.6, 0.9, 1.6, r));
      }
      ink(ctx, env, P.leafDark, 0.35, () => {
        ctx.moveTo(0, -4);
        ctx.lineTo(0, -6.8);
      });
    });
  }

  K.registerFind(99, { id: 'mintTea', label: 'Mint tea', slot: 'item', place: { name: 'Jemaa el-Fnaa', city: 'Marrakesh', lat: 31.6258, lon: -7.9892, radius: 500 } }, mintTea);
})(window.Bud);
