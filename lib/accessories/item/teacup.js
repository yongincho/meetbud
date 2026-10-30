/* Teacup, held: a piece found at Boston Tea Party Ships, Boston (find 13). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Boston Tea Party Ships: a cup of tea on its saucer.
  function teacup(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.3);
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(U.WHITE, 0.45);
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const x0 = -1.2 + i * 2.4;
      const k = sway(env, 2.6, i * 2.2);
      ctx.beginPath();
      ctx.moveTo(x0, -4.8);
      ctx.bezierCurveTo(x0 + 1.4 * k, -6.4, x0 - 1.4 * k, -7.6, x0 + 0.5 * k, -9.2);
      ctx.stroke();
    }
    ctx.fillStyle = env.c(C.cup);
    ctx.beginPath();
    U.ellipse(ctx, 0, 4.3, 6, 1.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4.4, -3.6);
    ctx.lineTo(4.4, -3.6);
    ctx.bezierCurveTo(4.4, 1.6, 2.6, 3.6, 0, 3.6);
    ctx.bezierCurveTo(-2.6, 3.6, -4.4, 1.6, -4.4, -3.6);
    ctx.fill();
    ctx.strokeStyle = env.c(C.cup);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(4.6, -1.2, 1.5, -1.3, 1.6);
    ctx.stroke();
    ctx.fillStyle = env.c(C.tea);
    ctx.beginPath();
    U.ellipse(ctx, 0, -3.5, 4.1, 0.8);
    ctx.fill();
    ctx.fillStyle = env.c(C.gold);
    ctx.fillRect(-4.2, -1.6, 8.4, 0.5);
    ctx.restore();
  }

  K.registerFind(13, { id: 'teacup', label: 'Teacup', slot: 'item', place: { name: 'Boston Tea Party Ships', city: 'Boston', lat: 42.3522, lon: -71.0513, radius: 450 } }, teacup);
})(window.Bud);
