/* Gelato, held: a piece found at Trevi Fountain, Rome (find 90: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint, ink, gleam } = K.AccKit;

  // Trevi Fountain: gelato, a pistachio scoop and a strawberry one.
  function gelato(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    paint(ctx, env, U.rgb('#E2A85E'), () => {
      ctx.moveTo(-3.2, -2.4);
      ctx.lineTo(3.2, -2.4);
      ctx.lineTo(0, 6.4);
      ctx.closePath();
    });
    ctx.save();
    ctx.clip();
    ink(ctx, env, U.rgb('#B97A3A'), 0.35, () => {
      for (let i = -4; i <= 4; i++) {
        ctx.moveTo(i * 1.4 - 4, -2.4);
        ctx.lineTo(i * 1.4 + 4, 6.4);
        ctx.moveTo(i * 1.4 + 4, -2.4);
        ctx.lineTo(i * 1.4 - 4, 6.4);
      }
    });
    ctx.restore();
    paint(ctx, env, U.rgb('#B5D88A'), () => ctx.arc(0, -3.2, 3.2, 0, TAU));
    paint(ctx, env, U.rgb('#FF9EB5'), () => ctx.arc(0.3, -6.6, 2.6, 0, TAU));
    paint(ctx, env, U.rgb('#E64B6B'), () => {
      for (const [x, y] of [[-0.8, -7.2], [1.2, -6.2], [0.2, -8.2]]) ctx.arc(x, y, 0.3, 0, TAU);
    });
    paint(ctx, env, U.rgb('#7FA85A'), () => {
      for (const [x, y] of [[-1.4, -3], [1.2, -2.6], [-0.2, -4.4]]) ctx.arc(x, y, 0.28, 0, TAU);
    });
    gleam(ctx, env, -0.8, -7.4, 0.8, 0.4, -0.4, 0.4);
    ctx.restore();
  }

  K.registerFind(90, { id: 'gelato', label: 'Gelato', slot: 'item', place: { name: 'Trevi Fountain', city: 'Rome', lat: 41.9009, lon: 12.4833, radius: 400 } }, gelato);
})(window.Bud);
