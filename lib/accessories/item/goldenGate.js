/* Golden Gate, held: a piece found at Golden Gate Bridge, San Francisco (find 1). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Golden Gate Bridge: a little span of it, towers, cables and the bay below.
  function goldenGate(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.scale(s, s);
    ctx.fillStyle = env.c(C.water, 0.85);
    ctx.beginPath();
    U.rr(ctx, -7.2, 4.4, 14.4, 2.2, 1.1);
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = env.c(C.bridge);
    // the hangers, from the main cable down to the deck
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    for (let x = -3.6; x <= 3.61; x += 0.9) {
      const t = (x / 4.2 + 1) / 2;
      const y = -6.8 * ((1 - t) * (1 - t) + t * t) + 2 * 2.4 * t * (1 - t);
      ctx.moveTo(x, y);
      ctx.lineTo(x, 2.4);
    }
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-7.1, 2);
    ctx.quadraticCurveTo(-5.6, -1.2, -4.2, -6.8);
    ctx.quadraticCurveTo(0, 2.4, 4.2, -6.8);
    ctx.quadraticCurveTo(5.6, -1.2, 7.1, 2);
    ctx.stroke();
    ctx.fillStyle = env.c(C.bridge);
    for (const tx of [-4.2, 4.2]) {
      ctx.beginPath();
      U.rr(ctx, tx - 0.95, -7.8, 0.6, 11.4, 0.25);
      U.rr(ctx, tx + 0.35, -7.8, 0.6, 11.4, 0.25);
      ctx.fill();
      ctx.beginPath();
      for (const y of [-7.4, -5, -2.6]) U.rr(ctx, tx - 0.95, y, 1.9, 0.5, 0.2);
      ctx.fill();
    }
    ctx.fillStyle = env.c(U.darken(C.bridge, 0.28));
    ctx.beginPath();
    U.rr(ctx, -7.2, 2.2, 14.4, 1.1, 0.45);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(1, { id: 'goldenGate', label: 'Golden Gate', slot: 'item', place: { name: 'Golden Gate Bridge', city: 'San Francisco', lat: 37.8199, lon: -122.4783, radius: 1500 } }, goldenGate);
})(window.Bud);
