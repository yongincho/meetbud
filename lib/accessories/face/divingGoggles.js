/* Diving goggles, worn on the face: a piece found at Haenyeo Museum, Jeju (find 68: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { begin, lensSize, P, paint, ink, gleam } = K.AccKit;

  // Haenyeo Museum: a Jeju diver's round goggles, rimmed in orange rubber.
  function divingGoggles(ctx, a, env) {
    const [lw, lh] = lensSize(a);
    const r = Math.max(lw, lh) * 1.05;
    begin(ctx, a);
    ink(ctx, env, P.orange, Math.max(0.8, r * 0.18), () => {
      ctx.moveTo(-a.dx - r, 0);
      ctx.lineTo(-a.dx - r * 1.7, -r * 0.2);
      ctx.moveTo(a.dx + r, 0);
      ctx.lineTo(a.dx + r * 1.7, -r * 0.2);
    });
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * a.dx;
      paint(ctx, env, P.glass, () => ctx.arc(cx, 0, r, 0, TAU), 0.45);
      ink(ctx, env, P.orange, Math.max(0.9, r * 0.24), () => ctx.arc(cx, 0, r, 0, TAU));
      gleam(ctx, env, cx - r * 0.35, -r * 0.35, r * 0.28, r * 0.14, -0.6, 0.55);
    }
    ink(ctx, env, U.darken(P.orange, 0.2), Math.max(0.8, r * 0.18), () => {
      ctx.moveTo(-a.dx + r * 0.9, 0);
      ctx.quadraticCurveTo(0, -r * 0.3, a.dx - r * 0.9, 0);
    });
    ctx.restore();
  }

  K.registerFind(68, { id: 'divingGoggles', label: 'Diving goggles', kr: '물안경', slot: 'face', place: { name: 'Haenyeo Museum', city: 'Jeju', lat: 33.5228, lon: 126.8635, radius: 500 } }, divingGoggles);
})(window.Bud);
