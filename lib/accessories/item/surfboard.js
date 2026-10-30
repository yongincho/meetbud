/* Surfboard, held: a piece found at Bondi Beach, Sydney (find 10). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Bondi Beach: a surfboard.
  function surfboard(ctx, a, env) {
    const s = (a.w || 1) * 0.82;
    begin(ctx, a);
    ctx.translate(0.6, -2.2 + sway(env, 2) * 0.4);
    ctx.rotate(0.24);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, -9.6);
    ctx.bezierCurveTo(4, -6.4, 4, 4, 1.4, 7.2);
    ctx.lineTo(-1.4, 7.2);
    ctx.bezierCurveTo(-4, 4, -4, -6.4, 0, -9.6);
    ctx.closePath();
    ctx.fillStyle = env.c(C.boardStripe);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = env.c(C.board);
    ctx.fillRect(-0.7, -10, 1.4, 18);
    ctx.fillStyle = env.c(C.flame);
    ctx.fillRect(-4, 3, 8, 1.1);
    ctx.restore();
    ctx.fillStyle = env.c(U.darken(C.boardStripe, 0.2));
    ctx.beginPath();
    ctx.moveTo(-0.2, 5.4);
    ctx.lineTo(1.4, 7.6);
    ctx.lineTo(-0.2, 7.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(10, { id: 'surfboard', label: 'Surfboard', slot: 'item', place: { name: 'Bondi Beach', city: 'Sydney', lat: -33.8915, lon: 151.2767, radius: 1200 } }, surfboard);
})(window.Bud);
