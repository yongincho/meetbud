/* Tartan scarf, worn at the neck: a piece found at Edinburgh Castle, Edinburgh (find 83: Europe). */
(function (K) {
  'use strict';
  const { begin, scarf, P, ink } = K.AccKit;

  // Edinburgh Castle: a tartan scarf, green and red with gold and navy lines.
  function tartanScarf(ctx, a, env) {
    const e = Object.create(env);
    e.accColors = Object.assign({}, env.accColors, { scarf: P.tartanGreen, scarf2: P.tartanRed });
    scarf(ctx, a, e);
    const hw = a.w / 2;
    const bh = Math.max(4, a.w * 0.2);
    begin(ctx, a);
    ctx.beginPath();
    ctx.moveTo(-hw, -bh / 2);
    ctx.quadraticCurveTo(0, bh * 0.35, hw, -bh / 2);
    ctx.lineTo(hw, bh / 2);
    ctx.quadraticCurveTo(0, bh * 1.35, -hw, bh / 2);
    ctx.closePath();
    ctx.clip();
    ink(ctx, env, P.tartanGold, Math.max(0.35, bh * 0.06), () => {
      for (let i = -7; i <= 7; i += 2) {
        ctx.moveTo(i * hw * 0.15, -bh);
        ctx.lineTo(i * hw * 0.15, bh * 1.6);
      }
    }, 0.85);
    ink(ctx, env, P.navy, Math.max(0.5, bh * 0.14), () => {
      for (const y of [-0.12, 0.3]) {
        ctx.moveTo(-hw, y * bh);
        ctx.quadraticCurveTo(0, y * bh + bh * 0.85, hw, y * bh);
      }
    }, 0.5);
    ctx.restore();
  }

  K.registerFind(83, { id: 'tartanScarf', label: 'Tartan scarf', slot: 'neck', place: { name: 'Edinburgh Castle', city: 'Edinburgh', lat: 55.9486, lon: -3.2006, radius: 500 } }, tartanScarf);
})(window.Bud);
