/* Opera glasses, worn on the face: a piece found at Sydney Opera House, Sydney (find 95: Oceania). */
(function (K) {
  'use strict';
  const { TAU } = K.util;
  const { C, begin, lensSize, paint, ink, gleam } = K.AccKit;

  // Sydney Opera House: gold opera glasses on a little handle.
  function operaGlasses(ctx, a, env) {
    const [lw, lh] = lensSize(a);
    const r = Math.max(lw, lh) * 0.95;
    begin(ctx, a);
    ink(ctx, env, C.gold, Math.max(0.9, r * 0.22), () => {
      ctx.moveTo(a.dx + r * 0.6, r * 0.6);
      ctx.lineTo(a.dx + r * 1.4, r * 2.6);
    });
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * a.dx;
      paint(ctx, env, C.lens, () => ctx.arc(cx, 0, r, 0, TAU), 0.85);
      ink(ctx, env, C.gold, Math.max(0.9, r * 0.26), () => ctx.arc(cx, 0, r, 0, TAU));
      gleam(ctx, env, cx - r * 0.3, -r * 0.3, r * 0.25, r * 0.12, -0.6, 0.5);
    }
    ink(ctx, env, C.gold, Math.max(0.9, r * 0.3), () => {
      ctx.moveTo(-a.dx + r, 0);
      ctx.lineTo(a.dx - r, 0);
    });
    paint(ctx, env, C.lock, () => ctx.arc(0, 0, r * 0.22, 0, TAU));
    ctx.restore();
  }

  K.registerFind(95, { id: 'operaGlasses', label: 'Opera glasses', slot: 'face', place: { name: 'Sydney Opera House', city: 'Sydney', lat: -33.857, lon: 151.2151, radius: 500 } }, operaGlasses);
})(window.Bud);
