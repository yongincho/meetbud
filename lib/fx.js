/* Shared expression overlays (ripples, thinking dots, sparkles, Zs, battery...)
 * and ambient particles used by skin packs.
 *
 * Overlays are positioned with anchors that each character provides:
 *   anchors(pose) -> { x, y, top, side, sideY, badge: [x, y] }
 * All drawing happens in stage units and is a pure function of time, so it can be
 * exported as sprite frames later.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { TAU, fract, clamp, smoothstep } = U;

  const Z_COLOR = [214, 222, 255];
  const SWEAT = [140, 212, 255];
  const INK = [28, 18, 30];

  const DEFAULT_ANCHORS = { x: 0, y: 4, top: -30, side: 26, sideY: 2, badge: [22, -32] };

  function waves(ctx, p, env, a, A) {
    const col = U.lighten(p.tint, 0.1);
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      const ox = A.x + side * (A.side + 2);
      const oy = A.sideY;
      for (let i = 0; i < 3; i++) {
        const u = fract(p.tt / 0.8 + i / 3);
        const r = 4 + u * 11;
        const al = a * (1 - u) * smoothstep(0, 0.18, u);
        if (al < 0.01) continue;
        ctx.strokeStyle = env.c(col, al);
        ctx.lineWidth = 2.4 * (1 - u * 0.35);
        ctx.beginPath();
        const a0 = side > 0 ? -0.72 : Math.PI - 0.72;
        ctx.arc(ox, oy, r, a0, a0 + 1.44);
        ctx.stroke();
      }
    }
  }

  function dots(ctx, p, env, a, A) {
    const col = U.lighten(p.tint, 0.15);
    const bx = A.badge[0] - 6;
    const by = A.badge[1] + 2;
    for (let i = 0; i < 3; i++) {
      const ph = (p.tt / 0.8) * TAU - i * 0.95;
      const b = Math.max(0, Math.sin(ph));
      ctx.fillStyle = env.c(col, a * (0.4 + 0.6 * b));
      ctx.beginPath();
      ctx.arc(bx + i * 6.2, by - b * 3.4, 2.5, 0, TAU);
      ctx.fill();
    }
  }

  function sparkles(ctx, p, env, a, A) {
    const x = p.loopT;
    const col = U.lighten(p.tint, 0.35);
    const cy = A.y - 4;
    if (x < 1.0) {
      const u = x / 1.0;
      const e = U.easeOut(u);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU + 0.35 + (U.hash(i + 1) - 0.5) * 0.3;
        const d = 18 + e * 20 * (0.75 + 0.5 * U.hash(i + 9));
        const r = (4 - 2.8 * u) * (0.7 + 0.5 * U.hash(i + 3));
        const al = a * (1 - u * u);
        ctx.fillStyle = env.c(i % 3 === 0 ? U.WHITE : col, al);
        ctx.beginPath();
        U.star4(ctx, A.x + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.9, r);
        ctx.fill();
      }
    }
    for (let i = 0; i < 3; i++) {
      const start = 1.0 + i * 0.38;
      const k = clamp((x - start) / 0.7);
      if (k <= 0 || k >= 1) continue;
      const s = Math.sin(k * Math.PI);
      const ang = -2.2 + i * 1.6;
      const d = 30 + U.hash(i + 20) * 6;
      ctx.fillStyle = env.c(col, a * s);
      ctx.beginPath();
      U.star4(ctx, A.x + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.85, 2.8 * s + 0.4);
      ctx.fill();
    }
  }

  function burst(ctx, p, env, a, A) {
    const x = p.loopT;
    if (x > 0.6) return;
    const u = x / 0.6;
    ctx.strokeStyle = env.c(U.lighten(p.tint, 0.25), a * (1 - u) * 0.9);
    ctx.lineWidth = 3.4 * (1 - u) + 0.3;
    ctx.beginPath();
    ctx.arc(A.x, A.y - 4, 12 + 34 * U.easeOut(u), 0, TAU);
    ctx.stroke();
  }

  function recDot(ctx, p, env, a, A) {
    const pulse = 0.5 + 0.5 * U.osc(p.tt, K.state('recording').loop, 2);
    const x = A.rec ? A.rec[0] : -A.badge[0];
    const y = A.rec ? A.rec[1] : A.badge[1];
    F.glow(ctx, x, y, 8, p.tint, a * 0.5 * pulse, env);
    ctx.fillStyle = env.c(p.tint, a * (0.55 + 0.45 * pulse));
    ctx.beginPath();
    ctx.arc(x, y, 3.6, 0, TAU);
    ctx.fill();
  }

  function zzz(ctx, p, env, a, A) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const u = fract(p.tt / 2 + i / 3);
      const al = a * Math.sin(u * Math.PI);
      if (al < 0.02) continue;
      const sz = 2.2 + u * 2.6;
      const zx = A.badge[0] - 8 + u * 10 + Math.sin(u * TAU) * 1.4;
      const zy = A.badge[1] + 10 - u * 15;
      ctx.strokeStyle = env.c(Z_COLOR, al);
      ctx.lineWidth = Math.max(1, sz * 0.45);
      ctx.beginPath();
      ctx.moveTo(zx - sz, zy - sz);
      ctx.lineTo(zx + sz, zy - sz);
      ctx.lineTo(zx - sz, zy + sz);
      ctx.lineTo(zx + sz, zy + sz);
      ctx.stroke();
    }
  }

  function battery(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    const w = 12;
    const h = 6.6;
    const on = U.osc(p.tt, K.state('lowbattery').loop, 3) > -0.2 ? 1 : 0.25;
    ctx.save();
    ctx.translate(bx, by);
    ctx.strokeStyle = env.c([236, 236, 242], a);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    U.rr(ctx, -w / 2, -h / 2, w, h, 1.6);
    ctx.stroke();
    ctx.fillStyle = env.c([236, 236, 242], a);
    ctx.fillRect(w / 2 + 0.2, -1.4, 1.5, 2.8);
    ctx.fillStyle = env.c(K.tint(env.theme, 'recording'), a * on);
    ctx.beginPath();
    U.rr(ctx, -w / 2 + 1.7, -h / 2 + 1.7, 2.6, h - 3.4, 0.6);
    ctx.fill();
    ctx.restore();
  }

  function sweat(ctx, p, env, a, A) {
    const u = fract(p.tt / K.state('lowbattery').loop);
    const al = a * U.win(u, 0, 1, 0.2);
    if (al < 0.02) return;
    const x = A.x + A.side * 0.82 + 1;
    const y = (A.sweatY == null ? A.sideY - 10 : A.sweatY) + u * 5;
    ctx.fillStyle = env.c(SWEAT, al);
    ctx.beginPath();
    F.drop(ctx, x, y, 2.3);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, al * 0.8);
    ctx.beginPath();
    ctx.arc(x - 0.8, y - 0.4, 0.7, 0, TAU);
    ctx.fill();
  }

  function bang(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    const pop = 1 + 0.16 * Math.max(0, Math.sin((p.tt / 0.8) * TAU));
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(pop, pop);
    ctx.fillStyle = env.c(p.tint, a);
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.moveTo(-4.6, 4.2);
    ctx.lineTo(-8.4, 8.6);
    ctx.lineTo(-1.6, 6.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(INK, a);
    ctx.beginPath();
    U.rr(ctx, -1.25, -4.6, 2.5, 6, 1.25);
    ctx.arc(0, 3.4, 1.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Done: a check pops into the badge just after the happy hop, and draws itself in.
  function check(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    const k = U.clamp((p.tt - 0.3) / 0.32);
    if (k <= 0) return;
    const s = 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2); // springs in, a touch past full size
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(s, s);
    ctx.fillStyle = env.c(p.tint, a);
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.moveTo(-4.6, 4.2);
    ctx.lineTo(-8.4, 8.6);
    ctx.lineTo(-1.6, 6.4);
    ctx.closePath();
    ctx.fill();
    const len = 10.4;
    const d = U.clamp((p.tt - 0.48) / 0.24);
    if (d > 0) {
      ctx.strokeStyle = env.c(INK, a);
      ctx.lineWidth = 2.1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([len * d, len]);
      ctx.beginPath();
      ctx.moveTo(-3.4, 0.1);
      ctx.lineTo(-1, 2.6);
      ctx.lineTo(3.6, -2.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  function question(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    const bob = 1.2 * Math.sin((p.tt / K.state('confused').loop) * TAU * 2);
    ctx.save();
    ctx.translate(bx, by + bob);
    ctx.fillStyle = env.c(p.tint, a);
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.moveTo(-4.6, 4.2);
    ctx.lineTo(-8.4, 8.6);
    ctx.lineTo(-1.6, 6.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = env.c(INK, a);
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-2.2, -2.2);
    ctx.quadraticCurveTo(-2.2, -4.7, 0, -4.7);
    ctx.quadraticCurveTo(2.3, -4.7, 2.3, -2.6);
    ctx.quadraticCurveTo(2.3, -1.1, 0.3, -0.5);
    ctx.lineTo(0.2, 0.9);
    ctx.stroke();
    ctx.fillStyle = env.c(INK, a);
    ctx.beginPath();
    ctx.arc(0.2, 3.5, 1.25, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function bolt(ctx, x, y, s) {
    ctx.moveTo(x + 0.35 * s, y - s);
    ctx.lineTo(x - 0.6 * s, y + 0.15 * s);
    ctx.lineTo(x - 0.02 * s, y + 0.15 * s);
    ctx.lineTo(x - 0.3 * s, y + s);
    ctx.lineTo(x + 0.62 * s, y - 0.2 * s);
    ctx.lineTo(x + 0.04 * s, y - 0.2 * s);
    ctx.closePath();
  }

  function charging(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    const L = K.state('charging').loop;
    const fill = 0.25 + 0.75 * U.easeInOut(U.fract(p.tt / L));
    const w = 13;
    const h = 7.4;
    ctx.save();
    ctx.translate(bx - 1, by);
    ctx.strokeStyle = env.c([236, 236, 242], a);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    U.rr(ctx, -w / 2, -h / 2, w, h, 1.8);
    ctx.stroke();
    ctx.fillStyle = env.c([236, 236, 242], a);
    ctx.fillRect(w / 2 + 0.2, -1.5, 1.5, 3);
    ctx.fillStyle = env.c(p.tint, a);
    ctx.beginPath();
    U.rr(ctx, -w / 2 + 1.6, -h / 2 + 1.6, (w - 3.2) * fill, h - 3.2, 0.7);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, a);
    ctx.beginPath();
    bolt(ctx, 0, 0, 3.3);
    ctx.fill();
    ctx.restore();
  }

  function micoff(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    ctx.save();
    ctx.translate(bx, by);
    ctx.strokeStyle = env.c([226, 230, 238], a);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    U.rr(ctx, -2.3, -5.6, 4.6, 7.6, 2.3);
    ctx.moveTo(-4.4, -0.4);
    ctx.quadraticCurveTo(-4.4, 4.2, 0, 4.2);
    ctx.quadraticCurveTo(4.4, 4.2, 4.4, -0.4);
    ctx.moveTo(0, 4.2);
    ctx.lineTo(0, 6.4);
    ctx.stroke();
    ctx.strokeStyle = env.c(U.lighten(p.tint, 0.3), a);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-5.6, -6.2);
    ctx.lineTo(5.6, 6.6);
    ctx.stroke();
    ctx.restore();
  }

  // hello: sparkles pop beside the winking eye. No words, so it reads the same in every language.
  const POP_COL = U.rgb('#FFF4CC');
  function pop(ctx, p, env, a, A) {
    const x = p.loopT;
    const [bx, by] = A.badge;
    const stars = [
      [0.68, -7, 7, 3.4],
      [0.8, 2, -2, 4.6],
      [0.92, 8, 8, 2.8],
    ];
    for (let i = 0; i < stars.length; i++) {
      const [t0, dx, dy, r] = stars[i];
      const s = U.easeOutBack(U.clamp((x - t0) / 0.2)) * (1 - U.smoothstep(t0 + 0.42, t0 + 0.7, x));
      if (s < 0.02) continue;
      ctx.save();
      ctx.translate(bx + dx, by + dy + 5);
      ctx.rotate(0.35 * (1 - s) + i * 0.4);
      F.glow(ctx, 0, 0, r * 2.6 * s, POP_COL, 0.4 * a, env);
      ctx.fillStyle = env.c(POP_COL, a);
      ctx.beginPath();
      U.star4(ctx, 0, 0, r * s);
      ctx.fill();
      ctx.restore();
    }
  }

  function hearts(ctx, p, env, a, A) {
    const L = K.state('love').loop;
    const col = U.lighten(p.tint, 0.15);
    for (let i = 0; i < 4; i++) {
      const u = fract(p.tt / L + i / 4);
      const al = a * Math.sin(u * Math.PI);
      if (al < 0.02) continue;
      const side = i % 2 ? 1 : -1;
      const x = A.x + side * (A.side + 2 + 3 * U.hash(i + 4)) + 2 * Math.sin(u * TAU + i);
      const y = A.y + 6 - u * 30;
      ctx.fillStyle = env.c(col, al);
      ctx.beginPath();
      F.heart(ctx, x, y, 2.6 + 1.6 * U.hash(i + 1));
      ctx.fill();
    }
  }

  // wave: a hand beside Bud, raised and waving from the wrist. Bud has no arms, so it floats where one
  // would be, out past its right eye and a little lower, in Bud's own color: a palm, four fingers and
  // the thumb toward Bud. It pops up as the wave starts, then waves four times a loop.
  function hand(ctx, p, env, a, A) {
    const L = K.state('wave').loop;
    const up = U.easeOutBack(clamp(p.tt / 0.4));
    const col = U.lighten(p.tint, 0.08);
    ctx.save();
    ctx.translate(A.x + A.side + 8, A.sideY + 16); // the wrist
    ctx.rotate(0.12 + 0.34 * Math.sin((TAU * 4 * p.loopT) / L) * smoothstep(0.15, 0.45, p.tt)); // leaning out a little, waving
    ctx.scale(1.05 * up, 1.05 * up);
    F.glow(ctx, 0, -12, 15, col, 0.3 * a, env);
    ctx.fillStyle = env.c(col, a);
    ctx.beginPath();
    U.rr(ctx, -5.5, -13, 11, 10.5, 4);
    ctx.fill();
    for (const [x, len, tilt] of [[-4.1, 6.6, -0.16], [-1.4, 8, -0.05], [1.4, 7.6, 0.05], [4.1, 6, 0.17]]) {
      ctx.save();
      ctx.translate(x, -11.5);
      ctx.rotate(tilt);
      ctx.beginPath();
      U.rr(ctx, -1.25, -len, 2.5, len + 1.5, 1.25);
      ctx.fill();
      ctx.restore();
    }
    ctx.translate(-4.8, -6.5);
    ctx.rotate(-0.95);
    ctx.beginPath();
    U.rr(ctx, -1.35, -6, 2.7, 6.8, 1.35);
    ctx.fill();
    ctx.restore();
  }

  const DRAWERS = { waves, dots, sparkles, burst, rec: recDot, zzz, battery, sweat, bang, check, question, bolt: charging, micoff, pop, hearts, hand };
  const ORDER = ['burst', 'waves', 'dots', 'sparkles', 'rec', 'zzz', 'battery', 'sweat', 'bang', 'check', 'question', 'bolt', 'micoff', 'pop', 'hearts', 'hand'];

  /** Draw a pose's overlays at overall alpha `alpha` (used to cross-fade during state changes). */
  function draw(ctx, pose, env, alpha, anchors) {
    if (alpha <= 0.01) return;
    const A = Object.assign({}, DEFAULT_ANCHORS, anchors || {});
    for (let i = 0; i < ORDER.length; i++) {
      const key = ORDER[i];
      const v = pose.fx[key];
      if (v && v > 0.01) {
        ctx.save();
        DRAWERS[key](ctx, pose, env, v * alpha, A);
        ctx.restore();
      }
    }
  }

  /* ------------------------------------------------------- ambient particles */

  /** Ambient particles a look can add, in outfit code order (code 1 first). */
  K.AMBIENTS = [];
  const LAYERS = Object.create(null);
  /** An ambience: code is its outfit code, def its K.AMBIENTS entry, layers its back() and front(). */
  K.registerAmbient = function (code, def, layers) {
    K.addRanked(K.AMBIENTS, def, code);
    LAYERS[def.id] = layers;
    return def;
  };

  // env.rate(hz) snaps a rate to whole cycles per loop when exporting sprites, so ambient
  // motion loops seamlessly too; live it returns hz unchanged.
  function ambient(ctx, kind, t, env, layer) {
    const B = env.bounds;
    const W = B.x1 - B.x0;
    const H = B.y1 - B.y0;
    const rate = env.rate || ((hz) => hz);
    const wave = (hz, ph) => Math.sin(TAU * (rate(hz) * t + (ph || 0)));
    ctx.save();
    // each ambience draws itself (lib/ambients/<id>.js), behind Bud, in front or both
    const draw = LAYERS[kind] && LAYERS[kind][layer];
    if (draw) draw(ctx, t, env, { B, W, H, rate, wave });
    ctx.restore();
  }

  /* ---------------------------------------------------- transition overlays */

  // Stage-space extras for the designed moves in transitions.js (the screen-edge ring for
  // "save" lives in screen.js because it follows the screen shape).
  const TRANSITION_FX = {
    flare(ctx, fr, env, A) {
      const u = fr.u;
      const col = U.lighten(fr.poseA ? fr.poseA.tint : fr.pose.tint, 0.15);
      const tx = A.x;
      const ty = A.top + 6;
      const ember = fr.poseA && 'orbitR' in fr.poseA.ex;
      if (!ember && u < 0.45) {
        const g = U.easeIn(u / 0.45);
        for (let i = 0; i < 3; i++) {
          const sx = A.badge[0] - 6 + i * 6.2;
          const sy = A.badge[1] + 2;
          ctx.fillStyle = env.c(col, 1 - 0.3 * g);
          ctx.beginPath();
          ctx.arc(U.lerp(sx, tx, g), U.lerp(sy, ty, g), 2.5 * (1 - 0.5 * g), 0, TAU);
          ctx.fill();
        }
      }
      const fl = U.hop(u, 0.38, 0.72);
      if (fl > 0.01) F.glow(ctx, A.x, A.y - 4, 18 + 30 * fl, U.WHITE, 0.55 * fl, env);
      if (u > 0.42 && u < 0.9) {
        const v = (u - 0.42) / 0.48;
        ctx.strokeStyle = env.c(U.lighten(fr.pose.tint, 0.3), 0.9 * (1 - v));
        ctx.lineWidth = 3 * (1 - v) + 0.4;
        ctx.beginPath();
        ctx.arc(A.x, A.y - 4, 14 + 32 * U.easeOut(v), 0, TAU);
        ctx.stroke();
      }
    },
    gather(ctx, fr, env, A) {
      const u = fr.u;
      if (u > 0.75) return;
      const col = U.lighten(fr.poseA ? fr.poseA.tint : fr.pose.tint, 0.1);
      ctx.lineCap = 'round';
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 3; i++) {
          const v = U.clamp(u / 0.75 + i * 0.12);
          const r = 16 - 13 * U.easeIn(v);
          const al = (1 - v) * U.smoothstep(0, 0.1, u);
          if (al < 0.02 || r < 1) continue;
          ctx.strokeStyle = env.c(col, al);
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          const a0 = side > 0 ? -0.72 : Math.PI - 0.72;
          ctx.arc(A.x + side * (A.side + 2), A.sideY, r, a0, a0 + 1.44);
          ctx.stroke();
        }
      }
    },
    mute(ctx, fr, env, A) {
      const u = fr.u;
      const g = U.smoothstep(0.15, 0.6, u);
      const al = 1 - U.smoothstep(0.75, 1, u);
      if (g < 0.01 || al < 0.01) return;
      ctx.strokeStyle = env.c(U.lighten(K.tint(env.theme, 'privacy'), 0.35), al);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(A.x - 22, A.y - 24);
      ctx.lineTo(A.x - 22 + 44 * g, A.y - 24 + 46 * g);
      ctx.stroke();
    },
    plug(ctx, fr, env, A) {
      const a = U.hop(fr.u, 0.05, 0.5);
      if (a < 0.02) return;
      F.glow(ctx, A.x, A.y - 4, 30, K.tint(env.theme, 'charging'), 0.5 * a, env);
      ctx.fillStyle = env.c(U.lighten(K.tint(env.theme, 'charging'), 0.4), a);
      ctx.beginPath();
      bolt(ctx, A.x, A.y - 4, 10 + 6 * a);
      ctx.fill();
    },
    swoon(ctx, fr, env, A) {
      const v = U.clamp((fr.u - 0.2) / 0.7);
      if (v <= 0 || v >= 1) return;
      const col = U.lighten(K.tint(env.theme, 'love'), 0.15);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + 0.5;
        const d = 12 + 26 * U.easeOut(v);
        ctx.fillStyle = env.c(col, 1 - v);
        ctx.beginPath();
        F.heart(ctx, A.x + Math.cos(ang) * d, A.y - 4 + Math.sin(ang) * d * 0.85, 2.6 * (1 - 0.4 * v));
        ctx.fill();
      }
    },
    greet(ctx, fr, env, A) {
      const v = U.clamp((fr.u - 0.08) / 0.7);
      if (v <= 0 || v >= 1) return;
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i - 2) * 0.55;
        const d = 22 + 14 * U.easeOut(v);
        ctx.fillStyle = env.c(i % 2 ? U.WHITE : [255, 226, 140], 1 - v);
        ctx.beginPath();
        U.star4(ctx, A.x + Math.cos(ang) * d, A.y - 4 + Math.sin(ang) * d, 3.2 * (1 - v) + 0.6);
        ctx.fill();
      }
    },
    wake(ctx, fr, env, A) {
      const a = U.hop(fr.u, 0.12, 0.62);
      if (a < 0.02) return;
      ctx.strokeStyle = env.c([236, 236, 242], a);
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      [-0.55, 0, 0.55].forEach((ang) => {
        const x = A.x + Math.sin(ang) * 4;
        const y = A.top + 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.sin(ang) * 3, y - Math.cos(ang) * 3);
        ctx.lineTo(x + Math.sin(ang) * (6 + 3 * a), y - Math.cos(ang) * (6 + 3 * a));
        ctx.stroke();
      });
    },
  };

  /** Draw the stage-space overlay of a running transition (fr = { tr, u, pose, poseA, poseB }). */
  function transition(ctx, fr, env, anchors) {
    if (!fr || !fr.tr) return;
    const fn = TRANSITION_FX[fr.tr.id];
    if (!fn) return;
    ctx.save();
    fn(ctx, fr, env, Object.assign({}, DEFAULT_ANCHORS, anchors || {}));
    ctx.restore();
  }

  K.FX = { draw, ambient, transition, DEFAULT_ANCHORS, ORDER };
})(window.Bud);
