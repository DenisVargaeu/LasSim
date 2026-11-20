(function (global) {
  'use strict';

  const {
    CFG,
    rad,
    rgbStr,
    wavelengthToRGB,
    Laser,
    PointSource,
    Lens,
    GlassSphere,
    PlaneMirror,
    CurvedMirror,
    BeamSplitter,
    Prism,
    GlassBlock,
    OpticalDetector,
    ColorFilter,
    ApertureSlit,
    BeamBlocker,
    DiffractionGrating,
    Polarizer,
    createComponent,
  } = global.LasSim;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = window.devicePixelRatio || 1;
      this.showFocalPoints = true;
      this.showOpticalAxis = true;
      this.theme = 'dark';
      this._installThemeMapping();
      this.resize();
    }

    setTheme(theme) {
      this.theme = theme === 'light' ? 'light' : 'dark';
    }

    // Canvas colors are authored for the light theme; in dark theme they are
    // translated to a warm Notion-dark palette on the fly.
    _installThemeMapping() {
      const ctx = this.ctx;
      const renderer = this;
      const proto = Object.getPrototypeOf(ctx);
      const EXACT = {
        '#fbf9f5': '#191816',
        '#f0ebe2': '#201e1b',
        '#e4dccf': '#2a2723',
        '#cfc3b0': '#3d3731',
        '#ffffff': '#25221e',
        '#cdc3b4': '#4b443c',
        '#9c8f7e': '#8d8276',
        '#37352f': '#ede7de',
        '#6b655c': '#d8d0c5',
        '#787774': '#a69e93',
        '#f1ece3': '#2e2a26',
        '#b9ae9e': '#5c544a',
        '#9f6b53': '#c99d80',
        '#b5826a': '#dcb398',
        '#a5785f': '#d1a688',
        '#448361': '#62b48b',
        '#2c2a27': '#3b3732',
        '#1e1c1a': '#5b544c',
        '#7c62a8': '#a88fd4',
      };
      const PREFIX = [
        ['rgba(55, 53, 47', 'rgba(237, 231, 222'],
        ['rgba(120, 110, 98', 'rgba(170, 160, 148'],
        ['rgba(225, 216, 202', 'rgba(58, 52, 46'],
        ['rgba(159, 107, 83', 'rgba(201, 157, 128'],
        ['rgba(90, 134, 168', 'rgba(132, 172, 204'],
        ['rgba(68, 131, 97', 'rgba(98, 180, 139'],
        ['rgba(124, 98, 168', 'rgba(168, 143, 212'],
      ];
      const map = (v) => {
        if (renderer.theme !== 'dark' || typeof v !== 'string') return v;
        const key = v.toLowerCase();
        if (EXACT[key]) return EXACT[key];
        for (const [from, to] of PREFIX) {
          if (v.startsWith(from)) return to + v.slice(from.length);
        }
        return v;
      };
      for (const prop of ['fillStyle', 'strokeStyle']) {
        const desc = Object.getOwnPropertyDescriptor(proto, prop);
        if (!desc || !desc.set) continue;
        Object.defineProperty(ctx, prop, {
          configurable: true,
          get() { return desc.get.call(ctx); },
          set(v) { desc.set.call(ctx, map(v)); },
        });
      }
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = rect.width;
      this.height = rect.height;
      this.dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * this.dpr;
      this.canvas.height = rect.height * this.dpr;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    clear() {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.fillStyle = '#fbf9f5';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawGrid(panX, panY, zoom) {
      const ctx = this.ctx;
      const gs = CFG.GRID_SIZE;
      const major = CFG.GRID_MAJOR;

      const x0 = -panX / zoom;
      const y0 = -panY / zoom;
      const x1 = (this.width - panX) / zoom;
      const y1 = (this.height - panY) / zoom;

      const startX = Math.floor(x0 / gs) * gs;
      const startY = Math.floor(y0 / gs) * gs;

      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      if (zoom > 0.35) {
        ctx.strokeStyle = '#f0ebe2';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        for (let x = startX; x <= x1; x += gs) {
          if (Math.round(x / gs) % major === 0) continue;
          ctx.moveTo(x, y0);
          ctx.lineTo(x, y1);
        }
        for (let y = startY; y <= y1; y += gs) {
          if (Math.round(y / gs) % major === 0) continue;
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
        }
        ctx.stroke();
      }

      ctx.strokeStyle = '#e4dccf';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      for (let x = startX; x <= x1; x += gs) {
        if (Math.round(x / gs) % major !== 0) continue;
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = startY; y <= y1; y += gs) {
        if (Math.round(y / gs) % major !== 0) continue;
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();

      ctx.strokeStyle = '#cfc3b0';
      ctx.lineWidth = 1.2 / zoom;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(0, y1);
      ctx.moveTo(x0, 0);
      ctx.lineTo(x1, 0);
      ctx.stroke();

      ctx.restore();
    }

    drawRays(segments, panX, panY, zoom) {
      if (!segments.length) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);
      const dark = this.theme === 'dark';
      ctx.globalCompositeOperation = dark ? 'lighter' : 'multiply';

      // Darken very bright colors (white / yellow) so they stay legible on warm paper
      const ink = (col) => {
        const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
        const k = lum > 150 ? 150 / lum : 1;
        return { r: Math.round(col.r * k), g: Math.round(col.g * k), b: Math.round(col.b * k) };
      };

      for (const seg of segments) {
        const c = dark ? seg.color : ink(seg.color);
        const a = Math.min(1, seg.intensity * 1.05);

        ctx.strokeStyle = rgbStr(c, a * 0.16);
        ctx.lineWidth = 6 / zoom;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(seg.p0.x, seg.p0.y);
        ctx.lineTo(seg.p1.x, seg.p1.y);
        ctx.stroke();

        ctx.strokeStyle = rgbStr(c, a * 0.95);
        ctx.lineWidth = 1.8 / zoom;
        ctx.beginPath();
        ctx.moveTo(seg.p0.x, seg.p0.y);
        ctx.lineTo(seg.p1.x, seg.p1.y);
        ctx.stroke();
      }

      ctx.restore();
    }

    drawComponents(components, selectedIdsOrId, hoveredId, panX, panY, zoom) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      const isIdSelected = (id) => {
        if (!selectedIdsOrId) return false;
        if (selectedIdsOrId instanceof Set) return selectedIdsOrId.has(id);
        if (Array.isArray(selectedIdsOrId)) return selectedIdsOrId.includes(id);
        return selectedIdsOrId === id;
      };

      for (const comp of components) {
        const isSelected = isIdSelected(comp.id);
        const isHovered = comp.id === hoveredId;

        ctx.save();
        ctx.translate(comp.x, comp.y);
        ctx.rotate(rad(comp.rotation));

        if (comp instanceof Laser) {
          this._drawLaser(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof PointSource) {
          this._drawPointSource(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof Lens) {
          this._drawLens(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof GlassSphere) {
          this._drawGlassSphere(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof PlaneMirror) {
          this._drawPlaneMirror(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof CurvedMirror) {
          this._drawCurvedMirror(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof BeamSplitter) {
          this._drawBeamSplitter(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof Prism) {
          this._drawPrism(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof GlassBlock) {
          this._drawGlassBlock(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof OpticalDetector) {
          this._drawOpticalDetector(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof ColorFilter) {
          this._drawColorFilter(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof ApertureSlit) {
          this._drawApertureSlit(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof BeamBlocker) {
          this._drawBeamBlocker(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof DiffractionGrating) {
          this._drawDiffractionGrating(ctx, comp, isSelected, isHovered, zoom);
        } else if (comp instanceof Polarizer) {
          this._drawPolarizer(ctx, comp, isSelected, isHovered, zoom);
        }

        ctx.restore();
      }

      ctx.restore();
    }

    _drawLaser(ctx, laser, selected, hovered, zoom) {
      const w = laser.bodyW;
      const h = laser.bodyH;
      const c = laser.color;

      if (laser.numRays > 1 && laser.beamWidth > h) {
        ctx.strokeStyle = rgbStr(c, 0.35);
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.moveTo(w / 2, -laser.beamWidth / 2);
        ctx.lineTo(w / 2, laser.beamWidth / 2);
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#9c8f7e' : '#cdc3b4';
      ctx.lineWidth = (selected ? 2 : 1.2) / zoom;

      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3 / zoom);
      ctx.fill();
      ctx.stroke();

      if (laser.type === 'white-led') {
        // LED emitter dome
        ctx.fillStyle = 'rgba(236, 205, 150, 0.95)';
        ctx.beginPath();
        ctx.arc(w / 2 - 2, 0, h * 0.32, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        ctx.fillStyle = '#37352f';
        ctx.font = `600 ${8.5 / zoom}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LED', -2, 0);
      } else if (laser.type === 'rgb-led') {
        // Trichromatic RGB LED emitter dome + 3 semiconductor dies (R, G, B)
        ctx.fillStyle = rgbStr(c, 0.45);
        ctx.beginPath();
        ctx.arc(w / 2 - 2, 0, h * 0.34, -Math.PI / 2, Math.PI / 2);
        ctx.fill();

        const rAlpha = 0.25 + 0.75 * (laser.rgb ? laser.rgb.r : 1);
        const gAlpha = 0.25 + 0.75 * (laser.rgb ? laser.rgb.g : 1);
        const bAlpha = 0.25 + 0.75 * (laser.rgb ? laser.rgb.b : 1);

        ctx.fillStyle = `rgba(255, 45, 35, ${rAlpha})`;
        ctx.fillRect(w / 2 - 5, -7, 4, 4);
        ctx.fillStyle = `rgba(45, 235, 65, ${gAlpha})`;
        ctx.fillRect(w / 2 - 5, -2, 4, 4);
        ctx.fillStyle = `rgba(45, 130, 255, ${bAlpha})`;
        ctx.fillRect(w / 2 - 5, 3, 4, 4);

        ctx.fillStyle = '#37352f';
        ctx.font = `600 ${8.5 / zoom}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RGB', -4, 0);
      } else {
        ctx.strokeStyle = '#f1ece3';
        ctx.lineWidth = 1 / zoom;
        for (let x = -w / 2 + 8; x <= -2; x += 5) {
          ctx.beginPath();
          ctx.moveTo(x, -h / 2 + 2);
          ctx.lineTo(x, h / 2 - 2);
          ctx.stroke();
        }

        ctx.fillStyle = rgbStr(c, 0.85);
        ctx.fillRect(w / 2 - 4, -h / 2 + 4, 4, h - 8);

        ctx.fillStyle = '#787774';
        ctx.font = `600 ${8.5 / zoom}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(laser.whiteLight ? 'WHITE' : `${laser.wavelength}`, 4, 0);
      }

      if (selected) {
        const boxH = Math.max(h, laser.numRays > 1 ? laser.beamWidth : h);
        this._drawSelectionFrame(ctx, -w / 2 - 6, -boxH / 2 - 6, w + 12, boxH + 12, zoom);
        this._drawRotationHandle(ctx, 0, -boxH / 2 - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    _drawLens(ctx, lens, selected, hovered, zoom) {
      const ap = lens.aperture;
      const halfAp = ap / 2;
      const fAbs = lens.focalLength;

      if (this.showOpticalAxis || selected) {
        ctx.strokeStyle = selected ? 'rgba(159, 107, 83, 0.35)' : 'rgba(120, 110, 98, 0.16)';
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([5 / zoom, 4 / zoom]);
        ctx.beginPath();
        ctx.moveTo(-fAbs - 45, 0);
        ctx.lineTo(fAbs + 45, 0);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = 'rgba(159, 107, 83, 0.25)';
      ctx.lineWidth = 0.8 / zoom;
      ctx.setLineDash([2 / zoom, 2 / zoom]);
      ctx.beginPath();
      ctx.moveTo(0, -halfAp);
      ctx.lineTo(0, halfAp);
      ctx.stroke();
      ctx.setLineDash([]);

      if (lens.type === 'convex-lens') {
        this._drawConvexBody(ctx, lens, selected, hovered, zoom);
      } else {
        this._drawConcaveBody(ctx, lens, selected, hovered, zoom);
      }

      if (this.showFocalPoints) {
        for (const side of [-1, 1]) {
          const fx = side * fAbs;
          ctx.fillStyle = selected ? '#9f6b53' : 'rgba(159, 107, 83, 0.65)';
          ctx.beginPath();
          ctx.arc(fx, 0, 3.2 / zoom, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = selected ? '#9f6b53' : 'rgba(159, 107, 83, 0.45)';
          ctx.lineWidth = 1 / zoom;
          ctx.beginPath();
          ctx.moveTo(fx, -5 / zoom);
          ctx.lineTo(fx, 5 / zoom);
          ctx.stroke();

          ctx.fillStyle = selected ? '#b5826a' : 'rgba(120, 110, 98, 0.7)';
          ctx.font = `500 ${9.5 / zoom}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(side === -1 ? 'F' : "F'", fx, 7 / zoom);
        }
      }

      if (selected) {
        const bw = lens.thickness + 16;
        this._drawSelectionFrame(ctx, -bw / 2, -halfAp - 6, bw, ap + 12, zoom);
        this._drawRotationHandle(ctx, 0, -halfAp - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    _drawConvexBody(ctx, lens, selected, hovered, zoom) {
      const halfAp = lens.aperture / 2;
      const t = lens.thickness;

      ctx.fillStyle = 'rgba(90, 134, 168, 0.13)';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#b5826a' : 'rgba(90, 134, 168, 0.65)';
      ctx.lineWidth = (selected ? 2 : 1.4) / zoom;

      ctx.beginPath();
      ctx.moveTo(0, -halfAp);
      ctx.quadraticCurveTo(t, 0, 0, halfAp);
      ctx.quadraticCurveTo(-t, 0, 0, -halfAp);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const aw = 4 / zoom;
      ctx.beginPath();
      ctx.moveTo(-aw, -halfAp + aw);
      ctx.lineTo(0, -halfAp);
      ctx.lineTo(aw, -halfAp + aw);
      ctx.moveTo(-aw, halfAp - aw);
      ctx.lineTo(0, halfAp);
      ctx.lineTo(aw, halfAp - aw);
      ctx.stroke();
    }

    _drawConcaveBody(ctx, lens, selected, hovered, zoom) {
      const halfAp = lens.aperture / 2;
      const edgeW = lens.thickness + 6;
      const waistW = 4;

      ctx.fillStyle = 'rgba(90, 134, 168, 0.13)';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#b5826a' : 'rgba(90, 134, 168, 0.65)';
      ctx.lineWidth = (selected ? 2 : 1.4) / zoom;

      ctx.beginPath();
      ctx.moveTo(edgeW / 2, -halfAp);
      ctx.quadraticCurveTo(waistW / 2, 0, edgeW / 2, halfAp);
      ctx.lineTo(-edgeW / 2, halfAp);
      ctx.quadraticCurveTo(-waistW / 2, 0, -edgeW / 2, -halfAp);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // ── 1. Plane Mirror ──
    _drawPlaneMirror(ctx, mirror, selected, hovered, zoom) {
      const halfAp = mirror.aperture / 2;
      const t = mirror.thickness;

      // Substrate backing block
      ctx.fillStyle = 'rgba(225, 216, 202, 0.75)';
      ctx.fillRect(-t, -halfAp, t, mirror.aperture);

      // Diagonal hatching marks on rear side
      ctx.strokeStyle = 'rgba(120, 110, 98, 0.45)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      const step = 8;
      for (let y = -halfAp + 4; y <= halfAp - 2; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(-t, y - 6);
      }
      ctx.stroke();

      // High-reflectivity front metallic surface at x = 0
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#37352f' : '#6b655c';
      ctx.lineWidth = (selected ? 2.6 : 2.2) / zoom;
      ctx.beginPath();
      ctx.moveTo(0, -halfAp);
      ctx.lineTo(0, halfAp);
      ctx.stroke();

      if (selected) {
        this._drawSelectionFrame(ctx, -t - 6, -halfAp - 6, t + 14, mirror.aperture + 12, zoom);
        this._drawRotationHandle(ctx, 0, -halfAp - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 1b. Curved Mirror (Concave & Convex) ──
    _drawCurvedMirror(ctx, mirror, selected, hovered, zoom) {
      const R = Math.max(40, mirror.radiusOfCurvature);
      const ap = Math.min(mirror.aperture, 1.92 * R);
      const halfAp = ap / 2;
      const isConcave = mirror.type === 'concave-mirror';
      const f = mirror.focalLength;

      // Optical axis dashed line
      if (this.showOpticalAxis || selected) {
        ctx.strokeStyle = selected ? 'rgba(159, 107, 83, 0.35)' : 'rgba(120, 110, 98, 0.16)';
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([5 / zoom, 4 / zoom]);
        ctx.beginPath();
        ctx.moveTo(-f - 65, 0);
        ctx.lineTo(f + 65, 0);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const cx = isConcave ? -R : R;
      const halfAngle = Math.asin(Math.min(0.98, halfAp / R));
      const startAngle = isConcave ? -halfAngle : Math.PI - halfAngle;
      const endAngle = isConcave ? halfAngle : Math.PI + halfAngle;

      // Rear substrate backing strip along the curved arc
      const backThickness = 7;
      const backR = isConcave ? R + backThickness : Math.max(10, R - backThickness);
      ctx.fillStyle = 'rgba(225, 216, 202, 0.72)';
      ctx.beginPath();
      ctx.arc(cx, 0, R, startAngle, endAngle, false);
      ctx.arc(cx, 0, backR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fill();

      // Rear hatching marks along the arc
      ctx.strokeStyle = 'rgba(120, 110, 98, 0.45)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      const numTicks = Math.max(6, Math.round(ap / 10));
      for (let i = 0; i <= numTicks; i++) {
        const a = startAngle + (endAngle - startAngle) * (i / numTicks);
        const x0 = cx + R * Math.cos(a);
        const y0 = R * Math.sin(a);
        const x1 = cx + backR * Math.cos(a + 0.03);
        const y1 = backR * Math.sin(a + 0.03);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();

      // High-reflectivity front curved surface
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#37352f' : '#6b655c';
      ctx.lineWidth = (selected ? 2.6 : 2.2) / zoom;
      ctx.beginPath();
      ctx.arc(cx, 0, R, startAngle, endAngle, false);
      ctx.stroke();

      // Focal point visualization (F for concave at -R/2, virtual F' for convex at +R/2)
      if (this.showFocalPoints && mirror.showFocalPoint) {
        const fx = isConcave ? -f : f;
        const label = isConcave ? 'F' : "F'";

        ctx.fillStyle = selected ? '#9f6b53' : isConcave ? 'rgba(159, 107, 83, 0.75)' : 'rgba(210, 153, 34, 0.8)';
        ctx.beginPath();
        ctx.arc(fx, 0, 3.2 / zoom, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = selected ? '#9f6b53' : 'rgba(159, 107, 83, 0.45)';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        ctx.moveTo(fx, -5 / zoom);
        ctx.lineTo(fx, 5 / zoom);
        ctx.stroke();

        ctx.fillStyle = selected ? '#b5826a' : 'rgba(55, 53, 47, 0.75)';
        ctx.font = `500 ${9.5 / zoom}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, fx, 7 / zoom);
      }

      if (selected) {
        const sagitta = R * (1 - Math.cos(halfAngle));
        const minX = isConcave ? -sagitta - 6 : -6;
        const maxX = isConcave ? backThickness + 6 : sagitta + backThickness + 6;
        this._drawSelectionFrame(ctx, minX, -halfAp - 6, maxX - minX, ap + 12, zoom);
        this._drawRotationHandle(ctx, 0, -halfAp - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 2. Beam Splitter ──
    _drawBeamSplitter(ctx, splitter, selected, hovered, zoom) {
      const s = splitter.size;
      const hs = s / 2;

      // Outer glass cube
      ctx.fillStyle = 'rgba(90, 134, 168, 0.09)';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#b5826a' : 'rgba(120, 110, 98, 0.55)';
      ctx.lineWidth = (selected ? 1.8 : 1.2) / zoom;
      ctx.beginPath();
      ctx.rect(-hs, -hs, s, s);
      ctx.fill();
      ctx.stroke();

      // Semi-transparent dielectric diagonal coating from (-hs, -hs) to (hs, hs)
      ctx.strokeStyle = selected ? '#b5826a' : 'rgba(90, 134, 168, 0.85)';
      ctx.lineWidth = 2.0 / zoom;
      ctx.beginPath();
      ctx.moveTo(-hs, -hs);
      ctx.lineTo(hs, hs);
      ctx.stroke();

      // Subtle dashed parallel secondary coating line
      ctx.strokeStyle = 'rgba(90, 134, 168, 0.35)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.moveTo(-hs + 3, -hs - 3);
      ctx.lineTo(hs + 3, hs - 3);
      ctx.stroke();
      ctx.setLineDash([]);

      // R:T ratio label
      const rPct = Math.round(splitter.reflectance * 100);
      const tPct = 100 - rPct;
      ctx.fillStyle = 'rgba(55, 53, 47, 0.65)';
      ctx.font = `500 ${8.5 / zoom}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${rPct}/${tPct}`, hs - 4 / zoom, -hs + 12 / zoom);

      if (selected) {
        this._drawSelectionFrame(ctx, -hs - 6, -hs - 6, s + 12, s + 12, zoom);
        this._drawRotationHandle(ctx, 0, -hs - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 3. Triangular Prism ──
    _drawPrism(ctx, prism, selected, hovered, zoom) {
      const verts = prism.getLocalVertices();

      ctx.fillStyle = 'rgba(90, 134, 168, 0.13)';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#b5826a' : 'rgba(90, 134, 168, 0.7)';
      ctx.lineWidth = (selected ? 2 : 1.4) / zoom;

      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      ctx.lineTo(verts[1].x, verts[1].y);
      ctx.lineTo(verts[2].x, verts[2].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Refractive index label near base
      ctx.fillStyle = 'rgba(55, 53, 47, 0.6)';
      ctx.font = `500 ${8.5 / zoom}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`n=${prism.refractiveIndex.toFixed(2)}`, 0, verts[1].y - 5 / zoom);

      if (selected) {
        const minX = Math.min(verts[0].x, verts[1].x, verts[2].x);
        const maxX = Math.max(verts[0].x, verts[1].x, verts[2].x);
        const minY = Math.min(verts[0].y, verts[1].y, verts[2].y);
        const maxY = Math.max(verts[0].y, verts[1].y, verts[2].y);
        this._drawSelectionFrame(
          ctx,
          minX - 6,
          minY - 6,
          maxX - minX + 12,
          maxY - minY + 12,
          zoom
        );
        this._drawRotationHandle(ctx, 0, minY - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 4. Rectangular Glass Block ──
    _drawGlassBlock(ctx, block, selected, hovered, zoom) {
      const w = block.width;
      const h = block.height;
      const hw = w / 2;
      const hh = h / 2;

      ctx.fillStyle = 'rgba(90, 134, 168, 0.11)';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#b5826a' : 'rgba(90, 134, 168, 0.65)';
      ctx.lineWidth = (selected ? 2 : 1.4) / zoom;

      ctx.beginPath();
      ctx.rect(-hw, -hh, w, h);
      ctx.fill();
      ctx.stroke();

      // Subtle glass sheen lines in corner
      ctx.strokeStyle = 'rgba(90, 134, 168, 0.22)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(-hw + 8, -hh + 4);
      ctx.lineTo(-hw + 4, -hh + 8);
      ctx.moveTo(-hw + 14, -hh + 4);
      ctx.lineTo(-hw + 4, -hh + 14);
      ctx.stroke();

      // Refractive index label
      ctx.fillStyle = 'rgba(55, 53, 47, 0.6)';
      ctx.font = `500 ${8.5 / zoom}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`n=${block.refractiveIndex.toFixed(2)}`, hw - 5 / zoom, hh - 4 / zoom);

      if (selected) {
        this._drawSelectionFrame(ctx, -hw - 6, -hh - 6, w + 12, h + 12, zoom);
        this._drawRotationHandle(ctx, 0, -hh - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 5. Optical Detector ──
    _drawOpticalDetector(ctx, det, selected, hovered, zoom) {
      const ap = det.aperture;
      const halfAp = ap / 2;
      const bw = det.bodyW;

      // Detector body housing (extends from x = 0 to x = +bw so front sensor is at x = 0)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#9c8f7e' : '#cdc3b4';
      ctx.lineWidth = (selected ? 2 : 1.2) / zoom;

      ctx.beginPath();
      ctx.roundRect(-2, -halfAp, bw, ap, 3 / zoom);
      ctx.fill();
      ctx.stroke();

      // Active photosensitive surface along x = 0
      const activeColor = det.detected
        ? rgbStr(wavelengthToRGB(det.avgWavelength || 550), 0.95)
        : '#b9ae9e';
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 3 / zoom;
      ctx.beginPath();
      ctx.moveTo(-2, -halfAp + 3);
      ctx.lineTo(-2, halfAp - 3);
      ctx.stroke();

      // Status LED indicator circle on housing
      const ledColor = det.detected ? '#448361' : '#cdc3b4';
      ctx.fillStyle = ledColor;
      ctx.beginPath();
      ctx.arc(bw / 2 - 2, -halfAp + 10, 3.5 / zoom, 0, Math.PI * 2);
      ctx.fill();

      if (det.detected) {
        ctx.fillStyle = 'rgba(68, 131, 97, 0.28)';
        ctx.beginPath();
        ctx.arc(bw / 2 - 2, -halfAp + 10, 7 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }

      // Live intensity readout badge rotated upright next to detector
      ctx.save();
      ctx.translate(bw / 2 - 2, 4);
      ctx.rotate(-rad(det.rotation));
      const pct = Math.round(det.totalIntensity * 100);
      ctx.fillStyle = det.detected ? '#448361' : '#787774';
      ctx.font = `600 ${8.5 / zoom}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(det.detected ? `${pct}%` : '0%', 0, 0);
      ctx.restore();

      if (selected) {
        this._drawSelectionFrame(ctx, -8, -halfAp - 6, bw + 12, ap + 12, zoom);
        this._drawRotationHandle(ctx, bw / 2 - 2, -halfAp - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 6. Optical Color Filter ──
    _drawColorFilter(ctx, filter, selected, hovered, zoom) {
      const halfAp = filter.aperture / 2;
      const t = filter.thickness;
      const c = filter.color;

      // Tinted filter glass plate
      ctx.fillStyle = rgbStr(c, 0.32);
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#37352f' : rgbStr(c, 0.9);
      ctx.lineWidth = (selected ? 2 : 1.5) / zoom;

      ctx.beginPath();
      ctx.roundRect(-t / 2, -halfAp, t, filter.aperture, 2 / zoom);
      ctx.fill();
      ctx.stroke();

      // Metallic end-caps (top & bottom filter holder clips)
      ctx.fillStyle = '#f1ece3';
      ctx.strokeStyle = '#b9ae9e';
      ctx.lineWidth = 1 / zoom;
      ctx.fillRect(-t / 2 - 2, -halfAp - 3, t + 4, 6);
      ctx.strokeRect(-t / 2 - 2, -halfAp - 3, t + 4, 6);
      ctx.fillRect(-t / 2 - 2, halfAp - 3, t + 4, 6);
      ctx.strokeRect(-t / 2 - 2, halfAp - 3, t + 4, 6);

      // Filter color & transmission badge next to filter
      ctx.save();
      ctx.translate(t / 2 + 14 / zoom, 0);
      ctx.rotate(-rad(filter.rotation));
      ctx.fillStyle = rgbStr(c, 0.95);
      ctx.font = `600 ${8.5 / zoom}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const labelText =
        filter.filterColor && filter.filterColor !== 'custom'
          ? `${filter.filterColor.toUpperCase()} ${Math.round(filter.transmission * 100)}%`
          : `${filter.passWavelength}nm ${Math.round(filter.transmission * 100)}%`;
      ctx.fillText(labelText, 0, 0);
      ctx.restore();

      if (selected) {
        this._drawSelectionFrame(ctx, -t / 2 - 8, -halfAp - 8, t + 16, filter.aperture + 16, zoom);
        this._drawRotationHandle(ctx, 0, -halfAp - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 7. Point Light Source ──
    _drawPointSource(ctx, src, selected, hovered, zoom) {
      const r = src.radius;
      const c = src.color;

      // Soft outer glow halo
      ctx.fillStyle = rgbStr(c, 0.22);
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.fill();

      // Fan sector guide if spreadAngle < 360°
      if (src.spreadAngle < 359.5) {
        const halfSpread = rad(src.spreadAngle / 2);
        ctx.strokeStyle = rgbStr(c, 0.45);
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.arc(0, 0, r + 9, -halfSpread, halfSpread);
        ctx.stroke();
      }

      // Emitter housing ring
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#9c8f7e' : '#cdc3b4';
      ctx.lineWidth = (selected ? 2 : 1.3) / zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Glowing filament core
      ctx.fillStyle = rgbStr(c, 0.95);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
      ctx.fill();

      // Small center specular dot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(-r * 0.16, -r * 0.16, r * 0.18, 0, Math.PI * 2);
      ctx.fill();

      if (selected) {
        const box = r + 8;
        this._drawSelectionFrame(ctx, -box, -box, box * 2, box * 2, zoom);
        this._drawRotationHandle(ctx, 0, -box - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 8. Dielectric Glass Sphere / Ball Lens ──
    _drawGlassSphere(ctx, sphere, selected, hovered, zoom) {
      const R = sphere.radius;

      // Translucent glass body
      ctx.fillStyle = 'rgba(90, 134, 168, 0.14)';
      ctx.strokeStyle = selected
        ? '#9f6b53'
        : hovered
        ? '#b5826a'
        : 'rgba(90, 134, 168, 0.82)';
      ctx.lineWidth = (selected ? 2.2 : 1.5) / zoom;

      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Curved inner specular crescent highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 2.2 / zoom;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.78, -Math.PI * 0.78, -Math.PI * 0.35);
      ctx.stroke();

      // Subtle optical center crosshair
      ctx.strokeStyle = 'rgba(90, 134, 168, 0.35)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
      ctx.moveTo(0, -5); ctx.lineTo(0, 5);
      ctx.stroke();

      // Refractive index readout upright inside sphere
      ctx.save();
      ctx.rotate(-rad(sphere.rotation));
      ctx.fillStyle = 'rgba(90, 134, 168, 0.9)';
      ctx.font = `600 ${9 / zoom}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`n=${sphere.refractiveIndex.toFixed(2)}`, 0, R * 0.45);
      ctx.restore();

      if (selected) {
        const box = R + 6;
        this._drawSelectionFrame(ctx, -box, -box, box * 2, box * 2, zoom);
        this._drawRotationHandle(ctx, 0, -R - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 9. Aperture / Multi-Slit Barrier ──
    _drawApertureSlit(ctx, slit, selected, hovered, zoom) {
      const halfAp = slit.aperture / 2;
      const t = slit.thickness;
      const segs = slit.getOpaqueSegments();

      // Subtle guide dashed line across open slits
      ctx.strokeStyle = 'rgba(120, 110, 98, 0.35)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([3 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.moveTo(0, -halfAp);
      ctx.lineTo(0, halfAp);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw each solid opaque barrier segment
      ctx.fillStyle = '#2c2a27';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#9c8f7e' : '#1e1c1a';
      ctx.lineWidth = (selected ? 1.8 : 1.2) / zoom;

      for (const [y0, y1] of segs) {
        const h = y1 - y0;
        if (h <= 0.5) continue;
        ctx.beginPath();
        ctx.roundRect(-t / 2, y0, t, h, 1.5 / zoom);
        ctx.fill();
        ctx.stroke();
      }

      // Slit count label
      ctx.save();
      ctx.translate(t / 2 + 12 / zoom, 0);
      ctx.rotate(-rad(slit.rotation));
      ctx.fillStyle = '#787774';
      ctx.font = `600 ${8 / zoom}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${slit.slitCount}-SLIT`, 0, 0);
      ctx.restore();

      if (selected) {
        this._drawSelectionFrame(ctx, -t / 2 - 8, -halfAp - 6, t + 16, slit.aperture + 12, zoom);
        this._drawRotationHandle(ctx, 0, -halfAp - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 10. Beam Blocker / Optical Baffle ──
    _drawBeamBlocker(ctx, blocker, selected, hovered, zoom) {
      const halfAp = blocker.aperture / 2;
      const t = blocker.thickness;

      // Matte absorber body
      ctx.fillStyle = '#2c2a27';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#9c8f7e' : '#1e1c1a';
      ctx.lineWidth = (selected ? 2 : 1.3) / zoom;

      ctx.beginPath();
      ctx.roundRect(-t / 2, -halfAp, t, blocker.aperture, 2 / zoom);
      ctx.fill();
      ctx.stroke();

      // Matte diagonal absorber grooves
      ctx.strokeStyle = '#787774';
      ctx.lineWidth = 1 / zoom;
      const step = 10;
      ctx.beginPath();
      for (let y = -halfAp + 6; y <= halfAp - 6; y += step) {
        ctx.moveTo(-t / 2 + 2, y - 3);
        ctx.lineTo(t / 2 - 2, y + 3);
      }
      ctx.stroke();

      // End caps
      ctx.fillStyle = '#9f6b53';
      ctx.fillRect(-t / 2 - 1, -halfAp - 2, t + 2, 3);
      ctx.fillRect(-t / 2 - 1, halfAp - 1, t + 2, 3);

      if (selected) {
        this._drawSelectionFrame(ctx, -t / 2 - 8, -halfAp - 6, t + 16, blocker.aperture + 12, zoom);
        this._drawRotationHandle(ctx, 0, -halfAp - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 11. Transmission Diffraction Grating ──
    _drawDiffractionGrating(ctx, grating, selected, hovered, zoom) {
      const halfAp = grating.aperture / 2;
      const t = grating.thickness;

      // Optical glass substrate
      ctx.fillStyle = 'rgba(90, 134, 168, 0.18)';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#b5826a' : 'rgba(90, 134, 168, 0.85)';
      ctx.lineWidth = (selected ? 2 : 1.4) / zoom;

      ctx.beginPath();
      ctx.roundRect(-t / 2, -halfAp, t, grating.aperture, 2 / zoom);
      ctx.fill();
      ctx.stroke();

      // Fine diffraction ruling ticks along the surface
      const tickSpacing = Math.max(4, Math.min(8, Math.round(4000 / grating.linesPerMm)));
      ctx.strokeStyle = '#37352f';
      ctx.lineWidth = 0.9 / zoom;
      ctx.beginPath();
      for (let y = -halfAp + 4; y <= halfAp - 4; y += tickSpacing) {
        ctx.moveTo(-t / 2 + 1.2, y);
        ctx.lineTo(t / 2 - 1.2, y);
      }
      ctx.stroke();

      // Spectral rainbow indicator strip on holder caps
      const spectral = ['#ff3b30', '#ff9500', '#34c759', '#388bfd', '#af52de'];
      const segW = (t + 4) / spectral.length;
      for (let i = 0; i < spectral.length; i++) {
        ctx.fillStyle = spectral[i];
        ctx.fillRect(-t / 2 - 2 + i * segW, -halfAp - 4, segW + 0.5, 4);
        ctx.fillRect(-t / 2 - 2 + i * segW, halfAp, segW + 0.5, 4);
      }

      // Lines/mm badge
      ctx.save();
      ctx.translate(t / 2 + 12 / zoom, 0);
      ctx.rotate(-rad(grating.rotation));
      ctx.fillStyle = 'rgba(90, 134, 168, 0.95)';
      ctx.font = `600 ${8 / zoom}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${grating.linesPerMm} l/mm`, 0, 0);
      ctx.restore();

      if (selected) {
        this._drawSelectionFrame(ctx, -t / 2 - 8, -halfAp - 8, t + 16, grating.aperture + 16, zoom);
        this._drawRotationHandle(ctx, 0, -halfAp - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    // ── 12. Linear Optical Polarizer ──
    _drawPolarizer(ctx, pol, selected, hovered, zoom) {
      const halfAp = pol.aperture / 2;
      const t = pol.thickness;

      // Smoked dichroic polarizing film plate
      ctx.fillStyle = 'rgba(124, 98, 168, 0.24)';
      ctx.strokeStyle = selected ? '#9f6b53' : hovered ? '#37352f' : '#7c62a8';
      ctx.lineWidth = (selected ? 2 : 1.5) / zoom;

      ctx.beginPath();
      ctx.roundRect(-t / 2, -halfAp, t, pol.aperture, 2 / zoom);
      ctx.fill();
      ctx.stroke();

      // Metallic mount caps
      ctx.fillStyle = '#f1ece3';
      ctx.strokeStyle = '#b9ae9e';
      ctx.lineWidth = 1 / zoom;
      ctx.fillRect(-t / 2 - 2, -halfAp - 3, t + 4, 6);
      ctx.strokeRect(-t / 2 - 2, -halfAp - 3, t + 4, 6);
      ctx.fillRect(-t / 2 - 2, halfAp - 3, t + 4, 6);
      ctx.strokeRect(-t / 2 - 2, halfAp - 3, t + 4, 6);

      // Upright polarization transmission-axis dial & angle badge next to polarizer
      ctx.save();
      ctx.translate(t / 2 + 16 / zoom, 0);
      ctx.rotate(-rad(pol.rotation));

      const dialR = 8 / zoom;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#7c62a8';
      ctx.lineWidth = 1.2 / zoom;
      ctx.beginPath();
      ctx.arc(0, 0, dialR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Polarization transmission axis double-bar inside dial
      const pRad = rad(pol.polAngle);
      const dx = Math.cos(pRad) * (dialR - 2 / zoom);
      const dy = -Math.sin(pRad) * (dialR - 2 / zoom);
      ctx.strokeStyle = '#7c62a8';
      ctx.lineWidth = 1.8 / zoom;
      ctx.beginPath();
      ctx.moveTo(-dx, -dy);
      ctx.lineTo(dx, dy);
      ctx.stroke();

      ctx.fillStyle = '#7c62a8';
      ctx.font = `600 ${8 / zoom}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`POL ${Math.round(pol.polAngle)}°`, dialR + 4 / zoom, 0);
      ctx.restore();

      if (selected) {
        this._drawSelectionFrame(ctx, -t / 2 - 8, -halfAp - 8, t + 16, pol.aperture + 16, zoom);
        this._drawRotationHandle(ctx, 0, -halfAp - CFG.ROTATION_HANDLE_DIST, zoom);
      }
    }

    _drawSelectionFrame(ctx, x, y, w, h, zoom) {
      ctx.strokeStyle = 'rgba(159, 107, 83, 0.45)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 3 / zoom]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      const cLen = 4 / zoom;
      ctx.strokeStyle = '#9f6b53';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.moveTo(x, y + cLen); ctx.lineTo(x, y); ctx.lineTo(x + cLen, y);
      ctx.moveTo(x + w - cLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cLen);
      ctx.moveTo(x, y + h - cLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cLen, y + h);
      ctx.moveTo(x + w - cLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cLen);
      ctx.stroke();
    }

    _drawRotationHandle(ctx, x, y, zoom) {
      ctx.strokeStyle = 'rgba(159, 107, 83, 0.45)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#9f6b53';
      ctx.lineWidth = 1.6 / zoom;
      ctx.beginPath();
      ctx.arc(x, y, CFG.ROTATION_HANDLE_R / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9f6b53';
      ctx.beginPath();
      ctx.arc(x, y, 2 / zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    drawDragPreview(type, x, y, panX, panY, zoom) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);
      ctx.translate(x, y);
      ctx.globalAlpha = 0.55;

      const dummy = createComponent(type, 0, 0);
      if (dummy instanceof Laser) {
        this._drawLaser(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof PointSource) {
        this._drawPointSource(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof Lens) {
        this._drawLens(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof GlassSphere) {
        this._drawGlassSphere(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof PlaneMirror) {
        this._drawPlaneMirror(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof CurvedMirror) {
        this._drawCurvedMirror(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof BeamSplitter) {
        this._drawBeamSplitter(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof Prism) {
        this._drawPrism(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof GlassBlock) {
        this._drawGlassBlock(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof OpticalDetector) {
        this._drawOpticalDetector(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof ColorFilter) {
        this._drawColorFilter(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof ApertureSlit) {
        this._drawApertureSlit(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof BeamBlocker) {
        this._drawBeamBlocker(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof DiffractionGrating) {
        this._drawDiffractionGrating(ctx, dummy, true, false, zoom);
      } else if (dummy instanceof Polarizer) {
        this._drawPolarizer(ctx, dummy, true, false, zoom);
      }

      ctx.restore();
    }

    drawGroupSelection(groupBounds, panX, panY, zoom) {
      if (!groupBounds) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      const { minX, minY, maxX, maxY, cx, cy, handleX, handleY } = groupBounds;
      const w = maxX - minX;
      const h = maxY - minY;

      // Dashed outer group bounding frame
      ctx.strokeStyle = 'rgba(159, 107, 83, 0.65)';
      ctx.lineWidth = 1.2 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeRect(minX, minY, w, h);
      ctx.setLineDash([]);

      // Group centroid crosshair
      const cr = 5 / zoom;
      ctx.strokeStyle = 'rgba(159, 107, 83, 0.85)';
      ctx.lineWidth = 1.2 / zoom;
      ctx.beginPath();
      ctx.moveTo(cx - cr, cy);
      ctx.lineTo(cx + cr, cy);
      ctx.moveTo(cx, cy - cr);
      ctx.lineTo(cx, cy + cr);
      ctx.stroke();

      // Group rotation handle above top-center of group box
      if (handleX !== undefined && handleY !== undefined) {
        ctx.strokeStyle = 'rgba(159, 107, 83, 0.55)';
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.moveTo(cx, minY);
        ctx.lineTo(handleX, handleY);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#a5785f';
        ctx.lineWidth = 1.8 / zoom;
        ctx.beginPath();
        ctx.arc(handleX, handleY, (CFG.ROTATION_HANDLE_R + 1) / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#a5785f';
        ctx.beginPath();
        ctx.arc(handleX, handleY, 2.2 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    drawMarquee(marqueeRect, panX, panY, zoom) {
      if (!marqueeRect) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      const x = Math.min(marqueeRect.x0, marqueeRect.x1);
      const y = Math.min(marqueeRect.y0, marqueeRect.y1);
      const w = Math.abs(marqueeRect.x1 - marqueeRect.x0);
      const h = Math.abs(marqueeRect.y1 - marqueeRect.y0);

      ctx.fillStyle = 'rgba(159, 107, 83, 0.10)';
      ctx.strokeStyle = 'rgba(159, 107, 83, 0.85)';
      ctx.lineWidth = 1.2 / zoom;
      ctx.fillRect(x, y, w, h);
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      ctx.restore();
    }
  }

  global.LasSim.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
