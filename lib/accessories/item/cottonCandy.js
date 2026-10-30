/* Cotton candy, held: a piece found at Coney Island Boardwalk, New York (find 36: New York). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint, ink } = K.AccKit;

  // Coney Island: a cloud of pink cotton candy on a paper cone.
  function cottonCandy(ctx, a, env) {
    hold(ctx, a, env, 2, 0.4);
    paint(ctx, env, U.rgb('#F7F3EC'), () => {
      ctx.moveTo(-0.9, -1);
      ctx.lineTo(0.9, -1);
      ctx.lineTo(0.3, 6.4);
      ctx.lineTo(-0.3, 6.4);
      ctx.closePath();
    });
    ink(ctx, env, U.rgb('#4AA8FF'), 0.35, () => {
      for (const y of [1, 3, 5]) {
        ctx.moveTo(-0.7, y - 0.6);
        ctx.lineTo(0.7, y);
      }
    });
    const puffs = [[0, -5, 3.4], [-2.6, -3.6, 2.4], [2.6, -3.8, 2.6], [-1.4, -7.4, 2.2], [1.6, -7.2, 2.3], [0, -2.4, 2.2]];
    for (const [x, y, r] of puffs) paint(ctx, env, U.rgb('#FFB7D5'), () => ctx.arc(x, y, r, 0, TAU));
    for (const [x, y, r] of puffs.slice(0, 3)) paint(ctx, env, U.rgb('#FFD3E6'), () => ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, TAU), 0.8);
    ctx.restore();
  }

  K.registerFind(36, { id: 'cottonCandy', label: 'Cotton candy', slot: 'item', place: { name: 'Coney Island Boardwalk', city: 'New York', lat: 40.5735, lon: -73.9785, radius: 800 } }, cottonCandy);
})(window.Bud);
