/* Eomuk, held: a piece found at Jagalchi Market, Busan (find 64: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, hold, ink, steam } = K.AccKit;

  // Jagalchi Market: eomuk, a ribbon of fish cake folded onto a skewer.
  function eomuk(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    steam(ctx, env, -9.6);
    ink(ctx, env, C.stick, 0.6, () => {
      ctx.moveTo(0, 6.6);
      ctx.lineTo(0, -10);
    });
    const cake = U.rgb('#E9B872');
    ink(ctx, env, cake, 2.2, () => {
      ctx.moveTo(-2.6, -8);
      for (let i = 0; i < 4; i++) {
        const y = -8 + i * 3.2;
        const s = i % 2 ? -1 : 1;
        ctx.bezierCurveTo(4 * s, y - 0.4, 4 * s, y + 1.8, 0, y + 1.6);
        ctx.bezierCurveTo(-4 * s, y + 1.4, -4 * s, y + 3.4, 0.4 * s, y + 3.2);
      }
    });
    ink(ctx, env, U.lighten(cake, 0.3), 0.5, () => {
      for (let i = 0; i < 4; i++) {
        const y = -7.6 + i * 3.2;
        ctx.moveTo(-1.6, y);
        ctx.quadraticCurveTo(0, y - 0.4, 1.6, y);
      }
    }, 0.7);
    ctx.restore();
  }

  K.registerFind(64, { id: 'eomuk', label: 'Eomuk', kr: '어묵', slot: 'item', place: { name: 'Jagalchi Market', city: 'Busan', lat: 35.0971, lon: 129.0313, radius: 500 } }, eomuk);
})(window.Bud);
