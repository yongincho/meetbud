/* Speedrun visor, worn on the face: built-in accessory 21 (its outfit code). One glossy black
 * racing shield across both eyes with a16z speedrun's slanted "sr" in white. It sizes itself to the
 * eyes like the sunglasses, and keeps its own colors in every theme: it is speedrun's mark. */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, begin, lensSize } = K.AccKit;

  // a16z speedrun's "sr" mark, traced from its logo (two polygons, already slanted), centered, 1 tall
  const S = [[-1.754,0.5],[-0.373,0.5],[-0.303,0.444],[-0.063,-0.007],[-0.092,-0.035],[-0.796,-0.035],[-0.81,-0.12],[-0.711,-0.317],[-0.599,-0.415],[-0.5,-0.43],[-0.486,-0.345],[-0.556,-0.218],[-0.542,-0.148],[-0.035,-0.148],[0.077,-0.232],[0.19,-0.5],[-1.176,-0.5],[-1.232,-0.472],[-1.43,-0.148],[-1.486,0.035],[-0.782,0.035],[-0.739,0.077],[-0.754,0.148],[-0.88,0.359],[-0.979,0.444],[-1.063,0.415],[-0.993,0.162],[-1.542,0.162],[-1.669,0.275]];
  const R = [[-0.19,0.5],[0.387,0.486],[0.852,-0.317],[0.965,-0.43],[1.063,-0.415],[0.993,-0.162],[1.528,-0.148],[1.669,-0.275],[1.754,-0.5],[0.359,-0.486],[-0.12,0.303]];
  const WIDTH = 3.507; // the mark's width for its height of 1
  const RIM = U.rgb('#9AA3B5'); // the glass cube's silver edge; fixed in every theme, like the mark

  function polygon(ctx, points) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }

  function srVisor(ctx, a, env) {
    const [lw, lh] = lensSize(a);
    const W = a.dx + lw;
    const H = lh;
    begin(ctx, a);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const fw = Math.max(0.8, Math.min(lw, lh) * 0.16);

    // the shield: a straight brow, sides sweeping in, a small notch over the nose
    ctx.beginPath();
    ctx.moveTo(-W * 0.98, -H * 0.9);
    ctx.lineTo(W * 0.98, -H * 0.9);
    ctx.lineTo(W * 1.04, -H * 0.5);
    ctx.lineTo(W * 0.82, H * 0.85);
    ctx.lineTo(W * 0.2, H * 0.95);
    ctx.lineTo(0, H * 0.6);
    ctx.lineTo(-W * 0.2, H * 0.95);
    ctx.lineTo(-W * 0.82, H * 0.85);
    ctx.lineTo(-W * 1.04, -H * 0.5);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -H, 0, H);
    g.addColorStop(0, env.c(C.lens, 0.97));
    g.addColorStop(1, env.c(U.mix(C.lens, RIM, 0.18), 0.92));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = env.c(RIM);
    ctx.lineWidth = fw;
    ctx.stroke();

    // a glint across the left end, clear of the letters
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = env.c(U.WHITE, 0.3);
    ctx.lineWidth = fw * 1.5;
    ctx.beginPath();
    ctx.moveTo(-W * 0.97, H * 0.3);
    ctx.lineTo(-W * 0.76, -H * 0.85);
    ctx.stroke();
    ctx.restore();

    // the "sr" mark across the middle, as wide as fits
    const h = Math.min(H * 0.8, (W * 1.36) / WIDTH);
    ctx.save();
    ctx.translate(0, -H * 0.04);
    ctx.scale(h, h);
    ctx.fillStyle = env.c(U.WHITE);
    polygon(ctx, S);
    polygon(ctx, R);
    ctx.restore();

    ctx.restore();
  }

  K.registerBuiltin(21, { id: 'srVisor', label: 'Speedrun visor', slot: 'face', kind: 'Glasses' }, srVisor);
})(window.Bud);
