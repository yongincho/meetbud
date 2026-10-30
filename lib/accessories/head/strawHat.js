/* Straw hat, worn on the head: a piece found at Southernmost Point, Key West (find 17). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Key West: a wide straw sun hat with a ribbon.
  function strawHat(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.translate(0, -w * 0.02);
    ctx.rotate(0.06 + sway(env, 1.4) * 0.02);
    ctx.fillStyle = env.c(U.darken(C.straw, 0.12));
    ctx.beginPath();
    U.ellipse(ctx, 0, 0, w * 0.48, w * 0.09);
    ctx.fill();
    ctx.fillStyle = env.c(C.straw);
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, -w * 0.02);
    ctx.bezierCurveTo(-w * 0.22, -w * 0.3, w * 0.22, -w * 0.3, w * 0.22, -w * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(C.boardStripe);
    ctx.fillRect(-w * 0.22, -w * 0.09, w * 0.44, w * 0.06);
    ctx.strokeStyle = env.c(U.darken(C.straw, 0.22), 0.6);
    ctx.lineWidth = w * 0.008;
    ctx.beginPath();
    for (let i = 1; i <= 2; i++) U.ellipse(ctx, 0, 0, w * (0.27 + i * 0.07), w * (0.05 + i * 0.012));
    ctx.stroke();
    ctx.restore();
  }

  K.registerFind(17, { id: 'strawHat', label: 'Straw hat', slot: 'head', place: { name: 'Southernmost Point', city: 'Key West', lat: 24.5465, lon: -81.7975, radius: 3000 } }, strawHat);
})(window.Bud);
