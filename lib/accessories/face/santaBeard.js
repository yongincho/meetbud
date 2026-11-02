/* Santa beard, worn on the face: a Christmas piece (reward 3), in the wardrobe all year. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin, paint } = K.AccKit;

  // Christmas: a round, fluffy beard under the eyes, with a bright white mustache on top.
  function santaBeard(ctx, a, env) {
    const k = a.ry;
    const hw = a.dx + a.rx * 1.2;
    const top = k * 1.05;
    const low = k * 2.45;
    const side = k * 0.35; // where the sideburns end, beside the eyes
    begin(ctx, a);
    ctx.translate(0, sway(env, 1.5) * k * 0.02);
    // the beard, rising beside the eyes, and the curls along its lower edge
    paint(ctx, env, C.beard, () => {
      ctx.moveTo(-hw, side);
      ctx.quadraticCurveTo(-hw, low, 0, low);
      ctx.quadraticCurveTo(hw, low, hw, side);
      ctx.quadraticCurveTo(hw * 0.86, top, hw * 0.55, top);
      ctx.lineTo(-hw * 0.55, top);
      ctx.quadraticCurveTo(-hw * 0.86, top, -hw, side);
      ctx.closePath();
    });
    ctx.fillStyle = env.c(C.beard);
    for (let i = 0; i < 5; i++) {
      const t = (0.12 + i * 0.19) * Math.PI;
      ctx.beginPath();
      ctx.arc(-Math.cos(t) * hw * 0.84, top + Math.sin(t) * (low - top) * 0.88, k * 0.26, 0, TAU);
      ctx.fill();
    }
    // the mustache: two white curls from the middle, tipped up at their ends
    for (let s = -1; s <= 1; s += 2) {
      paint(ctx, env, U.WHITE, () => U.ellipse(ctx, s * a.dx * 0.46, top + k * 0.04, a.dx * 0.55, k * 0.26, s * -0.3));
    }
    ctx.restore();
  }

  K.registerReward(3, { id: 'santaBeard', label: 'Santa beard', slot: 'face', how: 'christmas' }, santaBeard);
})(window.Bud);
