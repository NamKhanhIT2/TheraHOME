// <cinematic-scroll> — one scroll-scrubbed camera journey through the TheraHOME house.
//
// Ported from cinematic-scroll.js in the Claude Design project ("Home Cinematic.dc.html").
// The scene thresholds, plate moves and copy easing are the design's own, kept
// as they were: this choreography is dense enough that a paraphrase would
// drift. Two things differ from the design file, both marked NEXT below:
//   1. The design styled its own <nav data-cine-nav> with fixed colours. Here
//      the site nav is shared by every public page and already carries its
//      glass style, so at the top of the journey we only make it transparent,
//      and when scrolled (or when this element leaves the page) we hand its
//      original inline values back rather than overwrite them.
//   2. The video branch is kept but unused — the design describes footage
//      (approach.mp4) that the shipped HTML never includes.
(() => {
  if (customElements.get('cinematic-scroll')) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const p2out = (t) => 1 - (1 - t) * (1 - t);
  const p3out = (t) => 1 - Math.pow(1 - t, 3);
  const seg = (p, a, b, e = p2out) => e(clamp((p - a) / (b - a), 0, 1));

  // ---- central scene configuration (progress thresholds, 0..1)
  const SCENES = [
    { id: 1, to: 0.18, copyIn: [-0.06, 0.00], copyOut: [0.12, 0.18] },
    { id: 2, to: 0.35, copyIn: [0.19, 0.23], copyOut: [0.31, 0.35] },
    { id: 3, to: 0.55, copyIn: [0.35, 0.39], copyOut: [0.48, 0.52] },
    { id: 4, to: 0.72, copyIn: [0.55, 0.59], copyOut: [0.68, 0.72] },
    { id: 5, to: 0.88, copyIn: [0.72, 0.76], copyOut: [0.84, 0.87] },
    { id: 6, to: 1.01, copyIn: [0.90, 0.95], copyOut: [1.10, 1.20] },
  ];
  // Four stills joined as one forward camera move: the outgoing plate pushes into its doorway
  // (transform-origin at the opening) while the next plate arrives at scale 1 — no inset frames.
  const lin = (t) => t;
  const PLATES = [
    { key: 'ext',   origin: '60% 52%', in: [-0.1, 0.0],  out: [0.24, 0.32], move: (p) => `scale(${1 + 0.06 * seg(p, 0, 0.24, lin) + 0.42 * seg(p, 0.24, 0.33, lin)})` },
    { key: 'door',  origin: '58% 50%', in: [0.24, 0.32], out: [0.46, 0.54], move: (p) => `scale(${1 + 0.05 * seg(p, 0.24, 0.46, lin) + 0.45 * seg(p, 0.46, 0.55, lin)})` },
    { key: 'foyer', origin: '79% 46%', in: [0.46, 0.54], out: [0.68, 0.76], move: (p) => { const t = seg(p, 0.54, 0.77, lin); return `translateX(${-3 * t}%) scale(${1 + 0.05 * seg(p, 0.46, 0.68, lin) + 0.6 * seg(p, 0.68, 0.77, lin)})`; } },
    { key: 'gym',   origin: '52% 50%', in: [0.68, 0.76], out: [1.10, 1.20], move: (p) => `scale(${1 + 0.04 * seg(p, 0.68, 1.0, lin)})` },
  ];

  class CinematicScroll extends HTMLElement {
    connectedCallback() {
      if (this._booted) return; this._booted = true;
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.mobile = () => innerWidth < 760;
      this.style.display = 'block';
      this.style.height = this.mobile() ? '420vh' : '640vh';

      this.stage = this.querySelector('[data-cine-stage]');
      this.video = this.querySelector('video');
      this.plates = {};
      this.querySelectorAll('[data-cine-plate]').forEach((el) => { this.plates[el.dataset.cinePlate] = el; });
      this.copies = [...this.querySelectorAll('[data-cine-copy]')];
      this.steps = [...this.querySelectorAll('[data-cine-step]')];
      this.fill = this.querySelector('[data-cine-fill]');
      this.nav = document.querySelector('[data-cine-nav]');
      // NEXT: remember the nav's own inline style so it can be given back.
      if (this.nav && !this.nav._cineBase) {
        this.nav._cineBase = {
          background: this.nav.style.background,
          backdropFilter: this.nav.style.backdropFilter,
          webkitBackdropFilter: this.nav.style.webkitBackdropFilter,
          borderBottomColor: this.nav.style.borderBottomColor,
        };
      }

      if (this.video) {
        this.video.muted = true; this.video.playsInline = true; this.video.preload = 'auto';
        this.video.pause();
        const ready = () => { this.vdur = this.video.duration || 5.2; this.vready = true; this.render(true); };
        if (this.video.readyState >= 1) ready(); else this.video.addEventListener('loadedmetadata', ready, { once: true });
      }
      this.p = 0; this.pt = 0; this.vt = 0;
      // scroll handler renders synchronously (correct even where rAF is throttled);
      // the loop only continues the ease-out settle, via rAF with a timer fallback
      this._onScroll = () => { this.dirty = true; this.step(); this.schedule(); };
      this._onResize = () => { this.style.height = this.mobile() ? '420vh' : '640vh'; this._onScroll(); };
      this.schedule = () => {
        if (this.raf) return;
        this.raf = requestAnimationFrame(this.tick);
        clearTimeout(this.fallback);
        this.fallback = setTimeout(() => { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; this.tick(); } }, 60);
      };
      this.step = () => {
        const target = this.pt;
        const d = target - this.p;
        this.p = Math.abs(d) < 0.0005 ? target : this.p + d * 0.08;
        this.render();
      };
      this.tick = () => {
        this.raf = 0; clearTimeout(this.fallback);
        this.step();
        if (this.p !== this.pt) this.schedule();
      };
      window.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', this._onResize);
      this._onScroll();
    }
    disconnectedCallback() {
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onResize);
      cancelAnimationFrame(this.raf); this.raf = 0; clearTimeout(this.fallback);
      // NEXT: the shared nav outlives this element (client-side navigation),
      // so it must not be left transparent over the next page.
      this.restoreNav();
      this._booted = false;
    }

    restoreNav() {
      const nav = this.nav, base = nav && nav._cineBase;
      if (!base) return;
      nav.style.background = base.background;
      nav.style.backdropFilter = base.backdropFilter;
      nav.style.webkitBackdropFilter = base.webkitBackdropFilter;
      nav.style.borderBottomColor = base.borderBottomColor;
    }

    measure() {
      const r = this.getBoundingClientRect();
      const span = r.height - innerHeight;
      this.pt = clamp(-r.top / Math.max(span, 1), 0, 1);
      const nav = this.nav;
      if (nav) {
        // NEXT: transparent over the opening frame, the nav's own glass after.
        if (scrollY > 40) this.restoreNav();
        else {
          nav.style.background = 'transparent';
          nav.style.backdropFilter = 'none';
          nav.style.webkitBackdropFilter = 'none';
          nav.style.borderBottomColor = 'transparent';
        }
      }
    }

    render(force) {
      if (this.dirty || force) { this.measure(); this.dirty = false; }
      if (this.dirty === false && force) this.p = this.pt;
      const p = this.reduced ? this.pt : this.p;
      this.setAttribute('data-progress', p.toFixed(3));
      const scene = SCENES.find((s) => p < s.to) || SCENES[SCENES.length - 1];
      this.setAttribute('data-scene', String(scene.id));

      // ---- plates
      for (const pl of PLATES) {
        const el = this.plates[pl.key]; if (!el) continue;
        const o = seg(p, pl.in[0], pl.in[1]) * (1 - seg(p, pl.out[0], pl.out[1]));
        el.style.opacity = o.toFixed(3);
        el.style.transformOrigin = pl.origin;
        el.style.transform = this.reduced ? 'none' : pl.move(p);
        el.style.visibility = o > 0.001 ? 'visible' : 'hidden';
      }
      // gentle darkening for legibility in the final beat
      const grade = this.querySelector('[data-cine-grade]');
      if (grade) grade.style.opacity = '0.26';

      // ---- copy blocks: opacity 0→1, y 24→0, blur 8→0, staggered by child index
      for (const block of this.copies) {
        const s = SCENES[+block.dataset.cineCopy - 1]; if (!s) continue;
        const kids = block.children;
        let any = false;
        for (let i = 0; i < kids.length; i++) {
          const dl = i * 0.012;
          const a = seg(p, s.copyIn[0] + dl, s.copyIn[1] + dl, p3out);
          const b = seg(p, s.copyOut[0] + dl * 0.5, s.copyOut[1] + dl * 0.5, p2out);
          const o = a * (1 - b);
          const k = kids[i];
          if (this.reduced) { k.style.opacity = o > 0.5 ? '1' : '0'; k.style.transform = 'none'; k.style.filter = 'none'; }
          else {
            k.style.opacity = o.toFixed(3);
            k.style.transform = `translateY(${(24 * (1 - a) - 16 * b).toFixed(2)}px)`;
            k.style.filter = o > 0.98 ? 'none' : `blur(${(8 * (1 - a) + 6 * b).toFixed(2)}px)`;
          }
          if (o > 0.01) any = true;
        }
        block.style.visibility = any ? 'visible' : 'hidden';
        block.style.pointerEvents = any && p > s.copyIn[1] - 0.02 && p < s.copyOut[0] ? 'auto' : 'none';
      }
      // ---- progress rail
      this.steps.forEach((el, i) => { el.setAttribute('data-active', i + 1 === scene.id ? 'true' : 'false'); el.setAttribute('data-done', i + 1 < scene.id ? 'true' : 'false'); });
      if (this.fill) this.fill.style.transform = `scaleY(${p.toFixed(4)})`;
    }
  }
  customElements.define('cinematic-scroll', CinematicScroll);
})();
