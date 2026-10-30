/* Boater, worn on the head: a piece found at Rialto Bridge, Venice (find 91: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin, paint, ink } = K.AccKit;

  // Rialto Bridge: a gondolier's straw boater with a red ribbon.
  function boater(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.rotate(-0.05 + sway(env, 1.6) * 0.02);
    paint(ctx, env, U.darken(C.straw, 0.1), () => U.ellipse(ctx, 0, -w * 0.02, w * 0.46, w * 0.08));
    paint(ctx, env, C.straw, () => ctx.rect(-w * 0.23, -w * 0.22, w * 0.46, w * 0.2));
    paint(ctx, env, U.lighten(C.straw, 0.12), () => U.ellipse(ctx, 0, -w * 0.22, w * 0.23, w * 0.05));
    paint(ctx, env, C.cupRed, () => ctx.rect(-w * 0.23, -w * 0.12, w * 0.46, w * 0.06));
    const sw = sway(env, 2.4) * 0.05;
    paint(ctx, env, C.cupRed, () => {
      ctx.moveTo(w * 0.22, -w * 0.1);
      ctx.quadraticCurveTo(w * 0.32, -w * 0.02, w * (0.3 + sw), w * 0.12);
      ctx.lineTo(w * (0.26 + sw), w * 0.1);
      ctx.quadraticCurveTo(w * 0.27, 0, w * 0.2, -w * 0.07);
    });
    ink(ctx, env, U.darken(C.straw, 0.2), Math.max(0.3, w * 0.008), () => {
      for (let i = 1; i < 4; i++) {
        ctx.moveTo(-w * 0.23, -w * (0.12 + 0.025 * i) - w * 0.03);
        ctx.lineTo(w * 0.23, -w * (0.12 + 0.025 * i) - w * 0.03);
      }
    }, 0.6);
    ctx.restore();
  }

  K.registerFind(91, { id: 'boater', label: 'Boater', slot: 'head', place: { name: 'Rialto Bridge', city: 'Venice', lat: 45.438, lon: 12.3359, radius: 600 } }, boater);
})(window.Bud);
