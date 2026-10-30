/* Show ticket, held: a piece found at Times Square, New York (find 34: New York). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, star5, hold, paint, ink } = K.AccKit;

  // Times Square: a golden show ticket.
  function showTicket(ctx, a, env) {
    hold(ctx, a, env, 2, 0.4);
    ctx.rotate(-0.25 + sway(env, 2) * 0.05);
    const gold = U.rgb('#F5C451');
    paint(ctx, env, gold, () => {
      ctx.moveTo(-6, -3);
      ctx.lineTo(6, -3);
      ctx.arc(6, 0, 1, -Math.PI / 2, Math.PI / 2, true);
      ctx.lineTo(6, 3);
      ctx.lineTo(-6, 3);
      ctx.arc(-6, 0, 1, Math.PI / 2, -Math.PI / 2, true);
      ctx.closePath();
    });
    ctx.setLineDash([0.5, 0.5]);
    ink(ctx, env, U.darken(gold, 0.35), 0.25, () => {
      ctx.moveTo(2.6, -2.8);
      ctx.lineTo(2.6, 2.8);
    });
    ctx.setLineDash([]);
    paint(ctx, env, U.rgb('#C0392B'), () => star5(ctx, -2, 0, 2));
    paint(ctx, env, U.darken(gold, 0.3), () => {
      ctx.rect(3.4, -1.4, 1.8, 0.5);
      ctx.rect(3.4, -0.2, 1.8, 0.5);
      ctx.rect(3.4, 1, 1.8, 0.5);
    });
    ctx.restore();
  }

  K.registerFind(34, { id: 'showTicket', label: 'Show ticket', slot: 'item', place: { name: 'Times Square', city: 'New York', lat: 40.7575, lon: -73.9858, radius: 400 } }, showTicket);
})(window.Bud);
