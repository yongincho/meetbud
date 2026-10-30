/* Giraffe, held: a piece found at Giraffe Centre, Nairobi (find 100: Africa). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, hold, paint, ink } = K.AccKit;

  // The Giraffe Centre: a giraffe, neck up, spots and little horns.
  function giraffe(ctx, a, env) {
    hold(ctx, a, env, 2, 0.4);
    const coat = U.rgb('#F2C46B');
    const spot = U.rgb('#B9732F');
    ctx.rotate(sway(env, 1.6) * 0.04);
    paint(ctx, env, coat, () => {
      U.ellipse(ctx, -0.4, 3.4, 4, 2.6);
      U.rr(ctx, -3.6, 4.4, 1.2, 2.2, 0.5);
      U.rr(ctx, 1.6, 4.4, 1.2, 2.2, 0.5);
      U.rr(ctx, 1, -6, 2.2, 10, 1.1);
    });
    paint(ctx, env, spot, () => {
      for (const [x, y, r] of [[-2, 2.6, 0.9], [0.4, 3.8, 0.8], [-0.2, 2, 0.6], [2, -3.4, 0.6], [2.2, -0.4, 0.6], [1.7, 1.8, 0.5]]) {
        U.ellipse(ctx, x, y, r, r * 0.8);
      }
    });
    paint(ctx, env, coat, () => U.ellipse(ctx, 2.8, -7.4, 2.6, 1.9, 0.15));
    paint(ctx, env, U.lighten(coat, 0.35), () => U.ellipse(ctx, 4.4, -7, 1.1, 1, 0.15));
    ink(ctx, env, spot, 0.5, () => {
      ctx.moveTo(1.8, -9);
      ctx.lineTo(1.6, -10.6);
      ctx.moveTo(3.2, -9.1);
      ctx.lineTo(3.3, -10.7);
    });
    paint(ctx, env, spot, () => {
      ctx.arc(1.6, -10.7, 0.45, 0, TAU);
      ctx.arc(3.3, -10.8, 0.45, 0, TAU);
    });
    paint(ctx, env, C.lens, () => ctx.arc(2.6, -7.8, 0.45, 0, TAU));
    paint(ctx, env, C.earPink, () => U.ellipse(ctx, 3.6, -6.6, 0.6, 0.35), 0.6);
    ctx.restore();
  }

  K.registerFind(100, { id: 'giraffe', label: 'Giraffe', slot: 'item', place: { name: 'Giraffe Centre', city: 'Nairobi', lat: -1.3764, lon: 36.7454, radius: 600 } }, giraffe);
})(window.Bud);
