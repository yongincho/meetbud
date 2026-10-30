/* Pumpkin, held: built-in accessory 18 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { C, sway, begin } = K.AccKit;

  function pumpkin(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2.4) * 0.8);
    ctx.scale(s, s);
    F.glow(ctx, 0, 0, 12, C.carve, 0.22, env);
    ctx.fillStyle = env.c(C.pumpkinDark);
    ctx.beginPath();
    U.ellipse(ctx, -3.4, 0.4, 4.3, 5.2);
    U.ellipse(ctx, 3.4, 0.4, 4.3, 5.2);
    ctx.fill();
    ctx.fillStyle = env.c(C.pumpkin);
    ctx.beginPath();
    U.ellipse(ctx, 0, 0, 5, 5.8);
    ctx.fill();
    ctx.fillStyle = env.c(C.stem);
    ctx.beginPath();
    U.rr(ctx, -0.9, -8, 1.8, 3.2, 0.8);
    ctx.fill();
    ctx.fillStyle = env.c(C.carve);
    ctx.beginPath();
    ctx.moveTo(-3.6, -1.6);
    ctx.lineTo(-1.2, -1.6);
    ctx.lineTo(-2.4, -3.6);
    ctx.closePath();
    ctx.moveTo(3.6, -1.6);
    ctx.lineTo(1.2, -1.6);
    ctx.lineTo(2.4, -3.6);
    ctx.closePath();
    ctx.moveTo(-3.6, 1);
    ctx.lineTo(-1.8, 2);
    ctx.lineTo(0, 1);
    ctx.lineTo(1.8, 2);
    ctx.lineTo(3.6, 1);
    ctx.lineTo(2.6, 3.4);
    ctx.lineTo(-2.6, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(18, { id: 'pumpkin', label: 'Pumpkin', slot: 'item', kind: 'Seasonal (Halloween)', seasonal: true }, pumpkin);
})(window.Bud);
