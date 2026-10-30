/* Device mockups: the shell (SVG), the live screen (canvas) and the side profile.
 *
 * DeviceView stacks three layers in a box sized in mm x px-per-mm:
 *   shell SVG (body, ring, screen recess)  ->  Screen canvas  ->  overlay SVG (glass glare, wordmark)
 */
(function (K) {
  'use strict';
  const U = K.util;
  const f = (n) => Math.round(n * 1000) / 1000;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* -------------------------------------------------------------------- paths */

  function rrPath(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    return `M ${f(x + r)} ${f(y)} H ${f(x + w - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V ${f(y + h - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} H ${f(x + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} V ${f(y + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`;
  }
  function ellPath(cx, cy, rx, ry) {
    return `M ${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`;
  }
  function bodyPath(b) {
    return b.type === 'circle' ? ellPath(0, 0, b.w / 2, b.h / 2) : rrPath(-b.w / 2, -b.h / 2, b.w, b.h, b.r || 0);
  }
  function screenPath(sc, grow) {
    grow = grow || 0;
    const w = sc.w + 2 * grow;
    const h = sc.h + 2 * grow;
    const x = sc.x - w / 2;
    const y = sc.y - h / 2;
    const short = Math.min(sc.w, sc.h);
    if (sc.type === 'circle') return ellPath(sc.x, sc.y, w / 2, h / 2);
    if (sc.type === 'arch') {
      const r = Math.min(w / 2, h);
      const br = Math.max(0, (sc.br || 0) * short + grow);
      return `M ${f(x)} ${f(y + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V ${f(y + h - br)} A ${f(br)} ${f(br)} 0 0 1 ${f(x + w - br)} ${f(y + h)} H ${f(x + br)} A ${f(br)} ${f(br)} 0 0 1 ${f(x)} ${f(y + h - br)} Z`;
    }
    return rrPath(x, y, w, h, (sc.r || 0) * short + grow);
  }

  /* ----------------------------------------------------------------- geometry */

  function geometry(formOrId, size) {
    const form = typeof formOrId === 'string' ? K.forms.get(formOrId) || K.forms.list[0] : formOrId;
    const body = form.body(size);
    return {
      form,
      size,
      body,
      screen: form.screen(size),
      w: body.w,
      h: body.h,
      wordmark: form.wordmark ? form.wordmark(size) : null,
      ring: form.ring ? form.ring(size) : null,
      bezel: form.bezel == null ? 0.6 : form.bezel,
      pad: Math.max(3, body.w * 0.14),
    };
  }

  function screenShape(geo) {
    const sc = geo.screen;
    return { type: sc.type, r: sc.r || 0, br: sc.br || 0 };
  }

  function tones(hex, finish) {
    const c = U.rgb(hex || '#F4F1EC');
    const dark = U.luma(c) < 0.38;
    return {
      base: U.hex(c),
      lit: U.hex(U.lighten(c, finish === 'gloss' ? 0.32 : dark ? 0.1 : 0.18)),
      shade: U.hex(U.darken(c, finish === 'gloss' ? 0.14 : 0.1)),
      wall: U.hex(U.darken(c, dark ? 0.38 : 0.3)),
      ink: dark ? '#FFFFFF' : U.hex(U.darken(c, 0.66)),
      inkOpacity: dark ? 0.8 : 0.85,
      dark,
    };
  }

  function metalDefs(id, dark) {
    const stops = dark
      ? [[0, '#7c7d84'], [0.25, '#36373c'], [0.5, '#6e6f76'], [0.75, '#2b2c30'], [1, '#606167']]
      : [[0, '#fdfdfe'], [0.25, '#b9bac0'], [0.5, '#f3f3f5'], [0.75, '#a3a4ab'], [1, '#e9e9ec']];
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops.map((s) => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('')}</linearGradient>`;
  }

  /* ---------------------------------------------------------------- front SVG */

  function shellSvg(geo, o, u, extra) {
    const t = tones(o.shellColor, o.finish);
    const d = bodyPath(geo.body);
    const pad = geo.pad;
    const vb = `${f(-geo.w / 2 - pad)} ${f(-geo.h / 2 - pad)} ${f(geo.w + pad * 2)} ${f(geo.h + pad * 2)}`;
    const wall = Math.max(0.45, geo.w * 0.013);
    const shadow = o.shadow !== false;
    let s = `<svg class="kx-shell" viewBox="${vb}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>`;
    s += `<radialGradient id="${u}g" cx="34%" cy="24%" r="88%"><stop offset="0" stop-color="${t.lit}"/><stop offset=".55" stop-color="${t.base}"/><stop offset="1" stop-color="${t.shade}"/></radialGradient>`;
    s += `<linearGradient id="${u}rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${t.dark ? 0.3 : 0.9}"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${t.dark ? 0.55 : 0.24}"/></linearGradient>`;
    if (shadow) s += `<filter id="${u}sh" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${f(geo.w * 0.03)}"/></filter>`;
    if (o.finish === 'fabric') {
      s += `<pattern id="${u}fab" width="0.9" height="0.9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="0.9" height="0.34" fill="#000" fill-opacity="${t.dark ? 0.24 : 0.1}"/><rect y="0.45" width="0.45" height="0.45" fill="#fff" fill-opacity="${t.dark ? 0.07 : 0.16}"/></pattern>`;
    }
    if (o.finish === 'gloss') s += `<clipPath id="${u}cl"><path d="${d}"/></clipPath>`;
    if (geo.ring) {
      s += metalDefs(`${u}met`, t.dark);
      s += metalDefs(`${u}hin`, true);
    }
    s += '</defs>';
    if (shadow) s += `<path d="${d}" transform="translate(${f(geo.w * 0.015)} ${f(geo.w * 0.05)})" fill="#000" opacity="${o.shadowOpacity == null ? 0.34 : o.shadowOpacity}" filter="url(#${u}sh)"/>`;
    s += `<path d="${d}" transform="translate(0 ${f(wall)})" fill="${t.wall}"/>`;
    s += `<path d="${d}" fill="url(#${u}g)"/>`;
    if (o.finish === 'fabric') s += `<path d="${d}" fill="url(#${u}fab)"/>`;
    if (o.finish === 'gloss') {
      s += `<g clip-path="url(#${u}cl)"><ellipse cx="${f(-geo.w * 0.2)}" cy="${f(-geo.h * 0.32)}" rx="${f(geo.w * 0.44)}" ry="${f(geo.h * 0.15)}" transform="rotate(-24 ${f(-geo.w * 0.2)} ${f(-geo.h * 0.32)})" fill="#fff" opacity=".3"/></g>`;
    }
    s += `<path d="${d}" fill="none" stroke="url(#${u}rim)" stroke-width="${f(Math.max(0.3, geo.w * 0.012))}"/>`;
    if (geo.ring) s += ringSvg(geo, u);
    const recess = screenPath(geo.screen, geo.bezel);
    s += `<path d="${recess}" fill="#09090b"/>`;
    if (geo.form.glass === 'window') {
      s += `<path d="${recess}" fill="none" stroke="${t.dark ? '#000' : U.hex(U.darken(U.rgb(t.base), 0.35))}" stroke-opacity=".55" stroke-width="${f(Math.max(0.2, geo.bezel * 0.45))}"/>`;
    }
    if (extra) s += extra;
    s += '</svg>';
    return s;
  }

  function ringSvg(geo, u) {
    const R = geo.ring.outer / 2;
    const r = geo.ring.inner / 2;
    const band = R - r;
    let s = `<path d="${ellPath(0, 0, R, R)} ${ellPath(0, 0, r, r)}" fill="url(#${u}met)" fill-rule="evenodd"/>`;
    s += `<circle r="${f(R - 0.12)}" fill="none" stroke="#000" stroke-opacity=".22" stroke-width=".25"/>`;
    s += `<circle r="${f(r + 0.12)}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".3"/>`;
    s += `<circle r="${f(r + band * 0.5)}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="${f(band * 0.22)}"/>`;
    const hw = R * 0.17;
    s += `<rect x="${f(-hw)}" y="${f(-R - 0.2)}" width="${f(hw * 2)}" height="${f(band + 0.6)}" rx="${f(band * 0.3)}" fill="url(#${u}hin)"/>`;
    s += `<line x1="${f(-hw * 0.7)}" x2="${f(hw * 0.7)}" y1="${f(-R + band * 0.5)}" y2="${f(-R + band * 0.5)}" stroke="#fff" stroke-opacity=".25" stroke-width=".25"/>`;
    return s;
  }

  function overlaySvg(geo, o, u) {
    const t = tones(o.shellColor, o.finish);
    const pad = geo.pad;
    const vb = `${f(-geo.w / 2 - pad)} ${f(-geo.h / 2 - pad)} ${f(geo.w + pad * 2)} ${f(geo.h + pad * 2)}`;
    const name = o.name ? esc(o.name) : '';
    let s = `<svg class="kx-overlay" viewBox="${vb}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>`;
    if (o.glare) {
      s += `<linearGradient id="${u}gl" x1="0" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".34" stop-color="#fff" stop-opacity=".07"/><stop offset=".35" stop-color="#fff" stop-opacity=".025"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
    }
    let arc = '';
    if (geo.ring && geo.form.ringText && name) {
      const rc = (geo.ring.outer + geo.ring.inner) / 4;
      const a0 = (150 * Math.PI) / 180;
      const a1 = (30 * Math.PI) / 180;
      const R10 = rc * 10;
      arc = `M ${f(R10 * Math.cos(a0))} ${f(R10 * Math.sin(a0))} A ${f(R10)} ${f(R10)} 0 0 0 ${f(R10 * Math.cos(a1))} ${f(R10 * Math.sin(a1))}`;
      s += `<path id="${u}arc" d="${arc}"/>`;
    }
    s += '</defs>';
    if (o.glare) {
      const gp = screenPath(geo.screen, geo.bezel);
      s += `<path d="${gp}" fill="url(#${u}gl)"/>`;
      s += `<path d="${gp}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="${f(Math.max(0.15, geo.w * 0.004))}"/>`;
    }
    const font = 'font-family="Nunito, ui-rounded, \'SF Pro Rounded\', system-ui, sans-serif" font-weight="800"';
    // Text is set in a 10x coordinate system (scale .1) so browsers do not clamp the tiny mm font size.
    if (geo.wordmark && name) {
      const wm = geo.wordmark;
      const tx = `x="${f(wm.x * 10)}" font-size="${f(wm.size * 10)}" ${font} text-anchor="middle" dominant-baseline="central" letter-spacing="${f(wm.size * 0.2)}" transform="scale(.1)"`;
      if (!t.dark) s += `<text ${tx} y="${f((wm.y + wm.size * 0.05) * 10)}" fill="#fff" opacity=".45">${name}</text>`;
      s += `<text ${tx} y="${f(wm.y * 10)}" fill="${t.ink}" opacity="${t.inkOpacity}">${name}</text>`;
    }
    if (arc) {
      const band = (geo.ring.outer - geo.ring.inner) / 2;
      s += `<text transform="scale(.1)" font-size="${f(band * 4.8)}" ${font} fill="${t.dark ? '#ffffff' : '#000000'}" opacity="${t.dark ? 0.5 : 0.4}" letter-spacing="${f(band * 0.8)}"><textPath href="#${u}arc" startOffset="50%" text-anchor="middle" dominant-baseline="central">${name}</textPath></text>`;
    }
    s += '</svg>';
    return s;
  }

  /** Static thumbnail: shell plus a tiny face glyph in the window. */
  function thumbSvg(formId, o) {
    o = Object.assign({ size: 44, shellColor: '#F4F1EC', finish: 'matte', accent: '#2FE0B5' }, o || {});
    const geo = geometry(formId, o.size);
    geo.pad = 1.5;
    const sc = geo.screen;
    const short = Math.min(sc.w, sc.h);
    const cy = sc.type === 'arch' ? sc.y + sc.h * 0.22 : sc.y;
    const ex = short * 0.16;
    const er = Math.max(0.6, short * 0.065);
    let extra = `<g fill="${o.accent}"><ellipse cx="${f(sc.x - ex)}" cy="${f(cy)}" rx="${f(er)}" ry="${f(er * 1.35)}"/><ellipse cx="${f(sc.x + ex)}" cy="${f(cy)}" rx="${f(er)}" ry="${f(er * 1.35)}"/></g>`;
    if (geo.wordmark) {
      const wm = geo.wordmark;
      extra += `<rect x="${f(wm.x - wm.size * 1.3)}" y="${f(wm.y - wm.size * 0.3)}" width="${f(wm.size * 2.6)}" height="${f(wm.size * 0.6)}" rx="${f(wm.size * 0.3)}" fill="${tones(o.shellColor).ink}" opacity=".35"/>`;
    }
    return shellSvg(geo, Object.assign({}, o, { shadow: false }), K.uid('t'), extra).replace('preserveAspectRatio="none"', 'preserveAspectRatio="xMidYMid meet"');
  }

  /* ------------------------------------------------------------- side profile */

  /**
   * Side profile on the phone back, true proportions.
   * o.view: 'full' (whole width) or 'detail' (magnified right edge). o.labels: dimension text on/off.
   */
  function sideSvg(formOrId, size, o) {
    o = Object.assign({ thickness: 4, phoneT: 7.8, labels: true, view: 'full', shellColor: '#F4F1EC', phoneColor: 'black' }, o || {});
    // Drawn in 0.1 mm units: browsers clamp tiny SVG font sizes, so text needs a bigger coordinate system.
    const z = (v) => f(v * 10);
    const geo = geometry(formOrId, size);
    const prof = geo.form.profile || {};
    const L = geo.w;
    const T = o.thickness;
    const e = U.clamp(prof.edge || 1.5, 0.3, T * 0.62);
    const dome = prof.dome || 0;
    const labels = o.labels;
    const detail = o.view === 'detail';
    const t = tones(o.shellColor, o.finish);
    const pc = K.phoneColor(o.phoneColor);
    const over = T > 5.0001;
    const sw = geo.form.glass === 'face' ? L - e * 1.4 : geo.screen.w + geo.bezel * 2;
    const sx0 = geo.screen.x - sw / 2;
    const sx1 = sx0 + sw;

    let vx;
    let vy;
    let vw;
    let vh;
    if (detail) {
      vx = L / 2 - 9;
      vw = 15.5;
      vy = -(Math.max(T, 6) + 1.8);
      vh = -vy + 2.4;
    } else {
      const sideM = labels ? 3 : 2;
      const right = labels ? 12 : 2;
      vx = -L / 2 - sideM;
      vw = L + sideM + right;
      vy = -(Math.max(T, 6) + (labels ? 1.6 : 0.8));
      vh = -vy + (labels ? 6.6 : 2.2);
    }
    const slabH = detail ? 2.4 : labels ? 2.2 : Math.min(o.phoneT, 2);
    let s = `<svg class="kx-side${over ? ' over' : ''}${detail ? ' detail' : ''}" viewBox="${z(vx)} ${z(vy)} ${z(vw)} ${z(vh)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Side profile, ${T.toFixed(1)} millimeters thick">`;
    s += `<rect class="phone" x="${z(vx)}" y="0" width="${z(vw)}" height="${z(slabH)}" fill="${pc.body}"/>`;
    s += `<line x1="${z(vx)}" x2="${z(vx + vw)}" y1="0" y2="0" stroke="${pc.frame}" stroke-width="3.5"/>`;
    // device body (dome follows the glass)
    let d = `M ${z(-L / 2)} 0 V ${z(-T + e)} Q ${z(-L / 2)} ${z(-T)} ${z(-L / 2 + e)} ${z(-T)}`;
    if (dome > 0) d += ` H ${z(sx0)} Q ${z((sx0 + sx1) / 2)} ${z(-T - dome * 2)} ${z(sx1)} ${z(-T)}`;
    d += ` H ${z(L / 2 - e)} Q ${z(L / 2)} ${z(-T)} ${z(L / 2)} ${z(-T + e)} V 0 Z`;
    s += `<path d="${d}" fill="${t.base}" stroke="${t.wall}" stroke-width="${detail ? 1.4 : 2.5}"/>`;
    // glass band
    const gT = Math.min(0.7, T * 0.16);
    s += `<path d="M ${z(sx0)} ${z(-T + gT)} H ${z(sx1)} V ${z(-T)} ${dome > 0 ? `Q ${z((sx0 + sx1) / 2)} ${z(-T - dome * 2)} ${z(sx0)} ${z(-T)}` : `H ${z(sx0)}`} Z" fill="#111114" opacity=".9"/>`;
    if (prof.ring) {
      const band = (geo.ring.outer - geo.ring.inner) / 2;
      const rh = Math.max(0.6, T * 0.2);
      s += `<rect x="${z(-L / 2 + 0.2)}" y="${z(-T - 0.25)}" width="${z(band)}" height="${z(rh)}" rx="3" fill="#b9bac0"/>`;
      s += `<rect x="${z(L / 2 - band - 0.2)}" y="${z(-T - 0.25)}" width="${z(band)}" height="${z(rh)}" rx="3" fill="#b9bac0"/>`;
    }
    // 4 mm target and 5 mm limit for the first version (from the Oct 11 hardware discussion)
    s += `<line class="ref5" x1="${z(vx)}" x2="${z(vx + vw)}" y1="-40" y2="-40"/>`;
    s += `<line class="ref6" x1="${z(vx)}" x2="${z(vx + vw)}" y1="-50" y2="-50"/>`;
    if (labels) {
      const lx = L / 2 + (detail ? 2 : 3);
      const tick = detail ? 0.5 : 0.8;
      s += `<line class="dim" x1="${z(lx)}" x2="${z(lx)}" y1="0" y2="${z(-T)}"/>`;
      s += `<line class="dim" x1="${z(lx - tick)}" x2="${z(lx + tick)}" y1="0" y2="0"/><line class="dim" x1="${z(lx - tick)}" x2="${z(lx + tick)}" y1="${z(-T)}" y2="${z(-T)}"/>`;
      s += `<text class="lbl val${over ? ' bad' : ''}" x="${z(lx + (detail ? 0.8 : 1.2))}" y="${z(-T / 2 + (detail ? 0.45 : 0.75))}">${T.toFixed(1)} mm</text>`;
      if (detail) {
        s += `<text class="lbl" x="${z(vx + 0.6)}" y="${z(1.7)}">phone back</text>`;
      } else {
        const by = vh + vy - 1.2;
        s += `<line class="dim" x1="${z(-L / 2)}" x2="${z(L / 2)}" y1="${z(by)}" y2="${z(by)}"/>`;
        s += `<line class="dim" x1="${z(-L / 2)}" x2="${z(-L / 2)}" y1="${z(by - 0.8)}" y2="${z(by + 0.8)}"/><line class="dim" x1="${z(L / 2)}" x2="${z(L / 2)}" y1="${z(by - 0.8)}" y2="${z(by + 0.8)}"/>`;
        s += `<text class="lbl" x="0" y="${z(by - 0.7)}" text-anchor="middle" paint-order="stroke" stroke="var(--surface)" stroke-width="6">${f(L)} mm wide</text>`;
      }
    }
    s += '</svg>';
    return s;
  }

  /* --------------------------------------------------------------- DeviceView */

  class DeviceView {
    constructor(host, opts) {
      opts = opts || {};
      this.el = document.createElement('div');
      this.el.className = 'kx-device';
      this.shellEl = document.createElement('div');
      this.shellEl.className = 'kx-layer';
      this.screenEl = document.createElement('div');
      this.screenEl.className = 'kx-screen';
      this.overEl = document.createElement('div');
      this.overEl.className = 'kx-layer kx-over';
      this.el.append(this.shellEl, this.screenEl, this.overEl);
      host.appendChild(this.el);
      this.o = {};
      this.screen = opts.live === false ? null : new K.Screen(this.screenEl, opts.screenOpts || {});
      this.update(opts);
    }

    update(patch) {
      Object.assign(this.o, patch);
      const o = this.o;
      const geo = geometry(o.form || 'round-full', o.size || 44);
      this.geo = geo;
      const ppm = o.ppm || 3;
      this.el.style.width = `${f(geo.w * ppm)}px`;
      this.el.style.height = `${f(geo.h * ppm)}px`;
      const key = [geo.form.id, o.size, o.shellColor, o.finish, o.name, o.glare, o.shadow].join('|');
      if (key !== this._key) {
        this._key = key;
        const u = K.uid('d');
        this.shellEl.innerHTML = shellSvg(geo, o, u);
        this.overEl.innerHTML = overlaySvg(geo, o, u + 'o');
        const pl = (-geo.pad / geo.w) * 100;
        const pt = (-geo.pad / geo.h) * 100;
        const pw = ((geo.w + 2 * geo.pad) / geo.w) * 100;
        const ph = ((geo.h + 2 * geo.pad) / geo.h) * 100;
        [this.shellEl, this.overEl].forEach((el) => {
          el.style.left = `${pl}%`;
          el.style.top = `${pt}%`;
          el.style.width = `${pw}%`;
          el.style.height = `${ph}%`;
        });
        const sc = geo.screen;
        this.screenEl.style.left = `${((sc.x - sc.w / 2 + geo.w / 2) / geo.w) * 100}%`;
        this.screenEl.style.top = `${((sc.y - sc.h / 2 + geo.h / 2) / geo.h) * 100}%`;
        this.screenEl.style.width = `${(sc.w / geo.w) * 100}%`;
        this.screenEl.style.height = `${(sc.h / geo.h) * 100}%`;
      }
      if (this.screen) {
        this.screen.set(Object.assign({ shape: screenShape(geo), stage: geo.form.stage || {}, chrome: !!geo.form.chrome, name: o.name || '' }, o.screen || {}));
      }
      return this;
    }

    destroy() {
      if (this.screen) this.screen.destroy();
      this.el.remove();
    }
  }

  K.Device = { geometry, screenShape, screenPath, bodyPath, shellSvg, overlaySvg, thumbSvg, sideSvg, tones, DeviceView, esc };
})(window.Bud);
