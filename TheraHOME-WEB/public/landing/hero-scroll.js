// <hero-scroll> — scroll-controlled massage demonstration.
//
// Ported VERBATIM from the Claude Design project b34e8246-… (hero-scroll.js),
// except for the asset path (./assets/device.png -> /landing/device.png). It is
// a self-registering custom element with no framework ties, so copying it beats
// rewriting it in React: the scroll choreography is dense and any paraphrase
// would drift from the design.
//
// Loaded with next/script from the Sản phẩm page. If /landing/device.png is
// missing the texture load rejects, boot() logs and the canvas stays blank —
// ProductScrollHero probes the image first and renders a static hero instead,
// so the 600vh track is never empty.
//
// The photographed device stays whole and still; masked copies of its real working surfaces
// (the massage-node cluster and the two metallic electrodes) are overlaid and displaced a fraction
// of a millimetre at massage frequency, so only those areas vibrate. Node groups light up in
// sequence, ripples radiate from the cluster, the electrodes pulse and link, warmth builds.
(() => {
  if (customElements.get('hero-scroll')) return;
  const THREE_URL = 'https://unpkg.com/three@0.184.0/build/three.module.js';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const E = {
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    back: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  };
  const seg = (p, a, b, ease = E.inOut) => ease(clamp((p - a) / (b - a), 0, 1));
  const pulse = (p, a, b) => Math.sin(clamp((p - a) / (b - a), 0, 1) * Math.PI);

  const IMG = '/landing/device.png', IMG_W = 1430, IMG_H = 1100;
  const PW = 3.9, PH = PW * IMG_H / IMG_W;
  // Component regions in image UV (u from left, v from top), measured off the product photo
  const PAD_A = { u: 0.400, v: 0.375, rx: 0.075, ry: 0.075, rot: -0.35 };
  const PAD_B = { u: 0.515, v: 0.450, rx: 0.075, ry: 0.072, rot: -0.35 };
  const NODE_GROUPS = [
    [[0.435, 0.295], [0.470, 0.285], [0.505, 0.330], [0.540, 0.355]],
    [[0.330, 0.455], [0.375, 0.500], [0.425, 0.540], [0.360, 0.580], [0.410, 0.620], [0.460, 0.575]],
    [[0.205, 0.625], [0.245, 0.672], [0.400, 0.760], [0.445, 0.800], [0.520, 0.215]],
  ];
  const local = (u, v) => [(u - 0.5) * PW, (0.5 - v) * PH];

  class HeroScroll extends HTMLElement {
    static get observedAttributes() { return ['parallax', 'energy', 'vibration']; }
    attributeChangedCallback() { this._readAttrs(); }
    _readAttrs() {
      this.parallax = this.getAttribute('parallax') !== 'false';
      this.energy = parseFloat(this.getAttribute('energy')); if (isNaN(this.energy)) this.energy = 1;
      this.vib = parseFloat(this.getAttribute('vibration')); if (isNaN(this.vib)) this.vib = 1;
    }
    connectedCallback() {
      if (this._booted) return; this._booted = true; this._readAttrs();
      Object.assign(this.style, { display: 'block', position: 'absolute', inset: '0', overflow: 'hidden' });
      this.canvas = document.createElement('canvas');
      Object.assign(this.canvas.style, { width: '100%', height: '100%', display: 'block', opacity: '0', transition: 'opacity 900ms ease-out' });
      this.appendChild(this.canvas);
      this.boot().catch((e) => { console.error('hero-scroll', e); this.dispatchEvent(new CustomEvent('hero-failed', { bubbles: true })); });
    }
    disconnectedCallback() { this.dead = true; this.ro?.disconnect(); this.io?.disconnect(); window.removeEventListener('pointermove', this._onMove); window.removeEventListener('scroll', this._onScroll); clearInterval(this._iv); }

    async boot() {
      const THREE = await import(THREE_URL); this.THREE = THREE;
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.coarse = matchMedia('(pointer: coarse)').matches;
      const mobile = () => this.clientWidth < 760;

      const renderer = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile() ? 1.25 : 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      const scene = this.scene = new THREE.Scene();
      const camera = this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
      const tex = await new THREE.TextureLoader().loadAsync(IMG);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

      const root = this.root = new THREE.Group(); scene.add(root);
      const halo = this.halo = this._sprite(this._radialTex(0, 110, 220, 0.5), 0.24);
      halo.scale.set(8.5, 8.5, 1); halo.position.z = -1.3; root.add(halo);

      // ---- the product: one intact plane, never cut
      this.product = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      this.product.position.z = 0.04; this.product.renderOrder = 12; root.add(this.product);

      this.pulseOvl = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), this._bandMat(THREE, tex, 0.09));
      this.pulseOvl.position.z = 0.23; this.pulseOvl.renderOrder = 21; root.add(this.pulseOvl);

      // ---- node illumination, three groups lit in sequence
      this.nodeOvls = NODE_GROUPS.map((g) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({
          map: this._spotsTex(g, [120, 200, 255], 0.030), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
        }));
        m.position.z = 0.12; m.renderOrder = 18; root.add(m); return m;
      });

      // ---- EMS energy: concentric rings at each pad + a thin link between the two contacts
      const ringMat = () => new THREE.MeshBasicMaterial({ color: 0x2f9cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      this.emsRings = [PAD_A, PAD_B].flatMap((r, pi) => [0, 1, 2].map((k) => {
        const g = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.006, 8, 48), ringMat());
        const [x, y] = local(r.u, r.v); g.position.set(x, y, 0.1); g.rotation.x = -0.22;
        g.userData = { pad: pi, k }; g.renderOrder = 19; root.add(g); return g;
      }));
      const [ax, ay] = local(PAD_A.u, PAD_A.v), [bx, by] = local(PAD_B.u, PAD_B.v);
      this.linkCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(ax, ay, 0.1), new THREE.Vector3((ax + bx) / 2 - 0.1, (ay + by) / 2 + 0.28, 0.22), new THREE.Vector3(bx, by, 0.1));
      this.link = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.linkCurve.getPoints(36)), new THREE.LineBasicMaterial({ color: 0x63bcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
      this.link.renderOrder = 19; root.add(this.link);
      this.linkDot = this._sprite(this._radialTex(150, 210, 255, 0.95), 0); this.linkDot.scale.set(0.13, 0.13, 1); this.linkDot.renderOrder = 19; root.add(this.linkDot);
      // warm glow over the contact surface only (the device's heat function, not an invented module)
      this.padGlow = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({
        map: this._spotsTex([[PAD_A.u, PAD_A.v], [PAD_B.u, PAD_B.v]], [150, 210, 255], 0.075), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      }));
      this.padGlow.position.z = 0.1; this.padGlow.renderOrder = 18; root.add(this.padGlow);
      this.warm = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({
        map: this._spotsTex([[0.40, 0.52], [0.46, 0.44], [0.35, 0.60]], [255, 140, 60], 0.10), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
      }));
      this.warm.position.z = 0.08; this.warm.renderOrder = 17; root.add(this.warm);

      // ---- buzzing surface overlays: only the massage nodes and the electrodes move
      const softPts = (pts, rad) => this._mask((x, W, H) => {
        x.fillStyle = '#fff'; x.filter = 'blur(14px)';
        pts.forEach(([u, v]) => { x.beginPath(); x.arc(u * W, v * H, rad * W, 0, Math.PI * 2); x.fill(); });
      });
      const surf = (maskCanvas, z, order) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({
          map: tex, alphaMap: new THREE.CanvasTexture(maskCanvas), transparent: true, opacity: 0, depthWrite: false,
        }));
        m.position.z = z; m.renderOrder = order; root.add(m); return m;
      };
      // one buzzing surface per node group, each with its own phase and frequency, so the
      // movement reads as a real multi-point massage head rather than one block shifting
      this.nodeSurfs = NODE_GROUPS.map((g, i) => {
        const mask = softPts(g, 0.055);
        return { main: surf(mask, 0.045, 14), ghost: surf(mask, 0.0445, 14), fx: 21 + i * 3.5, fy: 26 + i * 4.5, ph: i * 1.9, sw: 1.15 + i * 0.4 };
      });
      const padMask = softPts([[PAD_A.u, PAD_A.v], [PAD_B.u, PAD_B.v]], 0.072);
      this.padSurf = surf(padMask, 0.055, 18);
      this.padGhost = surf(padMask, 0.0545, 18);

      // ---- massage ripples: concentric waves over the node cluster while the surface vibrates
      const NODE_HUB = [0.40, 0.55];
      const [hx, hy] = local(NODE_HUB[0], NODE_HUB[1]);
      this.ripples = [0, 1, 2].map((k) => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.007, 8, 56), new THREE.MeshBasicMaterial({ color: 0x59b4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.set(hx, hy, 0.09); m.rotation.x = -0.30; m.userData = { k }; m.renderOrder = 18; root.add(m); return m;
      });

      this.layout = () => {
        const w = this.clientWidth || 1, h = this.clientHeight || 1;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
        this.isMobile = mobile();
        this.rootScale = this.isMobile ? 0.98 : clamp(camera.aspect / 1.7, 0.8, 1.2);
        this.baseY = this.isMobile ? -1.0 : -0.12;
        this.baseX = this.isMobile ? 0.08 : Math.tan(camera.fov * Math.PI / 360) * 7.4 * camera.aspect * 0.42;
      };
      this.layout(); this.ro = new ResizeObserver(() => this.layout()); this.ro.observe(this);

      this.mouse = { tx: 0, ty: 0, x: 0, y: 0 };
      this._onMove = (e) => { if (!this.parallax || this.coarse) return; this.mouse.tx = (e.clientX / innerWidth) * 2 - 1; this.mouse.ty = (e.clientY / innerHeight) * 2 - 1; this._kick(); };
      window.addEventListener('pointermove', this._onMove, { passive: true });
      this.scrollP = 0; this.scrollTarget = 0;
      this._track = this.closest('[data-scroll-track]');
      this._onScroll = () => {
        const tr = this._track;
        if (tr) { const r = tr.getBoundingClientRect(); const span = Math.max(1, tr.offsetHeight - innerHeight); this.scrollTarget = clamp(-r.top / span, 0, 1); }
        else this.scrollTarget = clamp(window.scrollY / (innerHeight * 0.9), 0, 1);
        this._kick();
      };
      window.addEventListener('scroll', this._onScroll, { passive: true });
      this.visible = true;
      this.io = new IntersectionObserver((en) => { this.visible = en[0].isIntersecting; if (this.visible) this._kick(); }); this.io.observe(this);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this._kick(); });
      this._onScroll();
      this._iv = setInterval(() => this._kick(), 250);
      this.t0 = performance.now();
      this.canvas.style.opacity = '1';
      this.dispatchEvent(new CustomEvent('hero-ready', { bubbles: true }));
      this._kick();
    }

    // ---- texture helpers -----------------------------------------------------------------
    _cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
    _mask(draw) { const W = 1024, H = Math.round(1024 * IMG_H / IMG_W); const [c, x] = this._cv(W, H); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); draw(x, W, H); return c; }
    _radialTex(r, g, b, a) {
      const [c, x] = this._cv(128, 128); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, `rgba(${r},${g},${b},${a})`); gr.addColorStop(0.35, `rgba(${r},${g},${b},${a * 0.35})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new this.THREE.CanvasTexture(c);
    }
    _sprite(tex, opacity) { const THREE = this.THREE; return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })); }
    _spotsTex(pts, [r, g, b], rad) {
      const W = 1024, H = Math.round(1024 * IMG_H / IMG_W); const [c, x] = this._cv(W, H);
      pts.forEach(([u, v]) => { const gr = x.createRadialGradient(u * W, v * H, 0, u * W, v * H, rad * W); gr.addColorStop(0, `rgba(${r},${g},${b},0.9)`); gr.addColorStop(0.45, `rgba(${r},${g},${b},0.28)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); });
      const t = new this.THREE.CanvasTexture(c); t.colorSpace = this.THREE.SRGBColorSpace; return t;
    }
    // silhouette-masked moving band (scan highlight / final pulse)
    _bandMat(THREE, map, width = 0.035) {
      return new THREE.ShaderMaterial({
        uniforms: { map: { value: map }, uPos: { value: -1 }, uWidth: { value: width }, uGain: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform sampler2D map; uniform float uPos, uWidth, uGain; varying vec2 vUv;
          void main(){ vec4 t = texture2D(map, vUv); float d = ((1.0 - vUv.y) - uPos) / uWidth; float band = exp(-d*d);
            float a = t.a * band * uGain; if (a < 0.003) discard; gl_FragColor = vec4(vec3(0.45, 0.78, 1.0), a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
    }

    _kick() { if (!this._raf) this._raf = requestAnimationFrame(this._frame = this._frame || (() => this.tick())); }

    tick() {
      this._raf = 0; if (this.dead) return;
      if (!this.visible || document.hidden) return;
      // frame gate: ~60fps while animating, ~30fps when only the idle float runs
      const now = performance.now();
      if (now - (this._lastDraw || 0) < (this._busy ? 15.5 : 32)) { this._raf = requestAnimationFrame(this._frame); return; }
      this._lastDraw = now;
      const { root, camera, mouse } = this;
      const t = (performance.now() - this.t0) / 1000;
      const en = this.energy, pInt = this.coarse ? 0.4 : 1;
      this.scrollP += (this.scrollTarget - this.scrollP) * 0.12;
      const p = this.reduced ? this.scrollTarget : this.scrollP;
      const r = (a, b, ease) => seg(p, a, b, ease);
      mouse.x += (mouse.tx - mouse.x) * 0.06; mouse.y += (mouse.ty - mouse.y) * 0.06;

      // ---- beats
      const nodesLit = r(0.30, 0.48, E.out) * (1 - r(0.86, 0.94, E.out));     // massage nodes engage
      const ems = r(0.58, 0.68, E.out) * (1 - r(0.86, 0.93));                 // electrodes engage
      const heat = r(0.72, 0.80, E.out) * (1 - r(0.88, 0.95));                // warmth builds
      const edge = pulse(p, 0.93, 1.0);

      // ---- camera: macro dolly in on the working surface, then back out
      const camZ = 7.4 + 1.2 * r(0, 0.10, E.sine) - 1.3 * r(0.30, 0.46, E.sine) * (1 - r(0.80, 0.92, E.sine)) + 0.4 * r(0.93, 1.0, E.sine);
      const orbit = (0.22 * r(0.34, 0.70, E.sine)) * (1 - r(0.86, 1.0, E.sine)) + (this.reduced ? 0 : Math.sin(t * 0.2) * 0.02);
      camera.position.set(Math.sin(orbit) * camZ, this.baseY + 0.18 + Math.sin(orbit * 0.6) * 0.35, Math.cos(orbit) * camZ);
      camera.lookAt(0, this.baseY, 0);

      // ---- product placement: centre-right, centred while the massage plays
      const scale = this.rootScale * (1.12 - 0.12 * r(0, 0.25) - 0.18 * r(0.93, 1.0));
      const offX = this.baseX * (1 - r(0.12, 0.28)) + this.baseX * 0.92 * r(0.90, 1.0);
      const halfWLive = Math.tan(camera.fov * Math.PI / 360) * camZ * camera.aspect;
      const maxOffX = halfWLive - PW * 0.5 * scale - 0.15;
      const floatY = this.reduced ? 0 : Math.sin(t * Math.PI * 2 / 7) * 0.035;
      root.position.set(Math.min(offX, maxOffX) + mouse.x * 0.07 * pInt, this.baseY + floatY - mouse.y * 0.05 * pInt, 0);
      root.rotation.set((4 * r(0.12, 0.30) - 4 * r(0.90, 1.0)) * Math.PI / 180 - mouse.y * 0.02 * pInt,
        (-14 + 9 * r(0, 0.10) + 15 * r(0.10, 0.28) - 18 * r(0.90, 1.0)) * Math.PI / 180 + mouse.x * 0.03 * pInt, 0);
      root.scale.setScalar(scale);
      this.halo.material.opacity = 0.22 + 0.12 * Math.max(nodesLit, ems) + 0.18 * edge;

      // ---- vibration / massage: fast micro-motion plus a slower rhythmic swell
      const massage = Math.max(nodesLit, ems) * this.vib;
      const beat = 0.62 + 0.38 * Math.sin(t * Math.PI * 2 * 1.1);                // slow, even swell
      const jitter = massage * (0.85 + 0.3 * beat);
      // the CONTACT SURFACE buzzes, the device body stays still: a masked copy of the node area
      // is overlaid and displaced by a fraction of a millimetre at massage frequency
      this.nodeSurfs.forEach((n, i) => {
        // each group breathes on its own slow swell, so intensity travels across the cluster
        const lv = jitter * (0.55 + 0.45 * Math.sin(t * Math.PI * 2 * 0.45 * n.sw + n.ph));
        const nx = Math.sin(t * Math.PI * 2 * n.fx + n.ph) * 0.011 * lv;
        const ny = Math.sin(t * Math.PI * 2 * n.fy + n.ph * 0.7) * 0.014 * lv;
        n.main.material.opacity = Math.min(1, massage * 1.2);
        n.main.position.set(nx, ny, 0.045);
        n.ghost.material.opacity = Math.min(0.34, massage * 0.36);
        n.ghost.position.set(-nx * 0.8, -ny * 0.8, 0.0445);
      });
      const pv = ems * this.vib;
      const px2 = Math.sin(t * Math.PI * 2 * 30 + 0.6) * 0.0065 * pv;
      const py2 = Math.sin(t * Math.PI * 2 * 36) * 0.008 * pv;
      this.padSurf.material.opacity = Math.min(1, pv * 1.2);
      this.padSurf.position.set(px2, py2, 0.055);
      this.padGhost.material.opacity = Math.min(0.3, pv * 0.32);
      this.padGhost.position.set(-px2 * 0.8, -py2 * 0.8, 0.0545);
      this.ripples.forEach((m, i) => {
        const ph = ((t * 0.8 + i / 3) % 1);
        m.scale.setScalar(0.5 + ph * 2.1);
        m.material.opacity = 0.34 * massage * (1 - ph) * (0.6 + 0.4 * beat);
      });
      this.warm.material.opacity = 0.6 * heat * en;
      this.padGlow.material.opacity = 0.8 * ems * en * (0.7 + 0.3 * Math.sin(t * 2.1));

      // ---- EMS energy around both pads
      const [paX, paY] = local(PAD_A.u, PAD_A.v);
      const [pbX, pbY] = local(PAD_B.u, PAD_B.v);
      for (const g of this.emsRings) {
        const { pad, k } = g.userData;
        const px = pad ? pbX : paX, py = pad ? pbY : paY;
        const phase = ((t * 0.55 + k / 3 + pad * 0.17) % 1);
        g.position.set(px, py, 0.12);
        g.scale.setScalar(0.35 + phase * 1.5);
        g.material.opacity = ems * en * (1 - phase) * 0.75;
      }
      const linkOn = ems * (0.5 + 0.5 * Math.sin(t * 1.9));
      this.link.material.opacity = 0.6 * linkOn;
      const lk = (t * 0.5) % 1; const lp = this.linkCurve.getPoint(lk);
      this.linkDot.position.set(lp.x, lp.y, lp.z);
      this.linkDot.material.opacity = ems * en * Math.sin(lk * Math.PI);
      // ---- final edge pulse
      this.pulseOvl.material.uniforms.uPos.value = -0.12 + 1.24 * r(0.93, 1.0, E.sine);
      this.pulseOvl.material.uniforms.uGain.value = 0.75 * (p > 0.92 ? 1 : 0) * en;

      this._busy = Math.abs(this.scrollTarget - this.scrollP) > 0.0004 || massage > 0.01 || ems > 0.01 || edge > 0.01;
      const moving = Math.abs(this.scrollTarget - this.scrollP) > 0.0004
        || Math.abs(mouse.tx - mouse.x) > 0.0015 || Math.abs(mouse.ty - mouse.y) > 0.0015
        || massage > 0.01 || heat > 0.01 || ems > 0.01 || nodesLit > 0.01 || edge > 0.01
        || (p < 0.02 || p > 0.98);   // gentle float only holds at the resting frames
      this.renderer.render(this.scene, camera);
      if (moving) this._raf = requestAnimationFrame(this._frame);
    }
  }
  customElements.define('hero-scroll', HeroScroll);
})();
