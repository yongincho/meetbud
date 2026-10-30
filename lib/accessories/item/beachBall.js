/* Beach ball, held: a piece found at Copacabana Beach, Rio de Janeiro (find 107: the Americas). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin, paint, gleam } = K.AccKit;

  // Copacabana: a beach ball, bouncing.
  function beachBall(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, -Math.abs(sway(env, 2.4)) * 1.2);
    ctx.scale(s, s);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -1, 5.4, 0, TAU);
    ctx.clip();
    const cols = [C.cup, U.rgb('#E8402E'), C.cup, U.rgb('#FFD84D'), C.cup, U.rgb('#4A8FE7')];
    cols.forEach((col, i) => paint(ctx, env, col, () => {
      ctx.moveTo(0, -1);
      ctx.arc(0, -1, 6, (i / 6) * TAU + 0.3, ((i + 1) / 6) * TAU + 0.3);
      ctx.closePath();
    }));
    ctx.restore();
    paint(ctx, env, C.cup, () => ctx.arc(0, -1, 1, 0, TAU));
    gleam(ctx, env, -2.2, -3.4, 1.6, 0.8, -0.6, 0.4);
    ctx.restore();
  }

  K.registerFind(107, { id: 'beachBall', label: 'Beach ball', slot: 'item', place: { name: 'Copacabana Beach', city: 'Rio de Janeiro', lat: -22.9757, lon: -43.1866, radius: 2000 } }, beachBall);
})(window.Bud);
