/* Saekdong, worn at the neck: built-in accessory 15 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  function saekdong(ctx, a, env) {
    const w = a.w;
    const hw = w / 2;
    const bh = Math.max(4, w * 0.2);
    begin(ctx, a);
    ctx.beginPath();
    ctx.moveTo(-hw, -bh / 2);
    ctx.quadraticCurveTo(0, bh * 0.35, hw, -bh / 2);
    ctx.lineTo(hw, bh / 2);
    ctx.quadraticCurveTo(0, bh * 1.35, -hw, bh / 2);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    const n = 10;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = env.c(C.saekdong[i % C.saekdong.length]);
      ctx.fillRect(-hw + (w * i) / n, -bh, w / n + 0.3, bh * 3);
    }
    ctx.restore();
    const sw = sway(env, 2) * 0.1;
    ctx.fillStyle = env.c(C.saekdong[0]);
    ctx.save();
    ctx.translate(-hw * 0.3, bh * 0.6);
    ctx.rotate(-0.2 + sw);
    ctx.beginPath();
    U.ellipse(ctx, -bh * 0.5, 0, bh * 0.55, bh * 0.32, -0.3);
    U.ellipse(ctx, bh * 0.5, 0, bh * 0.55, bh * 0.32, 0.3);
    ctx.fill();
    ctx.fillRect(-bh * 0.2, 0, bh * 0.4, bh * 1.8);
    ctx.restore();
    ctx.restore();
  }

  K.registerBuiltin(15, { id: 'saekdong', label: 'Saekdong', kr: '색동', slot: 'neck', kind: 'Rainbow collar (Seollal)' }, saekdong);
})(window.Bud);
