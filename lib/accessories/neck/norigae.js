/* Norigae, worn at the neck: a piece found at Gyeongbokgung Palace, Seoul (find 4). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Gyeongbokgung: a norigae, a knotted charm with jade and a tassel.
  function norigae(ctx, a, env) {
    const k = Math.min(a.w * 0.16, 8);
    begin(ctx, a);
    ctx.translate(k * 0.75, -k * 0.1);
    ctx.rotate(0.07 * sway(env, 2.2));
    ctx.strokeStyle = env.c(C.lanternRed);
    ctx.lineWidth = k * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, k * 0.5);
    ctx.stroke();
    ctx.fillStyle = env.c(C.lanternRed);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const t = (i * TAU) / 4 + TAU / 8;
      U.ellipse(ctx, Math.cos(t) * k * 0.24, k * 0.78 + Math.sin(t) * k * 0.24, k * 0.2, k * 0.12, t);
    }
    ctx.fill();
    ctx.fillStyle = env.c(C.jade);
    ctx.beginPath();
    U.ellipse(ctx, 0, k * 1.3, k * 0.28, k * 0.34);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.45);
    ctx.beginPath();
    U.ellipse(ctx, -k * 0.08, k * 1.2, k * 0.07, k * 0.11, -0.3);
    ctx.fill();
    ctx.strokeStyle = env.c(C.saekdong[3]);
    ctx.lineWidth = k * 0.07;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const x = i * k * 0.07;
      ctx.moveTo(x, k * 1.62);
      ctx.quadraticCurveTo(x + sway(env, 2.6, i) * k * 0.08, k * 2.1, x * 1.6 + sway(env, 2.6, i) * k * 0.12, k * 2.65);
    }
    ctx.stroke();
    ctx.restore();
  }

  K.registerFind(4, { id: 'norigae', label: 'Norigae', kr: '노리개', slot: 'neck', place: { name: 'Gyeongbokgung Palace', city: 'Seoul', lat: 37.5796, lon: 126.977, radius: 700 } }, norigae);
})(window.Bud);
