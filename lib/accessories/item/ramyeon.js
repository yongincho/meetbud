/* Ramyeon, held: a piece found at Yeouido Hangang Park, Seoul (find 20). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // The Han River: a cup of ramyeon, chopsticks in, steam rising.
  function ramyeon(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.3);
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(U.WHITE, 0.45);
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const x0 = -1.6 + i * 2.6;
      const k = sway(env, 2.6, i * 2.2);
      ctx.beginPath();
      ctx.moveTo(x0, -5.6);
      ctx.bezierCurveTo(x0 + 1.4 * k, -7.2, x0 - 1.4 * k, -8.6, x0 + 0.5 * k, -10.2);
      ctx.stroke();
    }
    ctx.strokeStyle = env.c(C.stick);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(1.4, -3.6);
    ctx.lineTo(5.2, -10.2);
    ctx.moveTo(2.4, -3.4);
    ctx.lineTo(6.4, -9.6);
    ctx.stroke();
    ctx.fillStyle = env.c(C.cupRed);
    ctx.beginPath();
    ctx.moveTo(-4.4, -4);
    ctx.lineTo(4.4, -4);
    ctx.lineTo(3.2, 6);
    ctx.lineTo(-3.2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(C.noodle);
    ctx.beginPath();
    U.ellipse(ctx, 0, -4, 4.4, 1.1);
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(C.noodle, 0.2));
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    for (let x = -3; x <= 3; x += 1.5) {
      ctx.moveTo(x - 0.6, -4.4);
      ctx.quadraticCurveTo(x, -3.4, x + 0.6, -4.4);
    }
    ctx.stroke();
    ctx.fillStyle = env.c(C.cup, 0.9);
    ctx.fillRect(-3.8, -0.4, 7.6, 1.6);
    ctx.restore();
  }

  K.registerFind(20, { id: 'ramyeon', label: 'Ramyeon', kr: '라면', slot: 'item', place: { name: 'Yeouido Hangang Park', city: 'Seoul', lat: 37.5284, lon: 126.9326, radius: 1200 } }, ramyeon);
})(window.Bud);
