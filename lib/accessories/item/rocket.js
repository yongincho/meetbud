/* Rocket, held: a piece found at Kennedy Space Center, Cape Canaveral (find 15). */
(function (K) {
  'use strict';
  const { TAU } = K.util;
  const { C, sway, begin } = K.AccKit;

  // Kennedy Space Center: a little rocket, engine lit.
  function rocket(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2.2) * 0.5);
    ctx.rotate(0.12);
    ctx.scale(s, s);
    const f = 1 + sway(env, 9) * 0.15;
    ctx.fillStyle = env.c(C.flame);
    ctx.beginPath();
    ctx.moveTo(-1.6, 4.6);
    ctx.quadraticCurveTo(0, 4.6 + 5 * f, 1.6, 4.6);
    ctx.fill();
    ctx.fillStyle = env.c(C.light);
    ctx.beginPath();
    ctx.moveTo(-0.8, 4.6);
    ctx.quadraticCurveTo(0, 4.6 + 2.8 * f, 0.8, 4.6);
    ctx.fill();
    ctx.fillStyle = env.c(C.fin);
    ctx.beginPath();
    for (const k of [-1, 1]) {
      ctx.moveTo(k * 2, 0.4);
      ctx.lineTo(k * 4, 4.4);
      ctx.lineTo(k * 2, 3.6);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = env.c(C.rocket);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(3.2, -7, 2.4, 1, 2, 4.6);
    ctx.lineTo(-2, 4.6);
    ctx.bezierCurveTo(-2.4, 1, -3.2, -7, 0, -10);
    ctx.fill();
    ctx.fillStyle = env.c(C.fin);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(1.6, -8.6, 2.1, -7.4, 2.3, -6.4);
    ctx.lineTo(-2.3, -6.4);
    ctx.bezierCurveTo(-2.1, -7.4, -1.6, -8.6, 0, -10);
    ctx.fill();
    ctx.fillStyle = env.c(C.gemBlue);
    ctx.beginPath();
    ctx.arc(0, -3, 1.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(15, { id: 'rocket', label: 'Rocket', slot: 'item', place: { name: 'Kennedy Space Center', city: 'Cape Canaveral', lat: 28.5229, lon: -80.6823, radius: 3000 } }, rocket);
})(window.Bud);
