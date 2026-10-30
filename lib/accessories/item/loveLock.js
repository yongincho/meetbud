/* Love lock, held: a piece found at N Seoul Tower, Seoul (find 5). */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { C, sway, begin } = K.AccKit;

  // N Seoul Tower: a love lock with a heart on it.
  function loveLock(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.rotate(0.06 * sway(env, 1.7));
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(C.steel);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2.4, -2.6);
    ctx.lineTo(-2.4, -5.2);
    ctx.arc(0, -5.2, 2.4, Math.PI, 0);
    ctx.lineTo(2.4, -2.6);
    ctx.stroke();
    ctx.fillStyle = env.c(C.lock);
    ctx.beginPath();
    U.rr(ctx, -4, -3, 8, 7.4, 1.8);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.92);
    ctx.beginPath();
    F.heart(ctx, 0, 0.5, 1.7);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.25);
    ctx.beginPath();
    U.rr(ctx, -3.3, -2.4, 1.2, 5.6, 0.6);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(5, { id: 'loveLock', label: 'Love lock', slot: 'item', place: { name: 'N Seoul Tower', city: 'Seoul', lat: 37.5512, lon: 126.9882, radius: 700 } }, loveLock);
})(window.Bud);
