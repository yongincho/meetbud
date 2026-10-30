/* Star glasses, worn on the face: a piece found at Hollywood Sign, Los Angeles (find 8). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, begin, lensSize, star5 } = K.AccKit;

  // Hollywood Sign: star-shaped sunglasses.
  function starGlasses(ctx, a, env) {
    const [lw, lh] = lensSize(a);
    const r = Math.max(lw, lh) * 1.12;
    const fw = Math.max(0.8, r * 0.11);
    begin(ctx, a);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * a.dx;
      ctx.beginPath();
      star5(ctx, cx, lh * 0.1, r);
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, env.c(U.mix(C.lens, C.lock, 0.35), 0.94));
      g.addColorStop(1, env.c(C.lens, 0.86));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = env.c(C.gold);
      ctx.lineWidth = fw;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = env.c(U.WHITE, 0.35);
      ctx.lineWidth = fw * 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, r * 0.3);
      ctx.lineTo(cx - r * 0.05, -r * 0.45);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = env.c(C.gold);
    ctx.lineWidth = fw;
    ctx.beginPath();
    ctx.moveTo(-a.dx + r * 0.5, -lh * 0.2);
    ctx.quadraticCurveTo(0, -lh * 0.55, a.dx - r * 0.5, -lh * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  K.registerFind(8, { id: 'starGlasses', label: 'Star glasses', slot: 'face', place: { name: 'Hollywood Sign', city: 'Los Angeles', lat: 34.1341, lon: -118.3215, radius: 4000 } }, starGlasses);
})(window.Bud);
