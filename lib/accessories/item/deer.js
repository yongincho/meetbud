/* Fawn, held: a piece found at Nara Park, Nara (find 75: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, hold, paint, plushEyes } = K.AccKit;

  // Nara Park: a spotted fawn.
  function deer(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.4);
    const coat = U.rgb('#C98B52');
    paint(ctx, env, coat, () => {
      U.ellipse(ctx, -0.6, 2.4, 4.2, 2.6);
      U.rr(ctx, -3.8, 3.2, 1, 3.4, 0.5);
      U.rr(ctx, 1.8, 3.2, 1, 3.4, 0.5);
      U.rr(ctx, 1.4, -3.4, 2, 5.4, 1);
    });
    paint(ctx, env, C.cup, () => {
      for (const [x, y] of [[-2.6, 1.4], [-1, 1], [0.6, 1.6], [-1.8, 2.8]]) ctx.arc(x, y, 0.45, 0, TAU);
    });
    paint(ctx, env, coat, () => {
      U.ellipse(ctx, 2.6, -4.4, 2.2, 1.9);
      U.ellipse(ctx, 0.4, -6, 1.6, 0.7, -0.6);
      U.ellipse(ctx, 4.8, -6, 1.6, 0.7, 0.6);
    });
    paint(ctx, env, U.rgb('#F2C4A0'), () => {
      U.ellipse(ctx, 0.4, -6, 1, 0.35, -0.6);
      U.ellipse(ctx, 4.8, -6, 1, 0.35, 0.6);
    });
    paint(ctx, env, U.lighten(coat, 0.45), () => U.ellipse(ctx, 3, -3.4, 1.2, 0.8));
    plushEyes(ctx, env, 2.6, -4.8, 0.9, 0.38);
    paint(ctx, env, C.lens, () => U.ellipse(ctx, 3, -3.6, 0.4, 0.3));
    ctx.restore();
  }

  K.registerFind(75, { id: 'deer', label: 'Fawn', slot: 'item', place: { name: 'Nara Park', city: 'Nara', lat: 34.684, lon: 135.8523, radius: 1200 } }, deer);
})(window.Bud);
