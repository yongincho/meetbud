/* Bungeoppang, held: a piece found at Myeongdong, Seoul (find 19). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Myeongdong: bungeoppang, a warm fish-shaped bread.
  function bungeoppang(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.rotate(-0.5);
    ctx.scale(s, s);
    ctx.fillStyle = env.c(C.bread);
    ctx.beginPath();
    U.ellipse(ctx, -1, 0, 5, 3);
    ctx.moveTo(3.2, 0);
    ctx.lineTo(7, -2.8);
    ctx.lineTo(6.2, 0);
    ctx.lineTo(7, 2.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(C.bread, 0.28), 0.8);
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = -1.6 + i * 1.6;
      ctx.moveTo(x - 0.7, -1.6);
      ctx.quadraticCurveTo(x + 0.4, 0, x - 0.7, 1.6);
    }
    ctx.moveTo(-4, -2);
    ctx.quadraticCurveTo(-3, 0, -4, 2);
    ctx.stroke();
    ctx.fillStyle = env.c(U.darken(C.bread, 0.45));
    ctx.beginPath();
    ctx.arc(-4.4, -0.7, 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.25);
    ctx.beginPath();
    U.ellipse(ctx, -1.4, -1.6, 2.2, 0.6, -0.1);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(19, { id: 'bungeoppang', label: 'Bungeoppang', kr: '붕어빵', slot: 'item', place: { name: 'Myeongdong', city: 'Seoul', lat: 37.5636, lon: 126.9826, radius: 500 } }, bungeoppang);
})(window.Bud);
