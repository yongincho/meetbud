/* Coffee, held: built-in accessory 16 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { C, sway, begin } = K.AccKit;

  function coffee(ctx, a, env) {
    const col = env.accColors;
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(U.WHITE, 0.45);
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const x0 = -1.3 + i * 2.6;
      const k = sway(env, 2.6, i * 2.2);
      ctx.beginPath();
      ctx.moveTo(x0, -9.6);
      ctx.bezierCurveTo(x0 + 1.6 * k, -11.4, x0 - 1.6 * k, -12.8, x0 + 0.6 * k, -14.6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-4, -6.5);
    ctx.lineTo(4, -6.5);
    ctx.lineTo(3, 6);
    ctx.lineTo(-3, 6);
    ctx.closePath();
    ctx.fillStyle = env.c(C.cup);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3.7, -2.6);
    ctx.lineTo(3.7, -2.6);
    ctx.lineTo(3.3, 2.4);
    ctx.lineTo(-3.3, 2.4);
    ctx.closePath();
    ctx.fillStyle = env.c(C.sleeve);
    ctx.fill();
    ctx.fillStyle = env.c(C.cup, 0.95);
    ctx.beginPath();
    F.heart(ctx, 0, -0.1, 1.3);
    ctx.fill();
    ctx.fillStyle = env.c(col.hat);
    ctx.beginPath();
    U.rr(ctx, -4.7, -8.4, 9.4, 2.4, 1.1);
    ctx.fill();
    ctx.beginPath();
    U.rr(ctx, -3.4, -9.6, 6.8, 1.6, 0.8);
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(16, { id: 'coffee', label: 'Coffee', slot: 'item', kind: 'Held item' }, coffee);
})(window.Bud);
