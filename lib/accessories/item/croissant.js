/* Croissant, held: a piece found at The Louvre, Paris (find 84: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint, gleam } = K.AccKit;

  // The Louvre: a flaky croissant.
  function croissant(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    const seg = [[-4.6, 1.2, 1.4, 2, -0.9], [-2.4, -0.4, 1.9, 2.8, -0.4], [0, -0.9, 2.2, 3.2, 0], [2.4, -0.4, 1.9, 2.8, 0.4], [4.6, 1.2, 1.4, 2, 0.9]];
    for (const [x, y, rx, ry, r] of seg) {
      paint(ctx, env, P.crust, () => U.ellipse(ctx, x, y, rx, ry, r));
      paint(ctx, env, U.darken(P.crust, 0.18), () => U.ellipse(ctx, x, y + ry * 0.45, rx * 0.9, ry * 0.4, r), 0.6);
    }
    gleam(ctx, env, -0.4, -2.6, 1.2, 0.5, 0, 0.35);
    ctx.restore();
  }

  K.registerFind(84, { id: 'croissant', label: 'Croissant', slot: 'item', place: { name: 'The Louvre', city: 'Paris', lat: 48.8611, lon: 2.3369, radius: 600 } }, croissant);
})(window.Bud);
