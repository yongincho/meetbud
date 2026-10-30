/* Lucky pouch, held: built-in accessory 20 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  function pouch(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.6);
    ctx.scale(s, s);
    ctx.fillStyle = env.c(C.pouch);
    ctx.beginPath();
    ctx.moveTo(-2.6, -3.2);
    ctx.bezierCurveTo(-7.5, -1, -6.8, 6.4, 0, 6.4);
    ctx.bezierCurveTo(6.8, 6.4, 7.5, -1, 2.6, -3.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2.6, -3.2);
    ctx.lineTo(-4.2, -6);
    ctx.lineTo(4.2, -6);
    ctx.lineTo(2.6, -3.2);
    ctx.closePath();
    ctx.fillStyle = env.c(C.pouchDark);
    ctx.fill();
    ctx.fillStyle = env.c(C.gold);
    ctx.fillRect(-3, -3.8, 6, 1.2);
    ctx.beginPath();
    ctx.arc(0, 1.8, 1.9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = env.c(C.gold);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    U.ellipse(ctx, -1.8, -4.6, 1.6, 1, -0.4);
    U.ellipse(ctx, 1.8, -4.6, 1.6, 1, 0.4);
    ctx.stroke();
    ctx.restore();
  }

  K.registerBuiltin(20, { id: 'pouch', label: 'Lucky pouch', kr: '복주머니', slot: 'item', kind: 'Held item (Seollal)', seasonal: true }, pouch);
})(window.Bud);
