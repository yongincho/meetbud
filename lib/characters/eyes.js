/* Eyes ("Bud"): two expressive eyes and a little horn that doubles as a status light.
 *
 * The chosen direction. Everything reads from the eyes: lids for mood, shape for
 * emotion (happy arcs, hearts, a wink), size and position for attention. The horn tip
 * glows in the state color and perks up or droops with the mood. A small mouth shows
 * only when it has something to do: a rounded one that bounces open as Bud talks (or pants
 * when it's hot), a wavy one when it's dizzy or cold; otherwise there is no mouth.
 * firmware/core/face.cpp draws the same shapes on Bud's screen.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { TAU, mix, clamp, lerp } = U;

  const W0 = 22;
  const H0 = 30;
  const R0 = 10;
  const GAP = 18.5;
  const CY = 2; // eye line on the stage

  const exDefaults = () => ({ voice: 0, h: 1, round: 0, horn: 0, perk: 0, droop: 0, talk: 0, wave: 0, spiral: 0, cold: 0, hot: 0 });
  const MOUTH_Y = H0 / 2 + 4.5; // the mouth's top, under the eyes (above a neck piece's bow)
  const COLD_CHEEK = U.rgb('#A8DCFF');
  const HOT_CHEEK = U.rgb('#FF7A6B');

  function rectEye(ctx, p, env, side, col, e, pal) {
    const L = F.lids(p, side);
    const es = side < 0 ? p.eyeL : p.eyeR;
    const hp = Math.max(p.happy, side < 0 ? p.winkL : p.winkR);
    const wide = 1 + 0.14 * p.wide;
    const persp = p.lookX * side;
    const blinkBulge = 1 + 0.1 * (1 - p.eyeOpen);
    let w = W0 * wide * es * blinkBulge * (1 + 0.07 * persp);
    let h = H0 * wide * es * e.h * (1 + 0.05 * persp) * (1 - 0.3 * hp);
    if (L.asym < 0) h *= 1 - L.asym * 0.15;
    const r = lerp(R0, Math.min(w, h) / 2, e.round);
    const cx = side * GAP * (1 + 0.1 * p.wide) + p.lookX * 6;
    const cy = p.lookY * 5 - hp * 2;
    const open = Math.max(0.09, p.eyeOpen);
    const shut = Math.max(p.closed, p.heart);

    if (shut < 0.99) {
      ctx.save();
      ctx.globalAlpha *= clamp(1 - shut * 1.5);
      const hh = h * open;
      F.lidClip(ctx, cx, cy, w / 2, hh / 2, L.top, L.slope, L.bot);
      if (hp > 0.01) {
        const rr = w * 0.62;
        const d = hh * 0.62 * hp;
        ctx.beginPath();
        ctx.rect(cx - w, cy - hh, w * 2, hh * 2 + rr * 2);
        ctx.arc(cx, cy + hh / 2 + rr - d, rr, 0, TAU);
        ctx.clip('evenodd');
      }
      const g = ctx.createLinearGradient(0, cy - hh / 2, 0, cy + hh / 2);
      g.addColorStop(0, env.c(U.lighten(col, 0.22)));
      g.addColorStop(1, env.c(col));
      ctx.beginPath();
      U.rr(ctx, cx - w / 2, cy - hh / 2, w, hh, Math.min(r, hh / 2));
      ctx.fillStyle = g;
      ctx.fill();
      if (open > 0.5 && hp < 0.5) {
        const hs = w * 0.21 * (0.9 + 0.12 * p.sparkle);
        ctx.fillStyle = env.c(U.WHITE, 0.88);
        ctx.beginPath();
        U.rr(ctx, cx - w * 0.31 + p.lookX * 1.5, cy - hh * 0.33, hs, hs, hs * 0.38);
        ctx.fill();
        ctx.fillStyle = env.c(U.WHITE, 0.55);
        ctx.beginPath();
        ctx.arc(cx + w * 0.2 + p.lookX * 1.2, cy + hh * 0.26, w * 0.065, 0, TAU);
        ctx.fill();
        if (p.sparkle > 1.15) {
          ctx.globalAlpha *= clamp((p.sparkle - 1.15) / 0.4);
          ctx.fillStyle = env.c(U.WHITE, 0.9);
          ctx.beginPath();
          ctx.arc(cx + w * 0.12, cy - hh * 0.05, hs * 0.3, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    if (p.closed > 0.01) {
      ctx.save();
      ctx.globalAlpha *= clamp(p.closed * 1.4);
      ctx.strokeStyle = env.c(col);
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.42, cy + 2);
      ctx.quadraticCurveTo(cx, cy + 8, cx + w * 0.42, cy + 2);
      ctx.stroke();
      ctx.restore();
    }
    if (p.heart > 0.01) {
      const beat = 1 + 0.06 * (p.sy - 1) * 10;
      const s = W0 * 0.62 * es * beat;
      const hc = mix(K.tint(env.theme, 'love'), pal.eye, 0.12);
      ctx.save();
      ctx.globalAlpha *= clamp(p.heart * 1.4);
      F.glow(ctx, cx, cy, s * 1.8, hc, 0.22, env);
      const hg = ctx.createLinearGradient(0, cy - s, 0, cy + s);
      hg.addColorStop(0, env.c(U.lighten(hc, 0.25)));
      hg.addColorStop(1, env.c(hc));
      ctx.fillStyle = hg;
      ctx.beginPath();
      F.heart(ctx, cx, cy, s);
      ctx.fill();
      ctx.fillStyle = env.c(U.WHITE, 0.8);
      ctx.beginPath();
      U.ellipse(ctx, cx - s * 0.42, cy - s * 0.35, s * 0.2, s * 0.14, -0.6);
      ctx.fill();
      ctx.restore();
    }
  }

  /** The horn: a rounded nub whose tip is Bud's status light. */
  function horn(ctx, p, env, pal, e) {
    const L = K.state(p.state).loop;
    const tilt = 0.22 + 0.05 * e.horn - 0.35 * e.perk * 0.4 + 0.55 * e.droop;
    ctx.save();
    ctx.translate(-1 + p.lookX * 3, -19.5 + p.lookY * 2 - p.wide * 2 - 1.5 * e.perk + 2.5 * e.droop);
    ctx.rotate(tilt);
    ctx.scale(1, 1 + 0.12 * e.perk - 0.15 * e.droop);
    ctx.beginPath();
    ctx.moveTo(-4.2, 2);
    ctx.quadraticCurveTo(-3.9, -4.6, 0.3, -9.2);
    ctx.quadraticCurveTo(2.1, -10.4, 3, -8.4);
    ctx.quadraticCurveTo(4.4, -3.2, 4.2, 2);
    ctx.closePath();
    ctx.fillStyle = env.c(mix(pal.horn, p.tint, p.tintAmt * 0.35));
    ctx.fill();
    // status light: always softly on, pulses at rest, takes the state color otherwise
    const idlePulse = 0.45 + 0.35 * Math.max(0, U.osc(p.tt, L, Math.max(1, Math.round(L / 3))));
    const led = p.tintAmt > 0.05 ? mix(pal.eye, p.tint, p.tintAmt) : pal.eye;
    const ledA = (p.tintAmt > 0.05 ? 0.6 + 0.4 * p.tintAmt : idlePulse) * (1 - 0.6 * e.droop);
    F.glow(ctx, 1.2, -8.1, 7, led, 0.55 * ledA, env);
    ctx.fillStyle = env.c(U.lighten(led, 0.25), ledA);
    ctx.beginPath();
    ctx.arc(1.25, -8.1, 1.7, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /**
   * The talking mouth: a little D, flat on top and round below, that opens as the voice does
   * (p.mouthOpen) and closes to a small smile between words; wide open, a tongue shows.
   */
  function talkMouth(ctx, p, env, col, pal, amt) {
    if (amt < 0.02) return;
    const open = clamp((p.mouthOpen - 0.1) / 0.6);
    const x = p.lookX * 4;
    const y = MOUTH_Y + p.lookY * 3;
    const rx = 4.4 + 1.2 * open;
    const ry = 1.6 + 4.6 * open;
    ctx.save();
    ctx.globalAlpha *= amt;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = env.c(col);
    ctx.fill();
    const tongue = U.smoothstep(0.45, 0.75, open);
    if (tongue > 0.02) {
      ctx.clip();
      ctx.globalAlpha *= tongue;
      ctx.beginPath();
      U.ellipse(ctx, x + 0.4, y + ry * 0.95, rx * 0.58, ry * 0.42);
      ctx.fillStyle = env.c(pal.cheek);
      ctx.fill();
    }
    ctx.restore();
  }

  /** A wavy mouth: slow and loose when dizzy, quick and small when cold (chattering teeth). */
  function wavyMouth(ctx, p, env, col, amt, fast) {
    if (amt < 0.02) return;
    const x = p.lookX * 4;
    const y = MOUTH_Y + 2 + p.lookY * 3;
    const w = 12;
    const amp = fast ? 1.3 : 1.8;
    const shift = p.tt * (fast ? 9 : 2.2);
    ctx.save();
    ctx.globalAlpha *= amt;
    ctx.strokeStyle = env.c(col);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const px = x - w / 2 + (w * i) / 4;
      const py = y + (i % 2 ? -amp : amp) * Math.cos(Math.PI * shift) * (i === 0 || i === 4 ? 0.5 : 1);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Dizzy: each eye a spiral turning in place. */
  function spiralEye(ctx, p, env, side, col, amt) {
    if (amt < 0.02) return;
    const cx = side * GAP + p.lookX * 6;
    const cy = p.lookY * 5;
    const turn = p.tt * TAU * 0.9 * side;
    ctx.save();
    ctx.globalAlpha *= amt;
    ctx.strokeStyle = env.c(col);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = turn + u * TAU * 2.25;
      const r = 1 + u * 10.5;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r * 1.12;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Cold (pale blue) or hot (rosy) cheeks, just below the outer corner of each eye. */
  function moodCheeks(ctx, p, env, color, amt) {
    if (amt < 0.02) return;
    ctx.fillStyle = env.c(color, 0.8 * amt);
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      U.ellipse(ctx, s * (GAP + W0 * 0.5) + p.lookX * 6, H0 * 0.5 + 5 + p.lookY * 4, 4.6, 2.5);
      ctx.fill();
    }
  }

  K.registerCharacter({
    id: 'eyes',
    label: 'Eyes',
    kr: '눈',
    tagline: 'Two eyes and a little horn',
    blurb: 'The chosen direction: two expressive eyes and a little horn whose tip is the status light. Everything reads from the eyes, so it stays clear at tiny sizes, and the black around it keeps the screen cheap to run.',
    swatch: ['eye', 'horn', 'cheek'],
    palettes: {
      classic: { eye: '#79F7E6', horn: '#46B9AA', cheek: '#FF8FB1', tint: '#79F7E6', bg: '#0E2230' },
      night: { eye: '#B6A6FF', horn: '#7A6BDE', cheek: '#FF8FC8', tint: '#B6A6FF', bg: '#0D0B22' },
      sakura: { eye: '#FF9EC8', horn: '#D36F9A', cheek: '#FFD3E4', tint: '#FF9EC8', bg: '#2B0F1E' },
      mint: { eye: '#86FFC3', horn: '#46AE7E', cheek: '#FFA3B5', tint: '#86FFC3', bg: '#0B2219' },
      dancheong: { eye: '#FFD34E', horn: '#E8402E', cheek: '#FF8A70', tint: '#FFD34E', bg: '#13305E' },
      mono: { eye: '#FFFFFF', horn: '#A6A6A6', cheek: '#8A8A8A', tint: '#FFFFFF', bg: '#111111' },
    },

    pose(p, state, tt) {
      p.ex = Object.assign(exDefaults(), p.ex);
      const e = p.ex;
      const L = K.state(state).loop;
      e.horn = U.osc(tt, L, 1, 0.2);
      // each state's touches for Bud are in its file (lib/states/<id>.js)
      const touch = K.stateParts(state).eyes;
      if (touch) touch(p, e, tt, L);
      return p;
    },

    fidget(p, id, u) {
      const e = p.ex;
      if (id === 'hop') e.perk = Math.max(e.perk, U.hop(u, 0.1, 0.8));
      if (id === 'yawn') e.droop = Math.max(e.droop, 0.6 * U.win(u, 0.1, 0.78, 0.18));
      if (id === 'look') e.horn += 1.2 * Math.sin(u * Math.PI * 2);
    },

    anchors(p) {
      return { x: p.x, y: p.y + CY, top: p.y - 18, side: GAP + W0 / 2 + 1, sideY: p.y + CY, sweatY: p.y - 10, badge: [25, -28], rec: [-26, -28] };
    },

    draw(ctx, p, pal, env) {
      const e = p.ex;
      const col = mix(pal.eye, p.tint, p.tintAmt * 0.85);
      ctx.save();
      ctx.translate(p.x, p.y + CY);
      ctx.rotate(p.rot);
      ctx.scale(p.sx, p.sy);

      F.glow(ctx, -GAP, 0, 26, col, 0.22 * p.glow, env);
      F.glow(ctx, GAP, 0, 26, col, 0.22 * p.glow, env);

      env.acc(ctx, 'head', { x: p.lookX * 3, y: -21 + p.lookY * 2 - p.wide * 2, w: 46, ear: [34, 21] });
      horn(ctx, p, env, pal, e);

      // cheeks only show when Bud is properly happy (done, a wink, love); faint ones read as smudges
      const joy = Math.max(p.happy, p.winkL, p.winkR, p.heart);
      const cheekA = U.smoothstep(0.3, 0.6, joy) * Math.min(1, p.blush * 1.2) * 0.85;
      if (cheekA > 0.02) {
        ctx.fillStyle = env.c(pal.cheek, cheekA);
        for (let s = -1; s <= 1; s += 2) {
          ctx.beginPath();
          U.ellipse(ctx, s * (GAP + W0 * 0.42) + p.lookX * 6, H0 * 0.5 + 1 + p.lookY * 4, 4.6, 2.5);
          ctx.fill();
        }
      }

      moodCheeks(ctx, p, env, COLD_CHEEK, e.cold);
      moodCheeks(ctx, p, env, HOT_CHEEK, e.hot);
      if (e.spiral < 0.98) {
        ctx.save();
        ctx.globalAlpha *= 1 - e.spiral;
        rectEye(ctx, p, env, -1, col, e, pal);
        rectEye(ctx, p, env, 1, col, e, pal);
        ctx.restore();
      }
      spiralEye(ctx, p, env, -1, col, e.spiral);
      spiralEye(ctx, p, env, 1, col, e.spiral);
      talkMouth(ctx, p, env, col, pal, e.talk);
      wavyMouth(ctx, p, env, col, e.wave, e.cold > e.spiral);

      const wide = 1 + 0.14 * p.wide;
      env.acc(ctx, 'face', { x: p.lookX * 6, y: p.lookY * 5, dx: GAP * (1 + 0.1 * p.wide), rx: (W0 / 2) * wide, ry: (H0 / 2) * wide });
      env.acc(ctx, 'neck', { x: 0, y: 25, w: 44 });
      ctx.restore();
      env.acc(ctx, 'item', { x: p.x - 33, y: p.y + 30, w: 1 });
    },
  });
})(window.Bud);
