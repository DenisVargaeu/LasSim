(function (global) {
  'use strict';

  const {
    CFG,
    V,
    clamp,
    deg,
    rad,
    normAngle,
    wavelengthToRGB,
    rgbStr,
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
    FILTER_PRESETS,
    createComponent,
    cloneComponent,
    serializeComponent,
    deserializeComponent,
    buildOptpObject,
    validateAndParseOptp,
    RayTracer,
    Renderer,
    I18N,
  } = global.OptiLab;

  const i18n = I18N || {
    getLang: () => 'en',
    setLang: () => 'en',
    t: (k) => k,
    phrase: (s) => s,
    getComponentInfo: () => null,
    translateSubtree: () => {},
    applyStaticDOM: () => {},
  };

  const MATERIALS = [
    { name: 'Water', n: 1.33, disp: 0.02 },
    { name: 'Silica', n: 1.46, disp: 0.03 },
    { name: 'Crown', n: 1.52, disp: 0.05 },
    { name: 'Flint', n: 1.78, disp: 0.09 },
    { name: 'Sapphire', n: 1.77, disp: 0.04 },
    { name: 'Diamond', n: 2.42, disp: 0.14 },
  ];

  // ── IndexedDB Project Storage Engine ──
  class ProjectStorage {
    constructor() {
      this.dbName = 'OptiLabDB';
      this.dbVersion = 1;
      this.db = null;
      this._memProjects = new Map();
      this._memMeta = new Map();
    }

    async init() {
      if (this.db) return this.db;
      if (typeof indexedDB === 'undefined') return null;

      return new Promise((resolve) => {
        try {
          const req = indexedDB.open(this.dbName, this.dbVersion);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('projects')) {
              const store = db.createObjectStore('projects', { keyPath: 'id' });
              store.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
            if (!db.objectStoreNames.contains('meta')) {
              db.createObjectStore('meta', { keyPath: 'key' });
            }
          };
          req.onsuccess = (e) => {
            this.db = e.target.result;
            resolve(this.db);
          };
          req.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      });
    }

    async saveProject(proj) {
      await this.init();
      const record = {
        id: proj.id,
        name: String(proj.name || 'Untitled Project').trim() || 'Untitled Project',
        createdAt: proj.createdAt || Date.now(),
        updatedAt: Date.now(),
        componentCount: Array.isArray(proj.components) ? proj.components.length : 0,
        components: proj.components || [],
        settings: proj.settings || {},
      };
      this._memProjects.set(record.id, record);

      if (!this.db) return record;
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['projects', 'meta'], 'readwrite');
        tx.objectStore('projects').put(record);
        tx.objectStore('meta').put({ key: 'lastProjectId', value: record.id });
        tx.oncomplete = () => resolve(record);
        tx.onerror = (e) => reject(e.target.error);
      });
    }

    async getProject(id) {
      if (!id) return null;
      await this.init();
      if (!this.db) return this._memProjects.get(id) || null;
      return new Promise((resolve) => {
        const tx = this.db.transaction('projects', 'readonly');
        const req = tx.objectStore('projects').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    }

    async listProjects() {
      await this.init();
      if (!this.db) {
        return Array.from(this._memProjects.values()).sort((a, b) => b.updatedAt - a.updatedAt);
      }
      return new Promise((resolve) => {
        const tx = this.db.transaction('projects', 'readonly');
        const req = tx.objectStore('projects').getAll();
        req.onsuccess = () => {
          const list = Array.isArray(req.result) ? req.result : [];
          list.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    }

    async deleteProject(id) {
      await this.init();
      this._memProjects.delete(id);
      if (!this.db) return true;
      return new Promise((resolve) => {
        const tx = this.db.transaction('projects', 'readwrite');
        tx.objectStore('projects').delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    }

    async getLastProjectId() {
      await this.init();
      if (!this.db) return this._memMeta.get('lastProjectId') || null;
      return new Promise((resolve) => {
        const tx = this.db.transaction('meta', 'readonly');
        const req = tx.objectStore('meta').get('lastProjectId');
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
      });
    }

    async setLastProjectId(id) {
      await this.init();
      this._memMeta.set('lastProjectId', id);
      if (!this.db) return;
      return new Promise((resolve) => {
        const tx = this.db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put({ key: 'lastProjectId', value: id });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  }

  // ── Undo / Redo Snapshot History Manager ──
  class HistoryManager {
    constructor(maxSteps = 60) {
      this.maxSteps = maxSteps;
      this.stack = [];
      this.index = -1;
    }

    clear() {
      this.stack = [];
      this.index = -1;
    }

    snapshot(components, selectedIds) {
      return JSON.stringify({
        components: components.map((c) => serializeComponent(c)),
        selectedIds: Array.from(selectedIds || []),
      });
    }

    record(components, selectedIds) {
      const snap = this.snapshot(components, selectedIds);
      if (this.index >= 0 && this.stack[this.index] === snap) {
        return false;
      }
      this.stack = this.stack.slice(0, this.index + 1);
      this.stack.push(snap);
      if (this.stack.length > this.maxSteps) {
        this.stack.shift();
      } else {
        this.index++;
      }
      return true;
    }

    canUndo() {
      return this.index > 0;
    }

    canRedo() {
      return this.index >= 0 && this.index < this.stack.length - 1;
    }

    undo() {
      if (!this.canUndo()) return null;
      this.index--;
      return this._parse(this.stack[this.index]);
    }

    redo() {
      if (!this.canRedo()) return null;
      this.index++;
      return this._parse(this.stack[this.index]);
    }

    _parse(jsonStr) {
      const raw = JSON.parse(jsonStr);
      return {
        components: raw.components.map((d) => deserializeComponent(d, true)),
        selectedIds: new Set(raw.selectedIds || []),
      };
    }
  }

  // ── Upgraded Properties & Bench Inspector Panel ──
  class PropertiesPanel {
    constructor(app) {
      this.app = app;
      this.emptyEl = document.getElementById('props-empty');
      this.contentEl = document.getElementById('props-content');
      this._currentId = null;
      this._dialDragging = false;
    }

    show(component) {
      const selectedComps = this.app ? this.app.getSelectedComponents() : component ? [component] : [];
      if (selectedComps.length > 1) {
        this.showMulti(selectedComps);
        return;
      }
      const single = selectedComps.length === 1 ? selectedComps[0] : component;
      if (!single) {
        this.hide();
        return;
      }
      this._currentId = single.id;
      this.emptyEl.style.display = 'none';
      this.contentEl.classList.add('visible');
      this._build(single);
    }

    showMulti(selectedComps) {
      this._currentId = '__MULTI__';
      this.emptyEl.style.display = 'none';
      this.contentEl.classList.add('visible');

      const app = this.app;
      const count = selectedComps.length;
      const cx = Math.round(selectedComps.reduce((s, c) => s + c.x, 0) / count);
      const cy = Math.round(selectedComps.reduce((s, c) => s + c.y, 0) / count);
      const groupIds = new Set(selectedComps.map((c) => c.groupId).filter(Boolean));
      const isSingleGroup = groupIds.size === 1 && selectedComps.every((c) => c.groupId);

      this.contentEl.innerHTML = `
        <div class="prop-header">
          <div class="prop-title-wrap">
            <div class="prop-icon-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="2">
                <rect x="3" y="3" width="8" height="8" rx="1.5"/>
                <rect x="13" y="3" width="8" height="8" rx="1.5"/>
                <rect x="8" y="13" width="8" height="8" rx="1.5"/>
              </svg>
            </div>
            <div class="prop-title-meta">
              <span class="prop-category-tag">${isSingleGroup ? 'GROUPED SELECTION' : 'MULTI-OBJECT SELECTION'}</span>
              <h3>${i18n.t('objectsSelected', { n: count })}</h3>
            </div>
          </div>
        </div>

        <div class="prop-section">
          <div class="prop-section-header">
            <h4>Centroid Transform</h4>
            <span class="prop-badge-pill">${isSingleGroup ? 'Group #' + Array.from(groupIds)[0] : 'Unlocked'}</span>
          </div>

          <div class="prop-grid-2">
            <div class="prop-field">
              <label for="multi-cx">Centroid X</label>
              <div class="input-unit-wrap">
                <input type="number" id="multi-cx" value="${cx}" step="10">
                <span class="input-unit">px</span>
              </div>
            </div>
            <div class="prop-field">
              <label for="multi-cy">Centroid Y</label>
              <div class="input-unit-wrap">
                <input type="number" id="multi-cy" value="${cy}" step="10">
                <span class="input-unit">px</span>
              </div>
            </div>
          </div>

          <div class="param-block">
            <div class="param-header">
              <label>Group Rotation Around Centroid</label>
            </div>
            <div class="quick-angles">
              <button class="qa-btn multi-rot-btn" data-delta="-45">−45°</button>
              <button class="qa-btn multi-rot-btn" data-delta="-15">−15°</button>
              <button class="qa-btn multi-rot-btn" data-delta="15">+15°</button>
              <button class="qa-btn multi-rot-btn" data-delta="45">+45°</button>
              <button class="qa-btn multi-rot-btn" data-delta="90">+90°</button>
            </div>
          </div>
        </div>

        <div class="prop-section">
          <div class="prop-section-header">
            <h4>Grouping &amp; Alignment</h4>
          </div>
          <div class="prop-actions-grid">
            <button class="btn-secondary" id="multi-btn-group" title="Group Selection (Ctrl+G)">Group (Ctrl+G)</button>
            <button class="btn-secondary" id="multi-btn-ungroup" title="Ungroup Selection (Ctrl+Shift+G)">Ungroup</button>
          </div>
          <div class="prop-actions-grid">
            <button class="btn-secondary" id="multi-btn-align-y">Align Horizontal (Y)</button>
            <button class="btn-secondary" id="multi-btn-align-x">Align Vertical (X)</button>
          </div>
        </div>

        <div class="prop-section" style="border-bottom:none">
          <div class="prop-actions-grid">
            <button class="btn-secondary" id="multi-btn-dup" title="Duplicate Selection (Ctrl+D)">Duplicate (${count})</button>
            <button class="btn-delete" id="multi-btn-del" title="Delete Selection (Delete)">Delete (${count})</button>
          </div>
        </div>
      `;

      const cxInput = document.getElementById('multi-cx');
      const cyInput = document.getElementById('multi-cy');
      if (cxInput) {
        cxInput.addEventListener('change', (e) => {
          const newCx = parseFloat(e.target.value) || 0;
          const curCx = selectedComps.reduce((s, c) => s + c.x, 0) / selectedComps.length;
          app.moveSelectedBy(newCx - curCx, 0, true);
        });
      }
      if (cyInput) {
        cyInput.addEventListener('change', (e) => {
          const newCy = parseFloat(e.target.value) || 0;
          const curCy = selectedComps.reduce((s, c) => s + c.y, 0) / selectedComps.length;
          app.moveSelectedBy(0, newCy - curCy, true);
        });
      }

      this.contentEl.querySelectorAll('.multi-rot-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          app.rotateSelectedBy(parseFloat(btn.dataset.delta) || 0, true);
        });
      });

      const grpBtn = document.getElementById('multi-btn-group');
      const ungrpBtn = document.getElementById('multi-btn-ungroup');
      const alignYBtn = document.getElementById('multi-btn-align-y');
      const alignXBtn = document.getElementById('multi-btn-align-x');
      const dupBtn = document.getElementById('multi-btn-dup');
      const delBtn = document.getElementById('multi-btn-del');

      if (grpBtn) grpBtn.addEventListener('click', () => app.groupSelection());
      if (ungrpBtn) ungrpBtn.addEventListener('click', () => app.ungroupSelection());
      if (alignYBtn) alignYBtn.addEventListener('click', () => app.alignSelection('horizontal'));
      if (alignXBtn) alignXBtn.addEventListener('click', () => app.alignSelection('vertical'));
      if (dupBtn) dupBtn.addEventListener('click', () => app.duplicateSelection());
      if (delBtn) delBtn.addEventListener('click', () => app.deleteSelection());
      i18n.translateSubtree(this.contentEl);
    }

    hide() {
      this._currentId = null;
      this.emptyEl.style.display = 'flex';
      this.contentEl.classList.remove('visible');
      this.contentEl.innerHTML = '';
      this.renderBenchOverview();
    }

    // Renders the Scene Outliner & Global Bench Overview when no component is selected
    renderBenchOverview() {
      if (this._currentId !== null) return;
      const app = this.app;
      const comps = app.components;

      const sourcesCount = comps.filter((c) => c instanceof Laser || c instanceof PointSource).length;
      const opticsCount = comps.filter(
        (c) => !(c instanceof Laser) && !(c instanceof PointSource) && !(c instanceof OpticalDetector)
      ).length;
      const detCount = comps.filter((c) => c instanceof OpticalDetector).length;

      const typeNames = {
        'laser': 'Laser Source',
        'white-led': 'White LED',
        'rgb-led': 'RGB LED',
        'point-source': 'Point Source',
        'convex-lens': 'Convex Lens',
        'concave-lens': 'Concave Lens',
        'glass-sphere': 'Ball Lens / Sphere',
        'plane-mirror': 'Plane Mirror',
        'concave-mirror': 'Concave Mirror',
        'convex-mirror': 'Convex Mirror',
        'beam-splitter': 'Beam Splitter',
        'prism': 'Optical Prism',
        'glass-block': 'Glass Block',
        'optical-detector': 'Optical Detector',
        'optical-filter': 'Optical Filter',
        'color-filter': 'Optical Filter',
        'aperture-slit': 'Aperture / Slit',
        'beam-blocker': 'Beam Blocker',
        'diffraction-grating': 'Diffraction Grating',
        'polarizer': 'Linear Polarizer',
      };

      let listHtml = '';
      if (comps.length === 0) {
        listHtml = `
          <div style="padding:18px 8px;text-align:center;color:var(--text-muted);font-size:11.5px;">
            ${i18n.t('emptyOutliner')}
          </div>
        `;
      } else {
        for (const c of comps) {
          const dotColor =
            c instanceof Laser || c instanceof PointSource
              ? rgbStr(c.color)
              : c instanceof ColorFilter
              ? rgbStr(c.color)
              : c instanceof Polarizer
              ? '#7c62a8'
              : c instanceof ApertureSlit || c instanceof BeamBlocker
              ? '#6b655c'
              : c instanceof OpticalDetector
              ? c.detected
                ? '#448361'
                : '#9c8f7e'
              : '#9f6b53';
          listHtml += `
            <div class="outliner-item" data-select-id="${c.id}">
              <div class="outliner-left">
                <span class="outliner-dot" style="background:${dotColor}"></span>
                <span class="outliner-name">${typeNames[c.type] || c.type}</span>
                ${c.locked ? '<span class="prop-badge-pill">LOCKED</span>' : ''}
              </div>
              <span class="outliner-coords">(${Math.round(c.x)}, ${Math.round(c.y)})</span>
            </div>
          `;
        }
      }

      this.emptyEl.innerHTML = `
        <div class="prop-header">
          <div class="prop-title-wrap">
            <div class="prop-icon-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="#388bfd" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
            </div>
            <div class="prop-title-meta">
              <span class="prop-category-tag">WORKSPACE INSPECTOR</span>
              <h3>Optical Bench Overview</h3>
            </div>
          </div>
        </div>

        <div class="prop-section">
          <div class="prop-section-header">
            <h4>Bench Telemetry</h4>
            <span class="prop-badge-pill">${i18n.t('itemsCount', { n: comps.length })}</span>
          </div>
          <div class="optical-readout">
            <div class="readout-row"><span>Light Sources</span><span>${sourcesCount}</span></div>
            <div class="readout-row"><span>Optical Elements</span><span>${opticsCount}</span></div>
            <div class="readout-row"><span>Active Detectors</span><span>${detCount}</span></div>
            <div class="readout-row"><span>Traced Ray Segments</span><span id="overview-rays">${app.rayTracer.segments.length}</span></div>
          </div>
        </div>

        <div class="prop-section">
          <h4>Viewport Display</h4>
          <label class="prop-checkbox-row">
            <input type="checkbox" id="ov-snap" ${app.snapEnabled ? 'checked' : ''}>
            <span>Snap to 20px Grid</span>
          </label>
          <label class="prop-checkbox-row">
            <input type="checkbox" id="ov-foci" ${app.renderer.showFocalPoints ? 'checked' : ''}>
            <span>Show Lens Focal Points (F / F')</span>
          </label>
          <label class="prop-checkbox-row">
            <input type="checkbox" id="ov-axis" ${app.renderer.showOpticalAxis ? 'checked' : ''}>
            <span>Show Principal Optical Axes</span>
          </label>
        </div>

        <div class="prop-section" style="border-bottom:none;flex:1">
          <div class="prop-section-header">
            <h4>Scene Outliner</h4>
            <span style="font-size:10px;color:var(--text-muted)">Click to inspect</span>
          </div>
          <div class="outliner-list">${listHtml}</div>
        </div>
      `;

      this.emptyEl.querySelectorAll('.outliner-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          const target = app.components.find((c) => c.id === item.dataset.selectId);
          if (!target) return;
          if (e.ctrlKey || e.metaKey) {
            app.toggleSelectComponent(target);
          } else if (e.shiftKey) {
            app.addSelectComponent(target);
          } else {
            app.selectComponent(target);
          }
        });
      });

      const ovSnap = document.getElementById('ov-snap');
      if (ovSnap) {
        ovSnap.addEventListener('change', (e) => {
          app.snapEnabled = e.target.checked;
          const tbBtn = document.getElementById('btn-snap');
          if (tbBtn) tbBtn.classList.toggle('active', app.snapEnabled);
        });
      }

      const ovFoci = document.getElementById('ov-foci');
      if (ovFoci) {
        ovFoci.addEventListener('change', (e) => {
          app.renderer.showFocalPoints = e.target.checked;
          const tbBtn = document.getElementById('btn-foci');
          if (tbBtn) tbBtn.classList.toggle('active', app.renderer.showFocalPoints);
          app.requestUpdate();
        });
      }

      const ovAxis = document.getElementById('ov-axis');
      if (ovAxis) {
        ovAxis.addEventListener('change', (e) => {
          app.renderer.showOpticalAxis = e.target.checked;
          app.requestUpdate();
        });
      }
      i18n.translateSubtree(this.emptyEl);
    }

    refreshValues(comp) {
      if (!comp) {
        this.renderBenchOverview();
        return;
      }
      if (comp.id !== this._currentId) return;

      const xInput = document.getElementById('prop-x');
      const yInput = document.getElementById('prop-y');
      const rotInput = document.getElementById('prop-rot');
      const angleVal = normAngle(comp.rotation);

      if (xInput && document.activeElement !== xInput) xInput.value = Math.round(comp.x);
      if (yInput && document.activeElement !== yInput) yInput.value = Math.round(comp.y);
      if (rotInput && document.activeElement !== rotInput) rotInput.value = angleVal;

      this._updateDialNeedle(angleVal);

      if (comp instanceof Lens) {
        this._updateLensReadout(comp);
      } else if (comp instanceof CurvedMirror) {
        this._updateCurvedMirrorReadout(comp);
      } else if (comp instanceof PlaneMirror) {
        const normEl = document.getElementById('readout-mir-norm');
        if (normEl) {
          const nx = Math.cos(rad(comp.rotation)).toFixed(2);
          const ny = Math.sin(rad(comp.rotation)).toFixed(2);
          normEl.textContent = `(${nx}, ${ny})`;
        }
      } else if (comp instanceof OpticalDetector) {
        this.refreshDetectorTelemetry(comp);
      }
    }

    _updateDialNeedle(angleDeg) {
      const needle = document.getElementById('dial-needle');
      const dot = document.getElementById('dial-tip');
      if (!needle || !dot) return;
      const r = 16;
      const cx = 23, cy = 23;
      const aRad = rad(angleDeg);
      const tx = cx + r * Math.cos(aRad);
      const ty = cy + r * Math.sin(aRad);
      needle.setAttribute('x2', tx.toFixed(1));
      needle.setAttribute('y2', ty.toFixed(1));
      dot.setAttribute('cx', tx.toFixed(1));
      dot.setAttribute('cy', ty.toFixed(1));
    }

    _updateLensReadout(comp) {
      const fSignedEl = document.getElementById('readout-fsigned');
      const powerEl = document.getElementById('readout-power');
      const fnumEl = document.getElementById('readout-fnum');
      const fociEl = document.getElementById('readout-foci-pos');
      if (fSignedEl) fSignedEl.textContent = `${comp.fSigned > 0 ? '+' : ''}${comp.fSigned} px`;
      if (powerEl) powerEl.textContent = `${comp.opticalPower > 0 ? '+' : ''}${comp.opticalPower} D`;
      if (fnumEl) {
        const fNum = (comp.focalLength / comp.aperture).toFixed(2);
        fnumEl.textContent = `f/${fNum}`;
      }
      if (fociEl) {
        const ax = Math.cos(rad(comp.rotation));
        const ay = Math.sin(rad(comp.rotation));
        const fx = Math.round(comp.x + ax * comp.focalLength);
        const fy = Math.round(comp.y + ay * comp.focalLength);
        fociEl.textContent = `(${fx}, ${fy})`;
      }
    }

    _updateCurvedMirrorReadout(comp) {
      const flEl = document.getElementById('readout-cm-fl');
      const powerEl = document.getElementById('readout-cm-power');
      const fociEl = document.getElementById('readout-cm-foci');
      const pillEl = document.getElementById('cm-fl-pill');
      const isConcave = comp.type === 'concave-mirror';
      const f = comp.focalLength;
      if (pillEl) pillEl.textContent = `f = ${isConcave ? '+' : '−'}${Math.round(f)} px`;
      if (flEl) flEl.textContent = `${isConcave ? '+' : '−'}${f.toFixed(0)} px`;
      if (powerEl) powerEl.textContent = `${comp.opticalPower > 0 ? '+' : ''}${comp.opticalPower} D`;
      if (fociEl) {
        const sign = isConcave ? -1 : 1;
        const ax = Math.cos(rad(comp.rotation));
        const ay = Math.sin(rad(comp.rotation));
        const fx = Math.round(comp.x + sign * ax * f);
        const fy = Math.round(comp.y + sign * ay * f);
        fociEl.textContent = `(${fx}, ${fy})`;
      }
    }

    refreshDetectorTelemetry(det) {
      if (!det || det.id !== this._currentId) return;
      const statusDot = document.getElementById('det-status-dot');
      const statusText = document.getElementById('det-status-text');
      const hitsEl = document.getElementById('det-hits');
      const totalIntEl = document.getElementById('det-total-int');
      const peakIntEl = document.getElementById('det-peak-int');
      const wlEl = document.getElementById('det-wl');
      const evEl = document.getElementById('det-ev');
      const barFill = document.getElementById('det-bar-fill');

      if (statusDot) {
        statusDot.className = 'det-led ' + (det.detected ? 'active' : '');
      }
      if (statusText) {
        statusText.textContent = i18n.phrase(det.detected ? 'LIGHT DETECTED' : 'NO SIGNAL');
        statusText.style.color = det.detected ? '#448361' : '#8b949e';
      }
      if (hitsEl) hitsEl.textContent = i18n.t(det.hitCount === 1 ? 'raysCount' : 'raysCountPlural', { n: det.hitCount });
      if (totalIntEl) totalIntEl.textContent = `${Math.round(det.totalIntensity * 100)}% (${det.totalIntensity.toFixed(2)})`;
      if (peakIntEl) peakIntEl.textContent = `${Math.round(det.peakIntensity * 100)}%`;
      if (wlEl) {
        if (det.detected && det.avgWavelength) {
          const c = wavelengthToRGB(det.avgWavelength);
          wlEl.innerHTML = `<span class="color-swatch" style="background:${rgbStr(c)}"></span> ${det.avgWavelength} nm`;
        } else {
          wlEl.textContent = '—';
        }
      }
      if (evEl) {
        if (det.detected && det.avgWavelength) {
          const ev = (1239.84 / det.avgWavelength).toFixed(2);
          evEl.textContent = `${ev} eV`;
        } else {
          evEl.textContent = '—';
        }
      }
      if (barFill) {
        const pct = clamp(det.totalIntensity * 25, 0, 100);
        barFill.style.width = `${pct}%`;
      }
    }

    _getComponentIconSvg(comp) {
      if (comp.type === 'laser') {
        const col = rgbStr(comp.color);
        return `<svg viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2"><rect x="2" y="7" width="13" height="10" rx="2"/><line x1="15" y1="12" x2="22" y2="12"/></svg>`;
      }
      if (comp.type === 'white-led') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="#c9a46a" stroke-width="2"><rect x="3" y="7" width="10" height="10" rx="2"/><path d="M13 8a4 4 0 0 1 0 8"/><line x1="18" y1="8" x2="22" y2="6"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="18" y1="16" x2="22" y2="18"/></svg>`;
      }
      if (comp.type === 'rgb-led') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="2" y="6" width="11" height="12" rx="2" style="stroke:var(--icon-ink,#6b655c)"/><line x1="15" y1="8" x2="22" y2="6" stroke="#ff3b30"/><line x1="15" y1="12" x2="22" y2="12" stroke="#3fb950"/><line x1="15" y1="16" x2="22" y2="18" stroke="#388bfd"/></svg>`;
      }
      if (comp.type === 'point-source') {
        const col = rgbStr(comp.color);
        return `<svg viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2"><circle cx="12" cy="12" r="4" fill="${rgbStr(comp.color, 0.35)}"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="7.1" y2="7.1"/><line x1="16.9" y1="16.9" x2="19.1" y2="19.1"/><line x1="19.1" y1="4.9" x2="16.9" y2="7.1"/><line x1="7.1" y1="16.9" x2="4.9" y2="19.1"/></svg>`;
      }
      if (comp.type === 'convex-lens') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="#5a86a8" stroke-width="2"><path d="M12 2 Q18 12 12 22 Q6 12 12 2 Z"/></svg>`;
      }
      if (comp.type === 'concave-lens') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="#5a86a8" stroke-width="2"><path d="M8 3 Q12 12 8 21 L16 21 Q12 12 16 3 Z"/></svg>`;
      }
      if (comp.type === 'glass-sphere') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="#5a86a8" stroke-width="2"><circle cx="12" cy="12" r="8.5" fill="rgba(90,134,168,0.18)"/><path d="M7.5 9a5.5 5.5 0 0 1 4-4" stroke-width="1.5"/></svg>`;
      }
      if (comp.type === 'plane-mirror') {
        return `<svg viewBox="0 0 24 24" fill="none" style="stroke:var(--icon-ink,#6b655c)" stroke-width="2"><line x1="15" y1="3" x2="15" y2="21"/><line x1="15" y1="6" x2="9" y2="10"/><line x1="15" y1="12" x2="9" y2="16"/><line x1="15" y1="18" x2="9" y2="22"/></svg>`;
      }
      if (comp.type === 'concave-mirror') {
        return `<svg viewBox="0 0 24 24" fill="none" style="stroke:var(--icon-ink,#6b655c)" stroke-width="2"><path d="M10 3 Q17 12 10 21"/><line x1="12" y1="6" x2="17" y2="4"/><line x1="14" y1="12" x2="19" y2="10"/><line x1="12" y1="18" x2="17" y2="16"/></svg>`;
      }
      if (comp.type === 'convex-mirror') {
        return `<svg viewBox="0 0 24 24" fill="none" style="stroke:var(--icon-ink,#6b655c)" stroke-width="2"><path d="M15 3 Q8 12 15 21"/><line x1="13" y1="6" x2="18" y2="4"/><line x1="11" y1="12" x2="16" y2="10"/><line x1="13" y1="18" x2="18" y2="16"/></svg>`;
      }
      if (comp.type === 'optical-filter' || comp.type === 'color-filter') {
        const col = rgbStr(comp.color);
        return `<svg viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2"><rect x="9" y="3" width="6" height="18" rx="1.5" fill="${rgbStr(comp.color, 0.28)}"/></svg>`;
      }
      if (comp.type === 'aperture-slit') {
        return `<svg viewBox="0 0 24 24" fill="none" style="stroke:var(--icon-ink,#6b655c)" stroke-width="2.4"><line x1="12" y1="2" x2="12" y2="7"/><line x1="12" y1="10.5" x2="12" y2="13.5"/><line x1="12" y1="17" x2="12" y2="22"/></svg>`;
      }
      if (comp.type === 'beam-blocker') {
        return `<svg viewBox="0 0 24 24" fill="none" style="stroke:var(--icon-ink,#6b655c)" stroke-width="2"><rect x="9" y="3" width="6" height="18" rx="1" fill="rgba(120,110,98,0.35)"/><line x1="10" y1="7" x2="14" y2="10"/><line x1="10" y1="12" x2="14" y2="15"/><line x1="10" y1="17" x2="14" y2="20"/></svg>`;
      }
      if (comp.type === 'diffraction-grating') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="#5a86a8" stroke-width="1.8"><rect x="9" y="3" width="6" height="18" rx="1"/><line x1="9" y1="6.5" x2="15" y2="6.5"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="13.5" x2="15" y2="13.5"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="15" y1="12" x2="21" y2="7" stroke="#ff3b30"/><line x1="15" y1="12" x2="21" y2="12" stroke="#3fb950"/><line x1="15" y1="12" x2="21" y2="17" stroke="#388bfd"/></svg>`;
      }
      if (comp.type === 'polarizer') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="#8e7cc3" stroke-width="2"><rect x="9" y="3" width="6" height="18" rx="1.5" fill="rgba(124,98,168,0.25)"/><line x1="4" y1="12" x2="20" y2="12" stroke-dasharray="2 2"/></svg>`;
      }
      if (comp.type === 'beam-splitter') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="#5a86a8" stroke-width="2"><rect x="4" y="4" width="16" height="16"/><line x1="4" y1="4" x2="20" y2="20"/></svg>`;
      }
      if (comp.type === 'prism') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="#5a86a8" stroke-width="2"><polygon points="12,3 21,20 3,20"/></svg>`;
      }
      if (comp.type === 'glass-block') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="#5a86a8" stroke-width="2"><rect x="3" y="6" width="18" height="12"/></svg>`;
      }
      return `<svg viewBox="0 0 24 24" fill="none" stroke="#448361" stroke-width="2"><rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="9" r="2" fill="#448361"/></svg>`;
    }

    _build(comp) {
      const typeNames = {
        'laser': 'Laser Source',
        'white-led': 'White LED Source',
        'rgb-led': 'RGB LED Source',
        'point-source': 'Point Light Source',
        'convex-lens': 'Convex Lens',
        'concave-lens': 'Concave Lens',
        'glass-sphere': 'Ball Lens / Sphere',
        'plane-mirror': 'Plane Mirror',
        'concave-mirror': 'Concave Mirror',
        'convex-mirror': 'Convex Mirror',
        'beam-splitter': 'Beam Splitter',
        'prism': 'Optical Prism',
        'glass-block': 'Glass Block',
        'optical-detector': 'Optical Detector',
        'optical-filter': 'Optical Filter',
        'color-filter': 'Optical Filter',
        'aperture-slit': 'Aperture / Slit',
        'beam-blocker': 'Beam Blocker',
        'diffraction-grating': 'Diffraction Grating',
        'polarizer': 'Linear Polarizer',
      };

      const categoryTags = {
        'laser': 'MONOCHROMATIC SOURCE',
        'white-led': 'BROADBAND EMITTER',
        'rgb-led': 'TRICHROMATIC EMITTER',
        'point-source': 'RADIAL POINT EMITTER',
        'convex-lens': 'CONVERGING OPTIC',
        'concave-lens': 'DIVERGING OPTIC',
        'glass-sphere': 'SPHERICAL DIELECTRIC',
        'plane-mirror': 'SPECULAR REFLECTOR',
        'concave-mirror': 'CONVERGING MIRROR',
        'convex-mirror': 'DIVERGING MIRROR',
        'beam-splitter': 'DIELECTRIC SPLITTER',
        'prism': 'DISPERSIVE ELEMENT',
        'glass-block': 'REFRACTIVE SLAB',
        'optical-detector': 'PHOTODIODE SENSOR',
        'optical-filter': 'SPECTRAL BANDPASS',
        'color-filter': 'SPECTRAL BANDPASS',
        'aperture-slit': 'SPATIAL APERTURE',
        'beam-blocker': 'OPTICAL BEAM DUMP',
        'diffraction-grating': 'DIFFRACTIVE OPTIC',
        'polarizer': 'DICHROIC POLARIZER',
      };

      const angleVal = normAngle(comp.rotation);
      const aRad = rad(angleVal);
      const tx = (23 + 16 * Math.cos(aRad)).toFixed(1);
      const ty = (23 + 16 * Math.sin(aRad)).toFixed(1);

      let html = `
        <div class="prop-header">
          <div class="prop-title-wrap">
            <div class="prop-icon-box" id="prop-icon-box">${this._getComponentIconSvg(comp)}</div>
            <div class="prop-title-meta">
              <span class="prop-category-tag">${i18n.phrase(categoryTags[comp.type] || 'OPTICAL ELEMENT')} · #${comp.id}</span>
              <h3 id="prop-header-title">${typeNames[comp.type] || comp.type}</h3>
            </div>
          </div>
          <div class="prop-header-actions">
            <button class="icon-action-btn" id="btn-info-comp" title="What does this component do?">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
            <button class="icon-action-btn ${comp.locked ? 'active' : ''}" id="btn-lock-comp" title="${comp.locked ? 'Unlock position' : 'Lock position'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
            <button class="icon-action-btn" id="btn-center-comp" title="Move component to origin (0, 0)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
              </svg>
            </button>
            <button class="icon-action-btn" id="btn-dup-comp" title="Duplicate component (Clone)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Spatial Transform Section -->
        <div class="prop-section">
          <div class="prop-section-header">
            <h4>Spatial Transform</h4>
            <span class="prop-badge-pill">World (px, deg)</span>
          </div>

          <div class="prop-grid-2">
            <div class="prop-field">
              <label for="prop-x">Position X</label>
              <div class="input-unit-wrap">
                <input type="number" id="prop-x" value="${Math.round(comp.x)}" step="10">
                <span class="input-unit">px</span>
              </div>
            </div>
            <div class="prop-field">
              <label for="prop-y">Position Y</label>
              <div class="input-unit-wrap">
                <input type="number" id="prop-y" value="${Math.round(comp.y)}" step="10">
                <span class="input-unit">px</span>
              </div>
            </div>
          </div>

          <!-- Interactive Rotary Angle Dial -->
          <div class="angle-dial-row">
            <svg class="angle-dial-svg" id="angle-dial-svg" viewBox="0 0 46 46" title="Drag to rotate component">
              <circle cx="23" cy="23" r="20" style="fill:var(--icon-body,#ffffff);stroke:var(--border-subtle,#e3dccf)" stroke-width="1.5"/>
              <line x1="23" y1="3" x2="23" y2="7" stroke="#cdc3b4" stroke-width="1"/>
              <line x1="23" y1="39" x2="23" y2="43" stroke="#cdc3b4" stroke-width="1"/>
              <line x1="3" y1="23" x2="7" y2="23" stroke="#cdc3b4" stroke-width="1"/>
              <line x1="39" y1="23" x2="43" y2="23" stroke="#cdc3b4" stroke-width="1"/>
              <line id="dial-needle" x1="23" y1="23" x2="${tx}" y2="${ty}" stroke="#9f6b53" stroke-width="2" stroke-linecap="round"/>
              <circle cx="23" cy="23" r="2.5" fill="#8b949e"/>
              <circle id="dial-tip" cx="${tx}" cy="${ty}" r="3.2" fill="#9f6b53"/>
            </svg>
            <div class="angle-dial-controls">
              <div class="angle-dial-top">
                <label for="prop-rot">Orientation</label>
                <div class="input-unit-wrap" style="width:96px">
                  <input type="number" id="prop-rot" value="${angleVal}" min="-180" max="180" step="1">
                  <span class="input-unit">°</span>
                </div>
              </div>
              <div class="quick-angles">
                <button class="qa-btn step-rot-btn" data-step="-15">-15°</button>
                <button class="qa-btn step-rot-btn" data-step="-1">-1°</button>
                <button class="qa-btn set-rot-btn" data-angle="0">0°</button>
                <button class="qa-btn step-rot-btn" data-step="1">+1°</button>
                <button class="qa-btn step-rot-btn" data-step="15">+15°</button>
              </div>
            </div>
          </div>

          <div class="quick-angles">
            <button class="qa-btn set-rot-btn" data-angle="-90">-90°</button>
            <button class="qa-btn set-rot-btn" data-angle="-45">-45°</button>
            <button class="qa-btn set-rot-btn" data-angle="45">45°</button>
            <button class="qa-btn set-rot-btn" data-angle="90">90°</button>
            <button class="qa-btn set-rot-btn" data-angle="180">180°</button>
          </div>
        </div>
      `;

      // ── Component-Specific Sections ──
      if (comp instanceof Laser) {
        const isLed = comp.type === 'white-led';
        const isRgb = comp.type === 'rgb-led';
        const c = comp.color;
        const photonEv = (1239.84 / comp.wavelength).toFixed(2);
        const freqThz = Math.round(299792 / comp.wavelength);
        const rPct = comp.rgb ? Math.round(comp.rgb.r * 100) : 100;
        const gPct = comp.rgb ? Math.round(comp.rgb.g * 100) : 100;
        const bPct = comp.rgb ? Math.round(comp.rgb.b * 100) : 100;

        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>${isRgb ? 'RGB Trichromatic Emitter' : isLed ? 'White LED Emitter' : 'Laser Emission'}</h4>
              <span class="prop-badge-pill" id="laser-badge-pill">${
                isRgb
                  ? `<span class="color-swatch" id="rgb-pill-swatch" style="width:9px;height:9px;background:${rgbStr(c)};vertical-align:middle"></span> R${rPct} G${gPct} B${bPct}`
                  : isLed
                  ? '380–780 nm'
                  : comp.wavelength + ' nm'
              }</span>
            </div>

            ${
              isRgb
                ? `
            <div class="segmented-control">
              <button class="seg-btn ${comp.splitRgbRays ? 'active' : ''}" data-rgb-mode="split">Separate R·G·B Rays</button>
              <button class="seg-btn ${!comp.splitRgbRays ? 'active' : ''}" data-rgb-mode="mixed">Mixed RGB Beam</button>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-rgb-r" style="color:#d44c47">Red Channel (640 nm)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-rgb-r" value="${rPct}" min="0" max="100" step="1">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-rgb-r-num" value="${rPct}" min="0" max="100" step="1">
                  <span class="input-unit">%</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-rgb-g" style="color:#448361">Green Channel (532 nm)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-rgb-g" value="${gPct}" min="0" max="100" step="1">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-rgb-g-num" value="${gPct}" min="0" max="100" step="1">
                  <span class="input-unit">%</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-rgb-b" style="color:#337ea9">Blue Channel (460 nm)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-rgb-b" value="${bPct}" min="0" max="100" step="1">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-rgb-b-num" value="${bPct}" min="0" max="100" step="1">
                  <span class="input-unit">%</span>
                </div>
              </div>
            </div>

            <div class="quick-angles">
              <button class="qa-btn rgb-preset-btn" data-r="100" data-g="100" data-b="100" title="White (100/100/100)">White</button>
              <button class="qa-btn rgb-preset-btn" data-r="100" data-g="0" data-b="0" title="Red">R</button>
              <button class="qa-btn rgb-preset-btn" data-r="0" data-g="100" data-b="0" title="Green">G</button>
              <button class="qa-btn rgb-preset-btn" data-r="0" data-g="0" data-b="100" title="Blue">B</button>
              <button class="qa-btn rgb-preset-btn" data-r="0" data-g="100" data-b="100" title="Cyan">C</button>
              <button class="qa-btn rgb-preset-btn" data-r="100" data-g="0" data-b="100" title="Magenta">M</button>
              <button class="qa-btn rgb-preset-btn" data-r="100" data-g="100" data-b="0" title="Yellow">Y</button>
            </div>`
                : !isLed
                ? `
            <div class="param-block">
              <div class="param-header">
                <label for="prop-wl">Wavelength (λ)</label>
                <span class="slider-val">
                  <span class="color-swatch" id="prop-wl-swatch" style="background:${rgbStr(c)}"></span>
                  <span id="prop-wl-text">${comp.wavelength} nm</span>
                </span>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-wl" value="${comp.wavelength}" min="380" max="780" step="1">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-wl-num" value="${comp.wavelength}" min="380" max="780" step="1">
                  <span class="input-unit">nm</span>
                </div>
              </div>
            </div>

            <div class="quick-angles">
              <button class="qa-btn wl-preset-btn" data-wl="405" title="Violet Diode (405nm)"><span class="color-swatch" style="width:8px;height:8px;background:rgb(130,0,200)"></span>405</button>
              <button class="qa-btn wl-preset-btn" data-wl="473" title="Blue DPSS (473nm)"><span class="color-swatch" style="width:8px;height:8px;background:rgb(0,160,255)"></span>473</button>
              <button class="qa-btn wl-preset-btn" data-wl="532" title="Green Nd:YAG (532nm)"><span class="color-swatch" style="width:8px;height:8px;background:rgb(80,255,0)"></span>532</button>
              <button class="qa-btn wl-preset-btn" data-wl="589" title="Sodium D (589nm)"><span class="color-swatch" style="width:8px;height:8px;background:rgb(255,215,0)"></span>589</button>
              <button class="qa-btn wl-preset-btn" data-wl="633" title="HeNe Red (633nm)"><span class="color-swatch" style="width:8px;height:8px;background:rgb(255,40,0)"></span>633</button>
            </div>`
                : `
            <div class="quick-angles">
              <button class="qa-btn cone-preset-btn" data-cone="0">0° Collimated</button>
              <button class="qa-btn cone-preset-btn" data-cone="12">12° Narrow</button>
              <button class="qa-btn cone-preset-btn" data-cone="35">35° Flood</button>
            </div>`
            }

            <div class="param-block">
              <div class="param-header">
                <label for="prop-int">Beam Intensity</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-int" value="${Math.round(comp.intensity * 100)}" min="10" max="100" step="5">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-int-num" value="${Math.round(comp.intensity * 100)}" min="10" max="100" step="5">
                  <span class="input-unit">%</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-rays">Ray Count</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-rays-range" value="${comp.numRays}" min="1" max="31" step="2">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-rays" value="${comp.numRays}" min="1" max="31" step="2">
                  <span class="input-unit">#</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-bw">Beam Aperture Width</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-bw-range" value="${comp.beamWidth}" min="0" max="240" step="4">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-bw" value="${comp.beamWidth}" min="0" max="300" step="4">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-spread">Divergence Cone Angle</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-spread" value="${comp.spreadAngle || 0}" min="0" max="60" step="1">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-spread-num" value="${comp.spreadAngle || 0}" min="0" max="60" step="1">
                  <span class="input-unit">°</span>
                </div>
              </div>
            </div>

            ${
              !isLed
                ? `
            <div class="optical-readout">
              <div class="readout-row"><span>Photon Energy</span><span id="readout-photon-ev">${photonEv} eV</span></div>
              <div class="readout-row"><span>Frequency</span><span id="readout-freq-thz">${freqThz} THz</span></div>
            </div>`
                : `
            <div class="optical-readout">
              <div class="readout-row"><span>Emission Spectrum</span><span>Polychromatic White</span></div>
              <div class="readout-row"><span>Prism Dispersion</span><span>7-Band Rainbow</span></div>
            </div>`
            }
          </div>
        `;
      } else if (comp instanceof Lens) {
        const isConvex = comp.type === 'convex-lens';
        const fNum = (comp.focalLength / comp.aperture).toFixed(2);
        const ax = Math.cos(rad(comp.rotation));
        const ay = Math.sin(rad(comp.rotation));
        const fx = Math.round(comp.x + ax * comp.focalLength);
        const fy = Math.round(comp.y + ay * comp.focalLength);

        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Optical Prescription</h4>
              <span class="prop-badge-pill">${comp.opticalPower > 0 ? '+' : ''}${comp.opticalPower} D</span>
            </div>

            <div class="segmented-control">
              <button class="seg-btn ${isConvex ? 'active' : ''}" data-lens-type="convex-lens">Convex (+f)</button>
              <button class="seg-btn ${!isConvex ? 'active' : ''}" data-lens-type="concave-lens">Concave (−f)</button>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-fl-range">Focal Length |f|</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-fl-range" value="${comp.focalLength}" min="30" max="600" step="5">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-fl" value="${comp.focalLength}" min="20" max="1000" step="5">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-ap-range">Lens Aperture Ø</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-ap-range" value="${comp.aperture}" min="30" max="320" step="5">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-ap" value="${comp.aperture}" min="30" max="400" step="5">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="optical-readout">
              <div class="readout-row">
                <span>Signed Focal Length</span>
                <span id="readout-fsigned">${comp.fSigned > 0 ? '+' : ''}${comp.fSigned} px</span>
              </div>
              <div class="readout-row">
                <span>Optical Power</span>
                <span id="readout-power">${comp.opticalPower > 0 ? '+' : ''}${comp.opticalPower} D</span>
              </div>
              <div class="readout-row">
                <span>Relative Aperture</span>
                <span id="readout-fnum">f/${fNum}</span>
              </div>
              <div class="readout-row">
                <span>Focus F' Position</span>
                <span id="readout-foci-pos">(${fx}, ${fy})</span>
              </div>
            </div>
          </div>
        `;
      } else if (comp instanceof PlaneMirror) {
        const nx = Math.cos(rad(comp.rotation)).toFixed(2);
        const ny = Math.sin(rad(comp.rotation)).toFixed(2);
        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Specular Mirror</h4>
              <span class="prop-badge-pill">R = 100%</span>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-mir-ap">Reflective Aperture</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-mir-ap" value="${comp.aperture}" min="30" max="320" step="5">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-mir-ap-num" value="${comp.aperture}" min="30" max="320" step="5">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="optical-readout">
              <div class="readout-row"><span>Reflection Law</span><span>θi = θr</span></div>
              <div class="readout-row"><span>Surface Normal n̂</span><span id="readout-mir-norm">(${nx}, ${ny})</span></div>
            </div>
          </div>
        `;
      } else if (comp instanceof CurvedMirror) {
        const isConcave = comp.type === 'concave-mirror';
        const f = comp.focalLength;
        const sign = isConcave ? -1 : 1;
        const ax = Math.cos(rad(comp.rotation));
        const ay = Math.sin(rad(comp.rotation));
        const fx = Math.round(comp.x + sign * ax * f);
        const fy = Math.round(comp.y + sign * ay * f);

        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Curved Mirror Geometry</h4>
              <span class="prop-badge-pill" id="cm-fl-pill">f = ${isConcave ? '+' : '−'}${Math.round(f)} px</span>
            </div>

            <div class="segmented-control">
              <button class="seg-btn ${isConcave ? 'active' : ''}" data-cm-type="concave-mirror">Concave (+f)</button>
              <button class="seg-btn ${!isConcave ? 'active' : ''}" data-cm-type="convex-mirror">Convex (−f)</button>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-cm-r-range">Radius of Curvature (R)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-cm-r-range" value="${comp.radiusOfCurvature}" min="80" max="800" step="10">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-cm-r" value="${comp.radiusOfCurvature}" min="60" max="1200" step="10">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-cm-ap-range">Mirror Aperture Ø</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-cm-ap-range" value="${comp.aperture}" min="40" max="320" step="5">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-cm-ap" value="${comp.aperture}" min="40" max="360" step="5">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <label class="prop-checkbox-row">
              <input type="checkbox" id="prop-cm-foci" ${comp.showFocalPoint ? 'checked' : ''}>
              <span>Display ${isConcave ? 'Focal Point (F)' : "Virtual Focal Point (F')"}</span>
            </label>

            <div class="optical-readout">
              <div class="readout-row">
                <span>Focal Length (R/2)</span>
                <span id="readout-cm-fl">${isConcave ? '+' : '−'}${f.toFixed(0)} px</span>
              </div>
              <div class="readout-row">
                <span>Optical Power</span>
                <span id="readout-cm-power">${comp.opticalPower > 0 ? '+' : ''}${comp.opticalPower} D</span>
              </div>
              <div class="readout-row">
                <span>${isConcave ? 'Real Focus F' : "Virtual Focus F'"}</span>
                <span id="readout-cm-foci">(${fx}, ${fy})</span>
              </div>
            </div>
          </div>
        `;
      } else if (comp instanceof ColorFilter) {
        const transPct = Math.round(comp.transmission * 100);
        const colorLabel =
          comp.filterColor && comp.filterColor !== 'custom'
            ? comp.filterColor.toUpperCase()
            : `${comp.passWavelength} nm`;

        const filterButtons = [
          { key: 'red', label: 'Red', swatch: 'rgb(255,38,28)' },
          { key: 'green', label: 'Green', swatch: 'rgb(40,235,60)' },
          { key: 'blue', label: 'Blue', swatch: 'rgb(35,125,255)' },
          { key: 'cyan', label: 'Cyan', swatch: 'rgb(0,230,245)' },
          { key: 'magenta', label: 'Magenta', swatch: 'rgb(240,45,220)' },
          { key: 'yellow', label: 'Yellow', swatch: 'rgb(255,225,25)' },
        ];

        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Optical Color Filter</h4>
              <span class="prop-badge-pill" id="cf-badge-pill">${colorLabel} · ${transPct}%</span>
            </div>

            <div class="material-grid">
              ${filterButtons
                .map(
                  (fb) => `
                <div class="mat-card cf-preset-card ${comp.filterColor === fb.key ? 'active' : ''}" data-cf-color="${fb.key}">
                  <span class="mat-name" style="display:flex;align-items:center;gap:5px">
                    <span class="color-swatch" style="width:9px;height:9px;background:${fb.swatch}"></span>
                    ${fb.label}
                  </span>
                  <span class="mat-index">${FILTER_PRESETS[fb.key].wl} nm</span>
                </div>`
                )
                .join('')}
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-cf-trans">Transmission Ratio (T)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-cf-trans" value="${transPct}" min="0" max="100" step="1">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-cf-trans-num" value="${transPct}" min="0" max="100" step="1">
                  <span class="input-unit">%</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-cf-wl">Center Pass Wavelength</label>
                <span class="slider-val">
                  <span class="color-swatch" id="cf-wl-swatch" style="background:${rgbStr(comp.color)}"></span>
                  <span id="cf-wl-text">${comp.passWavelength} nm</span>
                </span>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-cf-wl" value="${comp.passWavelength}" min="380" max="780" step="1">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-cf-wl-num" value="${comp.passWavelength}" min="380" max="780" step="1">
                  <span class="input-unit">nm</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-cf-ap">Filter Aperture</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-cf-ap" value="${comp.aperture}" min="30" max="280" step="4">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-cf-ap-num" value="${comp.aperture}" min="30" max="320" step="4">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="optical-readout">
              <div class="readout-row"><span>Filter Mode</span><span id="cf-mode-readout">${comp.filterColor !== 'custom' ? comp.filterColor.toUpperCase() + ' Bandpass' : 'Custom Narrowband'}</span></div>
              <div class="readout-row"><span>Peak Transmittance</span><span id="cf-trans-readout">${transPct}%</span></div>
            </div>
          </div>
        `;
      } else if (comp instanceof BeamSplitter) {
        const rPct = Math.round(comp.reflectance * 100);
        const tPct = 100 - rPct;
        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Dielectric Coating</h4>
              <span class="prop-badge-pill" id="prop-bs-pill">${rPct}/${tPct}</span>
            </div>

            <div class="split-meter-bar">
              <div class="split-fill-r" id="split-bar-r" style="width:${rPct}%"></div>
              <div class="split-fill-t" id="split-bar-t" style="width:${tPct}%"></div>
            </div>
            <div class="split-legend">
              <span id="split-leg-r" style="color:#9f6b53">Reflected: ${rPct}%</span>
              <span id="split-leg-t" style="color:#5a86a8">Transmitted: ${tPct}%</span>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-bs-refl">Reflectance Ratio (R)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-bs-refl" value="${rPct}" min="0" max="100" step="1">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-bs-refl-num" value="${rPct}" min="0" max="100" step="1">
                  <span class="input-unit">%</span>
                </div>
              </div>
            </div>

            <div class="quick-angles">
              <button class="qa-btn bs-preset-btn" data-r="50">50/50</button>
              <button class="qa-btn bs-preset-btn" data-r="70">70/30</button>
              <button class="qa-btn bs-preset-btn" data-r="30">30/70</button>
              <button class="qa-btn bs-preset-btn" data-r="10">10/90</button>
              <button class="qa-btn bs-preset-btn" data-r="100">100% R</button>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-bs-size">Splitter Cube Size</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-bs-size-range" value="${comp.size}" min="30" max="240" step="4">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-bs-size" value="${comp.size}" min="30" max="240" step="4">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (comp instanceof Prism) {
        const critAngle = deg(Math.asin(1 / comp.refractiveIndex)).toFixed(1);
        const brewsterAngle = deg(Math.atan(comp.refractiveIndex)).toFixed(1);

        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Prism Material &amp; Geometry</h4>
              <span class="prop-badge-pill" id="pr-n-pill">n = ${comp.refractiveIndex.toFixed(2)}</span>
            </div>

            <div class="material-grid">
              ${MATERIALS.map(
                (m) => `
                <div class="mat-card ${Math.abs(comp.refractiveIndex - m.n) < 0.015 ? 'active' : ''}" data-n="${m.n}" data-disp="${m.disp}">
                  <span class="mat-name">${m.name}</span>
                  <span class="mat-index">n=${m.n}</span>
                </div>`
              ).join('')}
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-pr-n">Refractive Index (n)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-pr-n" value="${comp.refractiveIndex}" min="1.10" max="2.50" step="0.01">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-pr-n-num" value="${comp.refractiveIndex}" min="1.10" max="2.50" step="0.01">
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-pr-disp">Chromatic Dispersion (Δn)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-pr-disp" value="${comp.dispersion}" min="0" max="0.16" step="0.01">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-pr-disp-num" value="${comp.dispersion}" min="0" max="0.16" step="0.01">
                </div>
              </div>
            </div>

            <label class="prop-checkbox-row">
              <input type="checkbox" id="prop-pr-split" ${comp.splitSpectrum ? 'checked' : ''}>
              <span>Disperse Incoming Beam into Spectrum</span>
            </label>

            <div class="prop-grid-2">
              <div class="prop-field">
                <label for="prop-pr-side">Side Length</label>
                <div class="input-unit-wrap">
                  <input type="number" id="prop-pr-side" value="${comp.sideLength}" min="40" max="280" step="5">
                  <span class="input-unit">px</span>
                </div>
              </div>
              <div class="prop-field">
                <label for="prop-pr-apex">Apex Angle</label>
                <div class="input-unit-wrap">
                  <input type="number" id="prop-pr-apex" value="${comp.apexAngle}" min="30" max="90" step="5">
                  <span class="input-unit">°</span>
                </div>
              </div>
            </div>

            <div class="optical-readout">
              <div class="readout-row"><span>TIR Critical Angle θc</span><span id="pr-crit">${critAngle}°</span></div>
              <div class="readout-row"><span>Brewster's Angle θB</span><span id="pr-brewster">${brewsterAngle}°</span></div>
            </div>
          </div>
        `;
      } else if (comp instanceof GlassBlock) {
        const critAngle = deg(Math.asin(1 / comp.refractiveIndex)).toFixed(1);
        const brewsterAngle = deg(Math.atan(comp.refractiveIndex)).toFixed(1);

        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Dielectric Slab Optics</h4>
              <span class="prop-badge-pill" id="gb-n-pill">n = ${comp.refractiveIndex.toFixed(2)}</span>
            </div>

            <div class="material-grid">
              ${MATERIALS.map(
                (m) => `
                <div class="mat-card ${Math.abs(comp.refractiveIndex - m.n) < 0.015 ? 'active' : ''}" data-n="${m.n}" data-disp="${m.disp}">
                  <span class="mat-name">${m.name}</span>
                  <span class="mat-index">n=${m.n}</span>
                </div>`
              ).join('')}
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-gb-n">Refractive Index (n)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-gb-n" value="${comp.refractiveIndex}" min="1.10" max="2.50" step="0.01">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-gb-n-num" value="${comp.refractiveIndex}" min="1.10" max="2.50" step="0.01">
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-gb-w-range">Block Width (L)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-gb-w-range" value="${comp.width}" min="30" max="360" step="5">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-gb-w" value="${comp.width}" min="30" max="400" step="5">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-gb-h-range">Block Height (H)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-gb-h-range" value="${comp.height}" min="30" max="360" step="5">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-gb-h" value="${comp.height}" min="30" max="400" step="5">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="optical-readout">
              <div class="readout-row"><span>TIR Critical Angle θc</span><span id="gb-crit">${critAngle}°</span></div>
              <div class="readout-row"><span>Brewster's Angle θB</span><span id="gb-brewster">${brewsterAngle}°</span></div>
            </div>
          </div>
        `;
      } else if (comp instanceof OpticalDetector) {
        const wlBadge =
          comp.detected && comp.avgWavelength
            ? `<span class="color-swatch" style="background:${rgbStr(wavelengthToRGB(comp.avgWavelength))}"></span> ${comp.avgWavelength} nm`
            : '—';
        const evVal =
          comp.detected && comp.avgWavelength
            ? `${(1239.84 / comp.avgWavelength).toFixed(2)} eV`
            : '—';
        const barPct = clamp(comp.totalIntensity * 25, 0, 100);

        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Photodiode Telemetry</h4>
              <span class="prop-badge-pill">LIVE</span>
            </div>

            <div class="detector-status-box">
              <div class="det-status-header">
                <div class="det-status-left">
                  <span class="det-led ${comp.detected ? 'active' : ''}" id="det-status-dot"></span>
                  <span id="det-status-text" style="color:${comp.detected ? '#448361' : '#8b949e'};font-weight:600">
                    ${comp.detected ? 'LIGHT DETECTED' : 'NO SIGNAL'}
                  </span>
                </div>
              </div>
              <div class="det-meter-track">
                <div class="det-meter-fill" id="det-bar-fill" style="width:${barPct}%"></div>
              </div>
            </div>

            <div class="optical-readout">
              <div class="readout-row">
                <span>Incident Rays</span>
                <span id="det-hits">${i18n.t(comp.hitCount === 1 ? 'raysCount' : 'raysCountPlural', { n: comp.hitCount })}</span>
              </div>
              <div class="readout-row">
                <span>Integrated Flux</span>
                <span id="det-total-int">${Math.round(comp.totalIntensity * 100)}% (${comp.totalIntensity.toFixed(2)})</span>
              </div>
              <div class="readout-row">
                <span>Peak Ray Intensity</span>
                <span id="det-peak-int">${Math.round(comp.peakIntensity * 100)}%</span>
              </div>
              <div class="readout-row">
                <span>Mean Wavelength</span>
                <span id="det-wl" style="display:flex;align-items:center;gap:5px">${wlBadge}</span>
              </div>
              <div class="readout-row">
                <span>Mean Photon Energy</span>
                <span id="det-ev">${evVal}</span>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-det-ap-range">Active Sensor Aperture</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-det-ap-range" value="${comp.aperture}" min="20" max="260" step="4">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-det-ap" value="${comp.aperture}" min="20" max="260" step="4">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (comp instanceof PointSource) {
        const c = comp.color;
        const intPct = Math.round(comp.intensity * 100);
        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Point Emitter Output</h4>
              <span class="prop-badge-pill" id="ps-badge-pill">${comp.whiteLight ? 'Broadband' : comp.wavelength + ' nm'}</span>
            </div>

            <div class="segmented-control">
              <button class="seg-btn ${comp.whiteLight ? 'active' : ''}" data-ps-mode="white">White Light</button>
              <button class="seg-btn ${!comp.whiteLight ? 'active' : ''}" data-ps-mode="mono">Monochromatic</button>
            </div>

            ${
              !comp.whiteLight
                ? `
            <div class="param-block">
              <div class="param-header">
                <label for="prop-ps-wl">Wavelength (λ)</label>
                <span class="color-swatch" id="ps-wl-swatch" style="background:${rgbStr(c)}"></span>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-ps-wl" class="spectrum-slider" value="${comp.wavelength}" min="380" max="780" step="1">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-ps-wl-num" value="${comp.wavelength}" min="380" max="780" step="1">
                  <span class="input-unit">nm</span>
                </div>
              </div>
            </div>
                `
                : ''
            }

            <div class="param-block">
              <div class="param-header">
                <label for="prop-ps-spread-range">Emission Cone Angle</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-ps-spread-range" value="${comp.spreadAngle}" min="15" max="360" step="5">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-ps-spread" value="${comp.spreadAngle}" min="15" max="360" step="5">
                  <span class="input-unit">°</span>
                </div>
              </div>
            </div>

            <div class="quick-angles">
              <button class="qa-btn ps-spread-btn" data-spread="60">60°</button>
              <button class="qa-btn ps-spread-btn" data-spread="120">120°</button>
              <button class="qa-btn ps-spread-btn" data-spread="180">180°</button>
              <button class="qa-btn ps-spread-btn" data-spread="360">360°</button>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-ps-rays-range">Ray Density</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-ps-rays-range" value="${comp.numRays}" min="4" max="72" step="2">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-ps-rays" value="${comp.numRays}" min="4" max="72" step="1">
                  <span class="input-unit">rays</span>
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-ps-int">Radiant Intensity</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-ps-int" value="${intPct}" min="5" max="100" step="5">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-ps-int-num" value="${intPct}" min="5" max="100" step="5">
                  <span class="input-unit">%</span>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (comp instanceof GlassSphere) {
        const critAngle = deg(Math.asin(1 / comp.refractiveIndex)).toFixed(1);
        const efl = comp.effectiveFocalLength.toFixed(1);
        const bfl = comp.backFocalLength.toFixed(1);

        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Ball Lens / Dielectric Sphere</h4>
              <span class="prop-badge-pill" id="gs-n-pill">n = ${comp.refractiveIndex.toFixed(2)}</span>
            </div>

            <div class="material-grid">
              ${MATERIALS.map(
                (m) => `
                <div class="mat-card ${Math.abs(comp.refractiveIndex - m.n) < 0.015 ? 'active' : ''}" data-n="${m.n}" data-disp="${m.disp}">
                  <span class="mat-name">${m.name}</span>
                  <span class="mat-index">n=${m.n}</span>
                </div>`
              ).join('')}
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-gs-n">Refractive Index (n)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-gs-n" value="${comp.refractiveIndex}" min="1.10" max="2.50" step="0.01">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-gs-n-num" value="${comp.refractiveIndex}" min="1.10" max="2.50" step="0.01">
                </div>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-gs-disp">Chromatic Dispersion (Δn)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-gs-disp" value="${comp.dispersion}" min="0" max="0.16" step="0.01">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-gs-disp-num" value="${comp.dispersion}" min="0" max="0.16" step="0.01">
                </div>
              </div>
            </div>

            <label class="prop-checkbox-row">
              <input type="checkbox" id="prop-gs-split" ${comp.splitSpectrum ? 'checked' : ''}>
              <span>Disperse Incoming Beam into Spectrum</span>
            </label>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-gs-r-range">Sphere Radius (R)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-gs-r-range" value="${comp.radius}" min="20" max="180" step="2">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-gs-r" value="${comp.radius}" min="20" max="180" step="2">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="optical-readout">
              <div class="readout-row"><span>Effective Focal Length (EFL)</span><span id="gs-efl">${efl} px</span></div>
              <div class="readout-row"><span>Back Focal Length (BFL)</span><span id="gs-bfl">${bfl} px</span></div>
              <div class="readout-row"><span>TIR Critical Angle θc</span><span id="gs-crit">${critAngle}°</span></div>
            </div>
          </div>
        `;
      } else if (comp instanceof ApertureSlit) {
        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Aperture &amp; Slit Geometry</h4>
              <span class="prop-badge-pill" id="slit-count-pill">${i18n.t(comp.slitCount === 1 ? 'slitsCount' : 'slitsCountPlural', { n: comp.slitCount })}</span>
            </div>

            <div class="segmented-control">
              <button class="seg-btn ${comp.slitCount === 1 ? 'active' : ''}" data-slit-count="1">Single Slit</button>
              <button class="seg-btn ${comp.slitCount === 2 ? 'active' : ''}" data-slit-count="2">Double Slit</button>
              <button class="seg-btn ${comp.slitCount === 3 ? 'active' : ''}" data-slit-count="3">Triple Slit</button>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-slit-w-range">Slit Opening Width</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-slit-w-range" value="${comp.slitWidth}" min="4" max="100" step="2">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-slit-w" value="${comp.slitWidth}" min="4" max="100" step="2">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            ${
              comp.slitCount > 1
                ? `
            <div class="param-block">
              <div class="param-header">
                <label for="prop-slit-sp-range">Slit Center Spacing (d)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-slit-sp-range" value="${comp.slitSpacing}" min="12" max="160" step="2">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-slit-sp" value="${comp.slitSpacing}" min="12" max="160" step="2">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>
                `
                : ''
            }

            <div class="param-block">
              <div class="param-header">
                <label for="prop-slit-ap-range">Total Barrier Height</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-slit-ap-range" value="${comp.aperture}" min="60" max="400" step="10">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-slit-ap" value="${comp.aperture}" min="60" max="400" step="10">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (comp instanceof BeamBlocker) {
        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Optical Beam Dump</h4>
              <span class="prop-badge-pill">100% Absorb</span>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-bb-ap-range">Baffle Height</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-bb-ap-range" value="${comp.aperture}" min="24" max="360" step="4">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-bb-ap" value="${comp.aperture}" min="24" max="360" step="4">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (comp instanceof DiffractionGrating) {
        const dNm = Math.round(comp.grooveSpacingNm);
        const sin1 = 532 / comp.grooveSpacingNm;
        const theta1 = sin1 < 1 ? `${deg(Math.asin(sin1)).toFixed(1)}°` : 'Evanescent';

        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Diffraction Grating</h4>
              <span class="prop-badge-pill" id="dg-lpmm-pill">${comp.linesPerMm} l/mm</span>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-dg-lpmm-range">Groove Density</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-dg-lpmm-range" value="${comp.linesPerMm}" min="100" max="1200" step="25">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-dg-lpmm" value="${comp.linesPerMm}" min="100" max="1200" step="25">
                  <span class="input-unit">l/mm</span>
                </div>
              </div>
            </div>

            <div class="quick-angles">
              <button class="qa-btn dg-lpmm-btn" data-lpmm="300">300</button>
              <button class="qa-btn dg-lpmm-btn" data-lpmm="500">500</button>
              <button class="qa-btn dg-lpmm-btn" data-lpmm="800">800</button>
              <button class="qa-btn dg-lpmm-btn" data-lpmm="1000">1000</button>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label>Max Diffraction Order (±m)</label>
              </div>
              <div class="segmented-control">
                <button class="seg-btn ${comp.maxOrder === 1 ? 'active' : ''}" data-dg-order="1">±1</button>
                <button class="seg-btn ${comp.maxOrder === 2 ? 'active' : ''}" data-dg-order="2">±2</button>
                <button class="seg-btn ${comp.maxOrder === 3 ? 'active' : ''}" data-dg-order="3">±3</button>
              </div>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-dg-ap-range">Grating Aperture</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-dg-ap-range" value="${comp.aperture}" min="40" max="320" step="5">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-dg-ap" value="${comp.aperture}" min="40" max="320" step="5">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="optical-readout">
              <div class="readout-row"><span>Grating Pitch (d)</span><span id="dg-pitch">${dNm} nm</span></div>
              <div class="readout-row"><span>1st Order (532 nm, θi=0°)</span><span id="dg-theta1">${theta1}</span></div>
            </div>
          </div>
        `;
      } else if (comp instanceof Polarizer) {
        const axisLabel =
          Math.abs(comp.polAngle - 0) < 1 || Math.abs(comp.polAngle - 180) < 1
            ? 'Horizontal (H)'
            : Math.abs(comp.polAngle - 90) < 1
            ? 'Vertical (V)'
            : Math.abs(comp.polAngle - 45) < 1
            ? 'Diagonal (+45°)'
            : Math.abs(comp.polAngle - 135) < 1
            ? 'Anti-Diag (135°)'
            : `${comp.polAngle.toFixed(0)}°`;

        html += `
          <div class="prop-section">
            <div class="prop-section-header">
              <h4>Linear Polarizer (Malus's Law)</h4>
              <span class="prop-badge-pill" id="pol-angle-pill">${Math.round(comp.polAngle)}°</span>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-pol-angle-range">Transmission Axis (θ)</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-pol-angle-range" value="${comp.polAngle}" min="0" max="180" step="1">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-pol-angle" value="${comp.polAngle}" min="0" max="180" step="1">
                  <span class="input-unit">°</span>
                </div>
              </div>
            </div>

            <div class="quick-angles">
              <button class="qa-btn pol-preset-btn" data-pol="0">0° H</button>
              <button class="qa-btn pol-preset-btn" data-pol="45">45° D</button>
              <button class="qa-btn pol-preset-btn" data-pol="90">90° V</button>
              <button class="qa-btn pol-preset-btn" data-pol="135">135°</button>
            </div>

            <div class="param-block">
              <div class="param-header">
                <label for="prop-pol-ap-range">Filter Aperture</label>
              </div>
              <div class="param-track-row">
                <input type="range" id="prop-pol-ap-range" value="${comp.aperture}" min="30" max="320" step="4">
                <div class="input-unit-wrap">
                  <input type="number" id="prop-pol-ap" value="${comp.aperture}" min="30" max="320" step="4">
                  <span class="input-unit">px</span>
                </div>
              </div>
            </div>

            <div class="optical-readout">
              <div class="readout-row"><span>Axis Orientation</span><span id="pol-axis-label">${axisLabel}</span></div>
              <div class="readout-row"><span>Unpolarized Transmission</span><span>50%</span></div>
              <div class="readout-row"><span>Polarized Law</span><span>I = I₀ cos²(Δθ)</span></div>
            </div>
          </div>
        `;
      }

      html += `
        <div class="prop-section" style="border-bottom:none">
          <div class="prop-actions-grid">
            <button class="btn-secondary" id="btn-dup-bottom">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Duplicate
            </button>
            <button class="btn-delete" id="btn-del-comp">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Delete
            </button>
          </div>
        </div>
      `;

      this.contentEl.innerHTML = html;
      i18n.translateSubtree(this.contentEl);
      this._bindEvents(comp);
    }

    _bindEvents(comp) {
      const app = this.app;

      const bindInput = (id, callback) => {
        const el = document.getElementById(id);
        if (!el) return;
        const evtName = el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(evtName, (e) => {
          callback(el.type === 'checkbox' ? e.target.checked : e.target.value, e);
          app.markUnsaved();
          app.requestUpdate();
        });
        el.addEventListener('change', () => {
          app.recordHistory();
        });
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
      };

      const setRotation = (newAngle) => {
        comp.rotation = normAngle(newAngle);
        const rotInput = document.getElementById('prop-rot');
        if (rotInput && document.activeElement !== rotInput) rotInput.value = comp.rotation;
        this._updateDialNeedle(comp.rotation);
        this.refreshValues(comp);
        app.requestUpdate();
      };

      bindInput('prop-x', (val) => {
        comp.x = parseFloat(val) || 0;
        this.refreshValues(comp);
      });
      bindInput('prop-y', (val) => {
        comp.y = parseFloat(val) || 0;
        this.refreshValues(comp);
      });
      bindInput('prop-rot', (val) => {
        setRotation(parseFloat(val) || 0);
      });

      // Interactive SVG Rotary Dial dragging
      const dialSvg = document.getElementById('angle-dial-svg');
      if (dialSvg) {
        const updateFromDialEvent = (e) => {
          const rect = dialSvg.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          let angle = deg(Math.atan2(e.clientY - cy, e.clientX - cx));
          if (e.shiftKey) angle = Math.round(angle / 15) * 15;
          else angle = Math.round(angle);
          setRotation(angle);
        };

        dialSvg.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          dialSvg.setPointerCapture(e.pointerId);
          this._dialDragging = true;
          updateFromDialEvent(e);
        });
        dialSvg.addEventListener('pointermove', (e) => {
          if (!this._dialDragging) return;
          updateFromDialEvent(e);
        });
        dialSvg.addEventListener('pointerup', () => {
          this._dialDragging = false;
        });
      }

      // Quick set angle & step angle buttons
      this.contentEl.querySelectorAll('.set-rot-btn').forEach((btn) => {
        btn.addEventListener('click', () => setRotation(parseFloat(btn.dataset.angle)));
      });
      this.contentEl.querySelectorAll('.step-rot-btn').forEach((btn) => {
        btn.addEventListener('click', () => setRotation(comp.rotation + parseFloat(btn.dataset.step)));
      });

      // Header & bottom action buttons (Lock, Center, Duplicate, Delete)
      const lockBtn = document.getElementById('btn-lock-comp');
      if (lockBtn) {
        lockBtn.addEventListener('click', () => {
          comp.locked = !comp.locked;
          lockBtn.classList.toggle('active', comp.locked);
          lockBtn.title = comp.locked ? 'Unlock position' : 'Lock position';
        });
      }

      const centerBtn = document.getElementById('btn-center-comp');
      if (centerBtn) {
        centerBtn.addEventListener('click', () => {
          if (comp.locked) return;
          comp.x = 0;
          comp.y = 0;
          this.refreshValues(comp);
          app.requestUpdate();
        });
      }

      const dupHandler = () => {
        const clone = cloneComponent(comp);
        app.components.push(clone);
        app.selectComponent(clone);
      };
      const dupBtnTop = document.getElementById('btn-dup-comp');
      const dupBtnBot = document.getElementById('btn-dup-bottom');
      if (dupBtnTop) dupBtnTop.addEventListener('click', dupHandler);
      if (dupBtnBot) dupBtnBot.addEventListener('click', dupHandler);

      // ── Laser / White LED / RGB LED Bindings ──
      if (comp instanceof Laser) {
        if (comp.type === 'rgb-led') {
          this.contentEl.querySelectorAll('.seg-btn[data-rgb-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
              comp.splitRgbRays = btn.dataset.rgbMode === 'split';
              this.contentEl.querySelectorAll('.seg-btn[data-rgb-mode]').forEach((b) =>
                b.classList.toggle('active', b === btn)
              );
              app.requestUpdate();
            });
          });

          const updateRgbUI = () => {
            const rPct = Math.round(comp.rgb.r * 100);
            const gPct = Math.round(comp.rgb.g * 100);
            const bPct = Math.round(comp.rgb.b * 100);
            const pill = document.getElementById('laser-badge-pill');
            if (pill) {
              pill.innerHTML = `<span class="color-swatch" style="width:9px;height:9px;background:${rgbStr(comp.color)};vertical-align:middle"></span> R${rPct} G${gPct} B${bPct}`;
            }
            const syncPair = (rId, nId, val) => {
              const rEl = document.getElementById(rId);
              const nEl = document.getElementById(nId);
              if (rEl && document.activeElement !== rEl) rEl.value = val;
              if (nEl && document.activeElement !== nEl) nEl.value = val;
            };
            syncPair('prop-rgb-r', 'prop-rgb-r-num', rPct);
            syncPair('prop-rgb-g', 'prop-rgb-g-num', gPct);
            syncPair('prop-rgb-b', 'prop-rgb-b-num', bPct);
          };

          const setChannel = (ch, val) => {
            const pct = clamp(parseInt(val, 10) || 0, 0, 100);
            comp.rgb[ch] = pct / 100;
            updateRgbUI();
          };

          bindInput('prop-rgb-r', (v) => setChannel('r', v));
          bindInput('prop-rgb-r-num', (v) => setChannel('r', v));
          bindInput('prop-rgb-g', (v) => setChannel('g', v));
          bindInput('prop-rgb-g-num', (v) => setChannel('g', v));
          bindInput('prop-rgb-b', (v) => setChannel('b', v));
          bindInput('prop-rgb-b-num', (v) => setChannel('b', v));

          this.contentEl.querySelectorAll('.rgb-preset-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
              comp.setRgb(
                (parseInt(btn.dataset.r, 10) || 0) / 100,
                (parseInt(btn.dataset.g, 10) || 0) / 100,
                (parseInt(btn.dataset.b, 10) || 0) / 100
              );
              updateRgbUI();
              app.requestUpdate();
            });
          });
        }

        const syncWavelength = (wlVal) => {
          comp.setWavelength(parseInt(wlVal, 10) || 633);
          const wlRange = document.getElementById('prop-wl');
          const wlNum = document.getElementById('prop-wl-num');
          const swatch = document.getElementById('prop-wl-swatch');
          const text = document.getElementById('prop-wl-text');
          const iconBox = document.getElementById('prop-icon-box');
          const evEl = document.getElementById('readout-photon-ev');
          const freqEl = document.getElementById('readout-freq-thz');

          if (wlRange && document.activeElement !== wlRange) wlRange.value = comp.wavelength;
          if (wlNum && document.activeElement !== wlNum) wlNum.value = comp.wavelength;
          if (swatch) swatch.style.background = rgbStr(comp.color);
          if (text) text.textContent = `${comp.wavelength} nm`;
          if (iconBox) iconBox.innerHTML = this._getComponentIconSvg(comp);
          if (evEl) evEl.textContent = `${(1239.84 / comp.wavelength).toFixed(2)} eV`;
          if (freqEl) freqEl.textContent = `${Math.round(299792 / comp.wavelength)} THz`;
          app.requestUpdate();
        };

        bindInput('prop-wl', syncWavelength);
        bindInput('prop-wl-num', syncWavelength);

        this.contentEl.querySelectorAll('.wl-preset-btn').forEach((btn) => {
          btn.addEventListener('click', () => syncWavelength(btn.dataset.wl));
        });

        const syncIntensity = (pctVal) => {
          const pct = clamp(parseInt(pctVal, 10) || 100, 10, 100);
          comp.intensity = pct / 100;
          const rEl = document.getElementById('prop-int');
          const nEl = document.getElementById('prop-int-num');
          if (rEl && document.activeElement !== rEl) rEl.value = pct;
          if (nEl && document.activeElement !== nEl) nEl.value = pct;
        };
        bindInput('prop-int', syncIntensity);
        bindInput('prop-int-num', syncIntensity);

        const syncRays = (val) => {
          comp.numRays = clamp(parseInt(val, 10) || 1, 1, 31);
          const rEl = document.getElementById('prop-rays-range');
          const nEl = document.getElementById('prop-rays');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.numRays;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.numRays;
        };
        bindInput('prop-rays-range', syncRays);
        bindInput('prop-rays', syncRays);

        const syncBw = (val) => {
          comp.beamWidth = clamp(parseFloat(val) || 0, 0, 300);
          const rEl = document.getElementById('prop-bw-range');
          const nEl = document.getElementById('prop-bw');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.beamWidth;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.beamWidth;
        };
        bindInput('prop-bw-range', syncBw);
        bindInput('prop-bw', syncBw);

        const syncSpread = (val) => {
          comp.spreadAngle = clamp(parseFloat(val) || 0, 0, 60);
          const rEl = document.getElementById('prop-spread');
          const nEl = document.getElementById('prop-spread-num');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.spreadAngle;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.spreadAngle;
        };
        bindInput('prop-spread', syncSpread);
        bindInput('prop-spread-num', syncSpread);

        this.contentEl.querySelectorAll('.cone-preset-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncSpread(btn.dataset.cone);
            app.requestUpdate();
          });
        });
      }

      // ── Lens Bindings ──
      if (comp instanceof Lens) {
        this.contentEl.querySelectorAll('.seg-btn[data-lens-type]').forEach((btn) => {
          btn.addEventListener('click', () => {
            comp.type = btn.dataset.lensType;
            this._build(comp);
            app.requestUpdate();
          });
        });

        const syncFl = (val) => {
          comp.focalLength = clamp(parseFloat(val) || 120, 20, 1000);
          const rEl = document.getElementById('prop-fl-range');
          const nEl = document.getElementById('prop-fl');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.focalLength;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.focalLength;
          this._updateLensReadout(comp);
        };
        bindInput('prop-fl-range', syncFl);
        bindInput('prop-fl', syncFl);

        const syncAp = (val) => {
          comp.aperture = clamp(parseFloat(val) || 100, 30, 400);
          const rEl = document.getElementById('prop-ap-range');
          const nEl = document.getElementById('prop-ap');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.aperture;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.aperture;
          this._updateLensReadout(comp);
        };
        bindInput('prop-ap-range', syncAp);
        bindInput('prop-ap', syncAp);
      }

      // ── Plane Mirror Bindings ──
      if (comp instanceof PlaneMirror) {
        const syncMirAp = (val) => {
          comp.aperture = clamp(parseFloat(val) || 110, 30, 320);
          const rEl = document.getElementById('prop-mir-ap');
          const nEl = document.getElementById('prop-mir-ap-num');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.aperture;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.aperture;
        };
        bindInput('prop-mir-ap', syncMirAp);
        bindInput('prop-mir-ap-num', syncMirAp);
      }

      // ── Curved Mirror (Concave / Convex) Bindings ──
      if (comp instanceof CurvedMirror) {
        this.contentEl.querySelectorAll('.seg-btn[data-cm-type]').forEach((btn) => {
          btn.addEventListener('click', () => {
            comp.type = btn.dataset.cmType;
            this._build(comp);
            app.requestUpdate();
          });
        });

        const syncCmR = (val) => {
          comp.radiusOfCurvature = clamp(parseFloat(val) || 240, 60, 1200);
          const rEl = document.getElementById('prop-cm-r-range');
          const nEl = document.getElementById('prop-cm-r');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.radiusOfCurvature;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.radiusOfCurvature;
          this._updateCurvedMirrorReadout(comp);
        };
        bindInput('prop-cm-r-range', syncCmR);
        bindInput('prop-cm-r', syncCmR);

        const syncCmAp = (val) => {
          comp.aperture = clamp(parseFloat(val) || 116, 40, 360);
          const rEl = document.getElementById('prop-cm-ap-range');
          const nEl = document.getElementById('prop-cm-ap');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.aperture;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.aperture;
          this._updateCurvedMirrorReadout(comp);
        };
        bindInput('prop-cm-ap-range', syncCmAp);
        bindInput('prop-cm-ap', syncCmAp);

        bindInput('prop-cm-foci', (checked) => {
          comp.showFocalPoint = checked;
        });
      }

      // ── Optical Color Filter Bindings ──
      if (comp instanceof ColorFilter) {
        const updateFilterUI = () => {
          const transPct = Math.round(comp.transmission * 100);
          const colorLabel =
            comp.filterColor && comp.filterColor !== 'custom'
              ? comp.filterColor.toUpperCase()
              : `${comp.passWavelength} nm`;
          const pill = document.getElementById('cf-badge-pill');
          const swatch = document.getElementById('cf-wl-swatch');
          const wlText = document.getElementById('cf-wl-text');
          const wlRange = document.getElementById('prop-cf-wl');
          const wlNum = document.getElementById('prop-cf-wl-num');
          const modeEl = document.getElementById('cf-mode-readout');
          const transEl = document.getElementById('cf-trans-readout');
          const iconBox = document.getElementById('prop-icon-box');

          if (pill) pill.textContent = `${colorLabel} · ${transPct}%`;
          if (swatch) swatch.style.background = rgbStr(comp.color);
          if (wlText) wlText.textContent = `${comp.passWavelength} nm`;
          if (wlRange && document.activeElement !== wlRange) wlRange.value = comp.passWavelength;
          if (wlNum && document.activeElement !== wlNum) wlNum.value = comp.passWavelength;
          if (modeEl) {
            modeEl.textContent =
              comp.filterColor !== 'custom'
                ? `${comp.filterColor.toUpperCase()} Bandpass`
                : 'Custom Narrowband';
          }
          if (transEl) transEl.textContent = `${transPct}%`;
          if (iconBox) iconBox.innerHTML = this._getComponentIconSvg(comp);
        };

        this.contentEl.querySelectorAll('.cf-preset-card').forEach((card) => {
          card.addEventListener('click', () => {
            this.contentEl.querySelectorAll('.cf-preset-card').forEach((c) => c.classList.remove('active'));
            card.classList.add('active');
            comp.setFilterColor(card.dataset.cfColor);
            updateFilterUI();
            app.requestUpdate();
          });
        });

        const syncCfTrans = (val) => {
          const pct = clamp(parseInt(val, 10) || 0, 0, 100);
          comp.transmission = pct / 100;
          const rEl = document.getElementById('prop-cf-trans');
          const nEl = document.getElementById('prop-cf-trans-num');
          if (rEl && document.activeElement !== rEl) rEl.value = pct;
          if (nEl && document.activeElement !== nEl) nEl.value = pct;
          updateFilterUI();
        };
        bindInput('prop-cf-trans', syncCfTrans);
        bindInput('prop-cf-trans-num', syncCfTrans);

        const syncCfWl = (val) => {
          comp.setPassWavelength(parseInt(val, 10) || 532);
          this.contentEl.querySelectorAll('.cf-preset-card').forEach((c) => c.classList.remove('active'));
          updateFilterUI();
        };
        bindInput('prop-cf-wl', syncCfWl);
        bindInput('prop-cf-wl-num', syncCfWl);

        const syncCfAp = (val) => {
          comp.aperture = clamp(parseFloat(val) || 104, 30, 320);
          const rEl = document.getElementById('prop-cf-ap');
          const nEl = document.getElementById('prop-cf-ap-num');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.aperture;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.aperture;
        };
        bindInput('prop-cf-ap', syncCfAp);
        bindInput('prop-cf-ap-num', syncCfAp);
      }

      // ── Beam Splitter Bindings ──
      if (comp instanceof BeamSplitter) {
        const syncSplit = (val) => {
          const rPct = clamp(parseInt(val, 10) || 0, 0, 100);
          const tPct = 100 - rPct;
          comp.reflectance = rPct / 100;
          const rEl = document.getElementById('prop-bs-refl');
          const nEl = document.getElementById('prop-bs-refl-num');
          const pill = document.getElementById('prop-bs-pill');
          const barR = document.getElementById('split-bar-r');
          const barT = document.getElementById('split-bar-t');
          const legR = document.getElementById('split-leg-r');
          const legT = document.getElementById('split-leg-t');

          if (rEl && document.activeElement !== rEl) rEl.value = rPct;
          if (nEl && document.activeElement !== nEl) nEl.value = rPct;
          if (pill) pill.textContent = `${rPct}/${tPct}`;
          if (barR) barR.style.width = `${rPct}%`;
          if (barT) barT.style.width = `${tPct}%`;
          if (legR) legR.textContent = `Reflected: ${rPct}%`;
          if (legT) legT.textContent = `Transmitted: ${tPct}%`;
        };
        bindInput('prop-bs-refl', syncSplit);
        bindInput('prop-bs-refl-num', syncSplit);

        this.contentEl.querySelectorAll('.bs-preset-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncSplit(btn.dataset.r);
            app.requestUpdate();
          });
        });

        const syncBsSize = (val) => {
          comp.size = clamp(parseFloat(val) || 84, 30, 240);
          const rEl = document.getElementById('prop-bs-size-range');
          const nEl = document.getElementById('prop-bs-size');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.size;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.size;
        };
        bindInput('prop-bs-size-range', syncBsSize);
        bindInput('prop-bs-size', syncBsSize);
      }

      // ── Prism Bindings ──
      if (comp instanceof Prism) {
        const updatePrismAngles = () => {
          const pill = document.getElementById('pr-n-pill');
          const crit = document.getElementById('pr-crit');
          const brew = document.getElementById('pr-brewster');
          if (pill) pill.textContent = `n = ${comp.refractiveIndex.toFixed(2)}`;
          if (crit) crit.textContent = `${deg(Math.asin(1 / comp.refractiveIndex)).toFixed(1)}°`;
          if (brew) brew.textContent = `${deg(Math.atan(comp.refractiveIndex)).toFixed(1)}°`;
        };

        const syncPrN = (val) => {
          comp.refractiveIndex = clamp(parseFloat(val) || 1.52, 1.1, 2.5);
          const rEl = document.getElementById('prop-pr-n');
          const nEl = document.getElementById('prop-pr-n-num');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.refractiveIndex;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.refractiveIndex;
          updatePrismAngles();
        };
        bindInput('prop-pr-n', syncPrN);
        bindInput('prop-pr-n-num', syncPrN);

        const syncPrDisp = (val) => {
          comp.dispersion = clamp(parseFloat(val) || 0, 0, 0.16);
          const rEl = document.getElementById('prop-pr-disp');
          const nEl = document.getElementById('prop-pr-disp-num');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.dispersion;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.dispersion;
        };
        bindInput('prop-pr-disp', syncPrDisp);
        bindInput('prop-pr-disp-num', syncPrDisp);

        this.contentEl.querySelectorAll('.mat-card').forEach((card) => {
          card.addEventListener('click', () => {
            this.contentEl.querySelectorAll('.mat-card').forEach((c) => c.classList.remove('active'));
            card.classList.add('active');
            syncPrN(card.dataset.n);
            syncPrDisp(card.dataset.disp);
            app.requestUpdate();
          });
        });

        bindInput('prop-pr-split', (checked) => { comp.splitSpectrum = checked; });
        bindInput('prop-pr-side', (val) => { comp.sideLength = clamp(parseFloat(val) || 110, 40, 280); });
        bindInput('prop-pr-apex', (val) => { comp.apexAngle = clamp(parseFloat(val) || 60, 30, 90); });
      }

      // ── Glass Block Bindings ──
      if (comp instanceof GlassBlock) {
        const updateGbAngles = () => {
          const pill = document.getElementById('gb-n-pill');
          const crit = document.getElementById('gb-crit');
          const brew = document.getElementById('gb-brewster');
          if (pill) pill.textContent = `n = ${comp.refractiveIndex.toFixed(2)}`;
          if (crit) crit.textContent = `${deg(Math.asin(1 / comp.refractiveIndex)).toFixed(1)}°`;
          if (brew) brew.textContent = `${deg(Math.atan(comp.refractiveIndex)).toFixed(1)}°`;
        };

        const syncGbN = (val) => {
          comp.refractiveIndex = clamp(parseFloat(val) || 1.52, 1.1, 2.5);
          const rEl = document.getElementById('prop-gb-n');
          const nEl = document.getElementById('prop-gb-n-num');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.refractiveIndex;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.refractiveIndex;
          updateGbAngles();
        };
        bindInput('prop-gb-n', syncGbN);
        bindInput('prop-gb-n-num', syncGbN);

        this.contentEl.querySelectorAll('.mat-card').forEach((card) => {
          card.addEventListener('click', () => {
            this.contentEl.querySelectorAll('.mat-card').forEach((c) => c.classList.remove('active'));
            card.classList.add('active');
            syncGbN(card.dataset.n);
            comp.dispersion = parseFloat(card.dataset.disp) || 0.02;
            app.requestUpdate();
          });
        });

        const syncGbW = (val) => {
          comp.width = clamp(parseFloat(val) || 140, 30, 400);
          const rEl = document.getElementById('prop-gb-w-range');
          const nEl = document.getElementById('prop-gb-w');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.width;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.width;
        };
        bindInput('prop-gb-w-range', syncGbW);
        bindInput('prop-gb-w', syncGbW);

        const syncGbH = (val) => {
          comp.height = clamp(parseFloat(val) || 84, 30, 400);
          const rEl = document.getElementById('prop-gb-h-range');
          const nEl = document.getElementById('prop-gb-h');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.height;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.height;
        };
        bindInput('prop-gb-h-range', syncGbH);
        bindInput('prop-gb-h', syncGbH);
      }

      // ── Optical Detector Bindings ──
      if (comp instanceof OpticalDetector) {
        const syncDetAp = (val) => {
          comp.aperture = clamp(parseFloat(val) || 76, 20, 260);
          const rEl = document.getElementById('prop-det-ap-range');
          const nEl = document.getElementById('prop-det-ap');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.aperture;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.aperture;
        };
        bindInput('prop-det-ap-range', syncDetAp);
        bindInput('prop-det-ap', syncDetAp);
      }

      // ── Point Source Bindings ──
      if (comp instanceof PointSource) {
        this.contentEl.querySelectorAll('[data-ps-mode]').forEach((btn) => {
          btn.addEventListener('click', () => {
            comp.whiteLight = btn.dataset.psMode === 'white';
            app.markUnsaved();
            app.recordHistory();
            this._build(comp);
            app.requestUpdate();
          });
        });

        const syncPsWl = (val) => {
          comp.setWavelength(parseFloat(val) || 589);
          const rEl = document.getElementById('prop-ps-wl');
          const nEl = document.getElementById('prop-ps-wl-num');
          const sw = document.getElementById('ps-wl-swatch');
          const pill = document.getElementById('ps-badge-pill');
          const iconBox = document.getElementById('prop-icon-box');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.wavelength;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.wavelength;
          if (sw) sw.style.background = rgbStr(comp.color);
          if (pill) pill.textContent = `${comp.wavelength} nm`;
          if (iconBox) iconBox.innerHTML = this._getComponentIconSvg(comp);
        };
        bindInput('prop-ps-wl', syncPsWl);
        bindInput('prop-ps-wl-num', syncPsWl);

        const syncPsSpread = (val) => {
          comp.spreadAngle = clamp(parseFloat(val) || 360, 15, 360);
          const rEl = document.getElementById('prop-ps-spread-range');
          const nEl = document.getElementById('prop-ps-spread');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.spreadAngle;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.spreadAngle;
        };
        bindInput('prop-ps-spread-range', syncPsSpread);
        bindInput('prop-ps-spread', syncPsSpread);

        this.contentEl.querySelectorAll('.ps-spread-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncPsSpread(btn.dataset.spread);
            app.markUnsaved();
            app.recordHistory();
            app.requestUpdate();
          });
        });

        const syncPsRays = (val) => {
          comp.numRays = clamp(parseInt(val, 10) || 24, 4, 72);
          const rEl = document.getElementById('prop-ps-rays-range');
          const nEl = document.getElementById('prop-ps-rays');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.numRays;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.numRays;
        };
        bindInput('prop-ps-rays-range', syncPsRays);
        bindInput('prop-ps-rays', syncPsRays);

        const syncPsInt = (val) => {
          const pct = clamp(parseFloat(val) || 85, 5, 100);
          comp.intensity = pct / 100;
          const rEl = document.getElementById('prop-ps-int');
          const nEl = document.getElementById('prop-ps-int-num');
          if (rEl && document.activeElement !== rEl) rEl.value = pct;
          if (nEl && document.activeElement !== nEl) nEl.value = pct;
        };
        bindInput('prop-ps-int', syncPsInt);
        bindInput('prop-ps-int-num', syncPsInt);
      }

      // ── Glass Sphere Bindings ──
      if (comp instanceof GlassSphere) {
        const updateGsReadout = () => {
          const pill = document.getElementById('gs-n-pill');
          const efl = document.getElementById('gs-efl');
          const bfl = document.getElementById('gs-bfl');
          const crit = document.getElementById('gs-crit');
          if (pill) pill.textContent = `n = ${comp.refractiveIndex.toFixed(2)}`;
          if (efl) efl.textContent = `${comp.effectiveFocalLength.toFixed(1)} px`;
          if (bfl) bfl.textContent = `${comp.backFocalLength.toFixed(1)} px`;
          if (crit) crit.textContent = `${deg(Math.asin(1 / comp.refractiveIndex)).toFixed(1)}°`;
        };

        const syncGsN = (val) => {
          comp.refractiveIndex = clamp(parseFloat(val) || 1.52, 1.1, 2.5);
          const rEl = document.getElementById('prop-gs-n');
          const nEl = document.getElementById('prop-gs-n-num');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.refractiveIndex;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.refractiveIndex;
          updateGsReadout();
        };
        bindInput('prop-gs-n', syncGsN);
        bindInput('prop-gs-n-num', syncGsN);

        const syncGsDisp = (val) => {
          comp.dispersion = clamp(parseFloat(val) || 0, 0, 0.16);
          const rEl = document.getElementById('prop-gs-disp');
          const nEl = document.getElementById('prop-gs-disp-num');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.dispersion;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.dispersion;
        };
        bindInput('prop-gs-disp', syncGsDisp);
        bindInput('prop-gs-disp-num', syncGsDisp);
        bindInput('prop-gs-split', (checked) => { comp.splitSpectrum = Boolean(checked); });

        this.contentEl.querySelectorAll('.mat-card').forEach((card) => {
          card.addEventListener('click', () => {
            this.contentEl.querySelectorAll('.mat-card').forEach((c) => c.classList.remove('active'));
            card.classList.add('active');
            syncGsN(card.dataset.n);
            syncGsDisp(card.dataset.disp);
            app.markUnsaved();
            app.recordHistory();
            app.requestUpdate();
          });
        });

        const syncGsR = (val) => {
          comp.radius = clamp(parseFloat(val) || 52, 20, 180);
          const rEl = document.getElementById('prop-gs-r-range');
          const nEl = document.getElementById('prop-gs-r');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.radius;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.radius;
          updateGsReadout();
        };
        bindInput('prop-gs-r-range', syncGsR);
        bindInput('prop-gs-r', syncGsR);
      }

      // ── Aperture / Slit Bindings ──
      if (comp instanceof ApertureSlit) {
        this.contentEl.querySelectorAll('[data-slit-count]').forEach((btn) => {
          btn.addEventListener('click', () => {
            comp.slitCount = clamp(parseInt(btn.dataset.slitCount, 10) || 2, 1, 3);
            app.markUnsaved();
            app.recordHistory();
            this._build(comp);
            app.requestUpdate();
          });
        });

        const syncSlitW = (val) => {
          comp.slitWidth = clamp(parseFloat(val) || 16, 4, 100);
          const rEl = document.getElementById('prop-slit-w-range');
          const nEl = document.getElementById('prop-slit-w');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.slitWidth;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.slitWidth;
        };
        bindInput('prop-slit-w-range', syncSlitW);
        bindInput('prop-slit-w', syncSlitW);

        const syncSlitSp = (val) => {
          comp.slitSpacing = clamp(parseFloat(val) || 44, 12, 160);
          const rEl = document.getElementById('prop-slit-sp-range');
          const nEl = document.getElementById('prop-slit-sp');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.slitSpacing;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.slitSpacing;
        };
        bindInput('prop-slit-sp-range', syncSlitSp);
        bindInput('prop-slit-sp', syncSlitSp);

        const syncSlitAp = (val) => {
          comp.aperture = clamp(parseFloat(val) || 160, 60, 400);
          const rEl = document.getElementById('prop-slit-ap-range');
          const nEl = document.getElementById('prop-slit-ap');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.aperture;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.aperture;
        };
        bindInput('prop-slit-ap-range', syncSlitAp);
        bindInput('prop-slit-ap', syncSlitAp);
      }

      // ── Beam Blocker Bindings ──
      if (comp instanceof BeamBlocker) {
        const syncBbAp = (val) => {
          comp.aperture = clamp(parseFloat(val) || 100, 24, 360);
          const rEl = document.getElementById('prop-bb-ap-range');
          const nEl = document.getElementById('prop-bb-ap');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.aperture;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.aperture;
        };
        bindInput('prop-bb-ap-range', syncBbAp);
        bindInput('prop-bb-ap', syncBbAp);
      }

      // ── Diffraction Grating Bindings ──
      if (comp instanceof DiffractionGrating) {
        const updateDgReadout = () => {
          const pill = document.getElementById('dg-lpmm-pill');
          const pitch = document.getElementById('dg-pitch');
          const th1 = document.getElementById('dg-theta1');
          const dNm = comp.grooveSpacingNm;
          const sin1 = 532 / dNm;
          if (pill) pill.textContent = `${comp.linesPerMm} l/mm`;
          if (pitch) pitch.textContent = `${Math.round(dNm)} nm`;
          if (th1) th1.textContent = sin1 < 1 ? `${deg(Math.asin(sin1)).toFixed(1)}°` : i18n.phrase('Evanescent');
        };

        const syncDgLpmm = (val) => {
          comp.linesPerMm = clamp(parseFloat(val) || 500, 100, 1200);
          const rEl = document.getElementById('prop-dg-lpmm-range');
          const nEl = document.getElementById('prop-dg-lpmm');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.linesPerMm;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.linesPerMm;
          updateDgReadout();
        };
        bindInput('prop-dg-lpmm-range', syncDgLpmm);
        bindInput('prop-dg-lpmm', syncDgLpmm);

        this.contentEl.querySelectorAll('.dg-lpmm-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncDgLpmm(btn.dataset.lpmm);
            app.markUnsaved();
            app.recordHistory();
            app.requestUpdate();
          });
        });

        this.contentEl.querySelectorAll('[data-dg-order]').forEach((btn) => {
          btn.addEventListener('click', () => {
            comp.maxOrder = clamp(parseInt(btn.dataset.dgOrder, 10) || 2, 1, 3);
            this.contentEl.querySelectorAll('[data-dg-order]').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            app.markUnsaved();
            app.recordHistory();
            app.requestUpdate();
          });
        });

        const syncDgAp = (val) => {
          comp.aperture = clamp(parseFloat(val) || 110, 40, 320);
          const rEl = document.getElementById('prop-dg-ap-range');
          const nEl = document.getElementById('prop-dg-ap');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.aperture;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.aperture;
        };
        bindInput('prop-dg-ap-range', syncDgAp);
        bindInput('prop-dg-ap', syncDgAp);
      }

      // ── Linear Polarizer Bindings ──
      if (comp instanceof Polarizer) {
        const updatePolReadout = () => {
          const pill = document.getElementById('pol-angle-pill');
          const lbl = document.getElementById('pol-axis-label');
          if (pill) pill.textContent = `${Math.round(comp.polAngle)}°`;
          if (lbl) {
            lbl.textContent = i18n.phrase(
              Math.abs(comp.polAngle - 0) < 1 || Math.abs(comp.polAngle - 180) < 1
                ? 'Horizontal (H)'
                : Math.abs(comp.polAngle - 90) < 1
                ? 'Vertical (V)'
                : Math.abs(comp.polAngle - 45) < 1
                ? 'Diagonal (+45°)'
                : Math.abs(comp.polAngle - 135) < 1
                ? 'Anti-Diag (135°)'
                : `${comp.polAngle.toFixed(0)}°`
            );
          }
        };

        const syncPolAngle = (val) => {
          comp.setPolAngle(parseFloat(val) || 0);
          const rEl = document.getElementById('prop-pol-angle-range');
          const nEl = document.getElementById('prop-pol-angle');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.polAngle;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.polAngle;
          updatePolReadout();
        };
        bindInput('prop-pol-angle-range', syncPolAngle);
        bindInput('prop-pol-angle', syncPolAngle);

        this.contentEl.querySelectorAll('.pol-preset-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            syncPolAngle(btn.dataset.pol);
            app.markUnsaved();
            app.recordHistory();
            app.requestUpdate();
          });
        });

        const syncPolAp = (val) => {
          comp.aperture = clamp(parseFloat(val) || 104, 30, 320);
          const rEl = document.getElementById('prop-pol-ap-range');
          const nEl = document.getElementById('prop-pol-ap');
          if (rEl && document.activeElement !== rEl) rEl.value = comp.aperture;
          if (nEl && document.activeElement !== nEl) nEl.value = comp.aperture;
        };
        bindInput('prop-pol-ap-range', syncPolAp);
        bindInput('prop-pol-ap', syncPolAp);
      }

      const delBtn = document.getElementById('btn-del-comp');
      if (delBtn) {
        delBtn.addEventListener('click', () => app.deleteComponent(comp.id));
      }

      const infoBtn = document.getElementById('btn-info-comp');
      if (infoBtn) {
        infoBtn.addEventListener('click', () => app.openComponentInfo(comp.type));
      }
    }
  }

  // ── Main Application Controller ──
  class OptiLabApp {
    constructor() {
      this.canvas = document.getElementById('canvas');
      this.renderer = new Renderer(this.canvas);
      this.rayTracer = new RayTracer();
      this.propsPanel = new PropertiesPanel(this);
      this.storage = new ProjectStorage();
      this.history = new HistoryManager(60);

      this.projectId = 'proj_' + Date.now();
      this.projectName = 'My Optical Experiment';
      this.projectCreatedAt = Date.now();
      this.isSaved = true;

      this.components = [];
      this.selectedIds = new Set();
      this.selectedId = null;
      this.hoveredId = null;
      this.clipboard = [];
      this._pasteOffsetStep = 0;

      this.panX = 0;
      this.panY = 0;
      this.zoom = 1.0;

      this.snapEnabled = true;
      this._interaction = null;
      this._dragFromSidebar = null;
      this.marqueeRect = null;
      this._spacePressed = false;
      this._needsUpdate = true;
      this._groupCounter = 1;

      this.theme = 'dark';
      try {
        const storedTheme = localStorage.getItem('optilab-theme');
        if (storedTheme === 'light' || storedTheme === 'dark') {
          this.theme = storedTheme;
        }
      } catch (_e) {}

      this.lang = 'en';
      try {
        const storedLang = localStorage.getItem('optilab-lang');
        if (storedLang === 'en' || storedLang === 'sk') {
          this.lang = storedLang;
        }
      } catch (_e) {}

      this._centerViewport();
      this._bindEvents();
      this.setTheme(this.theme);
      this.setLanguage(this.lang, true);
      this._initProjectState();
      this._startAutoSaveLoop();
      this._loop();
    }

    setLanguage(lang, silent = false) {
      this.lang = i18n.setLang(lang);
      try {
        localStorage.setItem('optilab-lang', this.lang);
      } catch (_e) {}

      i18n.applyStaticDOM();
      this._setSaveStatus(this.isSaved);

      // Force right PropertiesPanel to rebuild in the newly selected language
      this.propsPanel._currentId = '__REBUILD__';
      this._syncSelectionUI();

      // Re-render Component Info modal if currently open
      const compInfoModal = document.getElementById('modal-comp-info');
      if (compInfoModal && compInfoModal.style.display !== 'none' && this._activeInfoType) {
        this.openComponentInfo(this._activeInfoType);
      }

      // Re-render Projects Manager modal if currently open
      const projModal = document.getElementById('modal-projects');
      if (projModal && projModal.style.display !== 'none') {
        this.openProjectsModal();
      }

      if (!silent) {
        this.showToast(i18n.t('toastLangSwitched'));
      }
    }

    setTheme(theme) {
      this.theme = theme === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', this.theme);
      document.body.classList.toggle('dark-mode', this.theme === 'dark');
      document.body.classList.toggle('light-mode', this.theme === 'light');
      if (this.renderer) {
        this.renderer.setTheme(this.theme);
      }
      const moon = document.querySelector('.theme-icon-moon');
      const sun = document.querySelector('.theme-icon-sun');
      if (moon && sun) {
        moon.style.display = this.theme === 'dark' ? 'none' : 'block';
        sun.style.display = this.theme === 'dark' ? 'block' : 'none';
      }
      try {
        localStorage.setItem('optilab-theme', this.theme);
      } catch (_e) {}
      this.requestUpdate();
    }

    async _initProjectState() {
      const validPresets = new Set([
        'converging',
        'diverging',
        'keplerian',
        'galilean',
        'interferometer',
        'prism-dispersion',
        'diffraction-grating',
        'polarizer-malus',
        'ball-lens',
        'pinhole-slit',
      ]);
      let requestedPreset = null;
      try {
        const params = new URLSearchParams(window.location.search);
        const p = params.get('preset');
        if (p && validPresets.has(p)) requestedPreset = p;
      } catch (_e) {}

      try {
        await this.storage.init();
        if (requestedPreset) {
          this.loadPreset(requestedPreset, false);
          this._refreshProjectCountPill();
          return;
        }
        const lastId = await this.storage.getLastProjectId();
        if (lastId) {
          const saved = await this.storage.getProject(lastId);
          if (saved && Array.isArray(saved.components) && saved.components.length > 0) {
            this._applyLoadedProjectRecord(saved);
            return;
          }
        }
      } catch (err) {
        // Fallback to default preset if IndexedDB is unavailable
      }
      this.loadPreset(requestedPreset || 'converging', false);
      await this.saveCurrentProject(true);
    }

    _applyLoadedProjectRecord(record) {
      this.projectId = record.id || 'proj_' + Date.now();
      this.projectName = record.name || 'My Optical Experiment';
      this.projectCreatedAt = record.createdAt || Date.now();
      const nameInput = document.getElementById('project-name-input');
      if (nameInput) nameInput.value = this.projectName;

      this.components = (record.components || []).map((d) => deserializeComponent(d, true));
      if (record.settings) {
        if (record.settings.snapEnabled !== undefined) {
          this.snapEnabled = Boolean(record.settings.snapEnabled);
          const btnSnap = document.getElementById('btn-snap');
          if (btnSnap) btnSnap.classList.toggle('active', this.snapEnabled);
        }
        if (record.settings.showFocalPoints !== undefined) {
          this.renderer.showFocalPoints = Boolean(record.settings.showFocalPoints);
          const btnFoci = document.getElementById('btn-foci');
          if (btnFoci) btnFoci.classList.toggle('active', this.renderer.showFocalPoints);
        }
        if (record.settings.showOpticalAxis !== undefined) {
          this.renderer.showOpticalAxis = Boolean(record.settings.showOpticalAxis);
        }
      }

      this.clearSelection(false);
      this.history.clear();
      this.recordHistory();
      this._setSaveStatus(true);
      this._refreshProjectCountPill();
      this.requestUpdate();
    }

    _startAutoSaveLoop() {
      this._autoSaveTimer = setInterval(() => {
        if (!this.isSaved) {
          this.saveCurrentProject(true);
        }
      }, 4500);
    }

    markUnsaved() {
      this._setSaveStatus(false);
    }

    _setSaveStatus(saved) {
      this.isSaved = Boolean(saved);
      const badge = document.getElementById('save-status-badge');
      const text = document.getElementById('save-status-text');
      if (badge) {
        badge.classList.toggle('saved', this.isSaved);
        badge.classList.toggle('unsaved', !this.isSaved);
      }
      if (text) {
        text.textContent = i18n.phrase(this.isSaved ? 'Saved' : 'Unsaved');
      }
    }

    recordHistory() {
      this.history.record(this.components, this.selectedIds);
      this._updateUndoRedoButtons();
    }

    _updateUndoRedoButtons() {
      const btnUndo = document.getElementById('btn-undo');
      const btnRedo = document.getElementById('btn-redo');
      if (btnUndo) btnUndo.disabled = !this.history.canUndo();
      if (btnRedo) btnRedo.disabled = !this.history.canRedo();
    }

    undo() {
      const state = this.history.undo();
      if (!state) return false;
      this.components = state.components;
      this._setSelectionSet(state.selectedIds);
      this._updateUndoRedoButtons();
      this.markUnsaved();
      this.requestUpdate();
      return true;
    }

    redo() {
      const state = this.history.redo();
      if (!state) return false;
      this.components = state.components;
      this._setSelectionSet(state.selectedIds);
      this._updateUndoRedoButtons();
      this.markUnsaved();
      this.requestUpdate();
      return true;
    }

    showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const el = document.createElement('div');
      el.className = `toast ${type}`;
      el.textContent = message;
      container.appendChild(el);
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 3200);
    }

    showConfirm(title, message, onConfirm) {
      const modal = document.getElementById('modal-confirm');
      const titleEl = document.getElementById('confirm-title');
      const msgEl = document.getElementById('confirm-message');
      const okBtn = document.getElementById('btn-confirm-ok');
      const cancelBtn = document.getElementById('btn-confirm-cancel');
      if (!modal || !okBtn || !cancelBtn) {
        if (onConfirm) onConfirm();
        return;
      }
      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      modal.style.display = 'flex';

      const cleanup = () => {
        modal.style.display = 'none';
        okBtn.onclick = null;
        cancelBtn.onclick = null;
      };
      okBtn.onclick = () => {
        cleanup();
        if (onConfirm) onConfirm();
      };
      cancelBtn.onclick = () => cleanup();
    }

    openComponentInfo(type) {
      const info = i18n.getComponentInfo(type);
      const modal = document.getElementById('modal-comp-info');
      if (!info || !modal) return;

      this._activeInfoType = type;

      const iconEl = document.getElementById('comp-info-icon');
      const catEl = document.getElementById('comp-info-category');
      const titleEl = document.getElementById('comp-info-title');
      const bodyEl = document.getElementById('comp-info-body');

      if (iconEl) {
        try {
          const dummy = createComponent(type, 0, 0);
          iconEl.innerHTML = this.propsPanel._getComponentIconSvg(dummy);
        } catch (_e) {
          iconEl.innerHTML = '';
        }
      }
      if (catEl) catEl.textContent = info.category;
      if (titleEl) titleEl.textContent = info.title;
      if (bodyEl) {
        const controlsHtml = (info.controls || [])
          .map(([label, desc]) => `<li><strong>${label}:</strong> ${desc}</li>`)
          .join('');
        bodyEl.innerHTML = `
          <p class="comp-info-summary">${info.summary}</p>

          <div class="comp-info-block">
            <span class="comp-info-label">${i18n.phrase('Physics & Governing Law')}</span>
            ${info.formula ? `<div class="comp-info-formula">${info.formula}</div>` : ''}
            <p class="comp-info-physics-text">${info.physics}</p>
          </div>

          <div class="comp-info-block">
            <span class="comp-info-label">${i18n.phrase('Key Controls')}</span>
            <ul class="comp-info-list">${controlsHtml}</ul>
          </div>

          <div class="comp-info-tip">
            <strong>${i18n.phrase('Try on the bench:')}</strong> ${info.tip}
          </div>
        `;
      }

      modal.style.display = 'flex';
    }

    async saveCurrentProject(silent = false) {
      const nameInput = document.getElementById('project-name-input');
      if (nameInput && nameInput.value.trim()) {
        this.projectName = nameInput.value.trim();
      }
      const record = {
        id: this.projectId,
        name: this.projectName,
        createdAt: this.projectCreatedAt,
        components: this.components.map((c) => serializeComponent(c)),
        settings: {
          snapEnabled: this.snapEnabled,
          showFocalPoints: this.renderer.showFocalPoints,
          showOpticalAxis: this.renderer.showOpticalAxis,
          zoom: this.zoom,
          panX: this.panX,
          panY: this.panY,
        },
      };
      await this.storage.saveProject(record);
      this._setSaveStatus(true);
      this._refreshProjectCountPill();
      if (!silent) {
        this.showToast(`Saved "${this.projectName}" to browser storage`, 'success');
      }
      return record;
    }

    async _refreshProjectCountPill() {
      const pill = document.getElementById('toolbar-proj-count');
      if (!pill || !this.storage) return;
      try {
        const list = await this.storage.listProjects();
        pill.textContent = String(list.length || 1);
      } catch (_e) {
        // Ignore storage errors
      }
    }

    createNewProject(skipConfirm = false) {
      const doCreate = async () => {
        if (this.components.length > 0) {
          await this.saveCurrentProject(true);
        }
        this.projectId = 'proj_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        this.projectName = 'Untitled Optical Experiment';
        this.projectCreatedAt = Date.now();
        const nameInput = document.getElementById('project-name-input');
        if (nameInput) nameInput.value = this.projectName;

        this.components = [];
        this.clearSelection(false);
        this.history.clear();
        this.recordHistory();
        await this.saveCurrentProject(true);
        this.requestUpdate();
        this.showToast('Created new project', 'success');
      };

      if (!skipConfirm && !this.isSaved && this.components.length > 0) {
        this.showConfirm(
          'Create New Project',
          `Save current changes to "${this.projectName}" and start a new blank project?`,
          doCreate
        );
      } else {
        doCreate();
      }
    }

    exportOptpFile() {
      const nameInput = document.getElementById('project-name-input');
      if (nameInput && nameInput.value.trim()) {
        this.projectName = nameInput.value.trim();
      }
      const optpObj = buildOptpObject(
        this.projectName,
        this.components,
        {
          snapEnabled: this.snapEnabled,
          showFocalPoints: this.renderer.showFocalPoints,
          showOpticalAxis: this.renderer.showOpticalAxis,
          zoom: this.zoom,
          panX: this.panX,
          panY: this.panY,
        },
        this.projectId
      );
      const jsonStr = JSON.stringify(optpObj, null, 2);
      const safeSlug =
        this.projectName
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, '-')
          .replace(/^-|-$/g, '') || 'optilab-project';
      const fileName = `${safeSlug}.optp`;

      // Use native OS Save dialog when running inside OptiLab Electron Desktop
      if (typeof window !== 'undefined' && window.optiLabDesktop && typeof window.optiLabDesktop.saveOptpFile === 'function') {
        window.optiLabDesktop.saveOptpFile(fileName, jsonStr).then((res) => {
          if (res && !res.canceled) {
            this.showToast(i18n.t('toastExported', { file: res.fileName || fileName }), 'success');
          }
        });
        return optpObj;
      }

      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast(i18n.t('toastExported', { file: a.download }), 'success');
      }
      return optpObj;
    }

    importOptpString(rawText, skipConfirm = false) {
      let parsed;
      try {
        parsed = validateAndParseOptp(rawText);
      } catch (err) {
        this.showToast(err.message || 'Invalid .optp project file.', 'error');
        throw err;
      }

      const applyImport = async () => {
        // Save current project first so user never loses work silently
        if (this.components.length > 0) {
          await this.saveCurrentProject(true);
        }
        this.projectId = 'proj_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        this.projectName = parsed.name;
        this.projectCreatedAt = Date.now();
        const nameInput = document.getElementById('project-name-input');
        if (nameInput) nameInput.value = this.projectName;

        this.components = parsed.components;
        if (parsed.settings) {
          if (parsed.settings.snapEnabled !== undefined) {
            this.snapEnabled = Boolean(parsed.settings.snapEnabled);
            const btnSnap = document.getElementById('btn-snap');
            if (btnSnap) btnSnap.classList.toggle('active', this.snapEnabled);
          }
          if (parsed.settings.showFocalPoints !== undefined) {
            this.renderer.showFocalPoints = Boolean(parsed.settings.showFocalPoints);
            const btnFoci = document.getElementById('btn-foci');
            if (btnFoci) btnFoci.classList.toggle('active', this.renderer.showFocalPoints);
          }
          if (parsed.settings.showOpticalAxis !== undefined) {
            this.renderer.showOpticalAxis = Boolean(parsed.settings.showOpticalAxis);
          }
        }

        this.clearSelection(false);
        this.history.clear();
        this.recordHistory();
        await this.saveCurrentProject(true);
        this.requestUpdate();
        this.showToast(i18n.t('toastImported', { name: this.projectName, n: this.components.length }), 'success');
      };

      if (!skipConfirm && this.components.length > 0 && !this.isSaved) {
        this.showConfirm(
          i18n.t('confirmImportTitle'),
          i18n.t('confirmImportMsg', { name: parsed.name, current: this.projectName }),
          applyImport
        );
      } else {
        applyImport();
      }
      return parsed;
    }

    _formatRelativeTime(ts) {
      const diffSec = Math.max(0, Math.floor((Date.now() - (Number(ts) || Date.now())) / 1000));
      if (diffSec < 15) return i18n.t('justNow');
      if (diffSec < 60) return i18n.t('secAgo', { n: diffSec });
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return i18n.t('minAgo', { n: diffMin });
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return i18n.t('hrAgo', { n: diffHr });
      const diffDays = Math.floor(diffHr / 24);
      return i18n.t('dayAgo', { n: diffDays });
    }

    async openProjectsModal() {
      await this.saveCurrentProject(true);
      const modal = document.getElementById('modal-projects');
      const container = document.getElementById('project-list-container');
      if (!modal || !container) return;

      const list = await this.storage.listProjects();
      const totalComps = list.reduce(
        (acc, p) => acc + (p.componentCount ?? (p.components ? p.components.length : 0)),
        0
      );

      const totalChip = document.getElementById('modal-proj-total-chip');
      const compsChip = document.getElementById('modal-proj-comps-chip');
      if (totalChip) totalChip.textContent = i18n.t(list.length === 1 ? 'projectsCount' : 'projectsCountPlural', { n: list.length });
      if (compsChip) compsChip.textContent = i18n.t(totalComps === 1 ? 'componentsCount' : 'componentsCountPlural', { n: totalComps });

      const searchInput = document.getElementById('project-search-input');
      const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const filtered = query
        ? list.filter((p) => String(p.name || '').toLowerCase().includes(query))
        : list;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="proj-empty-state">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <div>${query ? i18n.t('noProjectsMatching', { q: query }) : i18n.phrase('No saved projects in browser storage yet.')}</div>
          </div>`;
      } else {
        container.innerHTML = filtered
          .map((p) => {
            const isCurrent = p.id === this.projectId;
            const dateObj = new Date(p.updatedAt);
            const dateStr = dateObj.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            const relStr = this._formatRelativeTime(p.updatedAt);
            const count = p.componentCount ?? (p.components ? p.components.length : 0);
            const safeName = String(p.name || 'Untitled Project')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');

            return `
              <div class="project-row ${isCurrent ? 'active' : ''}" data-proj-id="${p.id}">
                <div class="project-row-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                    <circle cx="6" cy="12" r="2.5"></circle>
                    <path d="M8.5 12h11"></path>
                    <path d="M14 7 Q18 12 14 17"></path>
                  </svg>
                </div>
                <div class="project-row-info">
                  <div class="project-row-title" data-title-wrap="${p.id}">
                    <span class="project-row-name">${safeName}</span>
                    ${
                      isCurrent
                        ? '<span class="proj-active-badge"><span class="save-dot"></span>ACTIVE SESSION</span>'
                        : ''
                    }
                  </div>
                  <div class="project-row-meta">
                    <span class="proj-meta-chip">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                      </svg>
                      ${i18n.t(count === 1 ? 'componentsCount' : 'componentsCountPlural', { n: count }).toLowerCase()}
                    </span>
                    <span class="proj-meta-sep">•</span>
                    <span class="proj-meta-chip" title="${dateObj.toLocaleString()}">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      ${relStr} (${dateStr})
                    </span>
                    <span class="proj-meta-sep">•</span>
                    <span class="proj-meta-chip mono">OPTP v1</span>
                  </div>
                </div>
                <div class="project-row-actions">
                  ${
                    !isCurrent
                      ? `<button class="tb-btn active proj-open-btn" data-id="${p.id}" title="Load this project into the workspace">Open</button>`
                      : `<span class="proj-current-tag">Loaded</span>`
                  }
                  <button class="tb-btn proj-export-btn" data-id="${p.id}" title="Export as .optp file">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    .optp
                  </button>
                  <button class="tb-btn proj-rename-btn" data-id="${p.id}" title="Rename project">Rename</button>
                  <button class="tb-btn danger proj-del-btn" data-id="${p.id}" title="Delete project">Delete</button>
                </div>
              </div>
            `;
          })
          .join('');
      }

      i18n.translateSubtree(container);

      container.querySelectorAll('.proj-open-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const rec = await this.storage.getProject(btn.dataset.id);
          if (rec) {
            await this.storage.setLastProjectId(rec.id);
            this._applyLoadedProjectRecord(rec);
            modal.style.display = 'none';
            this.showToast(i18n.t('toastOpenedProj', { name: rec.name }), 'success');
          }
        });
      });

      container.querySelectorAll('.proj-export-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const rec = await this.storage.getProject(btn.dataset.id);
          if (!rec) return;
          if (rec.id === this.projectId) {
            this.exportOptpFile();
            return;
          }
          const comps = (rec.components || []).map((c) => deserializeComponent(c, true));
          const optpObj = buildOptpObject(rec.name, comps, rec.settings || {}, rec.id);
          const jsonStr = JSON.stringify(optpObj, null, 2);
          if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const safeSlug =
              String(rec.name || 'optilab-project')
                .toLowerCase()
                .replace(/[^a-z0-9-_]+/g, '-')
                .replace(/^-|-$/g, '') || 'optilab-project';
            a.href = url;
            a.download = `${safeSlug}.optp`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast(`Exported "${a.download}"`, 'success');
          }
        });
      });

      container.querySelectorAll('.proj-rename-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const rec = await this.storage.getProject(btn.dataset.id);
          if (!rec) return;
          const titleWrap = container.querySelector(`[data-title-wrap="${rec.id}"]`);
          if (titleWrap && typeof document !== 'undefined') {
            titleWrap.innerHTML = `
              <div class="proj-inline-rename">
                <input type="text" class="proj-inline-input" value="${String(rec.name).replace(/"/g, '&quot;')}" maxlength="64" />
                <button class="tb-btn active proj-inline-save">Save</button>
                <button class="tb-btn proj-inline-cancel">Cancel</button>
              </div>
            `;
            const inp = titleWrap.querySelector('.proj-inline-input');
            const saveBtn = titleWrap.querySelector('.proj-inline-save');
            const cancelBtn = titleWrap.querySelector('.proj-inline-cancel');
            if (inp) {
              inp.focus();
              inp.select();
            }
            const commitRename = async () => {
              const nextName = inp ? inp.value.trim() : '';
              if (nextName) {
                rec.name = nextName;
                await this.storage.saveProject(rec);
                if (rec.id === this.projectId) {
                  this.projectName = rec.name;
                  const nameInput = document.getElementById('project-name-input');
                  if (nameInput) nameInput.value = this.projectName;
                }
                this.showToast(`Renamed to "${rec.name}"`, 'success');
              }
              this.openProjectsModal();
            };
            if (saveBtn) saveBtn.addEventListener('click', commitRename);
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.openProjectsModal());
            if (inp) {
              inp.addEventListener('keydown', (ev) => {
                ev.stopPropagation();
                if (ev.key === 'Enter') commitRename();
                else if (ev.key === 'Escape') this.openProjectsModal();
              });
            }
            return;
          }
          const nextName = typeof prompt === 'function' ? prompt('Rename project:', rec.name) : null;
          if (nextName && nextName.trim()) {
            rec.name = nextName.trim();
            await this.storage.saveProject(rec);
            if (rec.id === this.projectId) {
              this.projectName = rec.name;
              const nameInput = document.getElementById('project-name-input');
              if (nameInput) nameInput.value = this.projectName;
            }
            this.openProjectsModal();
          }
        });
      });

      container.querySelectorAll('.proj-del-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const rec = await this.storage.getProject(btn.dataset.id);
          if (!rec) return;
          this.showConfirm(
            'Delete Project',
            `Are you sure you want to permanently delete "${rec.name}"?`,
            async () => {
              await this.storage.deleteProject(rec.id);
              if (rec.id === this.projectId) {
                const remaining = await this.storage.listProjects();
                if (remaining.length > 0) {
                  this._applyLoadedProjectRecord(remaining[0]);
                } else {
                  this.createNewProject(true);
                }
              }
              this._refreshProjectCountPill();
              this.openProjectsModal();
              this.showToast(`Deleted "${rec.name}"`);
            }
          );
        });
      });

      modal.style.display = 'flex';
    }

    _centerViewport() {
      this.panX = Math.round(this.renderer.width / 2);
      this.panY = Math.round(this.renderer.height / 2);
      this.zoom = 1.0;
      this._updateZoomUI();
    }

    requestUpdate() {
      this._needsUpdate = true;
    }

    loadPreset(name, recordUndo = true) {
      this.components = [];
      this.selectedIds.clear();
      this.selectedId = null;

      if (name === 'converging') {
        const laser = createComponent('laser', -260, 0);
        laser.numRays = 9;
        laser.beamWidth = 80;
        const convex = createComponent('convex-lens', -20, 0);
        convex.focalLength = 160;
        convex.aperture = 130;
        const det = createComponent('optical-detector', 140, 0);
        this.components.push(laser, convex, det);
        this.selectComponent(convex);
      } else if (name === 'diverging') {
        const laser = createComponent('laser', -240, 0);
        laser.setWavelength(532);
        laser.numRays = 9;
        laser.beamWidth = 76;
        const concave = createComponent('concave-lens', 0, 0);
        concave.focalLength = 140;
        concave.aperture = 130;
        this.components.push(laser, concave);
        this.selectComponent(concave);
      } else if (name === 'keplerian') {
        const laser = createComponent('laser', -340, 0);
        laser.setWavelength(473);
        laser.numRays = 7;
        laser.beamWidth = 48;

        const lens1 = createComponent('convex-lens', -160, 0);
        lens1.focalLength = 100;
        lens1.aperture = 100;

        const lens2 = createComponent('convex-lens', 120, 0);
        lens2.focalLength = 180;
        lens2.aperture = 150;

        this.components.push(laser, lens1, lens2);
        this.selectComponent(lens2);
      } else if (name === 'galilean') {
        const laser = createComponent('laser', -320, 0);
        laser.setWavelength(633);
        laser.numRays = 7;
        laser.beamWidth = 44;

        const lens1 = createComponent('concave-lens', -120, 0);
        lens1.focalLength = 100;
        lens1.aperture = 90;

        const lens2 = createComponent('convex-lens', 80, 0);
        lens2.focalLength = 200;
        lens2.aperture = 160;

        this.components.push(laser, lens1, lens2);
        this.selectComponent(lens1);
      } else if (name === 'interferometer') {
        const laser = createComponent('laser', -280, 0);
        laser.setWavelength(532);
        laser.numRays = 3;
        laser.beamWidth = 18;

        const splitter = createComponent('beam-splitter', -40, 0);
        splitter.reflectance = 0.5;

        const mirrorTop = createComponent('plane-mirror', -40, 160);
        mirrorTop.rotation = 45;

        const detRight = createComponent('optical-detector', 200, 0);
        const detRefl = createComponent('optical-detector', 160, 160);

        this.components.push(laser, splitter, mirrorTop, detRight, detRefl);
        this.selectComponent(splitter);
      } else if (name === 'prism-dispersion') {
        const led = createComponent('white-led', -240, 20);
        led.numRays = 1;
        led.spreadAngle = 0;
        led.rotation = -8;
        const prism = createComponent('prism', -20, 0);
        prism.refractiveIndex = 1.56;
        prism.dispersion = 0.08;
        prism.splitSpectrum = true;
        this.components.push(led, prism);
        this.selectComponent(led);
      } else if (name === 'diffraction-grating') {
        const led = createComponent('white-led', -260, 0);
        led.numRays = 1;
        led.spreadAngle = 0;
        const grating = createComponent('diffraction-grating', -60, 0);
        grating.linesPerMm = 600;
        grating.maxOrder = 2;
        this.components.push(led, grating);
        this.selectComponent(grating);
      } else if (name === 'polarizer-malus') {
        const laser = createComponent('laser', -300, 0);
        laser.setWavelength(532);
        laser.numRays = 5;
        laser.beamWidth = 40;
        const p1 = createComponent('polarizer', -140, 0);
        p1.setPolAngle(0);
        const p2 = createComponent('polarizer', -20, 0);
        p2.setPolAngle(45);
        const p3 = createComponent('polarizer', 100, 0);
        p3.setPolAngle(90);
        const det = createComponent('optical-detector', 240, 0);
        this.components.push(laser, p1, p2, p3, det);
        this.selectComponent(p2);
      } else if (name === 'ball-lens') {
        const led = createComponent('white-led', -260, 0);
        led.numRays = 7;
        led.beamWidth = 76;
        led.spreadAngle = 0;
        const sphere = createComponent('glass-sphere', -20, 0);
        sphere.radius = 60;
        sphere.refractiveIndex = 1.52;
        sphere.dispersion = 0.06;
        sphere.splitSpectrum = true;
        this.components.push(led, sphere);
        this.selectComponent(sphere);
      } else if (name === 'pinhole-slit') {
        const src = createComponent('point-source', -240, 0);
        src.numRays = 36;
        src.spreadAngle = 140;
        const slit = createComponent('aperture-slit', -60, 0);
        slit.slitCount = 2;
        slit.slitWidth = 18;
        slit.slitSpacing = 54;
        slit.aperture = 200;
        const lens = createComponent('convex-lens', 100, 0);
        lens.focalLength = 140;
        lens.aperture = 160;
        const det = createComponent('optical-detector', 260, 0);
        det.aperture = 120;
        this.components.push(src, slit, lens, det);
        this.selectComponent(slit);
      }

      if (recordUndo) {
        this.recordHistory();
        this.markUnsaved();
      } else {
        this.history.clear();
        this.recordHistory();
      }
      this.requestUpdate();
    }

    // ── Multi-Selection & Group Management ──
    _expandGroupIds(comp) {
      if (!comp) return [];
      if (!comp.groupId) return [comp.id];
      return this.components.filter((c) => c.groupId === comp.groupId).map((c) => c.id);
    }

    _setSelectionSet(idIterable) {
      const validIds = new Set(this.components.map((c) => c.id));
      this.selectedIds = new Set(Array.from(idIterable || []).filter((id) => validIds.has(id)));
      const arr = Array.from(this.selectedIds);
      this.selectedId = arr.length > 0 ? arr[arr.length - 1] : null;
      this._syncSelectionUI();
    }

    _syncSelectionUI() {
      const selectedComps = this.getSelectedComponents();
      if (selectedComps.length === 0) {
        this.propsPanel.hide();
      } else if (selectedComps.length === 1) {
        this.propsPanel.show(selectedComps[0]);
      } else {
        this.propsPanel.showMulti(selectedComps);
      }

      const mtb = document.getElementById('multi-toolbar');
      const mtbCount = document.getElementById('multi-tb-count');
      if (mtb) {
        mtb.style.display = selectedComps.length > 1 ? 'flex' : 'none';
      }
      if (mtbCount) {
        mtbCount.textContent = i18n.t('selectedCount', { n: selectedComps.length });
      }

      const statusSel = document.getElementById('status-selected');
      if (statusSel) statusSel.textContent = selectedComps.length;
    }

    selectComponent(comp) {
      if (!comp) {
        this.clearSelection();
        return;
      }
      const ids = this._expandGroupIds(comp);
      this._setSelectionSet(ids);
      this.requestUpdate();
    }

    toggleSelectComponent(comp) {
      if (!comp) return;
      const ids = this._expandGroupIds(comp);
      const next = new Set(this.selectedIds);
      const isCurrentlySelected = next.has(comp.id);
      for (const id of ids) {
        if (isCurrentlySelected) next.delete(id);
        else next.add(id);
      }
      this._setSelectionSet(next);
      this.requestUpdate();
    }

    addSelectComponent(comp) {
      if (!comp) return;
      const ids = this._expandGroupIds(comp);
      const next = new Set(this.selectedIds);
      for (const id of ids) next.add(id);
      this._setSelectionSet(next);
      this.requestUpdate();
    }

    selectAll() {
      this._setSelectionSet(this.components.map((c) => c.id));
      this.requestUpdate();
    }

    clearSelection(updateUI = true) {
      this.selectedIds.clear();
      this.selectedId = null;
      if (updateUI) {
        this._syncSelectionUI();
      }
      this.requestUpdate();
    }

    getSelected() {
      return this.components.find((c) => c.id === this.selectedId) || null;
    }

    getSelectedComponents() {
      return this.components.filter((c) => this.selectedIds.has(c.id));
    }

    groupSelection() {
      const sel = this.getSelectedComponents();
      if (sel.length < 2) return false;
      const gid = 'grp_' + (++this._groupCounter) + '_' + (Date.now() % 10000);
      for (const c of sel) {
        c.groupId = gid;
      }
      this.recordHistory();
      this.markUnsaved();
      this._syncSelectionUI();
      this.showToast(`Grouped ${sel.length} objects`);
      this.requestUpdate();
      return gid;
    }

    ungroupSelection() {
      const sel = this.getSelectedComponents();
      let changed = false;
      for (const c of sel) {
        if (c.groupId) {
          c.groupId = null;
          changed = true;
        }
      }
      if (changed) {
        this.recordHistory();
        this.markUnsaved();
        this._syncSelectionUI();
        this.showToast('Ungrouped selection');
        this.requestUpdate();
      }
      return changed;
    }

    alignSelection(axis = 'horizontal') {
      const sel = this.getSelectedComponents().filter((c) => !c.locked);
      if (sel.length < 2) return;
      if (axis === 'horizontal') {
        const avgY = Math.round(sel.reduce((s, c) => s + c.y, 0) / sel.length);
        const targetY = this.snapEnabled ? Math.round(avgY / CFG.GRID_SIZE) * CFG.GRID_SIZE : avgY;
        for (const c of sel) c.y = targetY;
      } else {
        const avgX = Math.round(sel.reduce((s, c) => s + c.x, 0) / sel.length);
        const targetX = this.snapEnabled ? Math.round(avgX / CFG.GRID_SIZE) * CFG.GRID_SIZE : avgX;
        for (const c of sel) c.x = targetX;
      }
      this.recordHistory();
      this.markUnsaved();
      this._syncSelectionUI();
      this.requestUpdate();
    }

    moveSelectedBy(dx, dy, commitHistory = false) {
      const sel = this.getSelectedComponents().filter((c) => !c.locked);
      if (!sel.length) return;
      for (const c of sel) {
        c.x = Math.round(c.x + dx);
        c.y = Math.round(c.y + dy);
      }
      if (commitHistory) {
        this.recordHistory();
      }
      this.markUnsaved();
      if (sel.length === 1) this.propsPanel.refreshValues(sel[0]);
      else this._syncSelectionUI();
      this.requestUpdate();
    }

    rotateSelectedBy(deltaDeg, commitHistory = false) {
      const sel = this.getSelectedComponents().filter((c) => !c.locked);
      if (!sel.length) return;
      if (sel.length === 1) {
        sel[0].rotation = normAngle(sel[0].rotation + deltaDeg);
        this.propsPanel.refreshValues(sel[0]);
      } else {
        const cx = sel.reduce((s, c) => s + c.x, 0) / sel.length;
        const cy = sel.reduce((s, c) => s + c.y, 0) / sel.length;
        const dRad = rad(deltaDeg);
        for (const c of sel) {
          const rel = V.rot({ x: c.x - cx, y: c.y - cy }, dRad);
          c.x = Math.round(cx + rel.x);
          c.y = Math.round(cy + rel.y);
          c.rotation = normAngle(c.rotation + deltaDeg);
        }
        this._syncSelectionUI();
      }
      if (commitHistory) {
        this.recordHistory();
      }
      this.markUnsaved();
      this.requestUpdate();
    }

    deleteComponent(id) {
      this.components = this.components.filter((c) => c.id !== id);
      this.selectedIds.delete(id);
      this._setSelectionSet(this.selectedIds);
      this.recordHistory();
      this.markUnsaved();
      this.requestUpdate();
    }

    deleteSelection() {
      if (this.selectedIds.size === 0) return 0;
      const count = this.selectedIds.size;
      this.components = this.components.filter((c) => !this.selectedIds.has(c.id));
      this.clearSelection();
      this.recordHistory();
      this.markUnsaved();
      this.requestUpdate();
      return count;
    }

    copySelection() {
      const sel = this.getSelectedComponents();
      if (!sel.length) return 0;
      this.clipboard = sel.map((c) => serializeComponent(c));
      this._pasteOffsetStep = 0;
      this.showToast(`Copied ${sel.length} object${sel.length === 1 ? '' : 's'}`);
      return this.clipboard.length;
    }

    cutSelection() {
      const count = this.copySelection();
      if (count > 0) {
        this.deleteSelection();
        this.showToast(`Cut ${count} object${count === 1 ? '' : 's'}`);
      }
      return count;
    }

    pasteSelection() {
      if (!this.clipboard || this.clipboard.length === 0) return [];
      this._pasteOffsetStep = (this._pasteOffsetStep % 6) + 1;
      const offset = 40 * this._pasteOffsetStep;
      const groupMap = new Map();
      const newComps = [];

      for (const data of this.clipboard) {
        const clone = deserializeComponent(data, false);
        clone.x = Math.round(data.x + offset);
        clone.y = Math.round(data.y + offset);
        clone.locked = false;
        if (data.groupId) {
          if (!groupMap.has(data.groupId)) {
            groupMap.set(data.groupId, 'grp_' + (++this._groupCounter) + '_' + (Date.now() % 10000));
          }
          clone.groupId = groupMap.get(data.groupId);
        }
        this.components.push(clone);
        newComps.push(clone);
      }

      this._setSelectionSet(newComps.map((c) => c.id));
      this.recordHistory();
      this.markUnsaved();
      this.requestUpdate();
      return newComps;
    }

    duplicateSelection() {
      const sel = this.getSelectedComponents();
      if (!sel.length) return [];
      const groupMap = new Map();
      const clones = [];

      for (const src of sel) {
        const copy = cloneComponent(src, 40, 40);
        if (src.groupId) {
          if (!groupMap.has(src.groupId)) {
            groupMap.set(src.groupId, 'grp_' + (++this._groupCounter) + '_' + (Date.now() % 10000));
          }
          copy.groupId = groupMap.get(src.groupId);
        }
        this.components.push(copy);
        clones.push(copy);
      }

      this._setSelectionSet(clones.map((c) => c.id));
      this.recordHistory();
      this.markUnsaved();
      this.requestUpdate();
      return clones;
    }

    getGroupBounds() {
      const sel = this.getSelectedComponents();
      if (sel.length < 2) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let sumX = 0, sumY = 0;

      for (const c of sel) {
        const pad = 42;
        minX = Math.min(minX, c.x - pad);
        minY = Math.min(minY, c.y - pad);
        maxX = Math.max(maxX, c.x + pad);
        maxY = Math.max(maxY, c.y + pad);
        sumX += c.x;
        sumY += c.y;
      }

      const cx = sumX / sel.length;
      const cy = sumY / sel.length;
      return {
        minX,
        minY,
        maxX,
        maxY,
        cx,
        cy,
        handleX: cx,
        handleY: minY - CFG.ROTATION_HANDLE_DIST,
      };
    }

    screenToWorld(sx, sy) {
      return V.create((sx - this.panX) / this.zoom, (sy - this.panY) / this.zoom);
    }

    snapWorld(pos) {
      if (!this.snapEnabled) return { x: Math.round(pos.x), y: Math.round(pos.y) };
      const gs = CFG.GRID_SIZE;
      return V.create(Math.round(pos.x / gs) * gs, Math.round(pos.y / gs) * gs);
    }

    hitTest(worldPos) {
      for (let i = this.components.length - 1; i >= 0; i--) {
        const comp = this.components[i];
        if (this._hitComponent(worldPos, comp)) return comp;
      }
      return null;
    }

    _hitComponent(wp, comp) {
      const local = V.rot(V.sub(wp, { x: comp.x, y: comp.y }), -rad(comp.rotation));
      const pad = CFG.HIT_PADDING;

      if (comp instanceof Laser) {
        const hw = comp.bodyW / 2 + pad;
        const hh = Math.max(comp.bodyH, comp.numRays > 1 ? comp.beamWidth : comp.bodyH) / 2 + pad;
        return Math.abs(local.x) <= hw && Math.abs(local.y) <= hh;
      } else if (comp instanceof PointSource) {
        return V.len(local) <= comp.radius + pad + 4;
      } else if (comp instanceof Lens) {
        const hw = Math.max(comp.thickness, 18) / 2 + pad + 6;
        const hh = comp.aperture / 2 + pad;
        return Math.abs(local.x) <= hw && Math.abs(local.y) <= hh;
      } else if (comp instanceof GlassSphere) {
        return V.len(local) <= comp.radius + pad;
      } else if (comp instanceof PlaneMirror) {
        const hw = comp.thickness + pad + 4;
        const hh = comp.aperture / 2 + pad;
        return Math.abs(local.x) <= hw && Math.abs(local.y) <= hh;
      } else if (comp instanceof CurvedMirror) {
        const R = Math.max(40, comp.radiusOfCurvature);
        const ap = Math.min(comp.aperture, 1.92 * R);
        const halfAngle = Math.asin(Math.min(0.98, ap / (2 * R)));
        const sagitta = R * (1 - Math.cos(halfAngle));
        const hw = sagitta + comp.thickness + pad + 10;
        const hh = ap / 2 + pad;
        return Math.abs(local.x) <= hw && Math.abs(local.y) <= hh;
      } else if (
        comp instanceof ColorFilter ||
        comp instanceof ApertureSlit ||
        comp instanceof BeamBlocker ||
        comp instanceof DiffractionGrating ||
        comp instanceof Polarizer
      ) {
        const hw = comp.thickness / 2 + pad + 6;
        const hh = comp.aperture / 2 + pad;
        return Math.abs(local.x) <= hw && Math.abs(local.y) <= hh;
      } else if (comp instanceof BeamSplitter) {
        const hs = comp.size / 2 + pad;
        return Math.abs(local.x) <= hs && Math.abs(local.y) <= hs;
      } else if (comp instanceof Prism) {
        const verts = comp.getLocalVertices();
        const minX = Math.min(verts[0].x, verts[1].x, verts[2].x) - pad;
        const maxX = Math.max(verts[0].x, verts[1].x, verts[2].x) + pad;
        const minY = Math.min(verts[0].y, verts[1].y, verts[2].y) - pad;
        const maxY = Math.max(verts[0].y, verts[1].y, verts[2].y) + pad;
        return local.x >= minX && local.x <= maxX && local.y >= minY && local.y <= maxY;
      } else if (comp instanceof GlassBlock) {
        const hw = comp.width / 2 + pad;
        const hh = comp.height / 2 + pad;
        return Math.abs(local.x) <= hw && Math.abs(local.y) <= hh;
      } else if (comp instanceof OpticalDetector) {
        const hh = comp.aperture / 2 + pad;
        return local.x >= -pad - 4 && local.x <= comp.bodyW + pad && Math.abs(local.y) <= hh;
      }
      return false;
    }

    _getLocalHandlePos(comp) {
      if (comp instanceof Laser) {
        const boxH = Math.max(comp.bodyH, comp.numRays > 1 ? comp.beamWidth : comp.bodyH);
        return V.create(0, -boxH / 2 - CFG.ROTATION_HANDLE_DIST);
      } else if (comp instanceof PointSource) {
        return V.create(0, -(comp.radius + 8) - CFG.ROTATION_HANDLE_DIST);
      } else if (comp instanceof GlassSphere) {
        return V.create(0, -comp.radius - CFG.ROTATION_HANDLE_DIST);
      } else if (
        comp instanceof Lens ||
        comp instanceof PlaneMirror ||
        comp instanceof CurvedMirror ||
        comp instanceof ColorFilter ||
        comp instanceof ApertureSlit ||
        comp instanceof BeamBlocker ||
        comp instanceof DiffractionGrating ||
        comp instanceof Polarizer
      ) {
        return V.create(0, -comp.aperture / 2 - CFG.ROTATION_HANDLE_DIST);
      } else if (comp instanceof BeamSplitter) {
        return V.create(0, -comp.size / 2 - CFG.ROTATION_HANDLE_DIST);
      } else if (comp instanceof Prism) {
        const verts = comp.getLocalVertices();
        const minY = Math.min(verts[0].y, verts[1].y, verts[2].y);
        return V.create(0, minY - CFG.ROTATION_HANDLE_DIST);
      } else if (comp instanceof GlassBlock) {
        return V.create(0, -comp.height / 2 - CFG.ROTATION_HANDLE_DIST);
      } else if (comp instanceof OpticalDetector) {
        return V.create(comp.bodyW / 2 - 2, -comp.aperture / 2 - CFG.ROTATION_HANDLE_DIST);
      }
      return V.create(0, -50);
    }

    hitRotationHandle(worldPos) {
      if (this.selectedIds.size > 1) {
        const gb = this.getGroupBounds();
        if (!gb) return false;
        return V.dist(worldPos, { x: gb.handleX, y: gb.handleY }) <= (CFG.ROTATION_HANDLE_R + 6) / this.zoom;
      }
      const comp = this.getSelected();
      if (!comp) return false;

      const localHandlePos = this._getLocalHandlePos(comp);
      const worldHandle = V.add({ x: comp.x, y: comp.y }, V.rot(localHandlePos, rad(comp.rotation)));
      return V.dist(worldPos, worldHandle) <= (CFG.ROTATION_HANDLE_R + 5) / this.zoom;
    }

    _bindEvents() {
      const canvas = this.canvas;

      canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
      window.addEventListener('pointermove', (e) => this._onPointerMove(e));
      window.addEventListener('pointerup', (e) => this._onPointerUp(e));
      canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      window.addEventListener('keydown', (e) => this._onKeyDown(e));
      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') this._spacePressed = false;
      });

      document.querySelectorAll('.component-card').forEach((card) => {
        const infoBtn = card.querySelector('.cc-info-btn');
        if (infoBtn) {
          infoBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
          });
          infoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openComponentInfo(card.dataset.type);
          });
        }

        card.addEventListener('pointerdown', (e) => {
          if (e.target && e.target.closest('.cc-info-btn')) return;
          e.preventDefault();
          const type = card.dataset.type;
          this._dragFromSidebar = {
            type,
            active: true,
            worldX: 0,
            worldY: 0,
            overCanvas: false,
          };
          this.canvas.style.cursor = 'copy';
        });
      });

      const modalCompInfo = document.getElementById('modal-comp-info');
      const btnCloseCompInfo = document.getElementById('btn-close-comp-info');
      const btnCloseCompInfoFooter = document.getElementById('btn-comp-info-close-footer');
      const btnAddCompInfo = document.getElementById('btn-comp-info-add');
      const closeCompInfo = () => {
        if (modalCompInfo) modalCompInfo.style.display = 'none';
      };
      if (modalCompInfo) {
        modalCompInfo.addEventListener('click', (e) => {
          if (e.target === modalCompInfo) closeCompInfo();
        });
      }
      if (btnCloseCompInfo) btnCloseCompInfo.addEventListener('click', closeCompInfo);
      if (btnCloseCompInfoFooter) btnCloseCompInfoFooter.addEventListener('click', closeCompInfo);
      if (btnAddCompInfo) {
        btnAddCompInfo.addEventListener('click', () => {
          const type = this._activeInfoType;
          if (!type) return;
          const center = this.snapWorld(
            this.screenToWorld(this.renderer.width / 2, this.renderer.height / 2)
          );
          const comp = createComponent(type, center.x, center.y);
          this.components.push(comp);
          this.selectComponent(comp);
          this.recordHistory();
          this.markUnsaved();
          this.requestUpdate();
          closeCompInfo();
          const info = i18n.getComponentInfo(type);
          this.showToast(i18n.t('toastAddedToBench', { name: info ? info.title : type }));
        });
      }

      const nameInput = document.getElementById('project-name-input');
      if (nameInput) {
        nameInput.addEventListener('input', () => {
          this.projectName = nameInput.value.trim() || 'Untitled Project';
          this.markUnsaved();
        });
        nameInput.addEventListener('change', () => {
          this.saveCurrentProject(true);
        });
      }

      const btnProjects = document.getElementById('btn-projects');
      if (btnProjects) btnProjects.addEventListener('click', () => this.openProjectsModal());

      const btnSave = document.getElementById('btn-save');
      if (btnSave) btnSave.addEventListener('click', () => this.saveCurrentProject(false));

      const btnExport = document.getElementById('btn-export');
      if (btnExport) btnExport.addEventListener('click', () => this.exportOptpFile());

      const fileInput = document.getElementById('optp-file-input');
      const triggerImportDialog = () => {
        if (fileInput) {
          fileInput.value = '';
          fileInput.click();
        }
      };
      const btnImport = document.getElementById('btn-import');
      if (btnImport) btnImport.addEventListener('click', triggerImportDialog);

      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              this.importOptpString(String(ev.target.result || ''));
              const projModal = document.getElementById('modal-projects');
              if (projModal) projModal.style.display = 'none';
            } catch (err) {
              // Error already toasted
            }
          };
          reader.readAsText(file);
        });
      }

      const btnUndo = document.getElementById('btn-undo');
      const btnRedo = document.getElementById('btn-redo');
      if (btnUndo) btnUndo.addEventListener('click', () => this.undo());
      if (btnRedo) btnRedo.addEventListener('click', () => this.redo());

      // Projects & Shortcuts Modal controls
      const btnCloseProjects = document.getElementById('btn-close-projects');
      const modalProjects = document.getElementById('modal-projects');
      if (btnCloseProjects && modalProjects) {
        btnCloseProjects.addEventListener('click', () => { modalProjects.style.display = 'none'; });
      }
      const btnModalNewProj = document.getElementById('btn-modal-new-proj');
      if (btnModalNewProj && modalProjects) {
        btnModalNewProj.addEventListener('click', () => {
          modalProjects.style.display = 'none';
          this.createNewProject();
        });
      }
      const btnModalImportProj = document.getElementById('btn-modal-import-proj');
      if (btnModalImportProj) {
        btnModalImportProj.addEventListener('click', triggerImportDialog);
      }

      const projSearchInput = document.getElementById('project-search-input');
      if (projSearchInput) {
        projSearchInput.addEventListener('input', () => {
          this.openProjectsModal();
        });
      }

      const optpDropzone = document.getElementById('optp-dropzone');
      if (optpDropzone) {
        optpDropzone.addEventListener('click', triggerImportDialog);
        optpDropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          optpDropzone.classList.add('dragover');
        });
        optpDropzone.addEventListener('dragleave', () => {
          optpDropzone.classList.remove('dragover');
        });
        optpDropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          optpDropzone.classList.remove('dragover');
          const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              this.importOptpString(String(ev.target.result || ''));
              if (modalProjects) modalProjects.style.display = 'none';
            } catch (_err) {
              // Error already toasted
            }
          };
          reader.readAsText(file);
        });
      }

      if (modalProjects) {
        modalProjects.addEventListener('click', (e) => {
          if (e.target === modalProjects) modalProjects.style.display = 'none';
        });
      }

      const btnShortcuts = document.getElementById('btn-shortcuts');
      const modalShortcuts = document.getElementById('modal-shortcuts');
      const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
      if (btnShortcuts && modalShortcuts) {
        btnShortcuts.addEventListener('click', () => { modalShortcuts.style.display = 'flex'; });
        modalShortcuts.addEventListener('click', (e) => {
          if (e.target === modalShortcuts) modalShortcuts.style.display = 'none';
        });
      }
      if (btnCloseShortcuts && modalShortcuts) {
        btnCloseShortcuts.addEventListener('click', () => { modalShortcuts.style.display = 'none'; });
      }

      const btnTheme = document.getElementById('btn-theme');
      if (btnTheme) {
        btnTheme.addEventListener('click', () => {
          this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
          this.showToast(i18n.t(this.theme === 'dark' ? 'toastThemeDark' : 'toastThemeLight'));
        });
      }

      document.querySelectorAll('.lang-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const nextLang = btn.dataset.lang;
          if (nextLang && nextLang !== this.lang) {
            this.setLanguage(nextLang, false);
          }
        });
      });

      // Floating Multi-Selection Toolbar bindings
      const bindMtb = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
      };
      bindMtb('mtb-group', () => this.groupSelection());
      bindMtb('mtb-ungroup', () => this.ungroupSelection());
      bindMtb('mtb-rot-ccw', () => this.rotateSelectedBy(-15, true));
      bindMtb('mtb-rot-cw', () => this.rotateSelectedBy(15, true));
      bindMtb('mtb-align-h', () => this.alignSelection('horizontal'));
      bindMtb('mtb-align-v', () => this.alignSelection('vertical'));
      bindMtb('mtb-dup', () => this.duplicateSelection());
      bindMtb('mtb-del', () => this.deleteSelection());

      const btnSnap = document.getElementById('btn-snap');
      if (btnSnap) {
        btnSnap.addEventListener('click', () => {
          this.snapEnabled = !this.snapEnabled;
          btnSnap.classList.toggle('active', this.snapEnabled);
          this.propsPanel.renderBenchOverview();
          this.markUnsaved();
        });
      }

      const btnFoci = document.getElementById('btn-foci');
      if (btnFoci) {
        btnFoci.addEventListener('click', () => {
          this.renderer.showFocalPoints = !this.renderer.showFocalPoints;
          btnFoci.classList.toggle('active', this.renderer.showFocalPoints);
          this.propsPanel.renderBenchOverview();
          this.markUnsaved();
          this.requestUpdate();
        });
      }

      const btnResetView = document.getElementById('btn-reset-view');
      if (btnResetView) {
        btnResetView.addEventListener('click', () => {
          this._centerViewport();
          this.requestUpdate();
        });
      }

      const btnClear = document.getElementById('btn-clear');
      if (btnClear) {
        btnClear.addEventListener('click', () => {
          if (this.components.length === 0) return;
          this.components = [];
          this.clearSelection();
          this.recordHistory();
          this.markUnsaved();
          this.requestUpdate();
        });
      }

      const presetSelect = document.getElementById('preset-select');
      if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
          if (e.target.value) {
            this.loadPreset(e.target.value, true);
            e.target.value = '';
          }
        });
      }

      const btnZoomIn = document.getElementById('btn-zoom-in');
      const btnZoomOut = document.getElementById('btn-zoom-out');
      const zoomLevel = document.getElementById('zoom-level');
      if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
          this._applyZoom(1.2, this.renderer.width / 2, this.renderer.height / 2);
        });
      }
      if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
          this._applyZoom(1 / 1.2, this.renderer.width / 2, this.renderer.height / 2);
        });
      }
      if (zoomLevel) {
        zoomLevel.addEventListener('click', () => {
          this._centerViewport();
          this.requestUpdate();
        });
      }

      window.addEventListener('resize', () => {
        this.renderer.resize();
        this.requestUpdate();
      });

      // Optional Electron Desktop IPC integration (no-op in browser)
      if (typeof window !== 'undefined' && window.optiLabDesktop && window.optiLabDesktop.isDesktop) {
        window.optiLabDesktop.onMenuAction(({ action, payload }) => {
          if (action === 'new-project') this.createNewProject();
          else if (action === 'open-projects') this.openProjectsModal();
          else if (action === 'save-project') this.saveCurrentProject(false);
          else if (action === 'export-optp') this.exportOptpFile();
          else if (action === 'undo') this.undo();
          else if (action === 'redo') this.redo();
          else if (action === 'load-preset' && payload) this.loadPreset(payload, true);
          else if (action === 'toggle-theme') {
            this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
            this.showToast(i18n.t(this.theme === 'dark' ? 'toastThemeDark' : 'toastThemeLight'));
          } else if (action === 'set-lang' && payload) {
            this.setLanguage(payload, false);
          } else if (action === 'open-shortcuts') {
            const modalShortcuts = document.getElementById('modal-shortcuts');
            if (modalShortcuts) modalShortcuts.style.display = 'flex';
          }
        });

        window.optiLabDesktop.onOpenOptpContent(({ content }) => {
          if (content) this.importOptpString(content, false);
        });
      }
    }

    _getCanvasPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      return V.create(e.clientX - rect.left, e.clientY - rect.top);
    }

    _isOverCanvas(e) {
      const rect = this.canvas.getBoundingClientRect();
      return (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
    }

    _onPointerDown(e) {
      if (e.button === 1 || (e.button === 0 && this._spacePressed)) {
        e.preventDefault();
        this._interaction = {
          type: 'pan',
          startX: e.clientX,
          startY: e.clientY,
          startPanX: this.panX,
          startPanY: this.panY,
        };
        this.canvas.classList.add('panning');
        return;
      }

      if (e.button !== 0) return;

      const sp = this._getCanvasPos(e);
      const wp = this.screenToWorld(sp.x, sp.y);

      if (this._dragFromSidebar && this._dragFromSidebar.active) return;

      if (this.hitRotationHandle(wp)) {
        if (this.selectedIds.size > 1) {
          const sel = this.getSelectedComponents().filter((c) => !c.locked);
          if (sel.length > 0) {
            const cx = sel.reduce((s, c) => s + c.x, 0) / sel.length;
            const cy = sel.reduce((s, c) => s + c.y, 0) / sel.length;
            const startAngle = deg(Math.atan2(wp.y - cy, wp.x - cx));
            this._interaction = {
              type: 'rotate-group',
              cx,
              cy,
              startAngle,
              items: sel.map((c) => ({ comp: c, x0: c.x, y0: c.y, rot0: c.rotation })),
              moved: false,
            };
          }
          return;
        }
        const comp = this.getSelected();
        if (comp && !comp.locked) {
          this._interaction = { type: 'rotate', comp, moved: false };
        }
        return;
      }

      const hit = this.hitTest(wp);
      if (hit) {
        if (e.ctrlKey || e.metaKey) {
          this.toggleSelectComponent(hit);
          return;
        }
        if (e.shiftKey) {
          this.addSelectComponent(hit);
          return;
        }
        if (!this.selectedIds.has(hit.id)) {
          this.selectComponent(hit);
        } else {
          this.selectedId = hit.id;
        }

        const movable = this.getSelectedComponents().filter((c) => !c.locked);
        if (movable.length > 0) {
          this._interaction = {
            type: 'move-multi',
            anchor: hit,
            offsetX: hit.x - wp.x,
            offsetY: hit.y - wp.y,
            items: movable.map((c) => ({ comp: c, dx: c.x - hit.x, dy: c.y - hit.y })),
            moved: false,
          };
        }
        return;
      }

      // Clicked empty workspace: start Marquee Selection box (or pan if Alt held)
      if (e.altKey) {
        this._interaction = {
          type: 'pan',
          startX: e.clientX,
          startY: e.clientY,
          startPanX: this.panX,
          startPanY: this.panY,
        };
        this.canvas.classList.add('panning');
        return;
      }

      const additive = e.ctrlKey || e.metaKey || e.shiftKey;
      const baseSet = additive ? new Set(this.selectedIds) : new Set();
      if (!additive) {
        this.clearSelection();
      }
      this.marqueeRect = { x0: wp.x, y0: wp.y, x1: wp.x, y1: wp.y };
      this._interaction = {
        type: 'marquee',
        startWorld: wp,
        baseSet,
      };
      this.requestUpdate();
    }

    _onPointerMove(e) {
      const sp = this._getCanvasPos(e);
      const wp = this.screenToWorld(sp.x, sp.y);

      const coordEl = document.getElementById('status-coords');
      if (coordEl && this._isOverCanvas(e)) {
        coordEl.textContent = `X: ${Math.round(wp.x)}  Y: ${Math.round(wp.y)}`;
      }

      if (this._dragFromSidebar && this._dragFromSidebar.active) {
        const snapped = this.snapWorld(wp);
        this._dragFromSidebar.worldX = snapped.x;
        this._dragFromSidebar.worldY = snapped.y;
        this._dragFromSidebar.overCanvas = this._isOverCanvas(e);
        this.requestUpdate();
        return;
      }

      if (this._interaction) {
        const inter = this._interaction;
        if (inter.type === 'pan') {
          this.panX = inter.startPanX + (e.clientX - inter.startX);
          this.panY = inter.startPanY + (e.clientY - inter.startY);
          this.requestUpdate();
        } else if (inter.type === 'move-multi') {
          const raw = V.create(wp.x + inter.offsetX, wp.y + inter.offsetY);
          const pos = this.snapWorld(raw);
          for (const item of inter.items) {
            item.comp.x = Math.round(pos.x + item.dx);
            item.comp.y = Math.round(pos.y + item.dy);
          }
          inter.moved = true;
          this.markUnsaved();
          if (inter.items.length === 1) {
            this.propsPanel.refreshValues(inter.anchor);
          }
          this.requestUpdate();
        } else if (inter.type === 'rotate') {
          const dx = wp.x - inter.comp.x;
          const dy = wp.y - inter.comp.y;
          let angle = deg(Math.atan2(dy, dx)) + 90;
          if (e.shiftKey) angle = Math.round(angle / 15) * 15;
          inter.comp.rotation = normAngle(angle);
          inter.moved = true;
          this.markUnsaved();
          this.propsPanel.refreshValues(inter.comp);
          this.requestUpdate();
        } else if (inter.type === 'rotate-group') {
          const curAngle = deg(Math.atan2(wp.y - inter.cy, wp.x - inter.cx));
          let delta = curAngle - inter.startAngle;
          if (e.shiftKey) delta = Math.round(delta / 15) * 15;
          const dRad = rad(delta);
          for (const item of inter.items) {
            const rel = V.rot({ x: item.x0 - inter.cx, y: item.y0 - inter.cy }, dRad);
            item.comp.x = Math.round(inter.cx + rel.x);
            item.comp.y = Math.round(inter.cy + rel.y);
            item.comp.rotation = normAngle(item.rot0 + delta);
          }
          inter.moved = true;
          this.markUnsaved();
          this.requestUpdate();
        } else if (inter.type === 'marquee') {
          this.marqueeRect = {
            x0: inter.startWorld.x,
            y0: inter.startWorld.y,
            x1: wp.x,
            y1: wp.y,
          };
          const minX = Math.min(this.marqueeRect.x0, this.marqueeRect.x1);
          const maxX = Math.max(this.marqueeRect.x0, this.marqueeRect.x1);
          const minY = Math.min(this.marqueeRect.y0, this.marqueeRect.y1);
          const maxY = Math.max(this.marqueeRect.y0, this.marqueeRect.y1);

          const nextSet = new Set(inter.baseSet);
          for (const c of this.components) {
            if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
              for (const gid of this._expandGroupIds(c)) nextSet.add(gid);
            }
          }
          this._setSelectionSet(nextSet);
          this.requestUpdate();
        }
        return;
      }

      if (this._isOverCanvas(e)) {
        if (this.hitRotationHandle(wp)) {
          this.canvas.className = 'hover-rotate';
        } else {
          const hit = this.hitTest(wp);
          const newHoverId = hit ? hit.id : null;
          if (newHoverId !== this.hoveredId) {
            this.hoveredId = newHoverId;
            this.requestUpdate();
          }
          this.canvas.className = hit ? 'hover-item' : '';
        }
      }
    }

    _onPointerUp(e) {
      if (this._dragFromSidebar && this._dragFromSidebar.active) {
        if (this._isOverCanvas(e)) {
          const sp = this._getCanvasPos(e);
          const wp = this.screenToWorld(sp.x, sp.y);
          const pos = this.snapWorld(wp);
          const comp = createComponent(this._dragFromSidebar.type, pos.x, pos.y);
          this.components.push(comp);
          this.selectComponent(comp);
          this.recordHistory();
          this.markUnsaved();
        }
        this._dragFromSidebar = null;
        this.canvas.style.cursor = '';
        this.requestUpdate();
        return;
      }

      if (this._interaction) {
        const inter = this._interaction;
        if (inter.moved) {
          this.recordHistory();
          this._syncSelectionUI();
        }
        this.marqueeRect = null;
        this.canvas.classList.remove('panning');
        this._interaction = null;
        this.requestUpdate();
      }
    }

    _onWheel(e) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? CFG.ZOOM_FACTOR : 1 / CFG.ZOOM_FACTOR;
      const sp = this._getCanvasPos(e);
      this._applyZoom(factor, sp.x, sp.y);
    }

    _applyZoom(factor, screenX, screenY) {
      const oldZoom = this.zoom;
      this.zoom = clamp(this.zoom * factor, CFG.MIN_ZOOM, CFG.MAX_ZOOM);
      const ratio = this.zoom / oldZoom;
      this.panX = screenX - (screenX - this.panX) * ratio;
      this.panY = screenY - (screenY - this.panY) * ratio;
      this._updateZoomUI();
      this.requestUpdate();
    }

    _updateZoomUI() {
      const el = document.getElementById('zoom-level');
      if (el) el.textContent = `${Math.round(this.zoom * 100)}%`;
    }

    _onKeyDown(e) {
      const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        this._spacePressed = true;
      }

      const cmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // 1. Project Shortcuts: Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+N
      if (cmd && key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          this.exportOptpFile();
        } else {
          this.saveCurrentProject(false);
        }
        return;
      }
      if (cmd && key === 'o') {
        e.preventDefault();
        const fileInput = document.getElementById('optp-file-input');
        if (fileInput) {
          fileInput.value = '';
          fileInput.click();
        }
        return;
      }
      if (cmd && key === 'n') {
        e.preventDefault();
        this.createNewProject();
        return;
      }

      // 2. Undo / Redo: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z
      if (cmd && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
        return;
      }
      if (cmd && key === 'y') {
        e.preventDefault();
        this.redo();
        return;
      }

      // 3. Selection & Grouping: Ctrl+A, Ctrl+G, Ctrl+Shift+G
      if (cmd && key === 'a') {
        e.preventDefault();
        this.selectAll();
        return;
      }
      if (cmd && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) this.ungroupSelection();
        else this.groupSelection();
        return;
      }

      // 4. Editing: Ctrl+D, Ctrl+C, Ctrl+V, Ctrl+X, Delete / Backspace
      if (cmd && key === 'd') {
        e.preventDefault();
        this.duplicateSelection();
        return;
      }
      if (cmd && key === 'c') {
        e.preventDefault();
        this.copySelection();
        return;
      }
      if (cmd && key === 'v') {
        e.preventDefault();
        this.pasteSelection();
        return;
      }
      if (cmd && key === 'x') {
        e.preventDefault();
        this.cutSelection();
        return;
      }

      if (!cmd && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (this.selectedIds.size > 0) {
          e.preventDefault();
          this.deleteSelection();
        }
        return;
      }

      // 5. Escape: close modals or clear selection
      if (e.key === 'Escape') {
        const modals = ['modal-comp-info', 'modal-projects', 'modal-shortcuts', 'modal-confirm'];
        for (const mid of modals) {
          const m = document.getElementById(mid);
          if (m && m.style.display !== 'none') {
            m.style.display = 'none';
            return;
          }
        }
        this.clearSelection();
        if (this._dragFromSidebar) {
          this._dragFromSidebar = null;
          this.canvas.style.cursor = '';
          this.requestUpdate();
        }
        return;
      }

      // 6. Step Rotate: R / Shift+R
      if (!cmd && (e.key === 'r' || e.key === 'R')) {
        if (this.selectedIds.size > 0) {
          this.rotateSelectedBy(e.shiftKey ? -15 : 15, true);
        }
        return;
      }

      // 7. View Zoom Shortcuts: +, -, 0, ?
      if (!cmd && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        this._applyZoom(1.2, this.renderer.width / 2, this.renderer.height / 2);
        return;
      }
      if (!cmd && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        this._applyZoom(1 / 1.2, this.renderer.width / 2, this.renderer.height / 2);
        return;
      }
      if (!cmd && e.key === '0') {
        e.preventDefault();
        this._centerViewport();
        this.requestUpdate();
        return;
      }
      if (!cmd && e.key === '?') {
        const modalShortcuts = document.getElementById('modal-shortcuts');
        if (modalShortcuts) modalShortcuts.style.display = 'flex';
      }
    }

    _loop() {
      if (this._needsUpdate) {
        this._needsUpdate = false;
        this._render();
      }
      requestAnimationFrame(() => this._loop());
    }

    _render() {
      this.rayTracer.trace(this.components);

      const sel = this.getSelected();
      if (this.selectedIds.size === 1 && sel instanceof OpticalDetector) {
        this.propsPanel.refreshDetectorTelemetry(sel);
      } else if (this.selectedIds.size === 0) {
        const ovRays = document.getElementById('overview-rays');
        if (ovRays) ovRays.textContent = this.rayTracer.segments.length;
      }

      this.renderer.clear();
      this.renderer.drawGrid(this.panX, this.panY, this.zoom);
      this.renderer.drawRays(this.rayTracer.segments, this.panX, this.panY, this.zoom);
      this.renderer.drawComponents(
        this.components,
        this.selectedIds,
        this.hoveredId,
        this.panX,
        this.panY,
        this.zoom
      );

      if (this.selectedIds.size > 1) {
        this.renderer.drawGroupSelection(this.getGroupBounds(), this.panX, this.panY, this.zoom);
      }

      if (this.marqueeRect) {
        this.renderer.drawMarquee(this.marqueeRect, this.panX, this.panY, this.zoom);
      }

      if (this._dragFromSidebar && this._dragFromSidebar.active && this._dragFromSidebar.overCanvas) {
        this.renderer.drawDragPreview(
          this._dragFromSidebar.type,
          this._dragFromSidebar.worldX,
          this._dragFromSidebar.worldY,
          this.panX,
          this.panY,
          this.zoom
        );
      }

      const countEl = document.getElementById('status-count');
      const rayEl = document.getElementById('status-rays');
      if (countEl) countEl.textContent = this.components.length;
      if (rayEl) rayEl.textContent = this.rayTracer.segments.length;
    }
  }

  global.OptiLab.ProjectStorage = ProjectStorage;
  global.OptiLab.HistoryManager = HistoryManager;
  global.OptiLab.OptiLabApp = OptiLabApp;

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('DOMContentLoaded', () => {
      window.optiLab = new OptiLabApp();
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
