/* Kimbap, held: a piece found at Gwangjang Market, Seoul (find 58: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, gleam } = K.AccKit;

  // Gwangjang Market: three slices of kimbap.
  function kimbap(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    const fill = [P.yellow, P.leaf, U.rgb('#F28A3C'), U.rgb('#F5A3B5')];
    for (const [x, y] of [[-3.4, 2], [3.4, 2], [0, -2.6]]) {
      paint(ctx, env, P.nori, () => ctx.arc(x, y, 3.2, 0, TAU));
      paint(ctx, env, P.rice, () => ctx.arc(x, y, 2.6, 0, TAU));
      fill.forEach((col, i) => {
        const t = (i / fill.length) * TAU + 0.4;
        paint(ctx, env, col, () => ctx.arc(x + Math.cos(t) * 0.9, y + Math.sin(t) * 0.9, 0.7, 0, TAU));
      });
      ctx.fillStyle = env.c(U.rgb('#E9E3CF'));
      for (let i = 0; i < 5; i++) ctx.fillRect(x - 2 + U.hash(i + x) * 3.6, y + 1 + U.hash(i + y) * 0.8, 0.35, 0.25);
    }
    gleam(ctx, env, -1.2, -4.6, 1.2, 0.4, -0.3, 0.25);
    ctx.restore();
  }

  K.registerFind(58, { id: 'kimbap', label: 'Kimbap', kr: '김밥', slot: 'item', place: { name: 'Gwangjang Market', city: 'Seoul', lat: 37.5698, lon: 127.0007, radius: 350 } }, kimbap);
})(window.Bud);
