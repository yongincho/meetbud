/* Best buds, worn at the neck: a piece earned by inviting a friend (reward 1). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Best buds: a thin gold chain with a heart pendant split down the middle by a zigzag, one half
  // pink and one teal. Earned together: a friend you invite, and you.
  function bestBuds(ctx, a, env) {
    const k = Math.min(a.w * 0.16, 8);
    const hw = a.w * 0.42;
    begin(ctx, a);
    ctx.strokeStyle = env.c(C.gold);
    ctx.lineWidth = Math.max(0.6, k * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-hw, -k * 0.5);
    ctx.quadraticCurveTo(0, k * 0.9, hw, -k * 0.5);
    ctx.stroke();
    ctx.translate(0, k * 0.4);
    ctx.rotate(0.08 * sway(env, 2.2));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, k * 0.45);
    ctx.stroke();
    // the heart: two lobes and a point, in two halves along a zigzag
    const h = k * 1.25;
    const heart = () => {
      ctx.beginPath();
      ctx.moveTo(0, k * 0.55 + h * 0.3);
      ctx.bezierCurveTo(-h * 0.1, k * 0.55 - h * 0.05, -h * 0.75, k * 0.55 + h * 0.05, -h * 0.55, k * 0.55 + h * 0.55);
      ctx.bezierCurveTo(-h * 0.4, k * 0.55 + h * 0.85, -h * 0.1, k * 0.55 + h * 1.05, 0, k * 0.55 + h * 1.25);
      ctx.bezierCurveTo(h * 0.1, k * 0.55 + h * 1.05, h * 0.4, k * 0.55 + h * 0.85, h * 0.55, k * 0.55 + h * 0.55);
      ctx.bezierCurveTo(h * 0.75, k * 0.55 + h * 0.05, h * 0.1, k * 0.55 - h * 0.05, 0, k * 0.55 + h * 0.3);
      ctx.closePath();
    };
    const zig = [[0, k * 0.55 + h * 0.3], [h * 0.12, k * 0.55 + h * 0.55], [-h * 0.1, k * 0.55 + h * 0.78], [h * 0.08, k * 0.55 + h * 1.0], [0, k * 0.55 + h * 1.25]];
    [[-1, C.petalDeep], [1, C.jade]].forEach(([side, color]) => {
      ctx.save();
      heart();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(side * h, k * 0.55 - h * 0.2);
      zig.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(side * h, k * 0.55 + h * 1.4);
      ctx.closePath();
      ctx.fillStyle = env.c(color);
      ctx.fill();
      ctx.restore();
    });
    ctx.strokeStyle = env.c(U.darken(C.gold, 0.1));
    ctx.lineWidth = Math.max(0.5, k * 0.09);
    ctx.beginPath();
    ctx.moveTo(zig[0][0], zig[0][1]);
    zig.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.stroke();
    ctx.fillStyle = env.c(U.WHITE, 0.5);
    ctx.beginPath();
    U.ellipse(ctx, -h * 0.32, k * 0.55 + h * 0.42, h * 0.1, h * 0.06, -0.5);
    ctx.fill();
    ctx.restore();
  }

  K.registerReward(1, { id: 'bestBuds', label: 'Best buds', slot: 'neck', how: 'invite' }, bestBuds);
})(window.Bud);
