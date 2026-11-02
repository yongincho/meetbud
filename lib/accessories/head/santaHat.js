/* Santa hat, worn on the head: a Christmas piece (reward 2), in the wardrobe all year. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin, paint } = K.AccKit;

  // Christmas: a soft red hat whose tip flops over to one side, a fluffy white brim and a pompom.
  function santaHat(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.rotate(0.05 + sway(env, 1.7) * 0.02);
    // the hat, rising from the brim and flopping over to the right
    paint(ctx, env, C.santa, () => {
      ctx.moveTo(-w * 0.3, -w * 0.06);
      ctx.quadraticCurveTo(-w * 0.26, -w * 0.5, w * 0.08, -w * 0.55);
      ctx.quadraticCurveTo(w * 0.36, -w * 0.58, w * 0.44, -w * 0.34);
      ctx.quadraticCurveTo(w * 0.24, -w * 0.4, w * 0.3, -w * 0.06);
      ctx.closePath();
    });
    // the fold's shadow, under the flop
    paint(ctx, env, C.santaDark, () => {
      ctx.moveTo(w * 0.12, -w * 0.4);
      ctx.quadraticCurveTo(w * 0.3, -w * 0.47, w * 0.44, -w * 0.34);
      ctx.quadraticCurveTo(w * 0.26, -w * 0.38, w * 0.12, -w * 0.4);
      ctx.closePath();
    });
    paint(ctx, env, U.WHITE, () => U.ellipse(ctx, -w * 0.1, -w * 0.36, w * 0.06, w * 0.12, 0.5), 0.2);
    // the brim: a band of fur with a soft, bumpy edge
    paint(ctx, env, C.fur, () => U.rr(ctx, -w * 0.34, -w * 0.15, w * 0.68, w * 0.14, w * 0.07));
    ctx.fillStyle = env.c(C.fur);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-w * 0.26 + i * w * 0.13, -w * 0.15, w * 0.045, 0, TAU);
      ctx.fill();
    }
    paint(ctx, env, C.furShade, () => U.rr(ctx, -w * 0.3, -w * 0.045, w * 0.6, w * 0.03, w * 0.015), 0.8);
    // the pompom, swinging a little
    const swing = sway(env, 2.3, 1) * w * 0.012;
    paint(ctx, env, C.fur, () => ctx.arc(w * 0.45 + swing, -w * 0.3, w * 0.075, 0, TAU));
    paint(ctx, env, C.furShade, () => ctx.arc(w * 0.47 + swing, -w * 0.27, w * 0.035, 0, TAU), 0.7);
    ctx.restore();
  }

  K.registerReward(2, { id: 'santaHat', label: 'Santa hat', slot: 'head', how: 'christmas' }, santaHat);
})(window.Bud);
