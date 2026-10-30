/* Banh mi, held: a piece found at Hoi An Ancient Town, Hoi An (find 79: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, ink } = K.AccKit;

  // Hoi An: a banh mi, herbs, chili and pickled carrot spilling out.
  function banhMi(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    ctx.rotate(-0.35);
    paint(ctx, env, P.leaf, () => {
      for (let i = 0; i < 5; i++) U.ellipse(ctx, -4.4 + i * 2.2, -1.6, 1.2, 0.6, 0.4);
    });
    paint(ctx, env, U.rgb('#F28A3C'), () => {
      for (let i = 0; i < 4; i++) U.rr(ctx, -3.6 + i * 2.2, -1.3, 1.6, 0.4, 0.2);
    });
    paint(ctx, env, U.rgb('#F5A3B5'), () => U.rr(ctx, -5, -0.9, 10, 0.9, 0.4));
    paint(ctx, env, P.sauce, () => {
      for (const x of [-2, 1.8]) ctx.arc(x, -1.8, 0.35, 0, TAU);
    });
    paint(ctx, env, P.crust, () => {
      ctx.moveTo(-6.4, 0);
      ctx.bezierCurveTo(-6.4, 3, 6.4, 3, 6.4, 0);
      ctx.closePath();
      ctx.moveTo(-6.2, -1.4);
      ctx.bezierCurveTo(-6.2, -4.2, 6.2, -4.2, 6.2, -1.4);
      ctx.quadraticCurveTo(0, -2.2, -6.2, -1.4);
    });
    ink(ctx, env, U.lighten(P.crust, 0.3), 0.4, () => {
      for (const x of [-3, 0, 3]) {
        ctx.moveTo(x - 0.8, -3.3);
        ctx.lineTo(x + 0.8, -2.5);
      }
    });
    ctx.restore();
  }

  K.registerFind(79, { id: 'banhMi', label: 'Banh mi', slot: 'item', place: { name: 'Hoi An Ancient Town', city: 'Hoi An', lat: 15.8772, lon: 108.326, radius: 700 } }, banhMi);
})(window.Bud);
