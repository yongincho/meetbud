/* Dango, held: a piece found at Tokyo Tower, Tokyo (find 6). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Tokyo Tower: dango, three dumplings on a stick.
  function dango(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.rotate(0.12);
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(C.stick);
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 6.6);
    ctx.lineTo(0, -10.6);
    ctx.stroke();
    for (const [y, col] of [[-7.6, C.dangoPink], [-3.4, C.cup], [0.8, C.dangoGreen]]) {
      ctx.fillStyle = env.c(col);
      ctx.beginPath();
      ctx.arc(0, y, 2.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = env.c(U.WHITE, 0.5);
      ctx.beginPath();
      ctx.arc(-0.75, y - 0.75, 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(6, { id: 'dango', label: 'Dango', slot: 'item', place: { name: 'Tokyo Tower', city: 'Tokyo', lat: 35.6586, lon: 139.7454, radius: 700 } }, dango);
})(window.Bud);
