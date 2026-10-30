/* Silk lantern, held: built-in accessory 19 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { C, sway, begin } = K.AccKit;

  function lantern(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.scale(s, s);
    const sw = sway(env, 1.6) * 0.12;
    ctx.strokeStyle = env.c([150, 110, 70]);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(5, -9);
    ctx.stroke();
    ctx.translate(5, -9);
    ctx.rotate(sw);
    ctx.strokeStyle = env.c(C.gold);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 3);
    ctx.stroke();
    F.glow(ctx, 0, 10, 16, C.light, 0.38, env);
    ctx.fillStyle = env.c(C.lanternRed);
    ctx.beginPath();
    U.rr(ctx, -5, 3.5, 10, 13, 3.2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    U.rr(ctx, -5, 3.5, 10, 13, 3.2);
    ctx.clip();
    ctx.fillStyle = env.c(C.lanternBlue);
    ctx.fillRect(-5, 3.5, 10, 6);
    const g = ctx.createRadialGradient(0, 10, 0, 0, 10, 6);
    g.addColorStop(0, env.c(C.light, 0.85));
    g.addColorStop(1, env.c(C.light, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-5, 3.5, 10, 13);
    ctx.restore();
    ctx.fillStyle = env.c(C.gold);
    ctx.fillRect(-3.4, 2.6, 6.8, 1.6);
    ctx.fillRect(-3.4, 15.8, 6.8, 1.6);
    ctx.strokeStyle = env.c(C.lanternRed);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 17.4);
    ctx.lineTo(0, 21);
    ctx.stroke();
    ctx.restore();
  }

  K.registerBuiltin(19, { id: 'lantern', label: 'Silk lantern', kr: '청사초롱', slot: 'item', kind: 'Held item (Korean traditional)' }, lantern);
})(window.Bud);
