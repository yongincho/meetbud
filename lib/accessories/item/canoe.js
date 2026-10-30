/* Canoe, held: a piece found at Lake Louise, Banff (find 104: the Americas). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, P, hold, paint, ink } = K.AccKit;

  // Lake Louise: a red canoe with its paddle.
  function canoe(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.4);
    ctx.rotate(-0.15 + sway(env, 1.8) * 0.05);
    ink(ctx, env, P.wood, 0.6, () => {
      ctx.moveTo(-1.6, 4);
      ctx.lineTo(3.4, -8.6);
    });
    paint(ctx, env, P.wood, () => U.ellipse(ctx, 3.6, -9, 0.9, 2.2, 0.38));
    paint(ctx, env, U.rgb('#D93A2B'), () => {
      ctx.moveTo(-7, -0.6);
      ctx.quadraticCurveTo(0, 0.6, 7, -0.6);
      ctx.quadraticCurveTo(5, 3.6, 0, 3.6);
      ctx.quadraticCurveTo(-5, 3.6, -7, -0.6);
    });
    paint(ctx, env, U.rgb('#F2E3C6'), () => {
      ctx.moveTo(-6.8, -0.6);
      ctx.quadraticCurveTo(0, 0.6, 6.8, -0.6);
      ctx.quadraticCurveTo(0, 1.4, -6.8, -0.6);
    });
    ink(ctx, env, P.sea, 0.6, () => {
      ctx.moveTo(-6.4, 4.4);
      ctx.quadraticCurveTo(-2, 3.8 + sway(env, 3) * 0.3, 2, 4.4);
      ctx.quadraticCurveTo(4.6, 4.8, 6.6, 4.4);
    }, 0.7);
    ctx.restore();
  }

  K.registerFind(104, { id: 'canoe', label: 'Canoe', slot: 'item', place: { name: 'Lake Louise', city: 'Banff', lat: 51.416, lon: -116.221, radius: 1500 } }, canoe);
})(window.Bud);
