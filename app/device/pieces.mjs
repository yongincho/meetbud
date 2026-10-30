// Pieces for Bud's own screen. The app draws every wardrobe piece with canvas calls
// (lib/accessories/); Bud only fills shapes. recordPiece runs a piece's drawer on a canvas that
// keeps what it fills and strokes as Bud's shapes (discs, ellipses, rounded rects, lines and
// polygons of up to 32 points), around the slot's anchor in the slot's own units; encodePiece
// packs them in Bud's piece format (bud-hardware firmware/core/pieces.h), which the device client
// sends in chunks and Bud keeps in flash. Curves are flattened here, so Bud never needs them.
//
// Format 1, little-endian: [0] format, [1] slot (0 head, 1 face, 2 neck, 3 item), [2] colors,
// [3] shapes; each color r, g, b, alpha; each shape its kind, its color's index, then 16-bit
// signed values in 1/64 of a unit:
//   1 disc: x, y, r                       2 ellipse: x, y, rx, ry, angle (1/4096 radian)
//   3 rect: x0, y0, x1, y1, corner radius 4 line: x0, y0, x1, y1, width (round ends)
//   5 polygon: a point count (3 to 32), then x, y for each point

export const PieceFormat = Object.freeze({
  Version: 1, Unit: 64, AngleUnit: 4096, MaxColors: 32, MaxShapes: 128, MaxPoints: 32, MaxBytes: 4064,
});
export const Shape = Object.freeze({ Disc: 1, Ellipse: 2, Rect: 3, Line: 4, Polygon: 5 });
export const SLOTS = ['head', 'face', 'neck', 'item'];
const STORED_PIECE = 0x80000000;

// How closely shapes follow the drawing, in units (Bud's screen shows about 4.7 pixels a unit).
const FLATTEN = 0.04; // curves to straight pieces
const SIMPLIFY = 0.05; // points dropped from an outline
const SIMPLIFY_STROKE = 0.08; // and from a stroke, each of whose pieces Bud draws as a line
// A stroke this wide or more (in units; about 3.5 pixels on Bud) goes as outline polygons instead of
// a line per piece: round rims as rings, without each piece filling its neighbor's pixels again.
const OUTLINE_STROKE = 0.75;
const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- the recording canvas */

const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const invert = (m) => {
  const det = m[0] * m[3] - m[1] * m[2];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
};
const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
// A rotation and one scale (no stretch or shear): circles stay circles.
const similar = (m) => Math.abs(Math.hypot(m[0], m[1]) - Math.hypot(m[2], m[3])) < 1e-6 * Math.hypot(m[0], m[1]) &&
  Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-9;
const upright = (m) => Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9;

const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };
export function parseColor(style) {
  // a gradient's stroke: its middle's color
  if (style && typeof style === 'object' && style.stops) return style.colorAt(0.5);
  const text = String(style).trim().toLowerCase();
  if (NAMED[text]) return NAMED[text];
  let m = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  m = text.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(',').map((p) => parseFloat(p));
    if (parts.length >= 3 && parts.every(Number.isFinite)) return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }
  throw new Error(`Bud cannot fill ${style}`);
}

// A gradient, in the coordinates of the canvas when it fills (as canvas has it). Bud has none, so a
// fill with one becomes bands of its colors (GRADIENT_BANDS of them).
const GRADIENT_BANDS = 4;
class Gradient {
  constructor(kind, args) { this.kind = kind; this.args = args; this.stops = []; }
  addColorStop(offset, color) { this.stops.push({ offset, color }); this.stops.sort((a, b) => a.offset - b.offset); }
  colorAt(t) {
    const stops = this.stops;
    if (!stops.length) return [0, 0, 0, 0];
    if (t <= stops[0].offset) return parseColor(stops[0].color);
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i].offset) {
        const a = parseColor(stops[i - 1].color), b = parseColor(stops[i].color);
        const k = (t - stops[i - 1].offset) / Math.max(1e-9, stops[i].offset - stops[i - 1].offset);
        return a.map((v, j) => v + (b[j] - v) * k);
      }
    }
    return parseColor(stops[stops.length - 1].color);
  }
}

// A path's piece, as canvas builds it: its points on the page, whether it was closed, and the calls
// that made it, so a lone circle, ellipse or rounded rect stays that shape on Bud.
class Subpath {
  constructor(x, y, m, local) {
    this.points = [[x, y]];
    this.closed = false;
    this.ops = [{ op: 'move', m, local }];
  }
}

export class RecordingContext {
  constructor() {
    this.shapes = [];
    this.state = { m: identity(), fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
      lineDash: [], lineDashOffset: 0, lineCap: 'butt', lineJoin: 'miter', clip: null };
    this.stack = [];
    this.paths = [];
    this.miterLimit = 10;
    this.globalCompositeOperation = 'source-over';
  }
  // Canvas state the pieces set and read.
  get fillStyle() { return this.state.fillStyle; }
  set fillStyle(v) { this.state.fillStyle = v; }
  get strokeStyle() { return this.state.strokeStyle; }
  set strokeStyle(v) { this.state.strokeStyle = v; }
  get lineWidth() { return this.state.lineWidth; }
  set lineWidth(v) { if (Number.isFinite(v) && v > 0) this.state.lineWidth = v; }
  get globalAlpha() { return this.state.globalAlpha; }
  set globalAlpha(v) { if (Number.isFinite(v) && v >= 0 && v <= 1) this.state.globalAlpha = v; }
  get lineCap() { return this.state.lineCap; }
  set lineCap(v) { this.state.lineCap = v; }
  get lineJoin() { return this.state.lineJoin; }
  set lineJoin(v) { this.state.lineJoin = v; }
  get lineDashOffset() { return this.state.lineDashOffset; }
  set lineDashOffset(v) { this.state.lineDashOffset = v; }
  setLineDash(dash) { this.state.lineDash = dash.length % 2 ? [...dash, ...dash] : [...dash]; }
  getLineDash() { return [...this.state.lineDash]; }

  save() { this.stack.push({ ...this.state, lineDash: [...this.state.lineDash] }); }
  restore() { if (this.stack.length) this.state = this.stack.pop(); }
  translate(x, y) { this.state.m = multiply(this.state.m, [1, 0, 0, 1, x, y]); }
  scale(x, y) { this.state.m = multiply(this.state.m, [x, 0, 0, y, 0, 0]); }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.state.m = multiply(this.state.m, [c, s, -s, c, 0, 0]); }
  transform(a, b, c, d, e, f) { this.state.m = multiply(this.state.m, [a, b, c, d, e, f]); }
  setTransform(a, b, c, d, e, f) { this.state.m = [a, b, c, d, e, f]; }
  resetTransform() { this.state.m = identity(); }
  createLinearGradient(...args) { return new Gradient('linear', args); }
  createRadialGradient(...args) { return new Gradient('radial', args); }

  beginPath() { this.paths = []; }
  #current() { return this.paths[this.paths.length - 1]; }
  #point(x, y) { return apply(this.state.m, x, y); }
  moveTo(x, y) { const [px, py] = this.#point(x, y); this.paths.push(new Subpath(px, py, this.state.m, [x, y])); }
  #ensure(x, y) { if (!this.#current() || this.#current().closed) this.moveTo(x, y); }
  lineTo(x, y) {
    if (!this.#current() || this.#current().closed) return this.moveTo(x, y);
    this.#current().points.push(this.#point(x, y));
    this.#current().ops.push({ op: 'line' });
  }
  closePath() {
    const sub = this.#current();
    if (!sub || sub.closed) return;
    sub.closed = true;
    sub.ops.push({ op: 'close' });
  }
  #last() { const p = this.#current().points; return p[p.length - 1]; }
  quadraticCurveTo(cx, cy, x, y) {
    this.#ensure(cx, cy);
    const p0 = this.#last(), p1 = this.#point(cx, cy), p2 = this.#point(x, y);
    const dd = Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]);
    const n = Math.min(64, Math.max(1, Math.ceil(Math.sqrt(dd / (4 * FLATTEN)))));
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      this.#current().points.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
    this.#current().ops.push({ op: 'curve' });
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    this.#ensure(c1x, c1y);
    const p0 = this.#last(), p1 = this.#point(c1x, c1y), p2 = this.#point(c2x, c2y), p3 = this.#point(x, y);
    const dd = Math.max(Math.hypot(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1]),
      Math.hypot(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1]));
    const n = Math.min(64, Math.max(1, Math.ceil(Math.sqrt((3 * dd) / (4 * FLATTEN)))));
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      this.#current().points.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    }
    this.#current().ops.push({ op: 'curve' });
  }
  // An ellipse's arc (a circle's when rx = ry), as canvas draws it: a line from the current point to
  // its start, then the arc.
  #arc(x, y, rx, ry, rot, a0, a1, ccw, kind) {
    let sweep = a1 - a0;
    if (!ccw && sweep < 0) sweep = sweep <= -TAU ? TAU : sweep + TAU * Math.ceil(-sweep / TAU);
    if (ccw && sweep > 0) sweep = sweep >= TAU ? -TAU : sweep - TAU * Math.ceil(sweep / TAU);
    if (Math.abs(sweep) > TAU) sweep = Math.sign(sweep) * TAU;
    const full = Math.abs(sweep) >= TAU - 1e-9;
    const local = (t) => {
      const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
      return [x + ex * Math.cos(rot) - ey * Math.sin(rot), y + ex * Math.sin(rot) + ey * Math.cos(rot)];
    };
    const start = local(a0);
    const sub = this.#current();
    if (!sub || sub.closed) this.moveTo(...start);
    else {
      const [px, py] = this.#point(...start), [lx, ly] = this.#last();
      if (Math.hypot(px - lx, py - ly) > 1e-9) this.lineTo(...start);
    }
    const r = Math.max(rx, ry) * scaleOf(this.state.m);
    const step = r > FLATTEN ? 2 * Math.acos(Math.max(-1, 1 - FLATTEN / r)) : Math.PI / 2;
    const n = Math.min(256, Math.max(2, Math.ceil(Math.abs(sweep) / step)));
    for (let i = 1; i <= n; i++) this.#current().points.push(this.#point(...local(a0 + (sweep * i) / n)));
    this.#current().ops.push({ op: kind, full, m: this.state.m, x, y, rx, ry, rot });
  }
  arc(x, y, r, a0, a1, ccw = false) { this.#arc(x, y, r, r, 0, a0, a1, ccw, 'arc'); }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw = false) { this.#arc(x, y, rx, ry, rot, a0, a1, ccw, 'ellipse'); }
  arcTo(x1, y1, x2, y2, r) {
    this.#ensure(x1, y1);
    const [x0, y0] = apply(invert(this.state.m), ...this.#last());
    const ux = x0 - x1, uy = y0 - y1, vx = x2 - x1, vy = y2 - y1;
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    const cross = ux * vy - uy * vx;
    if (!r || !lu || !lv || Math.abs(cross) < 1e-9) {
      this.lineTo(x1, y1);
      this.#current().ops.push({ op: 'corner', x: x1, y: y1, r: 0 });
      return;
    }
    const angle = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv))));
    const d = r / Math.tan(angle / 2);
    const t1 = [x1 + (ux / lu) * d, y1 + (uy / lu) * d], t2 = [x1 + (vx / lv) * d, y1 + (vy / lv) * d];
    const k = r / Math.sin(angle / 2), bx = ux / lu + vx / lv, by = uy / lu + vy / lv, bl = Math.hypot(bx, by);
    const cx = x1 + (bx / bl) * k, cy = y1 + (by / bl) * k;
    const a0 = Math.atan2(t1[1] - cy, t1[0] - cx), a1 = Math.atan2(t2[1] - cy, t2[0] - cx);
    // the shorter way round, from the first tangent point to the second
    const turn = (t1[0] - cx) * (t2[1] - cy) - (t1[1] - cy) * (t2[0] - cx);
    const ops = this.#current().ops.length;
    this.#arc(cx, cy, r, r, 0, a0, a1, turn < 0, 'arc');
    this.#current().ops.splice(ops, this.#current().ops.length - ops, { op: 'corner', x: x1, y: y1, r });
  }
  rect(x, y, w, h) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
    this.#current().ops = [{ op: 'rect', m: this.state.m, x, y, w, h }];
  }
  roundRect(x, y, w, h, r = 0) {
    const radius = Math.max(0, Math.min(Array.isArray(r) ? r[0] || 0 : r, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
  }

  clip() {
    // Bud has no clipping, so shapes are cut to the clip here (to its convex hull: exact for the
    // round and rectangular clips the pieces use).
    const points = this.paths.flatMap((sub) => sub.points);
    if (points.length < 3) return;
    let hull = convexHull(points);
    if (this.state.clip) hull = clipPolygon(hull, this.state.clip);
    this.state.clip = hull;
  }

  fill() {
    if (this.state.fillStyle instanceof Gradient) return this.#gradientFill(this.state.fillStyle);
    const color = this.#color(this.state.fillStyle);
    if (!color) return;
    for (const sub of this.paths) {
      const shape = primitive(sub);
      if (shape && (!this.state.clip || inside(this.state.clip, bounds(shape)))) this.#add({ ...shape, color });
      else this.#polygon(sub.points, color);
    }
  }
  fillRect(x, y, w, h) {
    const paths = this.paths;
    this.paths = [];
    this.rect(x, y, w, h);
    this.fill();
    this.paths = paths;
  }
  stroke() {
    const color = this.#color(this.state.strokeStyle);
    if (!color) return;
    const width = this.state.lineWidth * scaleOf(this.state.m);
    for (const sub of this.paths) {
      let line = sub.points.slice();
      if (sub.closed && line.length > 2) line.push(line[0]);
      line = simplify(line, SIMPLIFY_STROKE);
      const dashed = this.state.lineDash.some((d) => d > 0);
      if (width >= OUTLINE_STROKE && !dashed && !this.state.clip && line.length > 2) {
        const [first, last] = [line[0], line[line.length - 1]];
        const loop = sub.closed || Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6; // a whole circle, say
        const outlines = strokeOutlines(line, loop, width, color[3] === 255);
        if (outlines) {
          for (const points of outlines) this.#add({ kind: Shape.Polygon, points, color });
          if (!loop && this.state.lineCap === 'round') {
            for (const [x, y] of [line[0], line[line.length - 1]]) this.#add({ kind: Shape.Disc, x, y, r: width / 2, color });
          }
          continue;
        }
      }
      for (const [a, b] of dashes(line, this.state.lineDash.map((d) => d * scaleOf(this.state.m)))) {
        const cut = this.state.clip ? clipSegment(a, b, this.state.clip) : [a, b];
        if (cut) this.#add({ kind: Shape.Line, x0: cut[0][0], y0: cut[0][1], x1: cut[1][0], y1: cut[1][1], width, color });
      }
    }
  }
  strokeRect(x, y, w, h) {
    const paths = this.paths;
    this.paths = [];
    this.rect(x, y, w, h);
    this.stroke();
    this.paths = paths;
  }

  // A linear gradient: bands across it, each its middle's color (the ends' colors beyond them). A
  // radial one: discs along its cone from the outer circle in, each with the alpha that makes the
  // layers come to the gradient's at its middle, cut to the path.
  #gradientFill(gradient) {
    const m = this.state.m, n = GRADIENT_BANDS;
    for (const sub of this.paths) {
      const outline = dedupe(sub.points);
      if (outline.length < 3) continue;
      if (gradient.kind === 'linear') {
        const [p0, p1] = [apply(m, gradient.args[0], gradient.args[1]), apply(m, gradient.args[2], gradient.args[3])];
        const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len2 = dx * dx + dy * dy;
        if (!len2) { this.#polygon(outline, this.#color(gradient.colorAt(1))); continue; }
        // Layers, each over the last from its band on (no seam between bands), starting from the
        // more see-through end, with the alpha that makes the layers come to each band's.
        const fromStart = gradient.colorAt(0.5 / n)[3] <= gradient.colorAt(1 - 0.5 / n)[3];
        let below = 0;
        for (let k = 0; k < n; k++) {
          const band = fromStart ? k : n - 1 - k;
          const [red, green, blue, a] = gradient.colorAt((band + 0.5) / n);
          const target = Math.max(0, Math.min(1, a * this.state.globalAlpha));
          const alpha = layerAlpha(target, below);
          below = Math.max(below, target);
          if (alpha < 0.002) continue;
          let layer = outline;
          if (k > 0) { // keep t >= band / n, or t <= (band + 1) / n from the end
            const t = fromStart ? band / n : (band + 1) / n, ox = p0[0] + dx * t, oy = p0[1] + dy * t;
            layer = clipHalfPlane(layer, (p) => ((p[0] - ox) * dx + (p[1] - oy) * dy) * (fromStart ? 1 : -1));
          }
          if (layer.length >= 3) this.#polygon(layer, [Math.round(red), Math.round(green), Math.round(blue), Math.round(alpha * 255)]);
        }
        continue;
      }
      const [x0, y0, r0, x1, y1, r1] = gradient.args;
      const s = scaleOf(m);
      const disc = primitive(sub);
      let below = 0;  // the alpha the outer layers make
      for (let k = 0; k < n; k++) {
        const t = 1 - k / n, mid = 1 - (k + 0.5) / n;
        const [cx, cy] = apply(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), r = (r0 + (r1 - r0) * t) * s;
        const [red, green, blue, a] = gradient.colorAt(mid);
        const target = Math.max(0, Math.min(1, a * this.state.globalAlpha));
        const alpha = layerAlpha(target, below);
        below = Math.max(below, target);
        const color = alpha > 0.002 ? [Math.round(red), Math.round(green), Math.round(blue), Math.round(alpha * 255)] : null;
        if (!color || r <= 0) continue;
        const inPath = disc && disc.kind === Shape.Disc && Math.hypot(disc.x - cx, disc.y - cy) + r <= disc.r + 1e-6;
        if (inPath && (!this.state.clip || inside(this.state.clip, { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }))) {
          this.#add({ kind: Shape.Disc, x: cx, y: cy, r, color });
          continue;
        }
        const ring = Array.from({ length: PieceFormat.MaxPoints }, (_, i) => {
          const a2 = (i / PieceFormat.MaxPoints) * TAU;
          return [cx + r * Math.cos(a2), cy + r * Math.sin(a2)];
        });
        this.#polygon(clipPolygon(outline, ring), color);
      }
    }
  }
  #color(style) {
    const [r, g, b, a] = Array.isArray(style) ? style : parseColor(style);
    const alpha = Math.round(Math.max(0, Math.min(1, a * this.state.globalAlpha)) * 255);
    return alpha ? [Math.round(r), Math.round(g), Math.round(b), alpha] : null;
  }
  #polygon(points, color) {
    let outline = dedupe(points);
    if (this.state.clip) outline = clipPolygon(outline, this.state.clip);
    if (outline.length < 3 || Math.abs(area(outline)) < 1e-4) return;
    // fewer points, a little coarser each time, until Bud's polygon (32 points) holds it
    for (let tolerance = SIMPLIFY; ; tolerance *= 1.5) {
      const simpler = simplifyClosed(outline, tolerance);
      if (simpler.length <= PieceFormat.MaxPoints) {
        if (simpler.length >= 3) this.#add({ kind: Shape.Polygon, points: simpler, color });
        return;
      }
    }
  }
  #add(shape) { this.shapes.push(shape); }
}

// A subpath that is one circle, ellipse, rounded rect or rect, as that shape (null otherwise).
function primitive(sub) {
  const ops = sub.ops.filter((o) => o.op !== 'close');
  const arcs = ops.filter((o) => o.op === 'arc' || o.op === 'ellipse');
  if (ops.length === 2 && ops[0].op === 'move' && arcs.length === 1 && arcs[0].full) {
    const o = arcs[0], m = o.m;
    if (!similar(m)) return null;
    const [x, y] = apply(m, o.x, o.y), s = Math.hypot(m[0], m[1]);
    if (o.rx === o.ry) return { kind: Shape.Disc, x, y, r: o.rx * s };
    return { kind: Shape.Ellipse, x, y, rx: o.rx * s, ry: o.ry * s, angle: o.rot + Math.atan2(m[1], m[0]) };
  }
  if (ops.length === 1 && ops[0].op === 'rect' && upright(ops[0].m)) {
    const o = ops[0];
    const [x0, y0] = apply(o.m, o.x, o.y), [x1, y1] = apply(o.m, o.x + o.w, o.y + o.h);
    return { kind: Shape.Rect, x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), r: 0 };
  }
  // U.rr: a move, then four rounded corners of an upright rect with one radius
  const corners = ops.filter((o) => o.op === 'corner');
  if (ops.length === 5 && ops[0].op === 'move' && corners.length === 4 && sub.closed && upright(ops[0].m) &&
      Math.abs(Math.abs(ops[0].m[0]) - Math.abs(ops[0].m[3])) < 1e-9 && corners.every((c) => c.r === corners[0].r)) {
    const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
    const lx = Math.min(...xs), hx = Math.max(...xs), ly = Math.min(...ys), hy = Math.max(...ys);
    const rect = corners.every((c) => (c.x === lx || c.x === hx) && (c.y === ly || c.y === hy)) &&
      new Set(corners.map((c) => `${c.x},${c.y}`)).size === 4;
    if (rect) {
      const m = ops[0].m;
      const [x0, y0] = apply(m, lx, ly), [x1, y1] = apply(m, hx, hy);
      return { kind: Shape.Rect, x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1),
        r: corners[0].r * Math.abs(m[0]) };
    }
  }
  return null;
}

/* ---------------------------------------------------------------- geometry */

function dedupe(points) {
  const out = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6) out.push(p);
  }
  while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 1e-6) out.pop();
  return out;
}
function area(points) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}
function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
// Douglas-Peucker: the points a line keeps within `tolerance` of the original.
export function simplify(points, tolerance) {
  if (points.length <= 2) return points.slice();
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let worst = -1, at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = distanceToSegment(points[k], points[i], points[j]);
      if (d > worst) { worst = d; at = k; }
    }
    if (worst > tolerance) {
      keep[at] = true;
      stack.push([i, at], [at, j]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
// The same for a closed outline, split at its two farthest-apart points.
function simplifyClosed(points, tolerance) {
  if (points.length <= 3) return points.slice();
  let far = 0, best = -1;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
    if (d > best) { best = d; far = i; }
  }
  const a = simplify(points.slice(0, far + 1), tolerance);
  const b = simplify([...points.slice(far), points[0]], tolerance);
  return dedupe([...a, ...b.slice(1, -1)]);
}
function convexHull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1)); // counterclockwise in y-up terms
}
// Sutherland-Hodgman against a convex clip.
function clipPolygon(subject, clip) {
  let out = subject;
  const sign = Math.sign(area(clip)) || 1;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const side = (p) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length];
      const sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return dedupe(out);
}
// A smooth, wide stroke along a polyline as polygons of up to 32 points: its two sides, offset by
// half its width, in pieces of up to 14 segments that overlap their neighbor by one when the color
// is opaque (no seam shows) and only touch it when not. Null for a turn too sharp for that (the
// inner side would cross itself); the stroke then goes as lines.
function strokeOutlines(points, closed, width, opaque) {
  const half = width / 2;
  const loop = closed && points.length > 3 ? points.slice(0, -1) : points;
  const n = loop.length;
  const segs = closed ? n : n - 1;
  if (segs < 1) return null;
  const normal = (i) => {
    const a = loop[i % n], b = loop[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return len ? { x: -(b[1] - a[1]) / len, y: (b[0] - a[0]) / len, len } : null;
  };
  const normals = Array.from({ length: segs }, (_, i) => normal(i));
  if (normals.some((v) => !v)) return null;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const before = closed ? normals[(i - 1 + segs) % segs] : normals[i - 1];
    const after = closed ? normals[i % segs] : normals[i];
    const a = before || after, b = after || before;
    let mx = a.x + b.x, my = a.y + b.y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-9) return null;
    mx /= ml; my /= ml;
    const cos = mx * a.x + my * a.y; // cos of half the turn
    if (cos < 0.9) return null; // more than about 50 degrees
    // the inner side's corner moves this far along each segment: it must stay inside both
    const along = half * Math.sqrt(Math.max(0, 1 - cos * cos)) / cos;
    if (before && after && along > 0.5 * Math.min(before.len, after.len)) return null;
    const k = half / cos;
    left.push([loop[i][0] + mx * k, loop[i][1] + my * k]);
    right.push([loop[i][0] - mx * k, loop[i][1] - my * k]);
  }
  const step = 14, out = []; // 15 points a side, or 16 with the overlap: Bud's 32 at most
  const at = (i) => i % n;
  for (let start = 0; start < segs; start += step) {
    let end = Math.min(segs, start + step);
    // overlap the next piece by a segment (a loop's last piece overlaps its first)
    if (opaque && (end < segs || (closed && segs > step))) end++;
    const idx = [];
    for (let i = start; i <= end; i++) idx.push(at(i));
    out.push([...idx.map((i) => left[i]), ...idx.reverse().map((i) => right[i])]);
  }
  if (out.some((p) => p.length > PieceFormat.MaxPoints)) return null;
  return out;
}

// A gradient's layer over those below it (which come to `below`): the alpha that brings them to
// `target` there, or opaque (painting over) for an opaque band.
function layerAlpha(target, below) {
  if (target >= 0.999) return 1;
  return target <= below ? 0 : 1 - (1 - target) / (1 - below);
}

// The part of a polygon where side(point) >= 0, for a straight edge.
function clipHalfPlane(subject, side) {
  const out = [];
  for (let j = 0; j < subject.length; j++) {
    const p = subject[j], q = subject[(j + 1) % subject.length];
    const sp = side(p), sq = side(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return dedupe(out);
}
// Cyrus-Beck: the part of a segment inside a convex clip, or null.
function clipSegment(a, b, clip) {
  const sign = Math.sign(area(clip)) || 1;
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (let i = 0; i < clip.length; i++) {
    const p = clip[i], q = clip[(i + 1) % clip.length];
    const nx = -sign * (q[1] - p[1]), ny = sign * (q[0] - p[0]);
    const num = nx * (a[0] - p[0]) + ny * (a[1] - p[1]), den = nx * dx + ny * dy;
    if (Math.abs(den) < 1e-12) { if (num < 0) return null; continue; }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
}
function inside(clip, box) {
  const sign = Math.sign(area(clip)) || 1;
  const corners = [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]];
  return corners.every((c) => clip.every((p, i) => {
    const q = clip[(i + 1) % clip.length];
    return sign * ((q[0] - p[0]) * (c[1] - p[1]) - (q[1] - p[1]) * (c[0] - p[0])) >= -1e-9;
  }));
}
// The dashes of a line, as segments (the whole line's segments with no dash).
function dashes(points, pattern) {
  const out = [];
  if (!pattern.length || pattern.every((d) => d <= 0)) {
    for (let i = 1; i < points.length; i++) out.push([points[i - 1], points[i]]);
    return out;
  }
  let k = 0, left = pattern[0], on = true;
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1];
    const b = points[i];
    let rest = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (rest > 1e-9) {
      const step = Math.min(left, rest), t = step / rest;
      const c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      if (on) out.push([a, c]);
      a = c;
      rest -= step;
      left -= step;
      if (left <= 1e-9) { k = (k + 1) % pattern.length; left = pattern[k]; on = !on; }
    }
  }
  return out;
}
function bounds(shape) {
  switch (shape.kind) {
    case Shape.Disc: return { x0: shape.x - shape.r, y0: shape.y - shape.r, x1: shape.x + shape.r, y1: shape.y + shape.r };
    case Shape.Ellipse: {
      const r = Math.max(shape.rx, shape.ry);
      return { x0: shape.x - r, y0: shape.y - r, x1: shape.x + r, y1: shape.y + r };
    }
    case Shape.Rect: return shape;
    default: return { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
  }
}

/* ---------------------------------------------------------------- recording and the format */

// The anchors the Eyes character gives each slot (lib/characters/eyes.js), at rest: Bud's
// firmware draws a piece at the same places.
export const ANCHORS = {
  head: { x: 0, y: 0, w: 46, ear: [34, 21] },
  face: { x: 0, y: 0, dx: 18.5, rx: 11, ry: 15 },
  neck: { x: 0, y: 0, w: 44 },
  item: { x: 0, y: 0, w: 1 },
};

// Runs `draw(ctx, anchor, env)` for a still frame (time 0) and returns its shapes. env gives the
// drawer what Bud's screen gives it: colors as CSS (env.c) and the theme's accessory colors.
export function recordPiece(draw, slot, { accColors, c } = {}) {
  if (!SLOTS.includes(slot)) throw new RangeError(`Unknown slot ${slot}`);
  const ctx = new RecordingContext();
  const env = {
    t: 0,
    accColors,
    c: c || ((rgb, a = 1) => `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${a})`),
  };
  ctx.save();
  draw(ctx, { ...ANCHORS[slot] }, env);
  ctx.restore();
  return ctx.shapes;
}

const unit = (v) => {
  const q = Math.round(v * PieceFormat.Unit);
  if (q < -32768 || q > 32767) throw new RangeError('A piece reaches too far from its anchor');
  return q;
};

/** Bud's bytes for a piece's shapes. Shapes too faint or small to see are left out. */
export function encodePiece(slot, shapes) {
  const slotIndex = SLOTS.indexOf(slot);
  if (slotIndex < 0) throw new RangeError(`Unknown slot ${slot}`);
  const colors = [];
  const colorIndex = (c) => {
    const key = c.join(',');
    let i = colors.findIndex((x) => x.join(',') === key);
    if (i < 0) {
      if (colors.length === PieceFormat.MaxColors) throw new RangeError('A piece has too many colors for Bud');
      i = colors.push(c) - 1;
    }
    return i;
  };
  const body = [];
  const i16 = (v) => { const q = unit(v); body.push(q & 255, (q >> 8) & 255); };
  let count = 0;
  for (const s of shapes) {
    const start = body.length;
    switch (s.kind) {
      case Shape.Disc:
        if (s.r * PieceFormat.Unit < 1) continue;
        body.push(Shape.Disc, colorIndex(s.color)); i16(s.x); i16(s.y); i16(s.r); break;
      case Shape.Ellipse: {
        if (Math.min(s.rx, s.ry) * PieceFormat.Unit < 1) continue;
        let angle = s.angle % Math.PI;
        if (angle > Math.PI / 2) angle -= Math.PI;
        if (angle < -Math.PI / 2) angle += Math.PI;
        body.push(Shape.Ellipse, colorIndex(s.color)); i16(s.x); i16(s.y); i16(s.rx); i16(s.ry);
        const q = Math.round(angle * PieceFormat.AngleUnit);
        body.push(q & 255, (q >> 8) & 255);
        break;
      }
      case Shape.Rect:
        if ((s.x1 - s.x0) * PieceFormat.Unit < 1 || (s.y1 - s.y0) * PieceFormat.Unit < 1) continue;
        body.push(Shape.Rect, colorIndex(s.color)); i16(s.x0); i16(s.y0); i16(s.x1); i16(s.y1); i16(s.r); break;
      case Shape.Line:
        if (s.width * PieceFormat.Unit < 1) continue;
        body.push(Shape.Line, colorIndex(s.color)); i16(s.x0); i16(s.y0); i16(s.x1); i16(s.y1); i16(s.width); break;
      case Shape.Polygon: {
        const points = dedupe(s.points.map(([x, y]) => [unit(x) / PieceFormat.Unit, unit(y) / PieceFormat.Unit]));
        if (points.length < 3 || points.length > PieceFormat.MaxPoints) continue;
        body.push(Shape.Polygon, colorIndex(s.color), points.length);
        for (const [x, y] of points) { i16(x); i16(y); }
        break;
      }
      default: throw new RangeError(`Unknown shape ${s.kind}`);
    }
    if (body.length > start) count++;
  }
  if (!count) throw new RangeError('A piece with nothing Bud can draw');
  if (count > PieceFormat.MaxShapes) throw new RangeError(`A piece has ${count} shapes; Bud draws at most ${PieceFormat.MaxShapes}`);
  const bytes = new Uint8Array(4 + 4 * colors.length + body.length);
  bytes.set([PieceFormat.Version, slotIndex, colors.length, count]);
  colors.forEach((c, i) => bytes.set(c, 4 + 4 * i));
  bytes.set(body, 4 + 4 * colors.length);
  if (bytes.length > PieceFormat.MaxBytes) throw new RangeError(`A piece of ${bytes.length} bytes; Bud keeps at most ${PieceFormat.MaxBytes}`);
  return bytes;
}

/** The shapes back from Bud's bytes (for tests and checks), or an error for bytes Bud would refuse. */
export function decodePiece(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4 || bytes.length > PieceFormat.MaxBytes) throw new RangeError('Invalid piece size');
  const [version, slotIndex, colorCount, shapeCount] = bytes;
  if (version !== PieceFormat.Version || slotIndex >= SLOTS.length || !colorCount || colorCount > PieceFormat.MaxColors ||
      !shapeCount || shapeCount > PieceFormat.MaxShapes) throw new RangeError('Invalid piece header');
  const colors = [];
  let at = 4;
  for (let i = 0; i < colorCount; i++, at += 4) colors.push([...bytes.subarray(at, at + 4)]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const need = (n) => { if (at + n > bytes.length) throw new RangeError('Truncated piece'); };
  const v = () => { need(2); const q = view.getInt16(at, true); at += 2; return q / PieceFormat.Unit; };
  const shapes = [];
  for (let i = 0; i < shapeCount; i++) {
    need(2);
    const kind = bytes[at], color = bytes[at + 1];
    at += 2;
    if (color >= colorCount) throw new RangeError('Unknown piece color');
    switch (kind) {
      case Shape.Disc: shapes.push({ kind, color: colors[color], x: v(), y: v(), r: v() }); break;
      case Shape.Ellipse: {
        const s = { kind, color: colors[color], x: v(), y: v(), rx: v(), ry: v() };
        s.angle = (v() * PieceFormat.Unit) / PieceFormat.AngleUnit;
        shapes.push(s);
        break;
      }
      case Shape.Rect: shapes.push({ kind, color: colors[color], x0: v(), y0: v(), x1: v(), y1: v(), r: v() }); break;
      case Shape.Line: shapes.push({ kind, color: colors[color], x0: v(), y0: v(), x1: v(), y1: v(), width: v() }); break;
      case Shape.Polygon: {
        need(1);
        const n = bytes[at++];
        if (n < 3 || n > PieceFormat.MaxPoints) throw new RangeError('Invalid polygon');
        const points = [];
        for (let k = 0; k < n; k++) points.push([v(), v()]);
        shapes.push({ kind, color: colors[color], points });
        break;
      }
      default: throw new RangeError('Unknown piece shape');
    }
  }
  if (at !== bytes.length) throw new RangeError('Trailing piece bytes');
  return { slot: SLOTS[slotIndex], shapes };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
/** CRC-32 (the zlib one), as Bud checks a piece before keeping it. */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** A piece's name on Bud: from its bytes (FNV-1a), with the top bit set, so a redrawn piece is a new one. */
export function pieceKey(bytes) {
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return (STORED_PIECE | (h & 0x7fffffff)) >>> 0;
}
