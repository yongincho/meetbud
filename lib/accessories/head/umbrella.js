/* Umbrella, worn on the head: built-in accessory 7 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, begin } = K.AccKit;

  function umbrella(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const R = w * 0.62;
    const edge = -w * 0.34;
    begin(ctx, a);
    ctx.rotate(0.12 + 0.03 * sway(env, 1.4));
    // shaft and a J handle off to one side
    ctx.strokeStyle = env.c(U.darken(col.hat, 0.35));
    ctx.lineWidth = w * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(R * 0.92, edge);
    ctx.lineTo(R * 0.92, edge + w * 0.16);
    ctx.quadraticCurveTo(R * 0.92, edge + w * 0.24, R * 0.8, edge + w * 0.22);
    ctx.stroke();
    // canopy: a dome with a scalloped edge
    const n = 4;
    ctx.beginPath();
    ctx.moveTo(-R, edge);
    ctx.bezierCurveTo(-R, edge - R * 0.78, R, edge - R * 0.78, R, edge);
    for (let i = n - 1; i >= 0; i--) {
      const x0 = -R + (2 * R * (i + 1)) / n;
      const x1 = -R + (2 * R * i) / n;
      ctx.quadraticCurveTo((x0 + x1) / 2, edge - R * 0.16, x1, edge);
    }
    ctx.closePath();
    ctx.fillStyle = env.c(col.hat);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = env.c(col.hat2, 0.9);
    for (let i = 0; i < n; i += 2) {
      const x0 = -R + (2 * R * i) / n;
      ctx.beginPath();
      ctx.moveTo(0, edge - R * 0.62);
      ctx.lineTo(x0, edge + 2);
      ctx.lineTo(x0 + (2 * R) / n, edge + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = env.c(U.darken(col.hat, 0.35));
    ctx.beginPath();
    ctx.arc(0, edge - R * 0.6, w * 0.025, 0, TAU);
    ctx.fill();
    ctx.fillRect(-w * 0.012, edge - R * 0.72, w * 0.024, R * 0.1);
    ctx.restore();
  }

  K.registerBuiltin(7, { id: 'umbrella', label: 'Umbrella', slot: 'head', kind: 'Weather' }, umbrella);
})(window.Bud);
