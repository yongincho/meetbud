/* Snow globes, held: found at Lake Kawaguchi, the Pyramids of Giza and the Empire State Building. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, P, WHITE, hold, paint, ink, gleam } = K.AccKit;

  // A snow globe with the place inside; snow (or glitter) drifts in it.
  function globe(scene, base, flake) {
    return (ctx, a, env) => {
      hold(ctx, a, env, 2, 0.3);
      paint(ctx, env, base, () => {
        ctx.moveTo(-4.7, 6);
        ctx.lineTo(4.7, 6);
        ctx.lineTo(3.7, 2.4);
        ctx.lineTo(-3.7, 2.4);
        ctx.closePath();
      });
      paint(ctx, env, U.darken(base, 0.22), () => U.rr(ctx, -4.9, 5.1, 9.8, 1.3, 0.55));
      paint(ctx, env, U.lighten(base, 0.25), () => U.rr(ctx, -3.6, 2.4, 7.2, 0.6, 0.3));
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -2.6, 5.5, 0, TAU);
      ctx.clip();
      scene(ctx, env);
      for (let i = 0; i < 10; i++) {
        const x = -4.4 + ((i * 3.3) % 8.8);
        const y = -7 + ((i * 2.9) % 8.4) + sway(env, 1.4, i * 1.3) * 0.9;
        paint(ctx, env, flake, () => ctx.arc(x + sway(env, 1.1, i) * 0.4, y, 0.32 + (i % 3) * 0.08, 0, TAU), 0.9);
      }
      ctx.restore();
      paint(ctx, env, P.glass, () => ctx.arc(0, -2.6, 5.5, 0, TAU), 0.18);
      ink(ctx, env, WHITE, 0.45, () => ctx.arc(0, -2.6, 5.5, 0, TAU), 0.55);
      gleam(ctx, env, -2.3, -5.6, 1.5, 0.7, -0.6, 0.5);
      ctx.restore();
    };
  }
  // Lake Kawaguchi: Mount Fuji over the lake.
  const fujiGlobe = globe((ctx, env) => {
    paint(ctx, env, P.sky, () => ctx.rect(-6, -9, 12, 9));
    paint(ctx, env, P.sea, () => ctx.rect(-6, 0, 12, 4));
    paint(ctx, env, P.mountain, () => {
      ctx.moveTo(-6, 0.3);
      ctx.lineTo(-1.1, -5.8);
      ctx.lineTo(1.1, -5.8);
      ctx.lineTo(6, 0.3);
      ctx.closePath();
    });
    paint(ctx, env, P.snowcap, () => {
      ctx.moveTo(-1.1, -5.8);
      ctx.lineTo(1.1, -5.8);
      ctx.lineTo(2.6, -3.9);
      ctx.lineTo(1.4, -4.4);
      ctx.lineTo(0.4, -3.6);
      ctx.lineTo(-0.7, -4.4);
      ctx.lineTo(-2.6, -3.9);
      ctx.closePath();
    });
    paint(ctx, env, C.lock, () => ctx.arc(3.2, -6.4, 0.9, 0, TAU), 0.9);
  }, U.rgb('#C0392B'), WHITE);
  // Giza: the pyramids under a desert sun, in gold glitter.
  const pyramidGlobe = globe((ctx, env) => {
    paint(ctx, env, U.rgb('#FFD9A0'), () => ctx.rect(-6, -9, 12, 9));
    paint(ctx, env, P.sand, () => ctx.rect(-6, 0, 12, 4));
    paint(ctx, env, U.rgb('#FFB547'), () => ctx.arc(2.8, -5.6, 1.2, 0, TAU));
    for (const [x, h, s] of [[-1.4, 5.6, 4.2], [2.6, 3.4, 2.6]]) {
      paint(ctx, env, U.rgb('#E2B567'), () => {
        ctx.moveTo(x - s, 0.4);
        ctx.lineTo(x, 0.4 - h);
        ctx.lineTo(x + s, 0.4);
        ctx.closePath();
      });
      paint(ctx, env, U.rgb('#B98545'), () => {
        ctx.moveTo(x, 0.4 - h);
        ctx.lineTo(x + s, 0.4);
        ctx.lineTo(x + s * 0.2, 0.4);
        ctx.closePath();
      });
    }
  }, U.rgb('#3F6FB5'), C.gold);
  // The Empire State Building: an Art Deco tower over the city at night.
  const skylineGlobe = globe((ctx, env) => {
    paint(ctx, env, P.night, () => ctx.rect(-6, -9, 12, 13));
    paint(ctx, env, U.rgb('#4A5B8C'), () => {
      for (const [x, h] of [[-5.4, 3], [-3.6, 4.4], [2.6, 3.6], [4.2, 2.4]]) ctx.rect(x, 2 - h, 1.6, h + 2);
    });
    paint(ctx, env, U.rgb('#C9CDD6'), () => {
      ctx.moveTo(-1.6, 3);
      ctx.lineTo(-1.6, -2.4);
      ctx.lineTo(-1.1, -2.4);
      ctx.lineTo(-1.1, -4.2);
      ctx.lineTo(-0.6, -4.2);
      ctx.lineTo(-0.6, -5.6);
      ctx.lineTo(-0.15, -5.6);
      ctx.lineTo(0, -8.2);
      ctx.lineTo(0.15, -5.6);
      ctx.lineTo(0.6, -5.6);
      ctx.lineTo(0.6, -4.2);
      ctx.lineTo(1.1, -4.2);
      ctx.lineTo(1.1, -2.4);
      ctx.lineTo(1.6, -2.4);
      ctx.lineTo(1.6, 3);
      ctx.closePath();
    });
    ctx.fillStyle = env.c(C.light, 0.9);
    for (let y = -1.8; y < 2.6; y += 0.9) for (const x of [-1.1, -0.25, 0.6]) ctx.fillRect(x, y, 0.45, 0.4);
  }, U.rgb('#2B2D35'), WHITE);

  K.registerFind(74, { id: 'fujiGlobe', label: 'Fuji globe', slot: 'item', place: { name: 'Lake Kawaguchi', city: 'Fujikawaguchiko', lat: 35.514, lon: 138.7507, radius: 3000 } }, fujiGlobe);
  K.registerFind(98, { id: 'pyramidGlobe', label: 'Pyramid globe', slot: 'item', place: { name: 'Pyramids of Giza', city: 'Giza', lat: 29.9792, lon: 31.1342, radius: 1500 } }, pyramidGlobe);
  K.registerFind(33, { id: 'skylineGlobe', label: 'Skyline globe', slot: 'item', place: { name: 'Empire State Building', city: 'New York', lat: 40.7484, lon: -73.9857, radius: 400 } }, skylineGlobe);
})(window.Bud);
