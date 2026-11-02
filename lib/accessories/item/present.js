/* Present, held: a Christmas piece (reward 4), in the wardrobe all year. */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, hold, paint, gleam } = K.AccKit;

  // Christmas: a green box tied with a gold ribbon and a big bow.
  function present(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ctx.scale(1.2, 1.2);
    paint(ctx, env, C.gift, () => U.rr(ctx, -4, -2.4, 8, 6.8, 0.8));
    paint(ctx, env, C.giftDark, () => U.rr(ctx, -4.6, -3.8, 9.2, 2.2, 0.6));
    paint(ctx, env, C.gold, () => ctx.rect(-0.75, -3.8, 1.5, 8.2));
    paint(ctx, env, C.gold, () => ctx.rect(-4, 0.9, 8, 1.2));
    // the bow: two loops and a knot
    for (let s = -1; s <= 1; s += 2) {
      paint(ctx, env, C.gold, () => U.ellipse(ctx, s * 1.55, -4.75, 1.7, 1.05, s * 0.45));
      paint(ctx, env, U.darken(C.gold, 0.25), () => U.ellipse(ctx, s * 1.45, -4.7, 0.7, 0.4, s * 0.45));
    }
    paint(ctx, env, U.darken(C.gold, 0.1), () => ctx.arc(0, -4.3, 0.75, 0, Math.PI * 2));
    gleam(ctx, env, -2.6, -0.6, 0.5, 1.4, 0.15, 0.22);
    ctx.restore();
  }

  K.registerReward(4, { id: 'present', label: 'Present', slot: 'item', how: 'christmas' }, present);
})(window.Bud);
