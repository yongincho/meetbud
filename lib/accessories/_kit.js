/* The wardrobe's kit: what the accessory files share, and the lists they join.
 *
 * Each accessory (an item Bud can wear) is one file, lib/accessories/<slot>/<id>.js, that draws
 * it and registers it: K.registerBuiltin for the 20 built-ins, by outfit code (Bud draws those
 * itself), K.registerFind for the place finds and K.registerReward for the rewards, by their place
 * in K.FINDS and K.REWARDS. A factory that makes several items keeps them in one file (school
 * scarves, pennants, snow globes). Copy _template.js to add one, then run node tools/lib-files.mjs.
 *
 * Characters decide where things go by calling env.acc(ctx, slot, anchor) while they draw, with
 * anchor = { x, y, w, rot } in their own local coordinates:
 *   head: bottom-center of where a hat sits, w = head width (optional ear: [dx, dy] from
 *         the anchor to where headphone cups go)
 *   face: center between the eyes, dx = half the eye spacing, rx/ry = one eye's half size
 *   neck: center of where a scarf wraps, w = width to wrap
 *   item: where a held item hangs, w = scale (1 = about 13 stage units tall)
 * The looks (K.PACKS) are in lib/looks.js, the ambiences in lib/ambients/.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;

  const C = {
    pumpkin: U.rgb('#FF8A1F'),
    pumpkinDark: U.rgb('#D96400'),
    stem: U.rgb('#4E8F2E'),
    carve: U.rgb('#FFE066'),
    gat: U.rgb('#23232B'),
    gatEdge: U.rgb('#A9A9BC'),
    bead: U.rgb('#E8C07A'),
    petal: U.rgb('#FFB7CF'),
    petalDeep: U.rgb('#FF5C8A'),
    witch: U.rgb('#6B4BD8'),
    witchBand: U.rgb('#FF9A2E'),
    lanternBlue: U.rgb('#2F5DA8'),
    lanternRed: U.rgb('#D9452B'),
    gold: U.rgb('#F2C14E'),
    light: U.rgb('#FFE7A0'),
    pouch: U.rgb('#E8402E'),
    pouchDark: U.rgb('#B52A1E'),
    saekdong: ['#E8402E', '#F2C14E', '#2E8B6E', '#2F5DA8', '#F28AB2'].map(U.rgb),
    earPink: U.rgb('#FF9EBB'),
    gemRed: U.rgb('#E5484D'),
    gemBlue: U.rgb('#4AA8FF'),
    phones: U.rgb('#ECECF2'),
    lens: U.rgb('#14161C'),
    cup: U.rgb('#F7F3EC'),
    sleeve: U.rgb('#B07A4F'),
    canopyRib: U.rgb('#FFFFFF'),
    // place finds
    bridge: U.rgb('#E8542C'),
    water: U.rgb('#2F5DA8'),
    beret: U.rgb('#D9302F'),
    copper: U.rgb('#5FB8A2'),
    flame: U.rgb('#FFB547'),
    jade: U.rgb('#7FD1AE'),
    lock: U.rgb('#FF5C8A'),
    steel: U.rgb('#C9CDD6'),
    stick: U.rgb('#C99A5B'),
    dangoPink: U.rgb('#FFA3C4'),
    dangoGreen: U.rgb('#9BD67A'),
    busby: U.rgb('#1C1C22'),
    plume: U.rgb('#E5484D'),
    leiPetals: ['#FF7EB3', '#FFD84D', '#FFFFFF', '#FF9A2E', '#C78BFF'].map(U.rgb),
    board: U.rgb('#F7F3EC'),
    boardStripe: U.rgb('#2BB3A3'),
    cap: U.rgb('#C8102E'),
    duck: U.rgb('#FFD84D'),
    beak: U.rgb('#FF9A2E'),
    tea: U.rgb('#B5651D'),
    crimson: U.rgb('#A51C30'),
    rocket: U.rgb('#ECECF2'),
    fin: U.rgb('#E5484D'),
    flamingo: U.rgb('#FF8FB1'),
    straw: U.rgb('#E9C77B'),
    fan: U.rgb('#FF6F91'),
    bread: U.rgb('#D99A4E'),
    cupRed: U.rgb('#E8402E'),
    noodle: U.rgb('#F6D58C'),
    // Christmas
    santa: U.rgb('#D92B3A'),
    santaDark: U.rgb('#A51D2C'),
    fur: U.rgb('#FBF8F2'),
    furShade: U.rgb('#DCD6CC'),
    beard: U.rgb('#EEE8DE'),
    gift: U.rgb('#2F9E5B'),
    giftDark: U.rgb('#23784A'),
  };

  /** Gentle sway; loop-safe when exporting sprites (env.wave), plain sine otherwise. */
  function sway(env, k, ph) {
    return env.wave ? env.wave(k / TAU, (ph || 0) / TAU) : Math.sin(env.t * k + (ph || 0));
  }

  function begin(ctx, a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    if (a.rot) ctx.rotate(a.rot);
  }

  /** A five-petal blossom (the blossom hat, the cherry branch). */
  function flower(ctx, x, y, r, env, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = env.c(C.petal);
    for (let i = 0; i < 5; i++) {
      ctx.rotate(TAU / 5);
      ctx.beginPath();
      U.ellipse(ctx, 0, -r * 0.62, r * 0.42, r * 0.6);
      ctx.fill();
    }
    ctx.fillStyle = env.c(C.petalDeep);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** One lens's half width and half height, for glasses at the face anchor. */
  function lensSize(a) {
    const lw = Math.min(a.rx * 1.25 + 1, a.dx - 1.5);
    return [lw, a.ry + 1];
  }

  /** The knit scarf (built-in 13) in the theme's scarf colors; the school and tartan scarves wear it in theirs. */
  function scarf(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const hw = w / 2;
    const bh = Math.max(4, w * 0.2);
    begin(ctx, a);
    const sw = sway(env, 2.1) * 0.12;
    ctx.save();
    ctx.translate(hw * 0.45, bh * 0.4);
    ctx.rotate(0.18 + sw);
    ctx.fillStyle = env.c(U.darken(col.scarf, 0.08));
    ctx.beginPath();
    U.rr(ctx, -bh * 0.42, 0, bh * 0.84, bh * 2.1, bh * 0.25);
    ctx.fill();
    ctx.fillStyle = env.c(col.scarf2);
    ctx.fillRect(-bh * 0.42, bh * 0.9, bh * 0.84, bh * 0.28);
    ctx.strokeStyle = env.c(U.darken(col.scarf, 0.08));
    ctx.lineWidth = Math.max(0.5, bh * 0.1);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * bh * 0.26, bh * 2.05);
      ctx.lineTo(i * bh * 0.26, bh * 2.45);
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-hw, -bh / 2);
    ctx.quadraticCurveTo(0, bh * 0.35, hw, -bh / 2);
    ctx.lineTo(hw, bh / 2);
    ctx.quadraticCurveTo(0, bh * 1.35, -hw, bh / 2);
    ctx.closePath();
    ctx.fillStyle = env.c(col.scarf);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = env.c(col.scarf2);
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(i * hw * 0.42 - bh * 0.14, -bh, bh * 0.28, bh * 3);
    }
    ctx.restore();
    ctx.fillStyle = env.c(U.darken(col.scarf, 0.12));
    ctx.beginPath();
    U.ellipse(ctx, hw * 0.45, bh * 0.45, bh * 0.42, bh * 0.38);
    ctx.fill();
    ctx.restore();
  }

  /** Five-point star. */
  function star5(ctx, x, y, r, inner = 0.48) {
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * inner : r;
      const t = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i) ctx.lineTo(x + rad * Math.cos(t), y + rad * Math.sin(t));
      else ctx.moveTo(x + rad * Math.cos(t), y + rad * Math.sin(t));
    }
    ctx.closePath();
  }

  const P = {
    ink: U.rgb('#1B1B22'),
    orange: U.rgb('#F2742B'),
    yale: U.rgb('#1F3A6B'),
    columbia: U.rgb('#8DBCE8'),
    cardinal: U.rgb('#9B1C24'),
    berkeley: U.rgb('#1D3E7A'),
    tartanGreen: U.rgb('#1F6B45'),
    tartanRed: U.rgb('#C7333A'),
    tartanGold: U.rgb('#F2C14E'),
    glass: U.rgb('#CFE8FF'),
    sky: U.rgb('#9FD3F2'),
    night: U.rgb('#26305A'),
    sand: U.rgb('#E9C27B'),
    snowcap: U.rgb('#F4F7FB'),
    mountain: U.rgb('#5B6FB8'),
    clay: U.rgb('#C8643B'),
    wood: U.rgb('#B98A55'),
    woodDark: U.rgb('#8A5E33'),
    brass: U.rgb('#D9A441'),
    bronze: U.rgb('#A8743A'),
    leaf: U.rgb('#58B368'),
    leafDark: U.rgb('#2F7D47'),
    pink: U.rgb('#FF8FB1'),
    cream: U.rgb('#FFF4DC'),
    crust: U.rgb('#D9973F'),
    crustDark: U.rgb('#A8651F'),
    sauce: U.rgb('#D93A2B'),
    cheese: U.rgb('#FFD45E'),
    rice: U.rgb('#FBFAF5'),
    nori: U.rgb('#1E3B2A'),
    tea: U.rgb('#C98A4B'),
    matcha: U.rgb('#8CC152'),
    mint: U.rgb('#5DC08A'),
    stone: U.rgb('#8C8F98'),
    gray: U.rgb('#9AA0AA'),
    tan: U.rgb('#D6A46B'),
    sea: U.rgb('#3FA7D6'),
    navy: U.rgb('#24325F'),
    red: U.rgb('#E2433B'),
    yellow: U.rgb('#FFD84D'),
    purple: U.rgb('#9B6BD8'),
    blue: U.rgb('#4A8FE7'),
  };
  const WHITE = U.WHITE;

  /** A held item: at the hand, swaying a little, scaled. Ends with ctx.restore(). */
  function hold(ctx, a, env, k = 2, amp = 0.4) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, k) * amp);
    ctx.scale(s, s);
  }
  /** Fills the path `draw` makes, in one color. */
  function paint(ctx, env, col, draw, alpha) {
    ctx.fillStyle = env.c(col, alpha);
    ctx.beginPath();
    draw();
    ctx.fill();
  }
  /** Strokes the path `draw` makes, round-ended. */
  function ink(ctx, env, col, width, draw, alpha) {
    ctx.strokeStyle = env.c(col, alpha);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    draw();
    ctx.stroke();
  }
  /** A soft highlight. */
  function gleam(ctx, env, x, y, rx, ry, rot = 0, alpha = 0.32) {
    paint(ctx, env, WHITE, () => U.ellipse(ctx, x, y, rx, ry, rot), alpha);
  }
  /** Rising steam, two wisps. */
  function steam(ctx, env, y, gap = 2.4) {
    for (let i = 0; i < 2; i++) {
      const x0 = -gap / 2 + i * gap;
      const k = sway(env, 2.6, i * 2.2);
      ink(ctx, env, WHITE, 0.7, () => {
        ctx.moveTo(x0, y);
        ctx.bezierCurveTo(x0 + 1.3 * k, y - 1.5, x0 - 1.3 * k, y - 2.7, x0 + 0.5 * k, y - 4.2);
      }, 0.45);
    }
  }

  // A cup of something hot, or cold, by the place it's from.
  function steamingCup(ctx, a, env, body, top, wisps = true) {
    hold(ctx, a, env, 2, 0.3);
    if (wisps) steam(ctx, env, -4.8);
    body();
    top();
    ctx.restore();
  }

  /** Two little eyes (and a shine), for a plush face. */
  function plushEyes(ctx, env, x, y, gap, r) {
    for (const s of [-1, 1]) {
      paint(ctx, env, C.lens, () => ctx.arc(x + s * gap, y, r, 0, TAU));
      paint(ctx, env, WHITE, () => ctx.arc(x + s * gap - r * 0.3, y - r * 0.35, r * 0.35, 0, TAU), 0.9);
    }
  }
  /** Two pink cheeks, for a plush face. */
  function blush(ctx, env, x, y, gap, r) {
    paint(ctx, env, C.earPink, () => {
      U.ellipse(ctx, x - gap, y, r, r * 0.55);
      U.ellipse(ctx, x + gap, y, r, r * 0.55);
    }, 0.6);
  }

  /* ------------------------------------------------------------- the lists */

  const DRAW = { head: {}, face: {}, neck: {}, item: {} };

  /** Draw whatever the current outfit puts in `slot`. Called by characters via env.acc. */
  function drawSlot(ctx, slot, anchor, env, acc) {
    const id = acc && acc[slot];
    const fn = id && DRAW[slot] && DRAW[slot][id];
    if (!fn) return false;
    ctx.save();
    fn(ctx, anchor, env);
    ctx.restore();
    return true;
  }

  /** The wardrobe's slots. An outfit wears one item per slot; the looks (lib/looks.js) are preset outfits. */
  K.SLOTS = [
    { id: 'head', label: 'Head' },
    { id: 'face', label: 'Face' },
    { id: 'neck', label: 'Neck' },
    { id: 'item', label: 'Holding' },
  ];
  /** The 20 built-ins, in outfit code order (code 1 first): the accessories Bud draws itself. */
  K.ACCESSORIES = [];

  /** Pieces earned: Best buds with friends, when a friend you invited joins Bud and you become
   * friends (both get it), and Santa's (how: 'christmas'), which the wardrobe has all year. Not in
   * ACCESSORIES: the wardrobe shows them once earned. */
  K.REWARDS = [];

  /** Place finds: a piece you get by visiting its place (within radius meters), for a Bud
   * passport. Not in ACCESSORIES: the wardrobe shows them once found. */
  K.FINDS = [];

  function add(list, rank, def, draw) {
    K.addRanked(list, def, rank);
    DRAW[def.slot][def.id] = draw;
    return def;
  }
  /** A built-in: code is its outfit code (1 to 20, what Bluetooth sends), def its K.ACCESSORIES entry. */
  K.registerBuiltin = (code, def, draw) => add(K.ACCESSORIES, code, def, draw);
  /** A place find: order is its place in K.FINDS (1 first), def its entry (with `place`). */
  K.registerFind = (order, def, draw) => add(K.FINDS, order, def, draw);
  /** A reward: order is its place in K.REWARDS, def its entry (with `how`). */
  K.registerReward = (order, def, draw) => add(K.REWARDS, order, def, draw);

  K.accessory = (id) => K.ACCESSORIES.find((a) => a.id === id) || K.FINDS.find((a) => a.id === id) || null;

  /** Turn the explorer's accessory list (['beanie', 'scarf']) into slot form; the last piece per slot wins. */
  K.accFromToggles = function (ids) {
    const out = {};
    (ids || []).forEach((id) => {
      const a = K.ACCESSORIES.find((x) => x.id === id);
      if (a) out[a.slot] = a.id;
    });
    return out;
  };

  K.AccKit = { C, sway, begin, flower, lensSize, scarf, star5, P, WHITE, hold, paint, ink, gleam, steam, steamingCup, plushEyes, blush };
  K.Acc = { DRAW, drawSlot };
})(window.Bud);
