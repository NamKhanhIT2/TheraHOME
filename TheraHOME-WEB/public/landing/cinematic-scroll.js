// <cinematic-scroll> — one continuous scroll-scrubbed walkthrough.
// CinematicScroller — master progress, smoothing, rAF loop (custom element)
// VideoSegmentManager — preloads clips, scrubs the active one, pre-aligns neighbours, tiny boundary blend
// SceneCopy · ProgressRail · CinematicNav
//
// Ported from the Claude Design project ("Home Cinematic.dc.html", 2026-09-18
// rewrite). The design ships this as two files — cinematic-config.js defining
// window.CINEMATIC_CONFIG, then cinematic-scroll.js reading it. They are merged
// here ON PURPOSE: the script captures the config at load time (`const CFG =`
// below runs immediately), so a two-file split would make the hero depend on
// Next loading two <Script> tags in order. One file cannot get that wrong.
//
// Only the asset paths differ from the design (./assets/cine/… → /landing/cine/…,
// and the closing still is .jpg here — see public/landing/README.md).
/* eslint-disable @typescript-eslint/no-unused-expressions -- `a && a()` short-circuit
   calls are the design's own idiom; this file is kept diffable against it. */
(() => {
  if (customElements.get('cinematic-scroll')) return;

  // ---- cinematic-config.js, inlined ---------------------------------------
  // Central configuration for the TheraHOME cinematic scroll.
  // One timeline, three real-footage segments. Scroll scrubs them; the doors open in clip 01 itself.
  const CFG = {
    scrollHeight: { desktop: '860vh', mobile: '520vh' },
    smoothing: 0.07,
    copyDepth: { scaleFrom: 0.94, velocityShift: 900 },
    boundaryBlend: 0.006,
    // Source aspect of every plate (used to place the corner tag over the footage watermark)
    sourceAspect: 1248 / 704,
    // the stage carries the footage aspect (see data-cine-stage), so cover fills it with no crop
    fit: 'cover',
    segments: [
      { start: 0.00, end: 0.44, src: '/landing/cine/00.mp4', inTime: 0.00, outTime: null },
      { start: 0.44, end: 0.74, src: '/landing/cine/03.mp4', inTime: 0.10, outTime: null },
      // closing beat is a still: the generated footage's human motion reads artificial
      { start: 0.74, end: 1.00, type: 'still', src: '/landing/cine/gym-final.jpg', push: [1.0, 1.045] },
    ],
    copy: [
      { id: 1, in: [-0.05, 0.00], out: [0.12, 0.17] },
      { id: 2, in: [0.22, 0.26], out: [0.33, 0.36] },
      { id: 3, in: [0.50, 0.54], out: [0.56, 0.59] },
      { id: 4, in: [0.62, 0.65], out: [0.68, 0.70] },
      { id: 5, in: [0.80, 0.84], out: [0.88, 0.91] },
      { id: 6, in: [0.93, 0.96], out: [1.10, 1.20] },
    ],
    rail: [0.00, 0.22, 0.50, 0.62, 0.80, 0.93],
  };
  // ------------------------------------------------------------------------

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lin = (t) => t;
  const p2out = (t) => 1 - (1 - t) * (1 - t);
  const p3out = (t) => 1 - Math.pow(1 - t, 3);
  const seg = (p, a, b, e = p2out) => e(clamp((p - a) / (b - a), 0, 1));

  class VideoSegmentManager {
    constructor(host, reduced) {
      this.reduced = reduced;
      this.layer = host.querySelector('[data-cine-videos]');
      this.loading = host.querySelector('[data-cine-loading]');
      this.segs = CFG.segments.map((s, i) => {
        if (s.type === 'still') {
          const im = document.createElement('img');
          im.src = s.src; im.alt = '';
          im.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:${CFG.fit || 'cover'};opacity:0;transform-origin:50% 50%;will-change:opacity,transform;`;
          this.layer.appendChild(im);
          return { ...s, node: im, still: true, ready: true };
        }
        const v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', '');
        v.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:${CFG.fit || 'cover'};opacity:${i === 0 ? 1 : 0};will-change:opacity;`;
        this.layer.appendChild(v);
        const S = { ...s, v, node: v, dur: 0, ready: false, lastT: -1 };
        v.addEventListener('loadedmetadata', () => {
          S.dur = v.duration; S.ready = true; v.currentTime = s.inTime || 0;
          if (i === 0) this.firstReady();
          this.pending && this.pending();
        }, { once: true });
        // NEXT: the design fires every fetch at once. The opening frame is
        // what the visitor is waiting for, and a second clip racing it takes
        // half the bandwidth for footage not needed until 44% of the scroll —
        // so clip 0 downloads alone and the rest queue behind it.
        S.load = () => fetch(s.src)
          .then((r) => r.blob())
          .then((b) => { v.src = URL.createObjectURL(b); })
          .catch(() => { v.src = s.src; });
        return S;
      });
      this.frame();
      this.loadInOrder();
    }
    /** Clip 0 first, then the rest in timeline order. */
    loadInOrder() {
      const queue = this.segs.filter((S) => S.load);
      const next = () => { const S = queue.shift(); if (S) S.load().finally(next); };
      next();
    }
    // framing is re-applied on every resize: never latched to the width at boot
    frame() {
      const mobile = innerWidth > 0 && innerWidth < 760;
      this.segs.forEach((S) => { if (S.v && S.objectPosition) S.v.style.objectPosition = mobile ? S.mobilePosition : S.objectPosition; });
    }
    onReady(fn) { this.pending = fn; }
    firstReady() { if (this.loading) { this.loading.style.opacity = '0'; setTimeout(() => this.loading.remove(), 500); } }
    local(S, p) { return clamp((p - S.start) / (S.end - S.start), 0, 1); }
    timeFor(S, p) {
      const a = S.inTime || 0, b = S.outTime != null ? Math.min(S.outTime, S.dur) : S.dur - 0.04;
      return a + this.local(S, p) * (b - a);
    }
    // Forward: let the decoder run and catch up (smooth); backward/long jumps: quantised seek.
    seek(S, t, chase) {
      if (!S.ready || !S.v) return;
      const v = S.v, d = t - v.currentTime;
      if (chase && d > 0.03 && d < 0.25) {
        v.playbackRate = clamp(d * 8, 0.5, 2.5);
        if (v.paused) v.play().catch(() => {});
        S.chasing = true; this.busy = true; return;
      }
      if (S.chasing) { v.pause(); S.chasing = false; }
      const q = Math.round(t * 24) / 24;
      if (Math.abs(q - v.currentTime) > 0.03 && !v.seeking) { v.currentTime = q; S.lastT = q; }
    }
    // progress per tick equivalent to ~2 source frames of the active clip
    maxStep(p) {
      const S = this.segs.find((s) => p < s.end) || this.segs[this.segs.length - 1];
      if (!S.v || S.still) return 1;
      const a = S.inTime || 0, b = S.outTime != null ? Math.min(S.outTime, S.dur || 5) : (S.dur || 5) - 0.04;
      return (2 / 24) * (S.end - S.start) / Math.max(b - a, 0.5);
    }
    stopAll() { this.segs.forEach((S) => { if (S.chasing) { S.v.pause(); S.chasing = false; } }); this.busy = false; }
    // NEXT: pause every clip and drop the blob URLs when the element leaves.
    // In the design this page is the whole document; here a client-side route
    // change unmounts it, and a still-decoding <video> would keep running.
    destroy() {
      this.segs.forEach((S) => {
        if (!S.v) return;
        S.v.pause();
        if (S.v.src.startsWith('blob:')) URL.revokeObjectURL(S.v.src);
        S.v.removeAttribute('src'); S.v.load();
      });
    }
    update(p) {
      const ai = Math.max(0, this.segs.findIndex((s) => p < s.end));
      const A = this.segs[ai];
      if (this.reduced) {
        this.segs.forEach((S, i) => {
          S.node.style.opacity = i === ai ? '1' : '0';
          if (i === ai && !S.still) this.seek(S, this.timeFor(S, (S.start + S.end) / 2));
        });
        return;
      }
      this.busy = false;
      if (A.still) { const t = this.local(A, p); const k = A.push[0] + (A.push[1] - A.push[0]) * t; A.node.style.transform = `scale(${k.toFixed(4)})`; }
      else this.seek(A, this.timeFor(A, p), true);
      const N = this.segs[ai + 1], P = this.segs[ai - 1];
      if (N && !N.still) this.seek(N, this.timeFor(N, N.start), false);
      if (P && !P.still && +P.node.style.opacity === 0) this.seek(P, this.timeFor(P, P.end), false);
      this.segs.forEach((S, i) => { if (i !== ai && S.chasing) { S.v.pause(); S.chasing = false; } });
      this.segs.forEach((S, i) => {
        let o = 0;
        if (i === ai) o = 1;
        else if (N && i === ai + 1) o = seg(p, N.start - (N.blendIn || CFG.boundaryBlend), N.start, lin);
        else if (P && i === ai - 1) o = 1 - seg(p, P.end, P.end + (P.blendOut || CFG.boundaryBlend), lin);
        S.node.style.opacity = o.toFixed(3);
      });
    }
  }

  class SceneCopy {
    constructor(host, reduced) { this.reduced = reduced; this.blocks = [...host.querySelectorAll('[data-cine-copy]')]; }
    update(p, vel = 0) {
      const D = CFG.copyDepth || { scaleFrom: 1, velocityShift: 0 };
      const drift = clamp(vel * D.velocityShift, -28, 28);
      for (const block of this.blocks) {
        const c = CFG.copy.find((x) => x.id === +block.dataset.cineCopy); if (!c) continue;
        const kids = [...block.children].filter((n) => !n.hasAttribute('data-cine-scrim'));
        const scrim = block.querySelector('[data-cine-scrim]');
        let any = false, peak = 0;
        for (let i = 0; i < kids.length; i++) {
          const dl = i * 0.01;
          const a = seg(p, c.in[0] + dl, c.in[1] + dl, p3out);
          const b = seg(p, c.out[0] + dl * 0.5, c.out[1] + dl * 0.5, p2out);
          const o = a * (1 - b); const k = kids[i];
          if (this.reduced) { k.style.opacity = o > 0.5 ? '1' : '0'; k.style.transform = 'none'; }
          else {
            const sc = D.scaleFrom + (1 - D.scaleFrom) * a;
            k.style.opacity = o.toFixed(3);
            k.style.transform = `translateY(${(22 * (1 - a) - 14 * b - drift * (1 + i * 0.35)).toFixed(2)}px) scale(${sc.toFixed(4)})`;
            k.style.transformOrigin = '0 50%';
          }
          if (o > 0.01) any = true;
          if (o > peak) peak = o;
        }
        if (scrim) scrim.style.opacity = peak.toFixed(3);
        block.style.visibility = any ? 'visible' : 'hidden';
        block.style.pointerEvents = any && p > c.in[1] - 0.02 && p < c.out[0] ? 'auto' : 'none';
      }
    }
  }

  class ProgressRail {
    constructor(host) { this.steps = [...host.querySelectorAll('[data-cine-step]')]; this.fill = host.querySelector('[data-cine-fill]'); this.active = -1; }
    update(p) {
      let idx = 0; CFG.rail.forEach((t, i) => { if (p >= t) idx = i; });
      if (idx !== this.active) { this.active = idx; this.steps.forEach((s, i) => { s.setAttribute('data-active', i === idx ? 'true' : 'false'); s.setAttribute('data-done', i < idx ? 'true' : 'false'); }); }
      if (this.fill) this.fill.style.transform = `scaleY(${p.toFixed(4)})`;
    }
  }

  // The design's nav is solid from the first pixel in this revision, so this
  // does nothing — kept so the shape matches the source if it grows again.
  class CinematicNav {
    constructor() { this.nav = document.querySelector('[data-cine-nav]'); this.on = null; }
    update() {}
  }

  class CinematicScroller extends HTMLElement {
    connectedCallback() {
      if (this._booted) return; this._booted = true;
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.isMobile = () => innerWidth > 0 && innerWidth < 760;
      this.style.display = 'block';
      this.style.height = this.isMobile() ? CFG.scrollHeight.mobile : CFG.scrollHeight.desktop;
      this.videos = new VideoSegmentManager(this, this.reduced);
      this.videos.onReady(() => { this.videos.segs.forEach((S) => { S.lastT = -1; }); this.render(this.p); });
      this.copy = new SceneCopy(this, this.reduced);
      this.rail = new ProgressRail(this);
      this.nav = new CinematicNav();
      this.p = 0; this.pt = 0; this.raf = 0; this.vel = 0;
      this.tick = () => {
        this.raf = 0;
        const d = this.pt - this.p, prev = this.p;
        const maxStep = this.videos.maxStep(this.p);
        this.p = Math.abs(d) < 0.0004 ? this.pt : this.p + clamp(d * CFG.smoothing, -maxStep, maxStep);
        this.vel = this.reduced ? 0 : this.p - prev;
        this.render(this.reduced ? this.pt : this.p);
        if (this.p !== this.pt || this.videos.busy) this.raf = requestAnimationFrame(this.tick);
        else this.videos.stopAll();
      };
      this._onScroll = () => { this.measure(); this.nav.update(); if (!this.raf) this.raf = requestAnimationFrame(this.tick); };
      this._onResize = () => { this.style.height = this.isMobile() ? CFG.scrollHeight.mobile : CFG.scrollHeight.desktop; this.videos.frame(); this._onScroll(); };
      addEventListener('scroll', this._onScroll, { passive: true });
      addEventListener('resize', this._onResize);
      this._onScroll();
      this.render(0);
    }
    // NEXT: the design never unmounts this. Next does, on every client-side
    // navigation away from the home page — so the listeners, the rAF loop and
    // the decoding videos all have to be let go, or they run for the rest of
    // the session behind whatever page the visitor opened next.
    disconnectedCallback() {
      removeEventListener('scroll', this._onScroll);
      removeEventListener('resize', this._onResize);
      cancelAnimationFrame(this.raf); this.raf = 0;
      this.videos && this.videos.destroy();
      this._booted = false;
    }
    measure() { const r = this.getBoundingClientRect(); this.pt = clamp(-r.top / Math.max(r.height - innerHeight, 1), 0, 1); }
    setProgress(p) { this.pt = this.p = clamp(p, 0, 1); this.vel = 0; this.render(this.p); }
    render(p) {
      this.setAttribute('data-progress', p.toFixed(3));
      this.videos.update(p);
      this.copy.update(p, this.vel);
      this.rail.update(p);
    }
  }
  customElements.define('cinematic-scroll', CinematicScroller);
})();
