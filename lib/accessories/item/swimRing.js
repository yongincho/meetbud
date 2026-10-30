/* Swim ring, held: a piece found at Haeundae Beach, Busan (find 65: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, hold, paint, gleam } = K.AccKit;

  // Haeundae: a striped swim ring.
  function swimRing(ctx, a, env) {
    hold(ctx, a, env, 2, 0.5);
    ctx.rotate(sway(env, 1.6) * 0.1);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 5.6, 0, TAU);
    ctx.arc(0, 0, 2.6, 0, TAU, true);
    ctx.clip();
    for (let i = 0; i < 8; i++) {
      paint(ctx, env, i % 2 ? C.cup : U.rgb('#FF5C8A'), () => {
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 6, (i / 8) * TAU, ((i + 1) / 8) * TAU);
        ctx.closePath();
      });
    }
    ctx.restore();
    gleam(ctx, env, -2.6, -2.8, 1.6, 0.6, -0.7, 0.45);
    ctx.restore();
  }

  K.registerFind(65, { id: 'swimRing', label: 'Swim ring', kr: '튜브', slot: 'item', place: { name: 'Haeundae Beach', city: 'Busan', lat: 35.1586, lon: 129.1605, radius: 1000 } }, swimRing);
})(window.Bud);
