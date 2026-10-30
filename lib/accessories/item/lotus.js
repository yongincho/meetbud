/* Lotus, held: a piece found at Changdeokgung Palace, Seoul (find 61: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint } = K.AccKit;

  // Changdeokgung: a pink lotus on its pad.
  function lotus(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.35);
    paint(ctx, env, P.leaf, () => U.ellipse(ctx, 0, 4.2, 6, 1.8));
    paint(ctx, env, P.leafDark, () => {
      ctx.moveTo(0, 4.2);
      ctx.lineTo(4.4, 3.2);
      ctx.lineTo(4.6, 4.4);
      ctx.closePath();
    });
    const petal = U.rgb('#FF9EC4');
    for (const [r, s] of [[-0.9, 1], [0.9, 1], [-0.45, 1.1], [0.45, 1.1], [0, 1.2]]) {
      ctx.save();
      ctx.translate(0, 3);
      ctx.rotate(r);
      paint(ctx, env, r === 0 ? U.lighten(petal, 0.2) : petal, () => {
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-2.2 * s, -2, -1.6 * s, -6, 0, -7.4 * s);
        ctx.bezierCurveTo(1.6 * s, -6, 2.2 * s, -2, 0, 0);
      });
      ctx.restore();
    }
    paint(ctx, env, P.yellow, () => ctx.arc(0, 1.6, 0.8, 0, TAU));
    ctx.restore();
  }

  K.registerFind(61, { id: 'lotus', label: 'Lotus', kr: '연꽃', slot: 'item', place: { name: 'Changdeokgung Palace', city: 'Seoul', lat: 37.5794, lon: 126.9928, radius: 500 } }, lotus);
})(window.Bud);
