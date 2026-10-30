/* Penguin, held: a piece found at Boulders Beach, Cape Town (find 101: Africa). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, P, hold, paint, plushEyes, blush } = K.AccKit;

  // Boulders Beach: an African penguin.
  function penguin(ctx, a, env) {
    hold(ctx, a, env, 2.4, 0.4);
    ctx.rotate(sway(env, 2.4) * 0.06);
    paint(ctx, env, C.beak, () => {
      U.ellipse(ctx, -1.8, 6, 1.4, 0.6);
      U.ellipse(ctx, 1.8, 6, 1.4, 0.6);
    });
    paint(ctx, env, P.ink, () => U.ellipse(ctx, 0, 0.2, 4.6, 6.2));
    paint(ctx, env, P.ink, () => {
      U.ellipse(ctx, -4.4, 0.6, 1.1, 3, 0.35);
      U.ellipse(ctx, 4.4, 0.6, 1.1, 3, -0.35);
    });
    paint(ctx, env, C.cup, () => U.ellipse(ctx, 0, 1.8, 3.2, 4.2));
    paint(ctx, env, C.cup, () => {
      U.ellipse(ctx, -1.5, -2.8, 1.5, 1.2);
      U.ellipse(ctx, 1.5, -2.8, 1.5, 1.2);
    });
    plushEyes(ctx, env, 0, -2.8, 1.5, 0.55);
    paint(ctx, env, C.beak, () => {
      ctx.moveTo(-0.9, -1.6);
      ctx.lineTo(0.9, -1.6);
      ctx.lineTo(0, -0.4);
      ctx.closePath();
    });
    blush(ctx, env, 0, -1.4, 2.4, 0.6);
    ctx.restore();
  }

  K.registerFind(101, { id: 'penguin', label: 'Penguin', slot: 'item', place: { name: 'Boulders Beach', city: 'Cape Town', lat: -34.1975, lon: 18.4517, radius: 800 } }, penguin);
})(window.Bud);
