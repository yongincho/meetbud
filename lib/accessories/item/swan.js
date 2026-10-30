/* Swan, held: a piece found at Lake Eola Park, Orlando (find 54: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint, ink } = K.AccKit;

  // Lake Eola: a white swan with an orange beak.
  function swan(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.5);
    paint(ctx, env, P.sea, () => U.ellipse(ctx, 0, 5, 6, 1.1), 0.5);
    paint(ctx, env, C.cup, () => {
      ctx.moveTo(-5.6, 0);
      ctx.bezierCurveTo(-5.6, 5.4, 4.4, 5.4, 5, 1.4);
      ctx.bezierCurveTo(3, 2.4, 1, 0.6, 1.2, -1.6);
      ctx.bezierCurveTo(-1, -1, -3, 1.4, -5.6, 0);
    });
    ink(ctx, env, C.cup, 1.5, () => {
      ctx.moveTo(-3.4, 1.4);
      ctx.bezierCurveTo(-5.6, -1.6, -1, -4.8, -3.6, -7.6);
    });
    paint(ctx, env, C.cup, () => U.ellipse(ctx, -3.4, -7.8, 1.3, 1.1));
    paint(ctx, env, C.beak, () => {
      ctx.moveTo(-4.4, -8.2);
      ctx.lineTo(-6.6, -7.4);
      ctx.lineTo(-4.4, -7.2);
      ctx.closePath();
    });
    paint(ctx, env, C.lens, () => ctx.arc(-3.6, -8.1, 0.32, 0, TAU));
    ink(ctx, env, U.rgb('#D9DDE6'), 0.35, () => {
      ctx.moveTo(-1.6, 1.2);
      ctx.quadraticCurveTo(1, 3.4, 3.6, 1.8);
    });
    ctx.restore();
  }

  K.registerFind(54, { id: 'swan', label: 'Swan', slot: 'item', place: { name: 'Lake Eola Park', city: 'Orlando', lat: 28.5438, lon: -81.3716, radius: 500 } }, swan);
})(window.Bud);
