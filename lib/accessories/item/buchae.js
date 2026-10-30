/* Fan, held: a piece found at Bukchon Hanok Village, Seoul (find 18). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Bukchon: a folding fan, like the ones in Korean fan dance.
  function buchae(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.rotate(-0.15 + sway(env, 3) * 0.06);
    ctx.scale(s, s);
    const r = 8.4;
    ctx.fillStyle = env.c(C.fan);
    ctx.beginPath();
    ctx.moveTo(0, 4.8);
    ctx.arc(0, 4.8, r, -Math.PI * 0.86, -Math.PI * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(C.gold, 0.85);
    ctx.beginPath();
    ctx.arc(0, 4.8, r, -Math.PI * 0.86, -Math.PI * 0.14);
    ctx.arc(0, 4.8, r * 0.82, -Math.PI * 0.14, -Math.PI * 0.86, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(C.fan, 0.25), 0.7);
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const t = -Math.PI * (0.86 - (0.72 * i) / 8);
      ctx.moveTo(0, 4.8);
      ctx.lineTo(Math.cos(t) * r * 0.98, 4.8 + Math.sin(t) * r * 0.98);
    }
    ctx.stroke();
    ctx.fillStyle = env.c(C.petal);
    ctx.beginPath();
    for (const [x, y] of [[-3, -0.6], [2.4, -1.4], [0, -2.4]]) U.ellipse(ctx, x, y, 0.9, 0.9);
    ctx.fill();
    ctx.fillStyle = env.c(C.stick);
    ctx.beginPath();
    U.rr(ctx, -0.6, 4, 1.2, 3.2, 0.5);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(18, { id: 'buchae', label: 'Fan', kr: '부채', slot: 'item', place: { name: 'Bukchon Hanok Village', city: 'Seoul', lat: 37.5826, lon: 126.983, radius: 500 } }, buchae);
})(window.Bud);
