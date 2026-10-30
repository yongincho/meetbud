/* Brush, held: a piece found at Insadong, Seoul (find 60: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, P, hold, paint, ink } = K.AccKit;

  // Insadong: a calligraphy brush, an ink drop at the tip.
  function brush(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(0.35);
    paint(ctx, env, U.rgb('#C9A15C'), () => U.rr(ctx, -0.8, -10, 1.6, 11, 0.7));
    ink(ctx, env, U.rgb('#8A6A33'), 0.25, () => {
      for (const y of [-7, -3]) {
        ctx.moveTo(-0.8, y);
        ctx.lineTo(0.8, y);
      }
    });
    paint(ctx, env, P.red, () => U.rr(ctx, -0.25, -11.6, 0.5, 1.8, 0.25));
    paint(ctx, env, P.ink, () => {
      ctx.moveTo(-1.2, 1);
      ctx.lineTo(1.2, 1);
      ctx.quadraticCurveTo(1.4, 4, 0, 6.2);
      ctx.quadraticCurveTo(-1.4, 4, -1.2, 1);
    });
    paint(ctx, env, P.ink, () => ctx.arc(0.2, 7.4 + sway(env, 2) * 0.2, 0.45, 0, TAU), 0.85);
    ctx.restore();
  }

  K.registerFind(60, { id: 'brush', label: 'Brush', kr: '붓', slot: 'item', place: { name: 'Insadong', city: 'Seoul', lat: 37.5728, lon: 126.9857, radius: 400 } }, brush);
})(window.Bud);
