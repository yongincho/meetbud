/* Hiking hat, worn on the head: a piece found at Bukhansan National Park, Seoul (find 63: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, begin, paint, ink } = K.AccKit;

  // Bukhansan: an olive hiking bucket hat, stitched round the brim.
  function bucketHat(ctx, a, env) {
    const w = a.w;
    const cloth = U.rgb('#8A9A5B');
    begin(ctx, a);
    ctx.rotate(sway(env, 1.6) * 0.015);
    paint(ctx, env, U.darken(cloth, 0.12), () => {
      ctx.moveTo(-w * 0.42, w * 0.03);
      ctx.lineTo(-w * 0.3, -w * 0.1);
      ctx.lineTo(w * 0.3, -w * 0.1);
      ctx.lineTo(w * 0.42, w * 0.03);
      ctx.quadraticCurveTo(0, w * 0.1, -w * 0.42, w * 0.03);
      ctx.closePath();
    });
    paint(ctx, env, cloth, () => {
      ctx.moveTo(-w * 0.28, -w * 0.08);
      ctx.bezierCurveTo(-w * 0.27, -w * 0.36, w * 0.27, -w * 0.36, w * 0.28, -w * 0.08);
      ctx.closePath();
    });
    ctx.setLineDash([w * 0.03, w * 0.025]);
    ink(ctx, env, U.lighten(cloth, 0.35), Math.max(0.35, w * 0.01), () => {
      ctx.moveTo(-w * 0.36, w * 0.02);
      ctx.quadraticCurveTo(0, w * 0.075, w * 0.36, w * 0.02);
      ctx.moveTo(-w * 0.26, -w * 0.14);
      ctx.quadraticCurveTo(0, -w * 0.11, w * 0.26, -w * 0.14);
    });
    ctx.setLineDash([]);
    paint(ctx, env, U.darken(cloth, 0.3), () => ctx.arc(w * 0.18, -w * 0.2, w * 0.018, 0, TAU));
    ctx.restore();
  }

  K.registerFind(63, { id: 'bucketHat', label: 'Hiking hat', kr: '등산모자', slot: 'head', place: { name: 'Bukhansan National Park', city: 'Seoul', lat: 37.6511, lon: 126.9614, radius: 2000 } }, bucketHat);
})(window.Bud);
