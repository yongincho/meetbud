/* Bow tie, worn at the neck: built-in accessory 14 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, begin } = K.AccKit;

  function bowtie(ctx, a, env) {
    const col = env.accColors;
    const k = Math.min(a.w * 0.16, 8);
    begin(ctx, a);
    ctx.rotate(0.07 * sway(env, 2.4));
    ctx.fillStyle = env.c(col.hat);
    ctx.beginPath();
    for (let s = -1; s <= 1; s += 2) {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * k * 0.9, -k * 0.95, s * k * 1.45, -k * 0.62);
      ctx.quadraticCurveTo(s * k * 1.65, 0, s * k * 1.45, k * 0.62);
      ctx.quadraticCurveTo(s * k * 0.9, k * 0.95, 0, 0);
    }
    ctx.fill();
    ctx.fillStyle = env.c(col.hat2, 0.9);
    ctx.beginPath();
    [[-0.98, -0.22], [-0.68, 0.32], [0.98, -0.22], [0.68, 0.32]].forEach(([x, y]) => {
      ctx.moveTo(x * k + k * 0.13, y * k);
      ctx.arc(x * k, y * k, k * 0.13, 0, TAU);
    });
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(col.hat, 0.22));
    ctx.beginPath();
    U.rr(ctx, -k * 0.32, -k * 0.4, k * 0.64, k * 0.8, k * 0.22);
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(14, { id: 'bowtie', label: 'Bow tie', slot: 'neck', kind: 'Bow tie' }, bowtie);
})(window.Bud);
