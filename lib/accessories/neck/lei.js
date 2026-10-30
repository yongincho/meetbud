/* Lei, worn at the neck: a piece found at Waikiki Beach, Honolulu (find 9). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Waikiki: a flower lei.
  function lei(ctx, a, env) {
    const k = Math.min(a.w * 0.16, 8);
    const spread = Math.min(a.w * 0.42, k * 3.2);
    begin(ctx, a);
    ctx.rotate(0.04 * sway(env, 2));
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = Math.PI * (0.06 + (0.88 * i) / (n - 1));
      const x = -Math.cos(t) * spread;
      const y = Math.sin(t) * k * 0.55 - k * 0.1;
      const col = C.leiPetals[i % C.leiPetals.length];
      ctx.fillStyle = env.c(col);
      ctx.beginPath();
      for (let p = 0; p < 5; p++) {
        const pt = (p * TAU) / 5 + i;
        U.ellipse(ctx, x + Math.cos(pt) * k * 0.2, y + Math.sin(pt) * k * 0.2, k * 0.17, k * 0.17);
      }
      ctx.fill();
      ctx.fillStyle = env.c(C.gold);
      ctx.beginPath();
      ctx.arc(x, y, k * 0.09, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(9, { id: 'lei', label: 'Lei', slot: 'neck', place: { name: 'Waikiki Beach', city: 'Honolulu', lat: 21.2793, lon: -157.8292, radius: 1500 } }, lei);
})(window.Bud);
