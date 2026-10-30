/* Telescope, held: a piece found at Griffith Observatory, Los Angeles (find 43: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, star5, P, hold, paint, ink, gleam } = K.AccKit;

  // Griffith Observatory: a brass telescope on a tripod.
  function telescope(ctx, a, env) {
    hold(ctx, a, env, 2, 0.25);
    ink(ctx, env, P.woodDark, 0.6, () => {
      ctx.moveTo(0, -1);
      ctx.lineTo(-3.4, 6);
      ctx.moveTo(0, -1);
      ctx.lineTo(3.4, 6);
      ctx.moveTo(0, -1);
      ctx.lineTo(0, 6);
    });
    ctx.save();
    ctx.translate(0, -1.6);
    ctx.rotate(-0.6);
    paint(ctx, env, P.brass, () => U.rr(ctx, -4.6, -1.2, 9.2, 2.4, 0.6));
    paint(ctx, env, U.darken(P.brass, 0.2), () => {
      ctx.rect(-1.4, -1.25, 0.5, 2.5);
      ctx.rect(1.8, -1.25, 0.5, 2.5);
    });
    paint(ctx, env, U.lighten(P.brass, 0.2), () => U.rr(ctx, 4.2, -1.6, 1.4, 3.2, 0.5));
    paint(ctx, env, P.glass, () => U.ellipse(ctx, 5.6, 0, 0.35, 1.3), 0.8);
    gleam(ctx, env, 0, -0.6, 3.4, 0.3, 0, 0.35);
    ctx.restore();
    paint(ctx, env, C.light, () => star5(ctx, 4.6, -8.6, 1), 0.7 + sway(env, 3) * 0.3);
    ctx.restore();
  }

  K.registerFind(43, { id: 'telescope', label: 'Telescope', slot: 'item', place: { name: 'Griffith Observatory', city: 'Los Angeles', lat: 34.1183, lon: -118.3003, radius: 600 } }, telescope);
})(window.Bud);
