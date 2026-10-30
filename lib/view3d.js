/* 3D view: the device on the phone back as a 3D model you can drag around.
 *
 * Uses three.js, loaded from cdnjs the first time 3D is opened (the rest of the explorer
 * stays offline-friendly). The body is the form outline extruded to the thickness slider
 * with the side profile's edge radius as a bevel; the face is the shell color, finish
 * and printed name; the screen is a live texture from a hidden Screen, so the character
 * keeps animating. Phone outlines are the same approximate ones as the 2D view.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const D = K.Device;
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js';

  let loading = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = THREE_URL;
        s.async = true;
        s.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('three.js did not start')));
        s.onerror = () => {
          loading = null;
          reject(new Error('three.js could not be loaded'));
        };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  // Camera presets: yaw/pitch in radians, distance as a multiple of the fit distance.
  const PRESETS = {
    angle: { label: '3/4', yaw: -0.62, pitch: 0.3, zoom: 0.62 },
    back: { label: 'Back', yaw: 0, pitch: 0, zoom: 0.95 },
    side: { label: 'Side', yaw: -1.52, pitch: 0.04, zoom: 0.5 },
    edge: { label: 'Edge close-up', yaw: -1.2, pitch: 0.14, zoom: 0.24 },
  };

  const FINISH = {
    matte: { roughness: 0.78, clearcoat: 0, sheen: 0 },
    fabric: { roughness: 0.95, clearcoat: 0, sheen: 1 },
    gloss: { roughness: 0.32, clearcoat: 0.7, sheen: 0 },
  };

  function roundedRect(THREE, x, y, w, h, r) {
    r = Math.max(0.01, Math.min(r, w / 2, h / 2));
    const s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  /** Body outline inset by the bevel (three.js grows the bevel back out). y is up in 3D. */
  function bodyShape(THREE, body, inset) {
    if (body.type === 'circle') {
      const s = new THREE.Shape();
      s.absarc(0, 0, body.w / 2 - inset, 0, Math.PI * 2, false);
      return s;
    }
    return roundedRect(THREE, -body.w / 2 + inset, -body.h / 2 + inset, body.w - 2 * inset, body.h - 2 * inset, (body.r || 0) - inset);
  }

  /** Screen outline (2D geometry is y-down, so y flips). */
  function screenShape(THREE, sc, grow) {
    const w = sc.w + 2 * grow;
    const h = sc.h + 2 * grow;
    const cx = sc.x;
    const cy = -sc.y;
    const short = Math.min(sc.w, sc.h);
    if (sc.type === 'circle') {
      const s = new THREE.Shape();
      s.absellipse(cx, cy, w / 2, h / 2, 0, Math.PI * 2, false, 0);
      return s;
    }
    if (sc.type === 'arch') {
      const r = Math.min(w / 2, h);
      const x0 = cx - w / 2;
      const y0 = cy - h / 2;
      const br = Math.max(0.01, (sc.br || 0) * short + grow);
      const s = new THREE.Shape();
      s.moveTo(x0 + br, y0);
      s.lineTo(x0 + w - br, y0);
      s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + br);
      s.lineTo(x0 + w, y0 + h - r);
      s.absarc(cx, y0 + h - r, r, 0, Math.PI, false);
      s.lineTo(x0, y0 + br);
      s.quadraticCurveTo(x0, y0, x0 + br, y0);
      return s;
    }
    return roundedRect(THREE, cx - w / 2, cy - h / 2, w, h, (sc.r || 0) * short + grow);
  }

  /** A soft studio environment for reflections (what three's RoomEnvironment does, inline). */
  function studio(THREE, renderer) {
    const room = new THREE.Scene();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const walls = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x24262b, side: THREE.BackSide }));
    walls.scale.set(30, 18, 30);
    room.add(walls);
    const panel = (x, y, z, sx, sy, sz, v) => {
      const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v) }));
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      room.add(m);
    };
    panel(-7, 7, 6, 8, 0.3, 6, 4.5);
    panel(9, 3, 4, 0.3, 6, 7, 2.2);
    panel(0, 2, -14, 12, 6, 0.3, 1);
    panel(0, -8.8, 0, 14, 0.3, 14, 0.3);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const tex = pmrem.fromScene(room, 0.035).texture;
    pmrem.dispose();
    return tex;
  }

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => {
        ['map', 'emissiveMap', 'roughnessMap', 'bumpMap'].forEach((k) => {
          if (m[k] && m[k] !== obj.userData.keepTexture) m[k].dispose();
        });
        m.dispose();
      });
    });
  }

  class View3D {
    /** opts.controls: false turns off drag and wheel (for scroll-driven pages, which set the camera themselves). */
    constructor(host, opts) {
      this.host = host;
      this.opts = Object.assign({ controls: true }, opts || {});
      this.focus = 0; // camera target: 0 = the device, 1 = the middle of the phone
      this.el = document.createElement('div');
      this.el.className = 'v3d-canvas';
      host.appendChild(this.el);
      this.preset('angle', true);
      this.ready = false;
      this.active = false;
      this.o = null;
      this.keys = {};
      // hidden live screen that feeds the 3D screen texture
      this.srcHost = document.createElement('div');
      this.srcHost.setAttribute('aria-hidden', 'true');
      this.srcHost.style.cssText = 'position:fixed;left:-12000px;top:0;width:360px;height:360px;pointer-events:none;';
      document.body.appendChild(this.srcHost);
      this.screen = new K.Screen(this.srcHost, { manual: true, bloom: false });
    }

    /** Aim the camera directly: yaw/pitch in radians, zoom as a multiple of the fit distance. */
    setView(yaw, pitch, zoom, instant) {
      this.yawT = yaw;
      this.pitchT = pitch;
      this.zoomT = zoom;
      if (instant) {
        this.yaw = yaw;
        this.pitch = pitch;
        this.zoom = zoom;
      }
    }

    preset(name, instant) {
      const p = PRESETS[name] || PRESETS.angle;
      this.yawT = p.yaw;
      this.pitchT = p.pitch;
      this.zoomT = p.zoom;
      if (instant) {
        this.yaw = p.yaw;
        this.pitch = p.pitch;
        this.zoom = p.zoom;
      }
    }

    async start() {
      if (!this.ready) {
        const THREE = await loadThree();
        this.init(THREE);
        this.ready = true;
      }
      this.active = true;
      if (this.o) this.update(this.o);
      cancelAnimationFrame(this.raf);
      this.loop();
    }

    stop() {
      this.active = false;
      cancelAnimationFrame(this.raf);
    }

    init(THREE) {
      this.THREE = THREE;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.cssText = `display:block;width:100%;height:100%;touch-action:${this.opts.controls ? 'none' : 'pan-y'};`;
      this.el.appendChild(renderer.domElement);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      scene.environment = studio(THREE, renderer);
      this.scene = scene;
      this.camera = new THREE.PerspectiveCamera(28, 1, 1, 5000);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4e5a, 0.4));
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(-90, 120, 170);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      const sc = key.shadow.camera;
      sc.left = -110;
      sc.right = 110;
      sc.top = 110;
      sc.bottom = -110;
      sc.near = 10;
      sc.far = 600;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.03;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xc8dcff, 0.55);
      rim.position.set(140, -50, 60);
      scene.add(rim);

      this.rig = new THREE.Group();
      scene.add(this.rig);
      this.phone = new THREE.Group();
      this.device = new THREE.Group();
      this.rig.add(this.phone, this.device);

      this.screenTex = new THREE.CanvasTexture(this.screen.canvas);
      this.screenTex.encoding = THREE.sRGBEncoding;
      this.screenTex.minFilter = THREE.LinearFilter;
      this.screenTex.generateMipmaps = false;
      this.texCanvasW = this.screen.canvas.width;

      if (this.opts.controls) this.bindControls();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.el);
      this.resize();
    }

    resize() {
      if (!this.renderer) return;
      const r = this.el.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // shiftX moves the picture sideways (fraction of the width) without changing the perspective,
      // so a page can keep the phone clear of its captions
      const sx = this.shiftX || 0;
      const sy = this.shiftY || 0; // positive moves the picture down
      if (sx || sy) this.camera.setViewOffset(w, h, -sx * w, -sy * h, w, h);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
    }

    bindControls() {
      const el = this.renderer.domElement;
      const pts = new Map();
      let pinch = 0;
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = Math.hypot(a.x - b.x, a.y - b.y);
        }
      });
      el.addEventListener('pointermove', (e) => {
        const p = pts.get(e.pointerId);
        if (!p) return;
        if (pts.size === 1) {
          this.yawT -= (e.clientX - p.x) * 0.0065;
          this.pitchT = U.clamp(this.pitchT + (e.clientY - p.y) * 0.0065, -1.45, 1.45);
        }
        p.x = e.clientX;
        p.y = e.clientY;
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch) this.zoomT = U.clamp(this.zoomT * (pinch / d), 0.16, 2.2);
          pinch = d;
        }
      });
      const end = (e) => {
        pts.delete(e.pointerId);
        pinch = 0;
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          this.zoomT = U.clamp(this.zoomT * Math.exp(e.deltaY * 0.0012), 0.16, 2.2);
        },
        { passive: false }
      );
      el.addEventListener('dblclick', () => this.preset('angle'));
    }

    /** o: { phone, phoneColor, form, size, thickness, shellColor, finish, name, place: {cx, cy}, screen } */
    update(o) {
      this.o = o;
      const geo = D.geometry(o.form, o.size);
      const sc = geo.screen;
      // keep the hidden screen's aspect equal to the screen's
      const hostW = 360;
      const hostH = Math.round((hostW * sc.h) / sc.w);
      if (this.srcHost.style.height !== `${hostH}px`) this.srcHost.style.height = `${hostH}px`;
      this.screen.set(Object.assign({}, o.screen, { shape: D.screenShape(geo), stage: geo.form.stage || {}, chrome: !!geo.form.chrome, name: o.name || '', glow: false }));
      if (!this.ready) return;
      const ph = K.phones.get(o.phone);
      const phoneKey = [o.phone, o.phoneColor].join('|');
      if (phoneKey !== this.keys.phone) {
        this.keys.phone = phoneKey;
        this.buildPhone(ph, o.phoneColor);
      }
      const devKey = [o.form, o.size, o.thickness, o.shellColor, o.finish, o.name].join('|');
      if (devKey !== this.keys.device) {
        this.keys.device = devKey;
        this.buildDevice(geo, o);
      }
      const pl = o.place || { cx: ph.w / 2, cy: ph.h / 2 };
      this.device.position.set(pl.cx - ph.w / 2, -(pl.cy - ph.h / 2), 0);
      this.target = { x: this.device.position.x, y: this.device.position.y, z: o.thickness / 2 };
      this.center = { x: 0, y: 0, z: o.thickness / 2 };
      this.fit = (ph.h * 0.62) / Math.tan(((this.camera.fov / 2) * Math.PI) / 180);
    }

    buildPhone(ph, colorId) {
      const THREE = this.THREE;
      disposeTree(this.phone);
      this.phone.clear();
      const col = K.phoneColor(colorId);
      const bev = 1;
      const shape = roundedRect(THREE, -ph.w / 2 + bev, -ph.h / 2 + bev, ph.w - 2 * bev, ph.h - 2 * bev, ph.r - bev);
      const g = new THREE.ExtrudeGeometry(shape, { depth: ph.t - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 5, curveSegments: 24 });
      g.translate(0, 0, bev - ph.t);
      const backMat = new THREE.MeshPhysicalMaterial({ color: col.body, roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.6 });
      const frameMat = new THREE.MeshStandardMaterial({ color: col.frame, roughness: 0.4, metalness: 0.55, envMapIntensity: 0.8 });
      const body = new THREE.Mesh(g, [backMat, frameMat]);
      body.receiveShadow = true;
      body.castShadow = true;
      this.phone.add(body);
      // display side of the phone, facing away
      const front = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.15, metalness: 0.1 }));
      front.rotation.y = Math.PI;
      front.position.z = -ph.t - 0.02;
      this.phone.add(front);
      // the phone's own display, inset from the edge; pages can light it with setFrontScreen()
      const inset = 1.7;
      const scrShape = roundedRect(THREE, -ph.w / 2 + inset, -ph.h / 2 + inset, ph.w - 2 * inset, ph.h - 2 * inset, ph.r - inset);
      this.frontMat = new THREE.MeshBasicMaterial({ color: 0x07080b });
      const display = new THREE.Mesh(new THREE.ShapeGeometry(scrShape, 24), this.frontMat);
      display.rotation.y = Math.PI;
      display.position.z = -ph.t - 0.06;
      this.phone.add(display);
      this.frontSize = { w: ph.w - 2 * inset, h: ph.h - 2 * inset };
      if (this.frontCanvas) this.setFrontScreen(this.frontCanvas);
      (ph.buttons || []).forEach((b) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, b.h, ph.t * 0.32), frameMat);
        m.position.set((b.side === 'left' ? -1 : 1) * (ph.w / 2 + 0.25), ph.h / 2 - (b.y + b.h / 2), -ph.t / 2);
        this.phone.add(m);
      });
      // the printed back (camera island, lenses) as a texture once the SVG rasterizes
      const svg = K.phoneSvg(ph, colorId).replace(/viewBox="[^"]*"/, `viewBox="0 0 ${ph.w} ${ph.h}" width="${Math.round(ph.w * 14)}" height="${Math.round(ph.h * 14)}"`);
      const img = new Image();
      img.onload = () => {
        if (this.keys.phone !== [ph.id, colorId].join('|')) return;
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
        const tex = new THREE.CanvasTexture(cv);
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 4;
        tex.repeat.set(1 / ph.w, 1 / ph.h);
        tex.offset.set(0.5, 0.5);
        backMat.map = tex;
        backMat.color.set(0xffffff);
        backMat.needsUpdate = true;
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    /** Light the phone's own display (its front) with a canvas, such as a lock screen. */
    setFrontScreen(canvas) {
      this.frontCanvas = canvas;
      if (!this.frontMat || !this.THREE) return;
      const THREE = this.THREE;
      let tex = this.frontMat.map;
      if (!tex || tex.image !== canvas) {
        if (tex) tex.dispose();
        tex = new THREE.CanvasTexture(canvas);
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 4;
        // shape UVs are in mm, centered on the phone
        tex.repeat.set(1 / this.frontSize.w, 1 / this.frontSize.h);
        tex.offset.set(0.5, 0.5);
        this.frontMat.map = tex;
        this.frontMat.color.set(0xffffff);
        this.frontMat.needsUpdate = true;
      }
      tex.needsUpdate = true;
    }

    faceTexture(geo, o) {
      const THREE = this.THREE;
      const pxmm = 22;
      const W = geo.w;
      const H = geo.h;
      const cv = document.createElement('canvas');
      cv.width = Math.round(W * pxmm);
      cv.height = Math.round(H * pxmm);
      const c = cv.getContext('2d');
      const t = D.tones(o.shellColor, o.finish);
      c.fillStyle = t.base;
      c.fillRect(0, 0, cv.width, cv.height);
      if (o.finish === 'fabric') {
        const p = document.createElement('canvas');
        p.width = p.height = 16;
        const pc = p.getContext('2d');
        pc.strokeStyle = t.dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
        pc.lineWidth = 3;
        pc.beginPath();
        pc.moveTo(-4, 4);
        pc.lineTo(4, -4);
        pc.moveTo(0, 16);
        pc.lineTo(16, 0);
        pc.moveTo(12, 20);
        pc.lineTo(20, 12);
        pc.stroke();
        c.fillStyle = c.createPattern(p, 'repeat');
        c.fillRect(0, 0, cv.width, cv.height);
      }
      c.save();
      c.setTransform(pxmm, 0, 0, pxmm, (W / 2) * pxmm, (H / 2) * pxmm);
      c.fillStyle = '#060607';
      c.fill(new Path2D(D.screenPath(geo.screen, geo.bezel)));
      c.restore();
      if (geo.wordmark && o.name) {
        const wm = geo.wordmark;
        c.font = `800 ${Math.round(wm.size * pxmm)}px Nunito, ui-rounded, system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.globalAlpha = t.inkOpacity;
        c.fillStyle = t.ink;
        c.fillText(o.name, (wm.x + W / 2) * pxmm, (wm.y + H / 2) * pxmm);
        c.globalAlpha = 1;
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 4;
      tex.repeat.set(1 / W, 1 / H);
      tex.offset.set(0.5, 0.5);
      return tex;
    }

    buildDevice(geo, o) {
      const THREE = this.THREE;
      disposeTree(this.device);
      this.device.clear();
      const T = o.thickness;
      const prof = geo.form.profile || {};
      const e = U.clamp(prof.edge || 1.5, 0.3, T * 0.45);
      const fin = FINISH[o.finish] || FINISH.matte;
      const shell = new THREE.Color(o.shellColor);
      const matProps = { roughness: fin.roughness, metalness: 0, clearcoat: fin.clearcoat, clearcoatRoughness: 0.18, sheen: fin.sheen, sheenRoughness: 0.75, sheenColor: shell.clone().lerp(new THREE.Color(0xffffff), 0.4) };
      const faceMat = new THREE.MeshPhysicalMaterial(Object.assign({ map: this.faceTexture(geo, o) }, matProps));
      const sideMat = new THREE.MeshPhysicalMaterial(Object.assign({ color: shell }, matProps));
      const g = new THREE.ExtrudeGeometry(bodyShape(THREE, geo.body, e), {
        depth: Math.max(0.05, T - 2 * e),
        bevelEnabled: true,
        bevelThickness: e,
        bevelSize: e,
        bevelSegments: 8,
        curveSegments: geo.body.type === 'circle' ? 96 : 40,
      });
      g.translate(0, 0, e);
      const body = new THREE.Mesh(g, [faceMat, sideMat]);
      body.castShadow = true;
      body.receiveShadow = true;
      this.device.add(body);

      // live screen
      const sc = geo.screen;
      const screenMat = new THREE.MeshBasicMaterial({ map: this.screenTex, transparent: true, toneMapped: false });
      const scr = new THREE.Mesh(new THREE.ShapeGeometry(screenShape(THREE, sc, 0), 64), screenMat);
      this.screenTex.repeat.set(1 / sc.w, 1 / sc.h);
      this.screenTex.offset.set(-(sc.x - sc.w / 2) / sc.w, -(-sc.y - sc.h / 2) / sc.h);
      scr.position.z = T + 0.03;
      this.device.add(scr);
      this.device.userData.keepTexture = this.screenTex;

      // cover glass for reflections
      const glass = new THREE.Mesh(
        new THREE.ShapeGeometry(screenShape(THREE, sc, geo.bezel), 64),
        new THREE.MeshPhysicalMaterial({ color: 0x0b0b0e, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 })
      );
      glass.position.z = T + 0.07;
      this.device.add(glass);

      // flip-out ring for the ring grip
      if (geo.ring) {
        const R = geo.ring.outer / 2;
        const r = geo.ring.inner / 2;
        const ring = new THREE.Shape();
        ring.absarc(0, 0, R - 0.15, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, r, 0, Math.PI * 2, true);
        ring.holes.push(hole);
        const dark = D.tones(o.shellColor).dark;
        const metal = new THREE.MeshStandardMaterial({ color: dark ? 0x4a4b50 : 0xd9dade, metalness: 1, roughness: 0.3 });
        const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 3, curveSegments: 96 });
        const rm = new THREE.Mesh(rg, metal);
        rm.position.z = T - 0.05;
        rm.castShadow = true;
        this.device.add(rm);
        const hinge = new THREE.Mesh(new THREE.BoxGeometry(R * 0.34, (R - r) + 0.6, 0.9), metal);
        hinge.position.set(0, R - (R - r) / 2, T + 0.25);
        this.device.add(hinge);
      }
    }

    loop() {
      if (!this.active) return;
      this.raf = requestAnimationFrame(() => this.loop());
      if (!this.renderer || !this.target) return;
      const t = performance.now() / 1000;
      this.screen.render(t);
      if (this.screen.canvas.width !== this.texCanvasW) {
        // the source canvas was resized: a texture has to be re-created for the new size
        this.texCanvasW = this.screen.canvas.width;
        const old = this.screenTex;
        const tex = new this.THREE.CanvasTexture(this.screen.canvas);
        tex.encoding = old.encoding;
        tex.minFilter = old.minFilter;
        tex.generateMipmaps = false;
        tex.repeat.copy(old.repeat);
        tex.offset.copy(old.offset);
        this.device.traverse((m) => {
          if (m.material && m.material.map === old) m.material.map = tex;
        });
        this.device.userData.keepTexture = tex;
        this.screenTex = tex;
        old.dispose();
      }
      this.screenTex.needsUpdate = true;
      const k = 0.16;
      this.yaw += (this.yawT - this.yaw) * k;
      this.pitch += (this.pitchT - this.pitch) * k;
      this.zoom += (this.zoomT - this.zoom) * k;
      const dist = this.fit * this.zoom;
      const f = U.clamp(this.focus || 0);
      const c0 = this.center || this.target;
      const tg = { x: U.lerp(this.target.x, c0.x, f), y: U.lerp(this.target.y, c0.y, f), z: this.target.z };
      this.cur = this.cur || Object.assign({}, tg);
      this.cur.x += (tg.x - this.cur.x) * k;
      this.cur.y += (tg.y - this.cur.y) * k;
      this.cur.z += (tg.z - this.cur.z) * k;
      const cp = Math.cos(this.pitch);
      this.camera.position.set(this.cur.x + dist * cp * Math.sin(this.yaw), this.cur.y + dist * Math.sin(this.pitch), this.cur.z + dist * cp * Math.cos(this.yaw));
      this.camera.lookAt(this.cur.x, this.cur.y, this.cur.z);
      this.renderer.render(this.scene, this.camera);
    }
  }

  View3D.PRESETS = PRESETS;
  View3D.load = loadThree;
  K.View3D = View3D;
})(window.Bud);
