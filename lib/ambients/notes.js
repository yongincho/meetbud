/* Music, ambience 7 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, fract } = U;

  // Canonical app a0a697a: hash(i * 3.3), hash(i), hash(i * 7.7), frozen as binary64.
  // Firmware wardrobe/notes_seeds.inc stores their binary32 rounding. Do not resample.
  const NOTES_SEEDS = [
    [0.8193039737561776, 0.8193039737561776, 0.8193039737561776],
    [0.13875052042567404, 0.10467192550277105, 0.28723763824018533],
    [0.6593669948961178, 0.8001120227854699, 0.8940612899932603],
    [0.28634302130012657, 0.6297139996895567, 0.0861935725188232],
    [0.040223235708253924, 0.77850105969992, 0.2013074443602818],
    [0.6013259836508951, 0.5623689354324597, 0.6565490502252942],
  ];

  K.registerAmbient(7, { id: 'notes', label: 'Music' }, {
    back(ctx, t, env, { B, W, H, rate, wave }) {
      const cols = [[169, 139, 255], [74, 168, 255], [255, 120, 170]];
      const mid = (B.x0 + B.x1) / 2;
      for (let i = 0; i < 6; i++) {
        const u = fract(NOTES_SEEDS[i][0] + t * rate(0.2 + 0.08 * NOTES_SEEDS[i][1]));
        const side = i % 2 ? 1 : -1;
        const x = mid + side * (W * 0.33 + 4 * NOTES_SEEDS[i][2]) + 3 * wave(0.5, i / TAU);
        const y = B.y1 - 10 - u * H * 0.7;
        const a = Math.sin(Math.PI * u);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(0.25 * wave(0.4, i / TAU));
        ctx.fillStyle = env.c(cols[i % 3], 0.9 * a);
        ctx.beginPath();
        U.ellipse(ctx, 0, 0, 2, 1.45, -0.4);
        ctx.fill();
        ctx.fillRect(1.25, -6.4, 0.75, 6.2);
        if (i % 3 === 0) {
          ctx.beginPath();
          U.ellipse(ctx, 4.6, -1, 2, 1.45, -0.4);
          ctx.fill();
          ctx.fillRect(5.85, -7.4, 0.75, 6.2);
          ctx.beginPath();
          ctx.moveTo(1.25, -6.4);
          ctx.lineTo(6.6, -7.4);
          ctx.lineTo(6.6, -5.8);
          ctx.lineTo(1.25, -4.8);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(2, -6.4);
          ctx.quadraticCurveTo(4.6, -5, 3.8, -2.6);
          ctx.quadraticCurveTo(3.7, -4.2, 2, -4.6);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    },
  });
})(window.Bud);
