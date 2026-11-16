(function (global) {
  'use strict';

  const CFG = {
    GRID_SIZE: 20,
    GRID_MAJOR: 5,
    MAX_RAY_LENGTH: 8000,
    MAX_REFRACTIONS: 32,
    MAX_TOTAL_SEGMENTS: 2000,
    RAY_EPSILON: 0.4,
    ROTATION_HANDLE_DIST: 38,
    ROTATION_HANDLE_R: 6,
    HIT_PADDING: 8,
    MIN_ZOOM: 0.15,
    MAX_ZOOM: 5.0,
    ZOOM_FACTOR: 1.1,
    DEFAULT_WAVELENGTH: 633, // HeNe laser standard 632.8nm
    DEFAULT_FOCAL_LENGTH: 160,
    DEFAULT_APERTURE: 120,
    DEFAULT_BEAM_RAYS: 7,
    DEFAULT_BEAM_WIDTH: 72,
    DEFAULT_MIRROR_APERTURE: 110,
    DEFAULT_SPLITTER_SIZE: 84,
    DEFAULT_PRISM_SIZE: 110,
    DEFAULT_BLOCK_WIDTH: 140,
    DEFAULT_BLOCK_HEIGHT: 84,
    DEFAULT_DETECTOR_APERTURE: 76,
    DEFAULT_REFRACTIVE_INDEX: 1.52,
  };

  let _idCounter = 0;
  function uid() {
    return 'opt_' + (++_idCounter);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function deg(r) {
    return (r * 180) / Math.PI;
  }

  function rad(d) {
    return (d * Math.PI) / 180;
  }

  function normAngle(d) {
    let a = (((d + 180) % 360) + 360) % 360 - 180;
    return Math.round(a * 10) / 10;
  }

  // ── 2D Vector Operations ──
  const V = {
    create(x, y) { return { x, y }; },
    add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; },
    sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; },
    scale(v, s) { return { x: v.x * s, y: v.y * s }; },
    dot(a, b) { return a.x * b.x + a.y * b.y; },
    cross(a, b) { return a.x * b.y - a.y * b.x; },
    len(v) { return Math.sqrt(v.x * v.x + v.y * v.y); },
    norm(v) {
      const l = V.len(v);
      return l < 1e-12 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
    },
    rot(v, angleRad) {
      const c = Math.cos(angleRad), s = Math.sin(angleRad);
      return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
    },
    perp(v) { return { x: -v.y, y: v.x }; },
    dist(a, b) { return V.len(V.sub(a, b)); },
  };

  // ── Spectral Wavelength (380nm - 780nm) to RGB ──
  function wavelengthToRGB(wl) {
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) {
      r = -(wl - 440) / (440 - 380); g = 0; b = 1;
    } else if (wl < 490) {
      r = 0; g = (wl - 440) / (490 - 440); b = 1;
    } else if (wl < 510) {
      r = 0; g = 1; b = -(wl - 510) / (510 - 490);
    } else if (wl < 580) {
      r = (wl - 510) / (580 - 510); g = 1; b = 0;
    } else if (wl < 645) {
      r = 1; g = -(wl - 645) / (645 - 580); b = 0;
    } else if (wl <= 780) {
      r = 1; g = 0; b = 0;
    }

    let factor = 1.0;
    if (wl >= 380 && wl < 420) factor = 0.35 + 0.65 * (wl - 380) / (420 - 380);
    else if (wl > 700 && wl <= 780) factor = 0.35 + 0.65 * (780 - wl) / (780 - 700);

    return {
      r: Math.round(255 * Math.pow(r * factor, 0.8)),
      g: Math.round(255 * Math.pow(g * factor, 0.8)),
      b: Math.round(255 * Math.pow(b * factor, 0.8)),
    };
  }

  function rgbStr(c, a = 1) {
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
  }

  // ── Base Component ──
  class Component {
    constructor(type, x, y) {
      this.id = uid();
      this.type = type;
      this.x = Math.round(x);
      this.y = Math.round(y);
      this.rotation = 0; // degrees
      this.locked = false;
      this.groupId = null;
    }
  }

  // ── Laser / White LED / RGB LED Light Source ──
  class Laser extends Component {
    constructor(x, y, mode = false) {
      const resolvedType =
        mode === 'rgb-led'
          ? 'rgb-led'
          : mode === true || mode === 'white-led'
          ? 'white-led'
          : 'laser';
      super(resolvedType, x, y);
      const isWhiteLed = resolvedType === 'white-led';
      const isRgbLed = resolvedType === 'rgb-led';

      this.wavelength = CFG.DEFAULT_WAVELENGTH;
      this.intensity = 1.0;
      this.numRays = isRgbLed ? 5 : CFG.DEFAULT_BEAM_RAYS;
      this.beamWidth = isWhiteLed || isRgbLed ? 48 : CFG.DEFAULT_BEAM_WIDTH;
      this.spreadAngle = isWhiteLed ? 12 : isRgbLed ? 6 : 0; // LED beam cone angle in degrees (0 = collimated)
      this.whiteLight = isWhiteLed;
      this.isRgbLed = isRgbLed;
      this.rgb = { r: 1.0, g: 1.0, b: 1.0 }; // Normalized R, G, B channel levels (0.0 - 1.0)
      this.splitRgbRays = true; // Emit discrete R (640nm), G (532nm), B (460nm) sub-beams or mixed beam
      this._color = wavelengthToRGB(this.wavelength);
    }

    get color() {
      if (this.whiteLight) return { r: 245, g: 248, b: 255 };
      if (this.isRgbLed) {
        const maxCh = Math.max(this.rgb.r, this.rgb.g, this.rgb.b, 0.01);
        return {
          r: Math.round(clamp((this.rgb.r / maxCh) * 255, 20, 255)),
          g: Math.round(clamp((this.rgb.g / maxCh) * 255, 20, 255)),
          b: Math.round(clamp((this.rgb.b / maxCh) * 255, 20, 255)),
        };
      }
      return this._color;
    }

    setRgb(r, g, b) {
      this.rgb = {
        r: clamp(Number(r), 0, 1),
        g: clamp(Number(g), 0, 1),
        b: clamp(Number(b), 0, 1),
      };
    }

    setWavelength(wl) {
      this.wavelength = clamp(Math.round(wl), 380, 780);
      this._color = wavelengthToRGB(this.wavelength);
    }

    get bodyW() { return this.type === 'white-led' || this.type === 'rgb-led' ? 40 : 46; }
    get bodyH() { return this.type === 'rgb-led' ? 26 : 24; }
  }

  // ── Thin Lens (Convex / Concave) ──
  class Lens extends Component {
    constructor(type, x, y) {
      super(type, x, y);
      this.focalLength = CFG.DEFAULT_FOCAL_LENGTH;
      this.aperture = CFG.DEFAULT_APERTURE;
    }

    get fSigned() {
      return this.type === 'convex-lens' ? this.focalLength : -this.focalLength;
    }

    get opticalPower() {
      return (1000 / this.fSigned).toFixed(2);
    }

    get thickness() {
      return this.type === 'convex-lens' ? 18 : 12;
    }
  }

  // ── 1. Plane Mirror ──
  class PlaneMirror extends Component {
    constructor(x, y) {
      super('plane-mirror', x, y);
      this.aperture = CFG.DEFAULT_MIRROR_APERTURE;
    }

    get thickness() { return 10; }
  }

  // ── 2. Beam Splitter ──
  class BeamSplitter extends Component {
    constructor(x, y) {
      super('beam-splitter', x, y);
      this.size = CFG.DEFAULT_SPLITTER_SIZE;
      this.reflectance = 0.5; // 0.0 to 1.0 (50% reflection / 50% transmission)
    }

    get transmittance() {
      return Math.max(0, 1 - this.reflectance);
    }
  }

  // ── 3. Triangular Optical Prism ──
  class Prism extends Component {
    constructor(x, y) {
      super('prism', x, y);
      this.sideLength = CFG.DEFAULT_PRISM_SIZE;
      this.apexAngle = 60; // degrees
      this.refractiveIndex = CFG.DEFAULT_REFRACTIVE_INDEX;
      this.dispersion = 0.06; // Cauchy dispersion coefficient
      this.splitSpectrum = true; // Splits single beam into spectral wavelengths if dispersion > 0
    }

    // Local vertices of isosceles prism centered at centroid
    getLocalVertices() {
      const s = this.sideLength;
      const halfApex = rad(this.apexAngle / 2);
      const h = s * Math.cos(halfApex);
      const halfBase = s * Math.sin(halfApex);
      // Centroid at (0,0): top apex at y = -2/3 h, base at y = +1/3 h
      const topY = (-2 / 3) * h;
      const botY = (1 / 3) * h;
      return [
        { x: 0, y: topY },           // Top apex
        { x: halfBase, y: botY },    // Bottom right
        { x: -halfBase, y: botY },   // Bottom left
      ];
    }

    getWorldVertices() {
      const rotRad = rad(this.rotation);
      return this.getLocalVertices().map((v) =>
        V.add({ x: this.x, y: this.y }, V.rot(v, rotRad))
      );
    }

    effectiveIndex(wavelength = 550) {
      // Cauchy-like dispersion around 550nm green reference
      const delta = (550 - wavelength) / 170;
      return clamp(this.refractiveIndex + this.dispersion * delta, 1.01, 3.0);
    }
  }

  // ── 4. Rectangular Glass Block ──
  class GlassBlock extends Component {
    constructor(x, y) {
      super('glass-block', x, y);
      this.width = CFG.DEFAULT_BLOCK_WIDTH;
      this.height = CFG.DEFAULT_BLOCK_HEIGHT;
      this.refractiveIndex = CFG.DEFAULT_REFRACTIVE_INDEX;
      this.dispersion = 0.02;
    }

    getLocalVertices() {
      const hw = this.width / 2;
      const hh = this.height / 2;
      return [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
      ];
    }

    getWorldVertices() {
      const rotRad = rad(this.rotation);
      return this.getLocalVertices().map((v) =>
        V.add({ x: this.x, y: this.y }, V.rot(v, rotRad))
      );
    }

    effectiveIndex(wavelength = 550) {
      const delta = (550 - wavelength) / 170;
      return clamp(this.refractiveIndex + this.dispersion * delta, 1.01, 3.0);
    }
  }

  // ── 5. Optical Detector ──
  class OpticalDetector extends Component {
    constructor(x, y) {
      super('optical-detector', x, y);
      this.aperture = CFG.DEFAULT_DETECTOR_APERTURE;
      // Live telemetry updated every trace frame
      this.detected = false;
      this.hitCount = 0;
      this.totalIntensity = 0;
      this.peakIntensity = 0;
      this.avgWavelength = 0;
      this._wavelengthWeightedSum = 0;
    }

    resetReadings() {
      this.detected = false;
      this.hitCount = 0;
      this.totalIntensity = 0;
      this.peakIntensity = 0;
      this.avgWavelength = 0;
      this._wavelengthWeightedSum = 0;
    }

    recordHit(intensity, wavelength) {
      this.detected = true;
      this.hitCount += 1;
      this.totalIntensity += intensity;
      if (intensity > this.peakIntensity) {
        this.peakIntensity = intensity;
      }
      this._wavelengthWeightedSum += intensity * (wavelength || 550);
      this.avgWavelength = Math.round(this._wavelengthWeightedSum / this.totalIntensity);
    }

    get bodyW() { return 26; }
  }

  // ── 6. Curved Mirror (Concave & Convex Spherical/Parabolic Mirror) ──
  class CurvedMirror extends Component {
    constructor(type, x, y) {
      super(type, x, y); // 'concave-mirror' | 'convex-mirror'
      this.radiusOfCurvature = 240; // R in px (focal length f = R / 2 = 120 px)
      this.aperture = 116;
      this.showFocalPoint = true;
    }

    get focalLength() {
      return this.radiusOfCurvature / 2;
    }

    get fSigned() {
      return this.type === 'concave-mirror' ? this.focalLength : -this.focalLength;
    }

    get opticalPower() {
      return Number((1000 / this.fSigned).toFixed(2));
    }

    get thickness() {
      return 8;
    }
  }

  // ── 7. Optical Filter (RGB / CMY & Bandpass Spectral Filter) ──
  const FILTER_PRESETS = {
    red: {
      name: 'Red',
      wl: 640,
      rgb: { r: 255, g: 38, b: 28 },
      channels: { r: 1, g: 0, b: 0 },
      pass: (wl) => (wl >= 585 ? 1.0 : wl >= 560 ? (wl - 560) / 25 : 0),
    },
    green: {
      name: 'Green',
      wl: 532,
      rgb: { r: 40, g: 235, b: 60 },
      channels: { r: 0, g: 1, b: 0 },
      pass: (wl) =>
        wl >= 490 && wl <= 575
          ? 1.0
          : wl >= 470 && wl < 490
          ? (wl - 470) / 20
          : wl > 575 && wl <= 595
          ? (595 - wl) / 20
          : 0,
    },
    blue: {
      name: 'Blue',
      wl: 460,
      rgb: { r: 35, g: 125, b: 255 },
      channels: { r: 0, g: 0, b: 1 },
      pass: (wl) => (wl <= 495 ? 1.0 : wl <= 515 ? (515 - wl) / 20 : 0),
    },
    cyan: {
      name: 'Cyan',
      wl: 492,
      rgb: { r: 0, g: 230, b: 245 },
      channels: { r: 0, g: 1, b: 1 },
      pass: (wl) => (wl <= 575 ? 1.0 : wl <= 595 ? (595 - wl) / 20 : 0),
    },
    magenta: {
      name: 'Magenta',
      wl: 620,
      rgb: { r: 240, g: 45, b: 220 },
      channels: { r: 1, g: 0, b: 1 },
      pass: (wl) =>
        wl <= 490 || wl >= 585
          ? 1.0
          : wl > 490 && wl <= 510
          ? (510 - wl) / 20
          : wl >= 565 && wl < 585
          ? (wl - 565) / 20
          : 0,
    },
    yellow: {
      name: 'Yellow',
      wl: 580,
      rgb: { r: 255, g: 225, b: 25 },
      channels: { r: 1, g: 1, b: 0 },
      pass: (wl) => (wl >= 500 ? 1.0 : wl >= 480 ? (wl - 480) / 20 : 0),
    },
  };

  class ColorFilter extends Component {
    constructor(x, y) {
      super('optical-filter', x, y);
      this.filterColor = 'red'; // 'red' | 'green' | 'blue' | 'cyan' | 'magenta' | 'yellow' | 'custom'
      this.passWavelength = 640;
      this.bandwidth = 65; // FWHM passband width (nm) for custom mode
      this.transmission = 0.9; // 0.0 to 1.0 (0% - 100%)
      this.aperture = 104;
      this._color = { ...FILTER_PRESETS.red.rgb };
    }

    get color() {
      return this._color;
    }

    setFilterColor(colorName) {
      const key = String(colorName).toLowerCase();
      if (FILTER_PRESETS[key]) {
        this.filterColor = key;
        this.passWavelength = FILTER_PRESETS[key].wl;
        this._color = { ...FILTER_PRESETS[key].rgb };
      }
    }

    setPassWavelength(wl) {
      this.passWavelength = clamp(Math.round(wl), 380, 780);
      this.filterColor = 'custom';
      this._color = wavelengthToRGB(this.passWavelength);
    }

    // Spectral transmittance (0.0 to 1.0) for a monochromatic wavelength, including transmission %
    transmittanceAt(wl) {
      const preset = FILTER_PRESETS[this.filterColor];
      let spectralFactor = 0;
      if (preset) {
        spectralFactor = preset.pass(wl);
      } else {
        const diff = Math.abs(wl - this.passWavelength);
        const halfBw = Math.max(5, this.bandwidth / 2);
        spectralFactor = Math.exp(-Math.pow(diff / halfBw, 2.4) * Math.LN2);
      }
      return spectralFactor * this.transmission;
    }

    // Filter an incoming ray (supports broadband white, multi-channel RGB/CMY, and monochromatic rays)
    filterRay(rayState) {
      if (this.transmission <= 0.005) return null;

      const preset = FILTER_PRESETS[this.filterColor];

      // If ray carries RGB channel state (from White LED or previous RGB/CMY filter)
      if (rayState.isWhite || rayState.rgbChannels) {
        const inCh = rayState.rgbChannels || { r: 1, g: 1, b: 1 };
        if (preset) {
          const outCh = {
            r: inCh.r * preset.channels.r,
            g: inCh.g * preset.channels.g,
            b: inCh.b * preset.channels.b,
          };
          const activeCount = (outCh.r > 0 ? 1 : 0) + (outCh.g > 0 ? 1 : 0) + (outCh.b > 0 ? 1 : 0);
          if (activeCount === 0) return null; // All compatible channels blocked

          // Determine resulting color and effective wavelength
          let outColor = preset.rgb;
          let outWl = preset.wl;
          if (outCh.r && !outCh.g && !outCh.b) {
            outColor = FILTER_PRESETS.red.rgb;
            outWl = FILTER_PRESETS.red.wl;
          } else if (!outCh.r && outCh.g && !outCh.b) {
            outColor = FILTER_PRESETS.green.rgb;
            outWl = FILTER_PRESETS.green.wl;
          } else if (!outCh.r && !outCh.g && outCh.b) {
            outColor = FILTER_PRESETS.blue.rgb;
            outWl = FILTER_PRESETS.blue.wl;
          } else if (!outCh.r && outCh.g && outCh.b) {
            outColor = FILTER_PRESETS.cyan.rgb;
            outWl = FILTER_PRESETS.cyan.wl;
          } else if (outCh.r && !outCh.g && outCh.b) {
            outColor = FILTER_PRESETS.magenta.rgb;
            outWl = FILTER_PRESETS.magenta.wl;
          } else if (outCh.r && outCh.g && !outCh.b) {
            outColor = FILTER_PRESETS.yellow.rgb;
            outWl = FILTER_PRESETS.yellow.wl;
          }

          return {
            wavelength: outWl,
            color: { ...outColor },
            intensity: rayState.intensity * this.transmission,
            isWhite: false,
            rgbChannels: outCh,
          };
        } else {
          // Custom narrowband wavelength filter on white/RGB ray
          return {
            wavelength: this.passWavelength,
            color: { ...this._color },
            intensity: rayState.intensity * this.transmission,
            isWhite: false,
            rgbChannels: null,
          };
        }
      }

      // Monochromatic ray filtering
      const trans = this.transmittanceAt(rayState.wavelength);
      const newIntensity = rayState.intensity * trans;
      if (newIntensity <= 0.015) return null;

      return {
        wavelength: rayState.wavelength,
        color: rayState.color,
        intensity: newIntensity,
        isWhite: false,
        rgbChannels: null,
      };
    }

    get thickness() { return 10; }
  }

  function createComponent(type, x, y) {
    switch (type) {
      case 'laser': return new Laser(x, y, false);
      case 'white-led': return new Laser(x, y, true);
      case 'rgb-led': return new Laser(x, y, 'rgb-led');
      case 'convex-lens': return new Lens('convex-lens', x, y);
      case 'concave-lens': return new Lens('concave-lens', x, y);
      case 'plane-mirror': return new PlaneMirror(x, y);
      case 'concave-mirror': return new CurvedMirror('concave-mirror', x, y);
      case 'convex-mirror': return new CurvedMirror('convex-mirror', x, y);
      case 'beam-splitter': return new BeamSplitter(x, y);
      case 'prism': return new Prism(x, y);
      case 'glass-block': return new GlassBlock(x, y);
      case 'optical-detector': return new OpticalDetector(x, y);
      case 'optical-filter':
      case 'color-filter': return new ColorFilter(x, y);
      default: throw new Error('Unknown component type: ' + type);
    }
  }

  function cloneComponent(src, dx = 40, dy = 40) {
    const copy = createComponent(src.type, src.x + dx, src.y + dy);
    copy.rotation = src.rotation;
    copy.groupId = src.groupId || null;
    if (src instanceof Laser) {
      copy.setWavelength(src.wavelength);
      copy.intensity = src.intensity;
      copy.numRays = src.numRays;
      copy.beamWidth = src.beamWidth;
      copy.spreadAngle = src.spreadAngle;
      copy.whiteLight = src.whiteLight;
      copy.isRgbLed = src.isRgbLed;
      if (src.rgb) copy.setRgb(src.rgb.r, src.rgb.g, src.rgb.b);
      copy.splitRgbRays = src.splitRgbRays;
    } else if (src instanceof Lens) {
      copy.focalLength = src.focalLength;
      copy.aperture = src.aperture;
    } else if (src instanceof PlaneMirror) {
      copy.aperture = src.aperture;
    } else if (src instanceof CurvedMirror) {
      copy.radiusOfCurvature = src.radiusOfCurvature;
      copy.aperture = src.aperture;
      copy.showFocalPoint = src.showFocalPoint;
    } else if (src instanceof BeamSplitter) {
      copy.size = src.size;
      copy.reflectance = src.reflectance;
    } else if (src instanceof Prism) {
      copy.sideLength = src.sideLength;
      copy.apexAngle = src.apexAngle;
      copy.refractiveIndex = src.refractiveIndex;
      copy.dispersion = src.dispersion;
      copy.splitSpectrum = src.splitSpectrum;
    } else if (src instanceof GlassBlock) {
      copy.width = src.width;
      copy.height = src.height;
      copy.refractiveIndex = src.refractiveIndex;
      copy.dispersion = src.dispersion;
    } else if (src instanceof OpticalDetector) {
      copy.aperture = src.aperture;
    } else if (src instanceof ColorFilter) {
      if (src.filterColor && src.filterColor !== 'custom') {
        copy.setFilterColor(src.filterColor);
      } else {
        copy.setPassWavelength(src.passWavelength);
      }
      copy.bandwidth = src.bandwidth;
      copy.transmission = src.transmission;
      copy.aperture = src.aperture;
    }
    return copy;
  }

  // ── Serialization & OPTP Project Format ──
  function serializeComponent(comp) {
    const base = {
      id: comp.id,
      type: comp.type,
      x: Math.round(comp.x * 100) / 100,
      y: Math.round(comp.y * 100) / 100,
      rotation: normAngle(comp.rotation),
      locked: Boolean(comp.locked),
      groupId: comp.groupId || null,
    };

    if (comp instanceof Laser) {
      Object.assign(base, {
        wavelength: comp.wavelength,
        intensity: comp.intensity,
        numRays: comp.numRays,
        beamWidth: comp.beamWidth,
        spreadAngle: comp.spreadAngle || 0,
        whiteLight: Boolean(comp.whiteLight),
        isRgbLed: Boolean(comp.isRgbLed),
        rgb: comp.rgb ? { ...comp.rgb } : { r: 1, g: 1, b: 1 },
        splitRgbRays: Boolean(comp.splitRgbRays),
      });
    } else if (comp instanceof Lens) {
      Object.assign(base, {
        focalLength: comp.focalLength,
        aperture: comp.aperture,
      });
    } else if (comp instanceof PlaneMirror) {
      Object.assign(base, {
        aperture: comp.aperture,
      });
    } else if (comp instanceof CurvedMirror) {
      Object.assign(base, {
        radiusOfCurvature: comp.radiusOfCurvature,
        aperture: comp.aperture,
        showFocalPoint: Boolean(comp.showFocalPoint),
      });
    } else if (comp instanceof BeamSplitter) {
      Object.assign(base, {
        size: comp.size,
        reflectance: comp.reflectance,
      });
    } else if (comp instanceof Prism) {
      Object.assign(base, {
        sideLength: comp.sideLength,
        apexAngle: comp.apexAngle,
        refractiveIndex: comp.refractiveIndex,
        dispersion: comp.dispersion,
        splitSpectrum: Boolean(comp.splitSpectrum),
      });
    } else if (comp instanceof GlassBlock) {
      Object.assign(base, {
        width: comp.width,
        height: comp.height,
        refractiveIndex: comp.refractiveIndex,
        dispersion: comp.dispersion,
      });
    } else if (comp instanceof OpticalDetector) {
      Object.assign(base, {
        aperture: comp.aperture,
      });
    } else if (comp instanceof ColorFilter) {
      Object.assign(base, {
        filterColor: comp.filterColor,
        passWavelength: comp.passWavelength,
        bandwidth: comp.bandwidth,
        transmission: comp.transmission,
        aperture: comp.aperture,
      });
    }

    return base;
  }

  function deserializeComponent(data, preserveId = true) {
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
      throw new Error('Invalid component record in project file.');
    }
    const comp = createComponent(data.type, Number(data.x) || 0, Number(data.y) || 0);
    if (preserveId && typeof data.id === 'string' && data.id.trim()) {
      comp.id = data.id;
      const m = /^opt_(\d+)$/.exec(data.id);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > _idCounter) _idCounter = num;
      }
    }
    comp.rotation = normAngle(Number(data.rotation) || 0);
    comp.locked = Boolean(data.locked);
    comp.groupId = data.groupId || null;

    if (comp instanceof Laser) {
      if (data.wavelength !== undefined) comp.setWavelength(Number(data.wavelength));
      if (data.intensity !== undefined) comp.intensity = clamp(Number(data.intensity), 0.05, 1.0);
      if (data.numRays !== undefined) comp.numRays = clamp(parseInt(data.numRays, 10) || 1, 1, 31);
      if (data.beamWidth !== undefined) comp.beamWidth = clamp(Number(data.beamWidth) || 0, 0, 300);
      if (data.spreadAngle !== undefined) comp.spreadAngle = clamp(Number(data.spreadAngle) || 0, 0, 60);
      if (data.whiteLight !== undefined) comp.whiteLight = Boolean(data.whiteLight);
      if (data.isRgbLed !== undefined) comp.isRgbLed = Boolean(data.isRgbLed);
      if (data.rgb && typeof data.rgb === 'object') {
        comp.setRgb(data.rgb.r ?? 1, data.rgb.g ?? 1, data.rgb.b ?? 1);
      }
      if (data.splitRgbRays !== undefined) comp.splitRgbRays = Boolean(data.splitRgbRays);
    } else if (comp instanceof Lens) {
      if (data.focalLength !== undefined) comp.focalLength = clamp(Number(data.focalLength) || 160, 20, 1000);
      if (data.aperture !== undefined) comp.aperture = clamp(Number(data.aperture) || 120, 30, 400);
    } else if (comp instanceof PlaneMirror) {
      if (data.aperture !== undefined) comp.aperture = clamp(Number(data.aperture) || 110, 30, 320);
    } else if (comp instanceof CurvedMirror) {
      if (data.radiusOfCurvature !== undefined) comp.radiusOfCurvature = clamp(Number(data.radiusOfCurvature) || 240, 60, 1200);
      if (data.aperture !== undefined) comp.aperture = clamp(Number(data.aperture) || 116, 40, 360);
      if (data.showFocalPoint !== undefined) comp.showFocalPoint = Boolean(data.showFocalPoint);
    } else if (comp instanceof BeamSplitter) {
      if (data.size !== undefined) comp.size = clamp(Number(data.size) || 84, 30, 240);
      if (data.reflectance !== undefined) comp.reflectance = clamp(Number(data.reflectance), 0, 1);
    } else if (comp instanceof Prism) {
      if (data.sideLength !== undefined) comp.sideLength = clamp(Number(data.sideLength) || 110, 40, 280);
      if (data.apexAngle !== undefined) comp.apexAngle = clamp(Number(data.apexAngle) || 60, 30, 90);
      if (data.refractiveIndex !== undefined) comp.refractiveIndex = clamp(Number(data.refractiveIndex) || 1.52, 1.1, 2.5);
      if (data.dispersion !== undefined) comp.dispersion = clamp(Number(data.dispersion) || 0, 0, 0.16);
      if (data.splitSpectrum !== undefined) comp.splitSpectrum = Boolean(data.splitSpectrum);
    } else if (comp instanceof GlassBlock) {
      if (data.width !== undefined) comp.width = clamp(Number(data.width) || 140, 30, 400);
      if (data.height !== undefined) comp.height = clamp(Number(data.height) || 84, 30, 400);
      if (data.refractiveIndex !== undefined) comp.refractiveIndex = clamp(Number(data.refractiveIndex) || 1.52, 1.1, 2.5);
      if (data.dispersion !== undefined) comp.dispersion = clamp(Number(data.dispersion) || 0, 0, 0.16);
    } else if (comp instanceof OpticalDetector) {
      if (data.aperture !== undefined) comp.aperture = clamp(Number(data.aperture) || 76, 20, 260);
    } else if (comp instanceof ColorFilter) {
      if (data.filterColor && data.filterColor !== 'custom') {
        comp.setFilterColor(data.filterColor);
      } else if (data.passWavelength !== undefined) {
        comp.setPassWavelength(Number(data.passWavelength));
      }
      if (data.bandwidth !== undefined) comp.bandwidth = clamp(Number(data.bandwidth) || 65, 10, 200);
      if (data.transmission !== undefined) comp.transmission = clamp(Number(data.transmission), 0, 1);
      if (data.aperture !== undefined) comp.aperture = clamp(Number(data.aperture) || 104, 30, 320);
    }

    return comp;
  }

  function buildOptpObject(projectName, components, settings = {}, projectId = null) {
    return {
      format: 'OPTP',
      version: 1,
      application: 'OptiLab',
      exportedAt: new Date().toISOString(),
      project: {
        id: projectId || 'proj_' + Date.now(),
        name: String(projectName || 'My Optical Experiment').trim() || 'My Optical Experiment',
        components: components.map((c) => serializeComponent(c)),
        settings: {
          snapEnabled: settings.snapEnabled !== undefined ? Boolean(settings.snapEnabled) : true,
          showFocalPoints: settings.showFocalPoints !== undefined ? Boolean(settings.showFocalPoints) : true,
          showOpticalAxis: settings.showOpticalAxis !== undefined ? Boolean(settings.showOpticalAxis) : true,
          zoom: Number(settings.zoom) || 1.0,
          panX: Number(settings.panX) || 0,
          panY: Number(settings.panY) || 0,
        },
      },
    };
  }

  function validateAndParseOptp(rawInput) {
    let parsed = rawInput;
    if (typeof rawInput === 'string') {
      try {
        parsed = JSON.parse(rawInput);
      } catch (err) {
        throw new Error('Invalid JSON syntax in .optp file.');
      }
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid .optp file: root must be a JSON object.');
    }
    if (parsed.format !== 'OPTP' || parsed.application !== 'OptiLab') {
      throw new Error('Unrecognized file format: expected format "OPTP" for application "OptiLab".');
    }
    if (typeof parsed.version !== 'number' || !Number.isInteger(parsed.version)) {
      throw new Error('Missing or invalid OPTP format version.');
    }
    if (parsed.version > 1 || parsed.version < 1) {
      throw new Error(`Unsupported OPTP version v${parsed.version}. This build of OptiLab supports OPTP v1.`);
    }
    if (!parsed.project || typeof parsed.project !== 'object' || !Array.isArray(parsed.project.components)) {
      throw new Error('Malformed OPTP project structure: missing "project.components" array.');
    }

    const restoredComponents = parsed.project.components.map((item) => deserializeComponent(item, true));
    return {
      name: String(parsed.project.name || 'Imported Optical Experiment').trim() || 'Imported Optical Experiment',
      components: restoredComponents,
      settings: parsed.project.settings && typeof parsed.project.settings === 'object' ? parsed.project.settings : {},
    };
  }

  // ── Geometric Ray Tracer ──
  class RayTracer {
    constructor() {
      this.segments = [];
      this.focalPoints = [];
    }

    trace(components) {
      this.segments = [];
      this.focalPoints = [];

      const lenses = [];
      const curvedMirrors = [];
      const lasers = [];
      const detectors = [];

      for (const c of components) {
        if (c instanceof Lens) lenses.push(c);
        else if (c instanceof CurvedMirror) curvedMirrors.push(c);
        else if (c instanceof Laser) lasers.push(c);
        else if (c instanceof OpticalDetector) {
          c.resetReadings();
          detectors.push(c);
        }
      }

      // Compute world-space focal points for lenses
      for (const lens of lenses) {
        const ax = Math.cos(rad(lens.rotation));
        const ay = Math.sin(rad(lens.rotation));
        const f = Math.abs(lens.focalLength);
        this.focalPoints.push(
          { x: lens.x - ax * f, y: lens.y - ay * f, label: 'F', lens },
          { x: lens.x + ax * f, y: lens.y + ay * f, label: "F'", lens }
        );
      }

      // Compute world-space focal points for curved mirrors (f = R / 2)
      for (const mirror of curvedMirrors) {
        if (!mirror.showFocalPoint) continue;
        const ax = Math.cos(rad(mirror.rotation));
        const ay = Math.sin(rad(mirror.rotation));
        const f = mirror.focalLength;
        const sign = mirror.type === 'concave-mirror' ? -1 : 1;
        this.focalPoints.push({
          x: mirror.x + sign * ax * f,
          y: mirror.y + sign * ay * f,
          label: mirror.type === 'concave-mirror' ? 'F' : "F'",
          mirror,
        });
      }

      // Build queue of initial rays from all lasers and white LEDs
      const queue = [];

      for (const laser of lasers) {
        const theta = rad(laser.rotation);
        const baseDir = V.create(Math.cos(theta), Math.sin(theta));
        const perp = V.perp(baseDir);
        const n = laser.numRays;
        const bw = laser.beamWidth;
        const spread = laser.spreadAngle || 0;

        for (let i = 0; i < n; i++) {
          const frac = n === 1 ? 0 : i / (n - 1) - 0.5;
          const offset = frac * bw;
          const rayAngleOffset = rad(frac * spread);
          const dir = spread !== 0 ? V.rot(baseDir, rayAngleOffset) : baseDir;
          const origin = V.add(
            V.add({ x: laser.x, y: laser.y }, V.scale(baseDir, laser.bodyW / 2)),
            V.scale(perp, offset)
          );

          if (laser.isRgbLed) {
            const { r, g, b } = laser.rgb;
            if (r <= 0.01 && g <= 0.01 && b <= 0.01) continue;

            if (laser.splitRgbRays) {
              // Emit discrete Red (640nm), Green (532nm), Blue (460nm) sub-beams from the 3 LED dies
              const dies = [
                { ch: r, wl: 640, rgb: { r: 255, g: 38, b: 28 }, dy: -2.2 },
                { ch: g, wl: 532, rgb: { r: 40, g: 235, b: 60 }, dy: 0 },
                { ch: b, wl: 460, rgb: { r: 35, g: 125, b: 255 }, dy: 2.2 },
              ];
              for (const die of dies) {
                if (die.ch <= 0.015) continue;
                queue.push({
                  origin: V.add(origin, V.scale(perp, die.dy)),
                  dir,
                  wavelength: die.wl,
                  color: die.rgb,
                  intensity: laser.intensity * die.ch,
                  depth: 0,
                  skipTag: null,
                  dispersed: false,
                  isWhite: false,
                  rgbChannels: null,
                });
              }
            } else {
              // Emit a single trichromatic mixed-color ray carrying its R, G, B channel weights
              const maxCh = Math.max(r, g, b);
              const domWl = r >= g && r >= b ? 640 : g >= r && g >= b ? 532 : 460;
              queue.push({
                origin,
                dir,
                wavelength: r > 0.5 && g > 0.5 && b > 0.5 ? 550 : domWl,
                color: laser.color,
                intensity: laser.intensity * maxCh,
                depth: 0,
                skipTag: null,
                dispersed: false,
                isWhite: false,
                rgbChannels: { r, g, b },
              });
            }
          } else {
            queue.push({
              origin,
              dir,
              wavelength: laser.whiteLight ? 550 : laser.wavelength,
              color: laser.color,
              intensity: laser.intensity,
              depth: 0,
              skipTag: null,
              dispersed: false,
              isWhite: Boolean(laser.whiteLight),
              rgbChannels: laser.whiteLight ? { r: 1, g: 1, b: 1 } : null,
            });
          }
        }
      }

      // Process ray queue (handles splitting and multi-surface refractions)
      while (queue.length > 0 && this.segments.length < CFG.MAX_TOTAL_SEGMENTS) {
        const ray = queue.shift();
        this._traceRay(ray, components, queue);
      }
    }

    _traceRay(ray, components, queue) {
      let pos = { ...ray.origin };
      let dir = V.norm(ray.dir);
      let remaining = CFG.MAX_RAY_LENGTH;
      let depth = ray.depth;
      let intensity = ray.intensity;
      let wavelength = ray.wavelength;
      let color = ray.color;
      let skipTag = ray.skipTag;
      let dispersed = ray.dispersed;
      let isWhite = Boolean(ray.isWhite);
      let rgbChannels = ray.rgbChannels ? { ...ray.rgbChannels } : isWhite ? { r: 1, g: 1, b: 1 } : null;

      while (
        remaining > 0 &&
        depth < CFG.MAX_REFRACTIONS &&
        intensity > 0.015 &&
        this.segments.length < CFG.MAX_TOTAL_SEGMENTS
      ) {
        const hit = this._findNearestIntersection(pos, dir, components, skipTag);

        if (!hit || hit.t >= remaining) {
          const endPoint = V.add(pos, V.scale(dir, remaining));
          this.segments.push({ p0: { ...pos }, p1: endPoint, color, intensity });
          break;
        }

        const hitPoint = V.add(pos, V.scale(dir, hit.t));
        this.segments.push({ p0: { ...pos }, p1: hitPoint, color, intensity });
        remaining -= hit.t;
        depth++;

        const comp = hit.comp;

        // 1. Optical Detector: absorbs ray and records intensity
        if (comp instanceof OpticalDetector) {
          comp.recordHit(intensity, wavelength);
          break;
        }

        // 2. Thin Lens (Convex / Concave)
        if (comp instanceof Lens) {
          dir = this._refractThinLens(dir, comp, hit.h);
          pos = V.add(hitPoint, V.scale(dir, CFG.RAY_EPSILON));
          skipTag = comp.id;
          continue;
        }

        // 3. Plane Mirror or Curved Mirror (Concave / Convex): Law of Reflection using local surface normal
        if (comp instanceof PlaneMirror || comp instanceof CurvedMirror) {
          dir = this._reflectVector(dir, hit.normal);
          pos = V.add(hitPoint, V.scale(dir, CFG.RAY_EPSILON));
          skipTag = comp.id;
          continue;
        }

        // 3b. Optical Filter: RGB / CMY & Spectral Bandpass Filtering
        if (comp instanceof ColorFilter) {
          const filtered = comp.filterRay({
            wavelength,
            color,
            intensity,
            isWhite,
            rgbChannels,
          });
          if (!filtered || filtered.intensity <= 0.015) {
            // Incompatible wavelength absorbed by optical filter
            break;
          }
          wavelength = filtered.wavelength;
          color = filtered.color;
          intensity = filtered.intensity;
          isWhite = filtered.isWhite;
          rgbChannels = filtered.rgbChannels;
          pos = V.add(hitPoint, V.scale(dir, CFG.RAY_EPSILON));
          skipTag = comp.id;
          continue;
        }

        // 4. Beam Splitter: splits into transmitted ray and reflected ray
        if (comp instanceof BeamSplitter) {
          const reflIntensity = intensity * comp.reflectance;
          const transIntensity = intensity * comp.transmittance;

          // Enqueue reflected branch if reflectance > 0
          if (reflIntensity > 0.015 && depth < CFG.MAX_REFRACTIONS) {
            const reflDir = this._reflectVector(dir, hit.normal);
            queue.push({
              origin: V.add(hitPoint, V.scale(reflDir, CFG.RAY_EPSILON)),
              dir: reflDir,
              wavelength,
              color,
              intensity: reflIntensity,
              depth,
              skipTag: comp.id,
              dispersed,
              isWhite,
              rgbChannels: rgbChannels ? { ...rgbChannels } : null,
            });
          }

          // Continue current ray as transmitted branch if transmittance > 0
          if (transIntensity > 0.015) {
            intensity = transIntensity;
            pos = V.add(hitPoint, V.scale(dir, CFG.RAY_EPSILON));
            skipTag = comp.id;
            continue;
          } else {
            break;
          }
        }

        // 5. Prism or Glass Block: Snell's Law Refraction + Dispersion + Total Internal Reflection
        if (comp instanceof Prism || comp instanceof GlassBlock) {
          // If prism has spectral splitting enabled (or ray is White Light / Mixed RGB) and ray hasn't dispersed yet, fan out into spectral band on entry
          if (
            comp instanceof Prism &&
            (comp.splitSpectrum || isWhite || rgbChannels) &&
            comp.dispersion > 0.005 &&
            !dispersed &&
            hit.entering &&
            depth < CFG.MAX_REFRACTIONS - 2
          ) {
            if (rgbChannels && !isWhite) {
              // Mixed RGB ray splits into its active Red (640nm), Green (532nm), Blue (460nm) components
              const rgbBands = [
                { ch: rgbChannels.r, wl: 640, col: { r: 255, g: 38, b: 28 } },
                { ch: rgbChannels.g, wl: 532, col: { r: 40, g: 235, b: 60 } },
                { ch: rgbChannels.b, wl: 460, col: { r: 35, g: 125, b: 255 } },
              ];
              for (const band of rgbBands) {
                if (band.ch <= 0.015) continue;
                const nGlass = comp.effectiveIndex(band.wl);
                const subDir = this._snellRefractOrReflect(dir, hit.normal, 1.0, nGlass);
                queue.push({
                  origin: V.add(hitPoint, V.scale(subDir, CFG.RAY_EPSILON)),
                  dir: subDir,
                  wavelength: band.wl,
                  color: band.col,
                  intensity: intensity * band.ch * 0.75,
                  depth,
                  skipTag: hit.tag,
                  dispersed: true,
                  isWhite: false,
                  rgbChannels: null,
                });
              }
              break;
            }

            const spectralWavelengths = isWhite
              ? [410, 445, 485, 530, 575, 615, 665]
              : [-45, -22, 0, 22, 45].map((dWl) => clamp(wavelength + dWl, 385, 760));

            for (const subWl of spectralWavelengths) {
              const nGlass = comp.effectiveIndex(subWl);
              const subDir = this._snellRefractOrReflect(dir, hit.normal, 1.0, nGlass);
              queue.push({
                origin: V.add(hitPoint, V.scale(subDir, CFG.RAY_EPSILON)),
                dir: subDir,
                wavelength: subWl,
                color: wavelengthToRGB(subWl),
                intensity: intensity * (isWhite ? 0.38 : 0.42),
                depth,
                skipTag: hit.tag,
                dispersed: true,
                isWhite: false,
              });
            }
            break;
          }

          const nGlass = comp.effectiveIndex(wavelength);
          const n1 = hit.entering ? 1.0 : nGlass;
          const n2 = hit.entering ? nGlass : 1.0;

          dir = this._snellRefractOrReflect(dir, hit.normal, n1, n2);
          pos = V.add(hitPoint, V.scale(dir, CFG.RAY_EPSILON));
          skipTag = hit.tag;
          continue;
        }
      }
    }

    _findNearestIntersection(origin, dir, components, skipTag) {
      let nearest = null;

      for (const comp of components) {
        if (comp instanceof Laser) continue;

        if (comp instanceof Lens) {
          if (skipTag === comp.id) continue;
          const h = this._intersectSegmentCentered(origin, dir, comp.x, comp.y, rad(comp.rotation), comp.aperture);
          if (h && (!nearest || h.t < nearest.t)) {
            nearest = { t: h.t, h: h.u, comp, tag: comp.id };
          }
        } else if (comp instanceof PlaneMirror) {
          if (skipTag === comp.id) continue;
          const h = this._intersectSegmentCentered(origin, dir, comp.x, comp.y, rad(comp.rotation), comp.aperture);
          if (h && (!nearest || h.t < nearest.t)) {
            nearest = { t: h.t, normal: h.normal, comp, tag: comp.id };
          }
        } else if (comp instanceof CurvedMirror) {
          if (skipTag === comp.id) continue;
          const h = this._intersectCurvedMirror(origin, dir, comp);
          if (h && (!nearest || h.t < nearest.t)) {
            nearest = { t: h.t, normal: h.normal, comp, tag: comp.id };
          }
        } else if (comp instanceof ColorFilter) {
          if (skipTag === comp.id) continue;
          const h = this._intersectSegmentCentered(origin, dir, comp.x, comp.y, rad(comp.rotation), comp.aperture);
          if (h && (!nearest || h.t < nearest.t)) {
            nearest = { t: h.t, normal: h.normal, comp, tag: comp.id };
          }
        } else if (comp instanceof OpticalDetector) {
          if (skipTag === comp.id) continue;
          const h = this._intersectSegmentCentered(origin, dir, comp.x, comp.y, rad(comp.rotation), comp.aperture);
          if (h && (!nearest || h.t < nearest.t)) {
            nearest = { t: h.t, normal: h.normal, comp, tag: comp.id };
          }
        } else if (comp instanceof BeamSplitter) {
          if (skipTag === comp.id) continue;
          // Diagonal splitting plane is rotated by -45° inside the cube so horizontal rays reflect at 90°
          const diagAngle = rad(comp.rotation - 45);
          const diagLen = comp.size * Math.SQRT2;
          const h = this._intersectSegmentCentered(origin, dir, comp.x, comp.y, diagAngle, diagLen);
          if (h && (!nearest || h.t < nearest.t)) {
            nearest = { t: h.t, normal: h.normal, comp, tag: comp.id };
          }
        } else if (comp instanceof Prism || comp instanceof GlassBlock) {
          const verts = comp.getWorldVertices();
          const numEdges = verts.length;
          for (let i = 0; i < numEdges; i++) {
            const edgeTag = `${comp.id}_e${i}`;
            if (skipTag === edgeTag) continue;
            const a = verts[i];
            const b = verts[(i + 1) % numEdges];
            const segHit = this._intersectSegmentAB(origin, dir, a, b);
            if (segHit && (!nearest || segHit.t < nearest.t)) {
              // Outward normal for clockwise local vertices
              const edgeVec = V.sub(b, a);
              // Compute outward normal pointing away from polygon center
              let outNormal = V.norm({ x: edgeVec.y, y: -edgeVec.x });
              const mid = V.scale(V.add(a, b), 0.5);
              if (V.dot(outNormal, V.sub(mid, { x: comp.x, y: comp.y })) < 0) {
                outNormal = V.scale(outNormal, -1);
              }
              const entering = V.dot(dir, outNormal) < 0;
              const orientedNormal = entering ? outNormal : V.scale(outNormal, -1);

              nearest = {
                t: segHit.t,
                normal: orientedNormal,
                entering,
                comp,
                tag: edgeTag,
              };
            }
          }
        }
      }

      return nearest;
    }

    // Intersect ray with a segment centered at (cx, cy) whose normal is at angle `theta`
    _intersectSegmentCentered(origin, dir, cx, cy, theta, length) {
      const sx = -Math.sin(theta);
      const sy = Math.cos(theta);
      const halfLen = length / 2;

      const ex = cx - origin.x;
      const ey = cy - origin.y;

      const det = sx * dir.y - dir.x * sy;
      if (Math.abs(det) < 1e-10) return null;

      const t = (sx * ey - sy * ex) / det;
      const u = (dir.x * ey - dir.y * ex) / det;

      if (t < CFG.RAY_EPSILON) return null;
      if (Math.abs(u) > halfLen) return null;

      let nx = Math.cos(theta);
      let ny = Math.sin(theta);
      if (dir.x * nx + dir.y * ny > 0) {
        nx = -nx;
        ny = -ny;
      }

      return { t, u, normal: { x: nx, y: ny } };
    }

    // Intersect ray with a spherical/circular arc mirror (Concave or Convex)
    _intersectCurvedMirror(origin, dir, mirror) {
      const theta = rad(mirror.rotation);
      const localOrigin = V.rot(V.sub(origin, { x: mirror.x, y: mirror.y }), -theta);
      const localDir = V.rot(dir, -theta);

      const R = Math.max(40, mirror.radiusOfCurvature);
      const ap = Math.min(mirror.aperture, 1.92 * R);
      const halfAp = ap / 2;
      const isConcave = mirror.type === 'concave-mirror';

      // Circle center in local space (vertex at (0, 0)):
      // Concave mirror curves inward toward -x -> center C = (-R, 0), arc has x >= -R
      // Convex mirror curves outward toward -x -> center C = (+R, 0), arc has x <= +R
      const cx = isConcave ? -R : R;
      const mx = localOrigin.x - cx;
      const my = localOrigin.y;

      const b = mx * localDir.x + my * localDir.y;
      const c = mx * mx + my * my - R * R;
      const disc = b * b - c;
      if (disc < 0) return null;

      const sqrtDisc = Math.sqrt(disc);
      const candidates = [-b - sqrtDisc, -b + sqrtDisc];

      for (const t of candidates) {
        if (t < CFG.RAY_EPSILON) continue;
        const hx = localOrigin.x + t * localDir.x;
        const hy = localOrigin.y + t * localDir.y;

        if (Math.abs(hy) > halfAp) continue;
        if (isConcave && hx < cx) continue;
        if (!isConcave && hx > cx) continue;

        // Exact local unit surface normal from circle geometry
        let nx = (hx - cx) / R;
        let ny = hy / R;
        if (nx * localDir.x + ny * localDir.y > 0) {
          nx = -nx;
          ny = -ny;
        }

        const worldNormal = V.rot({ x: nx, y: ny }, theta);
        return { t, normal: V.norm(worldNormal) };
      }

      return null;
    }

    // Intersect ray (origin + t * dir) with segment [A, B]
    _intersectSegmentAB(origin, dir, a, b) {
      const v1 = V.sub(origin, a);
      const v2 = V.sub(b, a);
      const v3 = { x: -dir.y, y: dir.x };

      const dot = V.dot(v2, v3);
      if (Math.abs(dot) < 1e-10) return null;

      const t = V.cross(v2, v1) / dot;
      const s = V.dot(v1, v3) / dot;

      if (t < CFG.RAY_EPSILON) return null;
      if (s < 0 || s > 1) return null;

      return { t, s };
    }

    _reflectVector(dir, normal) {
      const dDotN = V.dot(dir, normal);
      return V.norm(V.sub(dir, V.scale(normal, 2 * dDotN)));
    }

    // Vector Snell's Law with automatic Total Internal Reflection (TIR)
    _snellRefractOrReflect(dir, normal, n1, n2) {
      const eta = n1 / n2;
      let cosI = -V.dot(dir, normal);
      let N = normal;
      if (cosI < 0) {
        cosI = -cosI;
        N = V.scale(normal, -1);
      }

      const sin2T = eta * eta * (1.0 - cosI * cosI);
      if (sin2T > 1.0) {
        // Total Internal Reflection
        return this._reflectVector(dir, N);
      }

      const cosT = Math.sqrt(1.0 - sin2T);
      return V.norm({
        x: eta * dir.x + (eta * cosI - cosT) * N.x,
        y: eta * dir.y + (eta * cosI - cosT) * N.y,
      });
    }

    _refractThinLens(dir, lens, h) {
      const theta = rad(lens.rotation);
      const ax = Math.cos(theta);
      const ay = Math.sin(theta);
      const sx = -Math.sin(theta);
      const sy = Math.cos(theta);

      const da = dir.x * ax + dir.y * ay;
      const ds = dir.x * sx + dir.y * sy;

      if (Math.abs(da) < 1e-10) return dir;

      const f = lens.fSigned;
      const newDs = ds - (Math.abs(da) * h) / f;

      return V.norm({
        x: da * ax + newDs * sx,
        y: da * ay + newDs * sy,
      });
    }
  }

  global.OptiLab = global.OptiLab || {};
  Object.assign(global.OptiLab, {
    CFG,
    uid,
    clamp,
    deg,
    rad,
    normAngle,
    V,
    wavelengthToRGB,
    rgbStr,
    Component,
    Laser,
    Lens,
    PlaneMirror,
    CurvedMirror,
    BeamSplitter,
    Prism,
    GlassBlock,
    OpticalDetector,
    ColorFilter,
    FILTER_PRESETS,
    createComponent,
    cloneComponent,
    serializeComponent,
    deserializeComponent,
    buildOptpObject,
    validateAndParseOptp,
    RayTracer,
  });
})(typeof window !== 'undefined' ? window : globalThis);
