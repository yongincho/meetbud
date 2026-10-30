/* Onigiri, held: a piece found at Shibuya Crossing, Tokyo (find 73: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint } = K.AccKit;

  // Shibuya Crossing: an onigiri, wrapped in nori.
  function onigiri(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    paint(ctx, env, P.rice, () => {
      ctx.moveTo(0, -6.4);
      ctx.bezierCurveTo(2.2, -6.4, 6.4, 2.4, 5.6, 4);
      ctx.bezierCurveTo(4.8, 5.4, -4.8, 5.4, -5.6, 4);
      ctx.bezierCurveTo(-6.4, 2.4, -2.2, -6.4, 0, -6.4);
    });
    ctx.fillStyle = env.c(U.rgb('#E7E3D6'));
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      U.ellipse(ctx, -3.4 + U.hash(i) * 6.8, -2.6 + U.hash(i + 30) * 6, 0.35, 0.2, U.hash(i + 7) * 3);
      ctx.fill();
    }
    paint(ctx, env, P.nori, () => U.rr(ctx, -2.4, 0.6, 4.8, 4.6, 0.4));
    paint(ctx, env, U.lighten(P.nori, 0.15), () => ctx.rect(-2.4, 1.6, 4.8, 0.3), 0.7);
    ctx.restore();
  }

  K.registerFind(73, { id: 'onigiri', label: 'Onigiri', slot: 'item', place: { name: 'Shibuya Crossing', city: 'Tokyo', lat: 35.6595, lon: 139.7005, radius: 400 } }, onigiri);
})(window.Bud);
