(function (global) {
  'use strict';

  const { createComponent, RayTracer, Renderer } = global.OptiLab;

  // ── Optical Scene Builders (shared by Hero Preview & Live Screenshot Cards) ──
  function buildScene(sceneName, pointerOffset = 0) {
    if (sceneName === 'prism-dispersion') {
      const led = createComponent('white-led', -220, 22);
      led.numRays = 1;
      led.spreadAngle = 0;
      led.rotation = -8 + pointerOffset * 10;
      const prism = createComponent('prism', -10, 0);
      prism.sideLength = 128;
      prism.refractiveIndex = 1.58;
      prism.dispersion = 0.085;
      prism.splitSpectrum = true;
      prism.rotation = pointerOffset * 6;
      return { components: [led, prism], zoom: 0.92, offsetX: 30, offsetY: 0 };
    }

    if (sceneName === 'diffraction-grating') {
      const led = createComponent('white-led', -235, 0);
      led.numRays = 1;
      led.spreadAngle = 0;
      led.rotation = pointerOffset * 10;
      const grating = createComponent('diffraction-grating', -50, 0);
      grating.linesPerMm = 620;
      grating.maxOrder = 2;
      grating.aperture = 130;
      return { components: [led, grating], zoom: 0.9, offsetX: 35, offsetY: 0 };
    }

    if (sceneName === 'ball-lens') {
      const led = createComponent('white-led', -240, 0);
      led.numRays = 7;
      led.beamWidth = 78;
      led.spreadAngle = 0;
      led.rotation = pointerOffset * 8;
      const sphere = createComponent('glass-sphere', -20, 0);
      sphere.radius = 64;
      sphere.refractiveIndex = 1.54;
      sphere.dispersion = 0.065;
      sphere.splitSpectrum = true;
      return { components: [led, sphere], zoom: 0.92, offsetX: 35, offsetY: 0 };
    }

    if (sceneName === 'polarizer-malus') {
      const laser = createComponent('laser', -270, 0);
      laser.setWavelength(532);
      laser.numRays = 5;
      laser.beamWidth = 38;
      const p1 = createComponent('polarizer', -130, 0);
      p1.setPolAngle(0);
      const p2 = createComponent('polarizer', -10, 0);
      p2.setPolAngle(45 + pointerOffset * 35);
      const p3 = createComponent('polarizer', 110, 0);
      p3.setPolAngle(90);
      const det = createComponent('optical-detector', 230, 0);
      return { components: [laser, p1, p2, p3, det], zoom: 0.78, offsetX: 0, offsetY: 0 };
    }

    if (sceneName === 'interferometer') {
      const laser = createComponent('laser', -255, -20);
      laser.setWavelength(532);
      laser.numRays = 3;
      laser.beamWidth = 18;
      const splitter = createComponent('beam-splitter', -40, -20);
      splitter.reflectance = 0.5;
      const mirror = createComponent('plane-mirror', -40, 125);
      mirror.rotation = 45 + pointerOffset * 8;
      const detRight = createComponent('optical-detector', 210, -20);
      const detBottom = createComponent('optical-detector', 175, 125);
      return { components: [laser, splitter, mirror, detRight, detBottom], zoom: 0.82, offsetX: 0, offsetY: -30 };
    }

    if (sceneName === 'pinhole-slit') {
      const src = createComponent('point-source', -235, 0);
      src.numRays = 34;
      src.spreadAngle = 140;
      src.rotation = pointerOffset * 12;
      const slit = createComponent('aperture-slit', -65, 0);
      slit.slitCount = 2;
      slit.slitWidth = 18;
      slit.slitSpacing = 54;
      slit.aperture = 190;
      const lens = createComponent('convex-lens', 85, 0);
      lens.focalLength = 135;
      lens.aperture = 155;
      const det = createComponent('optical-detector', 235, 0);
      det.aperture = 110;
      return { components: [src, slit, lens, det], zoom: 0.82, offsetX: 0, offsetY: 0 };
    }

    // Default: converging lens
    const laser = createComponent('laser', -240, 0);
    laser.numRays = 9;
    laser.beamWidth = 76;
    const lens = createComponent('convex-lens', -20, 0);
    lens.focalLength = 155;
    lens.aperture = 130;
    const det = createComponent('optical-detector', 135, 0);
    return { components: [laser, lens, det], zoom: 0.9, offsetX: 0, offsetY: 0 };
  }

  function renderSceneToCanvas(canvas, sceneName, theme, pointerOffset = 0, scaleBoost = 1) {
    if (!canvas || !canvas.parentElement) return;
    if (!canvas._lpRenderer) {
      canvas._lpRenderer = new Renderer(canvas);
      canvas._lpTracer = new RayTracer();
    }
    const renderer = canvas._lpRenderer;
    const tracer = canvas._lpTracer;
    renderer.setTheme(theme);
    renderer.resize();

    const { components, zoom, offsetX, offsetY } = buildScene(sceneName, pointerOffset);
    tracer.trace(components);

    const effectiveZoom = zoom * scaleBoost * Math.min(1, renderer.width / 560);
    const panX = renderer.width / 2 + offsetX * effectiveZoom;
    const panY = renderer.height / 2 + offsetY * effectiveZoom;

    renderer.clear();
    renderer.drawGrid(panX, panY, effectiveZoom);
    renderer.drawRays(tracer.segments, panX, panY, effectiveZoom);
    renderer.drawComponents(components, null, null, panX, panY, effectiveZoom);
  }

  // ── Landing Page Controller ──
  class LandingController {
    constructor() {
      this.theme = 'dark';
      this.lang = 'en';
      this.heroScene = 'prism-dispersion';
      this.heroPointer = 0;

      try {
        const savedTheme = localStorage.getItem('optilab-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') this.theme = savedTheme;
        const savedLang = localStorage.getItem('optilab-lang');
        if (savedLang === 'en' || savedLang === 'sk') this.lang = savedLang;
      } catch (_e) {}

      this._bindUI();
      this._syncVersionBadges();
      this.setTheme(this.theme);
      this.setLang(this.lang);
      this.renderAllCanvases();
    }

    _syncVersionBadges() {
      const ver = (global.OptiLab && global.OptiLab.VERSION) || '1.0.0';
      document.querySelectorAll('[data-optilab-version]').forEach((el) => {
        el.textContent = `v${ver}`;
      });
    }

    setTheme(theme) {
      this.theme = theme === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', this.theme);
      document.body.classList.toggle('dark-mode', this.theme === 'dark');
      document.body.classList.toggle('light-mode', this.theme === 'light');

      const sun = document.querySelector('.theme-icon-sun');
      const moon = document.querySelector('.theme-icon-moon');
      if (sun && moon) {
        sun.style.display = this.theme === 'dark' ? 'block' : 'none';
        moon.style.display = this.theme === 'dark' ? 'none' : 'block';
      }

      try {
        localStorage.setItem('optilab-theme', this.theme);
      } catch (_e) {}

      this.renderAllCanvases();
    }

    setLang(lang) {
      this.lang = lang === 'sk' ? 'sk' : 'en';
      document.documentElement.setAttribute('lang', this.lang);
      document.title =
        this.lang === 'sk'
          ? 'OptiLab — Interaktívny 2D simulátor geometrickej optiky'
          : 'OptiLab — Interactive 2D Geometric Optics Simulator';

      try {
        localStorage.setItem('optilab-lang', this.lang);
      } catch (_e) {}

      document.querySelectorAll('[data-lp-en]').forEach((el) => {
        const text = this.lang === 'sk' ? el.dataset.lpSk : el.dataset.lpEn;
        if (text !== undefined) {
          if (el.dataset.lpHtml === 'true') el.innerHTML = text;
          else el.textContent = text;
        }
      });

      document.querySelectorAll('.lang-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.lang === this.lang);
      });
    }

    renderHero() {
      const heroCanvas = document.getElementById('hero-canvas');
      if (heroCanvas) {
        renderSceneToCanvas(heroCanvas, this.heroScene, this.theme, this.heroPointer, 1.05);
      }
      const launchBtn = document.getElementById('hero-launch-preset');
      if (launchBtn) {
        launchBtn.href = `app.html?preset=${encodeURIComponent(this.heroScene)}`;
      }
    }

    renderAllCanvases() {
      this.renderHero();
      document.querySelectorAll('canvas[data-shot-scene]').forEach((canvas) => {
        renderSceneToCanvas(canvas, canvas.dataset.shotScene, this.theme, 0, 0.92);
      });
    }

    _bindUI() {
      const themeBtn = document.getElementById('lp-btn-theme');
      if (themeBtn) {
        themeBtn.addEventListener('click', () => {
          this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
        });
      }

      document.querySelectorAll('.lang-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.setLang(btn.dataset.lang);
        });
      });

      document.querySelectorAll('.window-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.window-tab').forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          this.heroScene = tab.dataset.scene || 'prism-dispersion';
          this.heroPointer = 0;
          this.renderHero();
        });
      });

      const heroStage = document.getElementById('hero-stage');
      if (heroStage) {
        heroStage.addEventListener('pointermove', (e) => {
          const rect = heroStage.getBoundingClientRect();
          const normY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
          this.heroPointer = Math.max(-1, Math.min(1, normY));
          this.renderHero();
        });
        heroStage.addEventListener('pointerleave', () => {
          this.heroPointer = 0;
          this.renderHero();
        });
      }

      let resizeTimer = null;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => this.renderAllCanvases(), 60);
      });
    }
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('DOMContentLoaded', () => {
      window.optiLabLanding = new LandingController();
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
