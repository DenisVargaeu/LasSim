/**
 * OptiLab — Node-Based Logic Editor UI & Renderer (logic-editor.js)
 *
 * Professional visual node editor inspired by Unreal Engine Blueprints
 * and Blender Geometry Nodes.
 *
 * Features:
 *  - Infinite pan & zoom canvas with dual-tier grid
 *  - Curved cubic Bezier wires with category colors and animated flow pulses
 *  - Interactive socket connection dragging & snapping
 *  - Multi-node selection & group moving
 *  - Marquee selection rectangle
 *  - Searchable node library modal (category filtering, instant search)
 *  - Live execution glow indicators
 *  - Interactive minimap
 *  - Integrated debug console drawer
 */

(function (global) {
  'use strict';

  const {
    SOCKET_TYPES,
    SOCKET_COLORS,
    CATEGORIES,
    NODE_DEFS,
    LogicNode,
    LogicWire,
    LogicEngine,
  } = global.OptiLab;

  class LogicEditor {
    constructor(app, containerEl) {
      this.app = app;
      this.container = containerEl; // #logic-workspace element
      this.engine = new LogicEngine(app);

      // Viewport Pan & Zoom
      this.panX = 140;
      this.panY = 120;
      this.zoom = 1.0;
      this.minZoom = 0.25;
      this.maxZoom = 2.0;

      // Selection state
      this.selectedNodeIds = new Set();
      this.selectedWireId = null;

      // Dragging state
      this.isPanning = false;
      this.panStartX = 0;
      this.panStartY = 0;
      this.isDraggingNodes = false;
      this.dragStartMouse = { x: 0, y: 0 };
      this.nodeInitialPositions = new Map();

      // Marquee selection
      this.isMarquee = false;
      this.marqueeStart = { x: 0, y: 0 };
      this.marqueeCurrent = { x: 0, y: 0 };

      // Wire pulling state
      this.connectingWire = null; // { fromNodeId, fromSocketId, fromType, isOutput, startX, startY, currentX, currentY }

      // DOM Elements cache
      this.bgCanvas = null;
      this.bgCtx = null;
      this.wiresSvg = null;
      this.nodesContainer = null;
      this.minimapCanvas = null;
      this.minimapCtx = null;
      this.searchModal = null;
      this.consoleDrawer = null;

      this.nodeElements = new Map(); // nodeId -> HTMLElement

      // Animation frame loop
      this._animFrame = null;
      this._needsRedraw = true;

      // Initialize UI
      this._buildUI();
      this._bindEvents();
      this._startRenderLoop();

      // Wire engine callbacks
      this.engine.onLogCallback = () => this._refreshConsoleLogs();
      this.engine.onExecutionStateChange = (running) => this._updateRunningUI(running);
    }

    // ── Build HTML Structure for Logic Workspace ──
    _buildUI() {
      this.container.innerHTML = `
        <!-- Logic Top Toolbar -->
        <div class="logic-toolbar" id="logic-toolbar">
          <div class="logic-tb-group">
            <button class="tb-btn primary" id="btn-logic-play" title="Run / Pause Visual Logic Simulation (Space)">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span id="logic-play-label">Run</span>
            </button>

            <button class="tb-btn" id="btn-logic-step" title="Step Logic Execution (Single Tick)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polygon points="5 4 15 12 5 20 5 4" fill="currentColor"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
              </svg>
              Step
            </button>

            <button class="tb-btn" id="btn-logic-reset" title="Reset Logic State &amp; Variables">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              Reset
            </button>

            <div class="logic-live-badge running" id="logic-engine-status">IDLE</div>
          </div>

          <div class="divider-v"></div>

          <div class="logic-tb-group">
            <button class="tb-btn" id="btn-logic-add-node" title="Open Node Catalog (Space / Right-Click)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Node
            </button>

            <button class="tb-btn" id="btn-logic-example" title="Load Default Optical Sensor → LED Working Graph">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              Example Graph
            </button>

            <button class="tb-btn danger" id="btn-logic-clear" title="Clear all nodes and wires">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear
            </button>
          </div>

          <div class="divider-v"></div>

          <div class="logic-tb-group">
            <button class="hud-btn" id="btn-logic-zoom-out" title="Zoom out (−)">−</button>
            <span id="logic-zoom-label" class="logic-zoom-pill" title="Reset Zoom (0)">100%</span>
            <button class="hud-btn" id="btn-logic-zoom-in" title="Zoom in (+)">+</button>
            <button class="tb-btn" id="btn-logic-center" title="Center graph">Center</button>
          </div>

          <div class="divider-v"></div>

          <div class="logic-tb-group" style="margin-left:auto">
            <button class="tb-btn" id="btn-toggle-console" title="Toggle Logic Debug Console Drawer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
              Console <span class="badge-count" id="logic-console-count">0</span>
            </button>
          </div>
        </div>

        <!-- Interactive Infinite Viewport Area -->
        <div class="logic-viewport" id="logic-viewport">
          <canvas id="logic-canvas-bg" class="logic-canvas-bg"></canvas>
          <svg id="logic-wires-svg" class="logic-wires-svg"></svg>
          <div id="logic-nodes-container" class="logic-nodes-container"></div>
          <div id="logic-marquee" class="logic-marquee" style="display:none"></div>

          <!-- Minimap in bottom-right corner -->
          <div class="logic-minimap-wrap" id="logic-minimap-wrap" title="Minimap (drag to pan)">
            <canvas id="logic-minimap" width="150" height="100"></canvas>
            <div id="logic-minimap-view" class="logic-minimap-view"></div>
          </div>
        </div>

        <!-- Searchable Node Catalog Context Modal -->
        <div class="logic-search-backdrop" id="logic-search-modal" style="display:none">
          <div class="logic-search-dialog">
            <div class="logic-search-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="logic-search-input" placeholder="Search nodes (e.g. Branch, Sensor, LED, Math, Delay)..." autocomplete="off" />
              <button class="modal-close" id="btn-close-search" title="Close (Esc)">&times;</button>
            </div>
            <div class="logic-cat-tabs" id="logic-cat-tabs">
              <button class="cat-tab active" data-cat="all">All</button>
              <button class="cat-tab" data-cat="events">Events</button>
              <button class="cat-tab" data-cat="inputs">Optical Inputs</button>
              <button class="cat-tab" data-cat="logic">Logic</button>
              <button class="cat-tab" data-cat="math">Math</button>
              <button class="cat-tab" data-cat="variables">Variables</button>
              <button class="cat-tab" data-cat="outputs">LED Outputs</button>
              <button class="cat-tab" data-cat="utilities">Utilities</button>
            </div>
            <div class="logic-search-list" id="logic-search-list"></div>
          </div>
        </div>

        <!-- Collapsible Logic Debug Console Drawer -->
        <div class="logic-console-drawer" id="logic-console-drawer" style="display:none">
          <div class="console-drawer-header">
            <div class="console-header-left">
              <span class="console-title">Logic Debug Output</span>
              <span class="console-sub" id="console-sub-count">0 messages</span>
            </div>
            <div class="console-header-actions">
              <button class="tb-btn small" id="btn-clear-console">Clear</button>
              <button class="tb-btn small icon-only" id="btn-close-console">&times;</button>
            </div>
          </div>
          <div class="console-drawer-body" id="console-logs-container">
            <div class="console-empty">No debug output yet. Use "Print / Debug" nodes to log signals here.</div>
          </div>
        </div>
      `;

      this.viewport = this.container.querySelector('#logic-viewport');
      this.bgCanvas = this.container.querySelector('#logic-canvas-bg');
      this.bgCtx = this.bgCanvas.getContext('2d');
      this.wiresSvg = this.container.querySelector('#logic-wires-svg');
      this.nodesContainer = this.container.querySelector('#logic-nodes-container');
      this.marqueeEl = this.container.querySelector('#logic-marquee');
      this.minimapCanvas = this.container.querySelector('#logic-minimap');
      this.minimapCtx = this.minimapCanvas.getContext('2d');
      this.minimapView = this.container.querySelector('#logic-minimap-view');
      this.searchModal = this.container.querySelector('#logic-search-modal');
      this.consoleDrawer = this.container.querySelector('#logic-console-drawer');

      this._resizeCanvases();
    }

    _resizeCanvases() {
      if (!this.viewport) return;
      const rect = this.viewport.getBoundingClientRect();
      const w = Math.max(300, rect.width);
      const h = Math.max(300, rect.height);

      if (this.bgCanvas) {
        this.bgCanvas.width = w;
        this.bgCanvas.height = h;
      }
      this._needsRedraw = true;
    }

    // ── Event Binding ──
    _bindEvents() {
      window.addEventListener('resize', () => {
        this._resizeCanvases();
        this._updateTransform();
      });

      // Viewport Panning & Zooming
      this.viewport.addEventListener('mousedown', (e) => this._onViewportMouseDown(e));
      window.addEventListener('mousemove', (e) => this._onWindowMouseMove(e));
      window.addEventListener('mouseup', (e) => this._onWindowMouseUp(e));
      this.viewport.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

      // Context menu for adding nodes
      this.viewport.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._openSearchModal(e.clientX, e.clientY);
      });

      // Toolbar Buttons
      const btnPlay = this.container.querySelector('#btn-logic-play');
      if (btnPlay) {
        btnPlay.addEventListener('click', () => {
          if (this.engine.running) {
            this.engine.stop();
          } else {
            this.engine.start();
          }
        });
      }

      const btnStep = this.container.querySelector('#btn-logic-step');
      if (btnStep) btnStep.addEventListener('click', () => this.engine.step());

      const btnReset = this.container.querySelector('#btn-logic-reset');
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          this.engine.reset();
          this._renderAllNodes();
          this._needsRedraw = true;
        });
      }

      const btnAddNode = this.container.querySelector('#btn-logic-add-node');
      if (btnAddNode) {
        btnAddNode.addEventListener('click', () => {
          const rect = this.viewport.getBoundingClientRect();
          this._openSearchModal(rect.left + rect.width / 2 - 160, rect.top + 80);
        });
      }

      const btnExample = this.container.querySelector('#btn-logic-example');
      if (btnExample) {
        btnExample.addEventListener('click', () => {
          // Identify any detector and laser on bench to bind properties
          const det = this.app.components ? this.app.components.find((c) => c.type === 'optical-detector') : null;
          const laser = this.app.components
            ? this.app.components.find((c) => c.type === 'laser' || c.type === 'rgb-led' || c.type === 'white-led')
            : null;
          this.engine.loadExampleGraph(det ? det.id : '', laser ? laser.id : '');
          this.panX = 100;
          this.panY = 100;
          this.zoom = 1.0;
          this._renderAllNodes();
          this._needsRedraw = true;
          this.app.showToast('Loaded working Optical Logic Example Graph', 'success');
        });
      }

      const btnClear = this.container.querySelector('#btn-logic-clear');
      if (btnClear) {
        btnClear.addEventListener('click', () => {
          this.engine.clear();
          this.selectedNodeIds.clear();
          this.selectedWireId = null;
          this._renderAllNodes();
          this._needsRedraw = true;
          this.app.showToast('Cleared logic graph', 'info');
        });
      }

      // Zoom Controls
      const btnZoomIn = this.container.querySelector('#btn-logic-zoom-in');
      const btnZoomOut = this.container.querySelector('#btn-logic-zoom-out');
      const btnCenter = this.container.querySelector('#btn-logic-center');
      const zoomPill = this.container.querySelector('#logic-zoom-label');

      if (btnZoomIn) btnZoomIn.addEventListener('click', () => this._zoomStep(1.2));
      if (btnZoomOut) btnZoomOut.addEventListener('click', () => this._zoomStep(1 / 1.2));
      if (zoomPill) {
        zoomPill.addEventListener('click', () => {
          this.zoom = 1.0;
          this._updateTransform();
        });
      }
      if (btnCenter) {
        btnCenter.addEventListener('click', () => {
          this.panX = 140;
          this.panY = 120;
          this.zoom = 1.0;
          this._updateTransform();
        });
      }

      // Console Drawer Toggle
      const btnConsole = this.container.querySelector('#btn-toggle-console');
      const btnCloseConsole = this.container.querySelector('#btn-close-console');
      const btnClearConsole = this.container.querySelector('#btn-clear-console');

      if (btnConsole) {
        btnConsole.addEventListener('click', () => {
          const isOpen = this.consoleDrawer.style.display !== 'none';
          this.consoleDrawer.style.display = isOpen ? 'none' : 'flex';
          btnConsole.classList.toggle('active', !isOpen);
        });
      }
      if (btnCloseConsole) {
        btnCloseConsole.addEventListener('click', () => {
          this.consoleDrawer.style.display = 'none';
          if (btnConsole) btnConsole.classList.remove('active');
        });
      }
      if (btnClearConsole) {
        btnClearConsole.addEventListener('click', () => {
          this.engine.clearLogs();
        });
      }

      // Search Modal Events
      this._bindSearchModalEvents();

      // Keyboard shortcuts
      window.addEventListener('keydown', (e) => this._onKeyDown(e));
    }

    _bindSearchModalEvents() {
      const modal = this.searchModal;
      const input = modal.querySelector('#logic-search-input');
      const closeBtn = modal.querySelector('#btn-close-search');
      const catTabs = modal.querySelectorAll('.cat-tab');

      closeBtn.addEventListener('click', () => this._closeSearchModal());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this._closeSearchModal();
      });

      input.addEventListener('input', () => this._filterSearchList());

      catTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          catTabs.forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          this._filterSearchList();
        });
      });
    }

    // ── Mouse & Touch Viewport Interactions ──
    _onViewportMouseDown(e) {
      // If clicking inside a node card, let node handlers handle selection/drag
      if (e.target.closest('.logic-node')) return;

      const isMiddle = e.button === 1;
      const isSpace = e.spaceKey;
      const isShift = e.shiftKey;

      if (isMiddle || isSpace) {
        // Pan canvas
        this.isPanning = true;
        this.panStartX = e.clientX - this.panX;
        this.panStartY = e.clientY - this.panY;
        this.viewport.style.cursor = 'grabbing';
      } else if (e.button === 0) {
        // Left click on empty canvas: marquee selection or pan
        if (isShift) {
          // Marquee selection
          this.isMarquee = true;
          const rect = this.viewport.getBoundingClientRect();
          this.marqueeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          this.marqueeCurrent = { ...this.marqueeStart };
          this._updateMarqueeUI();
        } else {
          // Deselect nodes unless clicking UI controls
          this.selectedNodeIds.clear();
          this.selectedWireId = null;
          this._updateSelectedNodesUI();
          this._updatePropertiesInspector();
          this._needsRedraw = true;

          // Also allow panning by dragging empty background
          this.isPanning = true;
          this.panStartX = e.clientX - this.panX;
          this.panStartY = e.clientY - this.panY;
          this.viewport.style.cursor = 'grabbing';
        }
      }
    }

    _onWindowMouseMove(e) {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStartX;
        this.panY = e.clientY - this.panStartY;
        this._updateTransform();
      } else if (this.isDraggingNodes) {
        const dx = (e.clientX - this.dragStartMouse.x) / this.zoom;
        const dy = (e.clientY - this.dragStartMouse.y) / this.zoom;

        for (const [nodeId, initPos] of this.nodeInitialPositions.entries()) {
          const node = this.engine.getNode(nodeId);
          if (node) {
            node.x = Math.round(initPos.x + dx);
            node.y = Math.round(initPos.y + dy);
            const el = this.nodeElements.get(nodeId);
            if (el) {
              el.style.left = `${node.x}px`;
              el.style.top = `${node.y}px`;
            }
          }
        }
        this._needsRedraw = true;
      } else if (this.connectingWire) {
        const rect = this.viewport.getBoundingClientRect();
        this.connectingWire.currentX = (e.clientX - rect.left - this.panX) / this.zoom;
        this.connectingWire.currentY = (e.clientY - rect.top - this.panY) / this.zoom;
        this._needsRedraw = true;
      } else if (this.isMarquee) {
        const rect = this.viewport.getBoundingClientRect();
        this.marqueeCurrent = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        this._updateMarqueeUI();
        this._evaluateMarqueeSelection();
      }
    }

    _onWindowMouseUp(e) {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewport.style.cursor = '';
      }
      if (this.isDraggingNodes) {
        this.isDraggingNodes = false;
        this._needsRedraw = true;
      }
      if (this.connectingWire) {
        // If released over a valid target socket, connect them
        const targetSocketEl = document.elementFromPoint(e.clientX, e.clientY);
        const socketWrap = targetSocketEl ? targetSocketEl.closest('.logic-socket') : null;

        if (socketWrap) {
          const toNodeId = socketWrap.dataset.nodeId;
          const toSocketId = socketWrap.dataset.socketId;
          const toIsInput = socketWrap.dataset.dir === 'in';

          if (this.connectingWire.isOutput && toIsInput) {
            this.engine.connect(
              this.connectingWire.fromNodeId,
              this.connectingWire.fromSocketId,
              toNodeId,
              toSocketId
            );
          } else if (!this.connectingWire.isOutput && !toIsInput) {
            this.engine.connect(
              toNodeId,
              toSocketId,
              this.connectingWire.fromNodeId,
              this.connectingWire.fromSocketId
            );
          }
        }
        this.connectingWire = null;
        this._needsRedraw = true;
      }
      if (this.isMarquee) {
        this.isMarquee = false;
        if (this.marqueeEl) this.marqueeEl.style.display = 'none';
      }
    }

    _onWheel(e) {
      e.preventDefault();
      const rect = this.viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);

      if (newZoom !== this.zoom) {
        // Zoom toward mouse pointer
        this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
        this.zoom = newZoom;
        this._updateTransform();
      }
    }

    _zoomStep(factor) {
      const rect = this.viewport.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const newZoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
      this.panX = cx - (cx - this.panX) * (newZoom / this.zoom);
      this.panY = cy - (cy - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;
      this._updateTransform();
    }

    _updateTransform() {
      if (this.nodesContainer) {
        this.nodesContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
      }
      const pill = this.container.querySelector('#logic-zoom-label');
      if (pill) {
        pill.textContent = `${Math.round(this.zoom * 100)}%`;
      }
      this._needsRedraw = true;
    }

    _updateMarqueeUI() {
      if (!this.marqueeEl) return;
      const x0 = Math.min(this.marqueeStart.x, this.marqueeCurrent.x);
      const y0 = Math.min(this.marqueeStart.y, this.marqueeCurrent.y);
      const w = Math.abs(this.marqueeStart.x - this.marqueeCurrent.x);
      const h = Math.abs(this.marqueeStart.y - this.marqueeCurrent.y);

      this.marqueeEl.style.display = 'block';
      this.marqueeEl.style.left = `${x0}px`;
      this.marqueeEl.style.top = `${y0}px`;
      this.marqueeEl.style.width = `${w}px`;
      this.marqueeEl.style.height = `${h}px`;
    }

    _evaluateMarqueeSelection() {
      const rx0 = (Math.min(this.marqueeStart.x, this.marqueeCurrent.x) - this.panX) / this.zoom;
      const ry0 = (Math.min(this.marqueeStart.y, this.marqueeCurrent.y) - this.panY) / this.zoom;
      const rx1 = (Math.max(this.marqueeStart.x, this.marqueeCurrent.x) - this.panX) / this.zoom;
      const ry1 = (Math.max(this.marqueeStart.y, this.marqueeCurrent.y) - this.panY) / this.zoom;

      for (const node of this.engine.getAllNodes()) {
        const nodeW = 180;
        const nodeH = 100;
        const overlaps =
          node.x < rx1 && node.x + nodeW > rx0 && node.y < ry1 && node.y + nodeH > ry0;
        if (overlaps) {
          this.selectedNodeIds.add(node.id);
        }
      }
      this._updateSelectedNodesUI();
    }

    // ── Node Rendering & DOM Card Creation ──
    _renderAllNodes() {
      this.nodesContainer.innerHTML = '';
      this.nodeElements.clear();

      for (const node of this.engine.getAllNodes()) {
        this._createNodeElement(node);
      }
      this._updateSelectedNodesUI();
      this._needsRedraw = true;
    }

    _createNodeElement(node) {
      const def = NODE_DEFS[node.type];
      const cat = CATEGORIES[node.category.toUpperCase()] || CATEGORIES.UTILITIES;

      const card = document.createElement('div');
      card.className = `logic-node cat-${node.category}`;
      card.id = `ln_${node.id}`;
      card.style.left = `${node.x}px`;
      card.style.top = `${node.y}px`;

      // Header
      const header = document.createElement('div');
      header.className = 'node-header';
      header.style.borderTopColor = cat.color;

      header.innerHTML = `
        <span class="node-icon" style="color:${cat.color}">${cat.icon}</span>
        <span class="node-title">${node.title}</span>
        <div class="node-actions">
          <button class="node-del-btn" title="Delete Node (Del)">&times;</button>
        </div>
      `;

      // Del button
      const delBtn = header.querySelector('.node-del-btn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.engine.removeNode(node.id);
        this.selectedNodeIds.delete(node.id);
        card.remove();
        this.nodeElements.delete(node.id);
        this._updatePropertiesInspector();
        this._needsRedraw = true;
      });

      // Body Columns
      const body = document.createElement('div');
      body.className = 'node-body';

      // Left: Inputs Column
      const inCol = document.createElement('div');
      inCol.className = 'node-sockets-col in-col';

      for (const socket of node.inputs) {
        const isConnected = this._isSocketConnected(node.id, socket.id, true);
        const sColor = SOCKET_COLORS[socket.type] || '#fff';
        const isExec = socket.type === SOCKET_TYPES.EXEC;

        const row = document.createElement('div');
        row.className = `socket-row in-row ${isExec ? 'is-exec' : ''}`;

        row.innerHTML = `
          <div class="logic-socket socket-in" data-node-id="${node.id}" data-socket-id="${socket.id}" data-type="${socket.type}" data-dir="in" title="${socket.type.toUpperCase()}: ${socket.name}">
            <span class="socket-pill" style="border-color:${sColor}; background:${isConnected ? sColor : 'transparent'}"></span>
          </div>
          <span class="socket-label">${socket.name}</span>
        `;

        // If disconnected and not exec, show inline control for quick tweaking
        if (!isConnected && !isExec) {
          const inlineInput = this._createInlineInput(node, socket);
          if (inlineInput) row.appendChild(inlineInput);
        }

        inCol.appendChild(row);
      }

      // Right: Outputs Column
      const outCol = document.createElement('div');
      outCol.className = 'node-sockets-col out-col';

      for (const socket of node.outputs) {
        const isConnected = this._isSocketConnected(node.id, socket.id, false);
        const sColor = SOCKET_COLORS[socket.type] || '#fff';
        const isExec = socket.type === SOCKET_TYPES.EXEC;

        const row = document.createElement('div');
        row.className = `socket-row out-row ${isExec ? 'is-exec' : ''}`;

        row.innerHTML = `
          <span class="socket-label">${socket.name}</span>
          <div class="logic-socket socket-out" data-node-id="${node.id}" data-socket-id="${socket.id}" data-type="${socket.type}" data-dir="out" title="${socket.type.toUpperCase()}: ${socket.name}">
            <span class="socket-pill" style="border-color:${sColor}; background:${isConnected ? sColor : 'transparent'}"></span>
          </div>
        `;
        outCol.appendChild(row);
      }

      body.appendChild(inCol);
      body.appendChild(outCol);

      card.appendChild(header);
      card.appendChild(body);

      // Node selection & dragging handlers
      card.addEventListener('mousedown', (e) => this._onNodeMouseDown(e, node));

      // Sockets wire pulling handlers
      card.querySelectorAll('.logic-socket').forEach((sockEl) => {
        sockEl.addEventListener('mousedown', (e) => this._onSocketMouseDown(e, sockEl));
      });

      this.nodesContainer.appendChild(card);
      this.nodeElements.set(node.id, card);
      return card;
    }

    _isSocketConnected(nodeId, socketId, isInput) {
      for (const wire of this.engine.getAllWires()) {
        if (isInput && wire.toNode === nodeId && wire.toSocket === socketId) return true;
        if (!isInput && wire.fromNode === nodeId && wire.fromSocket === socketId) return true;
      }
      return false;
    }

    _createInlineInput(node, socket) {
      const curVal = node.customValues[socket.id] ?? socket.defaultValue ?? 0;

      if (socket.type === SOCKET_TYPES.BOOLEAN) {
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'inline-socket-chk';
        chk.checked = Boolean(curVal);
        chk.addEventListener('change', (e) => {
          node.customValues[socket.id] = e.target.checked;
        });
        return chk;
      }

      if (socket.type === SOCKET_TYPES.NUMBER) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'inline-socket-num';
        inp.value = curVal;
        inp.addEventListener('input', (e) => {
          node.customValues[socket.id] = Number(e.target.value);
        });
        return inp;
      }

      if (socket.type === SOCKET_TYPES.STRING || socket.type === SOCKET_TYPES.ANY) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'inline-socket-txt';
        inp.value = curVal;
        inp.addEventListener('input', (e) => {
          node.customValues[socket.id] = e.target.value;
        });
        return inp;
      }

      return null;
    }

    _onNodeMouseDown(e, node) {
      // If clicking inside socket or an inline input, do not initiate node drag
      if (e.target.closest('.logic-socket') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        return;
      }

      e.stopPropagation();

      const isShift = e.shiftKey || e.ctrlKey || e.metaKey;

      if (isShift) {
        if (this.selectedNodeIds.has(node.id)) {
          this.selectedNodeIds.delete(node.id);
        } else {
          this.selectedNodeIds.add(node.id);
        }
      } else {
        if (!this.selectedNodeIds.has(node.id)) {
          this.selectedNodeIds.clear();
          this.selectedNodeIds.add(node.id);
        }
      }

      this._updateSelectedNodesUI();
      this._updatePropertiesInspector();

      // Begin group dragging
      this.isDraggingNodes = true;
      this.dragStartMouse = { x: e.clientX, y: e.clientY };
      this.nodeInitialPositions.clear();

      for (const id of this.selectedNodeIds) {
        const n = this.engine.getNode(id);
        if (n) {
          this.nodeInitialPositions.set(id, { x: n.x, y: n.y });
        }
      }
    }

    _onSocketMouseDown(e, socketEl) {
      e.stopPropagation();
      const nodeId = socketEl.dataset.nodeId;
      const socketId = socketEl.dataset.socketId;
      const isInput = socketEl.dataset.dir === 'in';
      const type = socketEl.dataset.type;

      // If clicking an existing input socket with a wire, disconnect it to pull new connection
      if (isInput) {
        const existingWire = this.engine.getAllWires().find(
          (w) => w.toNode === nodeId && w.toSocket === socketId
        );
        if (existingWire) {
          this.engine.disconnect(existingWire.id);
          this._renderAllNodes();
        }
      }

      const rect = socketEl.getBoundingClientRect();
      const vpRect = this.viewport.getBoundingClientRect();
      const startX = (rect.left + rect.width / 2 - vpRect.left - this.panX) / this.zoom;
      const startY = (rect.top + rect.height / 2 - vpRect.top - this.panY) / this.zoom;

      this.connectingWire = {
        fromNodeId: nodeId,
        fromSocketId: socketId,
        fromType: type,
        isOutput: !isInput,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
      };
      this._needsRedraw = true;
    }

    _updateSelectedNodesUI() {
      for (const [id, el] of this.nodeElements.entries()) {
        el.classList.toggle('selected', this.selectedNodeIds.has(id));
      }
    }

    _updateRunningUI(running) {
      const badge = this.container.querySelector('#logic-engine-status');
      const label = this.container.querySelector('#logic-play-label');
      const btn = this.container.querySelector('#btn-logic-play');
      const topBadge = document.getElementById('logic-live-badge');

      if (badge) {
        badge.textContent = running ? 'RUNNING (30Hz)' : 'STOPPED';
        badge.className = `logic-live-badge ${running ? 'running' : 'stopped'}`;
      }
      if (label) {
        label.textContent = running ? 'Pause' : 'Run';
      }
      if (btn) {
        btn.classList.toggle('active', running);
      }
      if (topBadge) {
        topBadge.textContent = running ? 'ACTIVE' : 'IDLE';
        topBadge.className = `logic-live-badge ${running ? 'running' : ''}`;
      }
    }

    // ── Keyboard Shortcuts ──
    _onKeyDown(e) {
      // Ignore if user is typing in text input/textarea
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Space: Toggle Play/Pause
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (this.engine.running) this.engine.stop();
        else this.engine.start();
        return;
      }

      // Delete / Backspace: Delete selected nodes or wire
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedNodeIds.size > 0) {
          e.preventDefault();
          for (const id of Array.from(this.selectedNodeIds)) {
            this.engine.removeNode(id);
          }
          this.selectedNodeIds.clear();
          this._renderAllNodes();
          this._updatePropertiesInspector();
          this._needsRedraw = true;
        } else if (this.selectedWireId) {
          e.preventDefault();
          this.engine.disconnect(this.selectedWireId);
          this.selectedWireId = null;
          this._renderAllNodes();
          this._needsRedraw = true;
        }
        return;
      }

      // Ctrl + D: Duplicate selected nodes
      if (mod && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        this._duplicateSelectedNodes();
        return;
      }

      // Ctrl + A: Select all nodes
      if (mod && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        for (const n of this.engine.getAllNodes()) {
          this.selectedNodeIds.add(n.id);
        }
        this._updateSelectedNodesUI();
        this._updatePropertiesInspector();
        return;
      }

      // Escape: Deselect all / Close search
      if (e.key === 'Escape') {
        if (this.searchModal && this.searchModal.style.display !== 'none') {
          this._closeSearchModal();
        } else {
          this.selectedNodeIds.clear();
          this.selectedWireId = null;
          this._updateSelectedNodesUI();
          this._updatePropertiesInspector();
          this._needsRedraw = true;
        }
      }
    }

    _duplicateSelectedNodes() {
      if (this.selectedNodeIds.size === 0) return;
      const newIds = new Set();

      for (const id of this.selectedNodeIds) {
        const orig = this.engine.getNode(id);
        if (orig) {
          const dup = this.engine.addNode(orig.type, orig.x + 40, orig.y + 40);
          dup.properties = JSON.parse(JSON.stringify(orig.properties));
          dup.customValues = JSON.parse(JSON.stringify(orig.customValues));
          dup.title = orig.title;
          newIds.add(dup.id);
        }
      }

      this.selectedNodeIds = newIds;
      this._renderAllNodes();
      this._updatePropertiesInspector();
      this._needsRedraw = true;
      this.app.showToast(`Duplicated ${newIds.size} node(s)`, 'info');
    }

    // ── Search & Add Node Modal ──
    _openSearchModal(screenX, screenY) {
      if (!this.searchModal) return;
      this.searchModal.style.display = 'flex';
      const dialog = this.searchModal.querySelector('.logic-search-dialog');
      const input = this.searchModal.querySelector('#logic-search-input');

      // Spawn at cursor position within window bounds
      const w = 480;
      const left = clamp(screenX, 20, window.innerWidth - w - 20);
      const top = clamp(screenY, 50, window.innerHeight - 440);
      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;

      this._targetSpawnWorldPos = {
        x: Math.round((screenX - this.viewport.getBoundingClientRect().left - this.panX) / this.zoom),
        y: Math.round((screenY - this.viewport.getBoundingClientRect().top - this.panY) / this.zoom),
      };

      input.value = '';
      this._filterSearchList();
      setTimeout(() => input.focus(), 50);
    }

    _closeSearchModal() {
      if (this.searchModal) {
        this.searchModal.style.display = 'none';
      }
    }

    _filterSearchList() {
      const input = this.searchModal.querySelector('#logic-search-input');
      const query = (input.value || '').trim().toLowerCase();
      const activeCatTab = this.searchModal.querySelector('.cat-tab.active');
      const catFilter = activeCatTab ? activeCatTab.dataset.cat : 'all';

      const listEl = this.searchModal.querySelector('#logic-search-list');
      listEl.innerHTML = '';

      const items = Object.values(NODE_DEFS).filter((def) => {
        if (catFilter !== 'all' && def.category !== catFilter) return false;
        if (!query) return true;
        return (
          def.title.toLowerCase().includes(query) ||
          def.category.toLowerCase().includes(query) ||
          (def.description && def.description.toLowerCase().includes(query))
        );
      });

      if (items.length === 0) {
        listEl.innerHTML = `<div class="search-empty">No matching nodes found for "${query}"</div>`;
        return;
      }

      for (const def of items) {
        const cat = CATEGORIES[def.category.toUpperCase()] || CATEGORIES.UTILITIES;
        const item = document.createElement('div');
        item.className = 'search-item';
        item.innerHTML = `
          <div class="search-item-left">
            <span class="search-item-icon" style="color:${cat.color}">${cat.icon}</span>
            <div class="search-item-info">
              <span class="search-item-title">${def.title}</span>
              <span class="search-item-desc">${def.description || ''}</span>
            </div>
          </div>
          <span class="search-cat-pill" style="border-color:${cat.color}; color:${cat.color}">${cat.label}</span>
        `;

        item.addEventListener('click', () => {
          const spawnX = this._targetSpawnWorldPos ? this._targetSpawnWorldPos.x : 200;
          const spawnY = this._targetSpawnWorldPos ? this._targetSpawnWorldPos.y : 200;
          const newNode = this.engine.addNode(def.type, spawnX, spawnY);
          this.selectedNodeIds.clear();
          this.selectedNodeIds.add(newNode.id);
          this._renderAllNodes();
          this._updatePropertiesInspector();
          this._closeSearchModal();
          this._needsRedraw = true;
        });

        listEl.appendChild(item);
      }
    }

    // ── Properties Panel Integration ──
    _updatePropertiesInspector() {
      const container = document.getElementById('props-content');
      const emptyEl = document.getElementById('props-empty');
      if (!container || !emptyEl) return;

      // Only manage properties when in logic workspace tab
      const logicWs = document.getElementById('logic-workspace');
      if (!logicWs || logicWs.style.display === 'none') return;

      if (this.selectedNodeIds.size === 0) {
        emptyEl.style.display = 'flex';
        container.style.display = 'none';
        emptyEl.querySelector('div').textContent =
          'Select a logic node on the canvas to inspect its parameters, connections and telemetry.';
        return;
      }

      emptyEl.style.display = 'none';
      container.style.display = 'block';

      // Multi-node selection properties
      if (this.selectedNodeIds.size > 1) {
        const count = this.selectedNodeIds.size;
        container.innerHTML = `
          <div class="prop-header">
            <div class="prop-title-wrap">
              <div class="prop-icon-box" style="color:var(--accent)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
              </div>
              <div class="prop-title-meta">
                <span class="prop-category-tag">MULTI-SELECTION</span>
                <h3>${count} Nodes Selected</h3>
              </div>
            </div>
          </div>

          <div class="prop-section">
            <div class="logic-multi-summary-box">
              <span class="logic-multi-count-tag">${count}</span>
              <span style="font-size:12px; color:var(--text-secondary)">nodes currently active in multi-selection.</span>
            </div>
          </div>

          <div class="prop-section" style="border-bottom:none">
            <div class="prop-section-header">
              <h4>ACTIONS</h4>
            </div>
            <div class="prop-actions-grid">
              <button class="btn-secondary" id="multi-node-dup">Duplicate All (${count})</button>
              <button class="btn-delete" id="multi-node-del">Delete All (${count})</button>
            </div>
          </div>
        `;

        const mDup = container.querySelector('#multi-node-dup');
        const mDel = container.querySelector('#multi-node-del');
        if (mDup) mDup.addEventListener('click', () => this._duplicateSelectedNodes());
        if (mDel) {
          mDel.addEventListener('click', () => {
            for (const id of Array.from(this.selectedNodeIds)) {
              this.engine.removeNode(id);
            }
            this.selectedNodeIds.clear();
            this._renderAllNodes();
            this._updatePropertiesInspector();
            this._needsRedraw = true;
          });
        }
        return;
      }

      // Single node properties
      const firstId = Array.from(this.selectedNodeIds)[0];
      const node = this.engine.getNode(firstId);
      if (!node) return;

      const def = NODE_DEFS[node.type];
      const cat = CATEGORIES[node.category.toUpperCase()] || CATEGORIES.UTILITIES;

      let html = `
        <div class="prop-header">
          <div class="prop-title-wrap">
            <div class="prop-icon-box" style="border-color:${cat.color}40; background-color:${cat.color}18; color:${cat.color}">
              <span style="font-size:16px">${cat.icon}</span>
            </div>
            <div class="prop-title-meta">
              <span class="prop-category-tag" style="background-color:${cat.color}22; color:${cat.color}; border:1px solid ${cat.color}44">
                ${cat.label} · #${node.id}
              </span>
              <h3>${node.title}</h3>
            </div>
          </div>
          <div class="prop-header-actions">
            <button class="icon-action-btn" id="prop-btn-focus" title="Center view on node">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="12" cy="12" r="3"></circle>
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
              </svg>
            </button>
            <button class="icon-action-btn" id="prop-btn-dup-icon" title="Duplicate node (Ctrl+D)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="icon-action-btn danger" id="prop-btn-del-icon" title="Delete node (Del)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Section: Overview & Telemetry -->
        <div class="prop-section">
          <p class="node-prop-desc">${def ? def.description : ''}</p>
          <div class="node-meta-grid">
            <div class="node-meta-item">
              <span class="meta-label">Position</span>
              <span class="meta-val">X: ${node.x}, Y: ${node.y}</span>
            </div>
            <div class="node-meta-item">
              <span class="meta-label">Execution Status</span>
              <span class="meta-val ${node.hasError ? 'error' : node.isExecuting ? 'active' : ''}">
                ${node.hasError ? 'Error' : node.isExecuting ? 'Active' : 'Idle'}
              </span>
            </div>
          </div>
        </div>

        <!-- Section: Parameters & Properties -->
        <div class="prop-section">
          <div class="prop-section-header">
            <h4>NODE PARAMETERS</h4>
          </div>
      `;

      // Specific parameters per node type
      if (node.type === 'logic-greater-than' || node.type === 'logic-less-than') {
        const curThresh = node.properties.threshold ?? 50;
        html += `
          <div class="prop-field">
            <div class="prop-row">
              <label>Comparison Threshold</label>
            </div>
            <div class="node-slider-row">
              <input type="range" id="prop-thresh-slider" min="0" max="100" step="1" value="${curThresh}" />
              <div class="input-unit-wrap node-slider-val-box">
                <input type="number" id="prop-threshold" value="${curThresh}" min="0" max="100" />
              </div>
            </div>
          </div>
        `;
      } else if (node.type === 'logic-compare') {
        const op = node.properties.operator || '>';
        html += `
          <div class="prop-field">
            <div class="prop-row">
              <label>Comparison Operator</label>
            </div>
            <select class="node-prop-select" id="prop-operator">
              <option value=">" ${op === '>' ? 'selected' : ''}>&gt; Greater Than</option>
              <option value="<" ${op === '<' ? 'selected' : ''}>&lt; Less Than</option>
              <option value="==" ${op === '==' ? 'selected' : ''}>= Equal</option>
              <option value="!=" ${op === '!=' ? 'selected' : ''}>≠ Not Equal</option>
              <option value=">=" ${op === '>=' ? 'selected' : ''}>≥ Greater or Equal</option>
              <option value="<=" ${op === '<=' ? 'selected' : ''}>≤ Less or Equal</option>
            </select>
          </div>
        `;
      } else if (node.type.startsWith('input-sensor') || node.type.startsWith('event-sensor')) {
        const detectors = this.app.components ? this.app.components.filter((c) => c.type === 'optical-detector') : [];
        html += `
          <div class="prop-field">
            <div class="prop-row">
              <label>Target Optical Detector</label>
            </div>
            <select class="node-prop-select" id="prop-sensor-id">
              <option value="">Any Available Detector (${detectors.length} on bench)</option>
              ${detectors
                .map((d) => `<option value="${d.id}" ${node.properties.sensorId === d.id ? 'selected' : ''}>Detector #${d.id} (${d.detected ? 'Light Detected' : 'No Light'})</option>`)
                .join('')}
            </select>
          </div>
        `;
      } else if (node.type.startsWith('output-led') || node.type === 'input-laser-state') {
        const lasers = this.app.components
          ? this.app.components.filter((c) => c.type === 'laser' || c.type === 'rgb-led' || c.type === 'white-led')
          : [];
        html += `
          <div class="prop-field">
            <div class="prop-row">
              <label>Target Light Source</label>
            </div>
            <select class="node-prop-select" id="prop-target-id">
              <option value="">First Available Source (${lasers.length} on bench)</option>
              ${lasers
                .map((l) => `<option value="${l.id}" ${(node.properties.targetId || node.properties.laserId) === l.id ? 'selected' : ''}>${l.type.toUpperCase()} #${l.id} (${l.enabled !== false ? 'ON' : 'OFF'})</option>`)
                .join('')}
            </select>
          </div>
        `;
        if (node.type === 'output-led-brightness') {
          const brightVal = node.properties.defaultBrightness ?? 100;
          html += `
            <div class="prop-field">
              <div class="prop-row">
                <label>Default Brightness (%)</label>
              </div>
              <div class="node-slider-row">
                <input type="range" id="prop-bright-slider" min="0" max="100" step="1" value="${brightVal}" />
                <div class="input-unit-wrap node-slider-val-box">
                  <input type="number" id="prop-bright-num" min="0" max="100" value="${brightVal}" />
                  <span class="input-unit">%</span>
                </div>
              </div>
            </div>
          `;
        }
      } else if (node.type === 'utility-delay') {
        const curDur = node.properties.duration ?? 500;
        html += `
          <div class="prop-field">
            <div class="prop-row">
              <label>Delay Duration (ms)</label>
            </div>
            <div class="node-slider-row">
              <input type="range" id="prop-delay-slider" min="10" max="3000" step="50" value="${curDur}" />
              <div class="input-unit-wrap node-slider-val-box" style="width:70px">
                <input type="number" id="prop-delay" min="10" max="10000" step="50" value="${curDur}" />
                <span class="input-unit">ms</span>
              </div>
            </div>
          </div>
        `;
      } else if (node.type.startsWith('variable-')) {
        const curName = node.properties.varName || 'myVar';
        const curVal = this.engine.getVariable(curName);
        html += `
          <div class="prop-field">
            <div class="prop-row">
              <label>Variable Name</label>
            </div>
            <input type="text" class="node-prop-input" id="prop-var-name" value="${curName}" placeholder="e.g. counter, threshold" />
          </div>
          <div class="node-meta-grid" style="margin-top:6px">
            <div class="node-meta-item">
              <span class="meta-label">Current Value</span>
              <span class="meta-val" id="prop-var-val">${curVal}</span>
            </div>
          </div>
        `;
      } else if (node.type === 'utility-print-debug') {
        const curMsg = node.customValues['value'] ?? 'Hello OptiLab';
        html += `
          <div class="prop-field">
            <div class="prop-row">
              <label>Default Debug Value / Message</label>
            </div>
            <input type="text" class="node-prop-input" id="prop-debug-val" value="${curMsg}" />
          </div>
        `;
      } else if (node.type === 'math-random') {
        const curMin = node.properties.min ?? 0;
        const curMax = node.properties.max ?? 100;
        const isInt = Boolean(node.properties.integer);
        html += `
          <div class="prop-field">
            <div class="prop-row">
              <label>Minimum Value (Min)</label>
            </div>
            <div class="input-unit-wrap">
              <input type="number" id="prop-rnd-min" value="${curMin}" step="${isInt ? 1 : 0.1}" />
            </div>
          </div>
          <div class="prop-field">
            <div class="prop-row">
              <label>Maximum Value (Max)</label>
            </div>
            <div class="input-unit-wrap">
              <input type="number" id="prop-rnd-max" value="${curMax}" step="${isInt ? 1 : 0.1}" />
            </div>
          </div>
          <div class="prop-field">
            <div class="prop-row" style="cursor:pointer">
              <label for="prop-rnd-int" style="cursor:pointer">Round to Whole Integer</label>
              <input type="checkbox" id="prop-rnd-int" ${isInt ? 'checked' : ''} style="accent-color:var(--accent)" />
            </div>
          </div>
          <div class="prop-field" style="margin-top:6px">
            <button class="tb-btn small" id="prop-btn-roll" style="width:100%; justify-content:center; gap:6px">
              <span>🎲 Roll Sample Value:</span>
              <span id="prop-rnd-preview" style="font-family:var(--font-mono); font-weight:700; color:var(--accent-text)">-</span>
            </button>
          </div>
        `;
      }

      html += `
        </div>

        <!-- Section: Sockets & Connections Summary -->
        <div class="prop-section">
          <div class="prop-section-header">
            <h4>SOCKETS &amp; SIGNALS</h4>
          </div>
          <div class="node-sockets-summary">
      `;

      // Inputs summary
      for (const socket of node.inputs) {
        const isConnected = this._isSocketConnected(node.id, socket.id, true);
        const sColor = SOCKET_COLORS[socket.type] || '#fff';
        const isExec = socket.type === SOCKET_TYPES.EXEC;
        const inlineVal = node.customValues[socket.id] ?? socket.defaultValue ?? '-';

        html += `
          <div class="socket-summary-item">
            <div class="socket-summary-left">
              <span class="socket-summary-pill ${isExec ? 'is-exec' : ''}" style="border-color:${sColor}; background:${isConnected ? sColor : 'transparent'}"></span>
              <span class="socket-summary-name">${socket.name || 'Exec In'}</span>
            </div>
            <span class="socket-summary-status ${isConnected ? 'connected' : ''}">
              ${isConnected ? 'Connected' : isExec ? 'Unwired' : `Val: ${inlineVal}`}
            </span>
          </div>
        `;
      }

      // Outputs summary
      for (const socket of node.outputs) {
        const isConnected = this._isSocketConnected(node.id, socket.id, false);
        const sColor = SOCKET_COLORS[socket.type] || '#fff';
        const isExec = socket.type === SOCKET_TYPES.EXEC;
        const lastVal = node.lastOutputValues[socket.id];

        html += `
          <div class="socket-summary-item">
            <div class="socket-summary-left">
              <span class="socket-summary-pill ${isExec ? 'is-exec' : ''}" style="border-color:${sColor}; background:${isConnected ? sColor : 'transparent'}"></span>
              <span class="socket-summary-name">${socket.name || 'Exec Out'}</span>
            </div>
            <span class="socket-summary-status ${lastVal !== undefined ? 'live-val' : isConnected ? 'connected' : ''}">
              ${lastVal !== undefined ? `Out: ${lastVal}` : isConnected ? 'Connected' : 'Idle'}
            </span>
          </div>
        `;
      }

      html += `
          </div>
        </div>

        <!-- Section: Actions -->
        <div class="prop-section" style="border-bottom:none">
          <div class="prop-section-header">
            <h4>ACTIONS</h4>
          </div>
          <div class="prop-actions-grid">
            <button class="btn-secondary" id="prop-btn-dup">Duplicate Node</button>
            <button class="btn-delete" id="prop-btn-del">Delete Node</button>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Bind input changes
      const threshSlider = container.querySelector('#prop-thresh-slider');
      const threshInp = container.querySelector('#prop-threshold');
      if (threshSlider && threshInp) {
        threshSlider.addEventListener('input', (e) => {
          threshInp.value = e.target.value;
          node.properties.threshold = Number(e.target.value);
          node.customValues['b'] = Number(e.target.value);
        });
        threshInp.addEventListener('input', (e) => {
          threshSlider.value = e.target.value;
          node.properties.threshold = Number(e.target.value);
          node.customValues['b'] = Number(e.target.value);
        });
      }

      const brightSlider = container.querySelector('#prop-bright-slider');
      const brightNum = container.querySelector('#prop-bright-num');
      if (brightSlider && brightNum) {
        brightSlider.addEventListener('input', (e) => {
          brightNum.value = e.target.value;
          node.properties.defaultBrightness = Number(e.target.value);
          node.customValues['brightness'] = Number(e.target.value);
        });
        brightNum.addEventListener('input', (e) => {
          brightSlider.value = e.target.value;
          node.properties.defaultBrightness = Number(e.target.value);
          node.customValues['brightness'] = Number(e.target.value);
        });
      }

      const delaySlider = container.querySelector('#prop-delay-slider');
      const delayInp = container.querySelector('#prop-delay');
      if (delaySlider && delayInp) {
        delaySlider.addEventListener('input', (e) => {
          delayInp.value = e.target.value;
          node.properties.duration = Math.max(10, Number(e.target.value));
        });
        delayInp.addEventListener('input', (e) => {
          delaySlider.value = e.target.value;
          node.properties.duration = Math.max(10, Number(e.target.value));
        });
      }

      const opSelect = container.querySelector('#prop-operator');
      if (opSelect) {
        opSelect.addEventListener('change', (e) => {
          node.properties.operator = e.target.value;
        });
      }

      const sensorSelect = container.querySelector('#prop-sensor-id');
      if (sensorSelect) {
        sensorSelect.addEventListener('change', (e) => {
          node.properties.sensorId = e.target.value;
        });
      }

      const targetSelect = container.querySelector('#prop-target-id');
      if (targetSelect) {
        targetSelect.addEventListener('change', (e) => {
          if (node.properties.targetId !== undefined) node.properties.targetId = e.target.value;
          if (node.properties.laserId !== undefined) node.properties.laserId = e.target.value;
        });
      }

      const varNameInp = container.querySelector('#prop-var-name');
      if (varNameInp) {
        varNameInp.addEventListener('input', (e) => {
          node.properties.varName = e.target.value.trim() || 'myVar';
          const valEl = container.querySelector('#prop-var-val');
          if (valEl) valEl.textContent = this.engine.getVariable(node.properties.varName);
        });
      }

      const debugValInp = container.querySelector('#prop-debug-val');
      if (debugValInp) {
        debugValInp.addEventListener('input', (e) => {
          node.customValues['value'] = e.target.value;
        });
      }

      // Random Number node events
      const rndMinInp = container.querySelector('#prop-rnd-min');
      const rndMaxInp = container.querySelector('#prop-rnd-max');
      const rndIntChk = container.querySelector('#prop-rnd-int');
      const btnRoll = container.querySelector('#prop-btn-roll');
      const rndPreview = container.querySelector('#prop-rnd-preview');

      if (rndMinInp) {
        rndMinInp.addEventListener('input', (e) => {
          node.properties.min = Number(e.target.value);
          node.customValues['min'] = Number(e.target.value);
        });
      }
      if (rndMaxInp) {
        rndMaxInp.addEventListener('input', (e) => {
          node.properties.max = Number(e.target.value);
          node.customValues['max'] = Number(e.target.value);
        });
      }
      if (rndIntChk) {
        rndIntChk.addEventListener('change', (e) => {
          node.properties.integer = e.target.checked;
        });
      }
      if (btnRoll && rndPreview) {
        const doRoll = () => {
          const min = Number(node.properties.min ?? 0);
          const max = Number(node.properties.max ?? 100);
          const low = Math.min(min, max);
          const high = Math.max(min, max);
          const rnd = low + Math.random() * (high - low);
          const val = node.properties.integer ? Math.round(rnd) : Math.round(rnd * 1000) / 1000;
          rndPreview.textContent = String(val);
          node.lastOutputValues['val'] = val;
          node.lastOutputValues['int'] = Math.round(val);
        };
        btnRoll.addEventListener('click', doRoll);
        doRoll();
      }

      // Actions
      const focusBtn = container.querySelector('#prop-btn-focus');
      if (focusBtn) {
        focusBtn.addEventListener('click', () => {
          const vpRect = this.viewport.getBoundingClientRect();
          this.panX = vpRect.width / 2 - (node.x + 105) * this.zoom;
          this.panY = vpRect.height / 2 - (node.y + 50) * this.zoom;
          this._updateTransform();
        });
      }

      const btnDup = container.querySelector('#prop-btn-dup');
      const btnDupIcon = container.querySelector('#prop-btn-dup-icon');
      const doDup = () => this._duplicateSelectedNodes();
      if (btnDup) btnDup.addEventListener('click', doDup);
      if (btnDupIcon) btnDupIcon.addEventListener('click', doDup);

      const btnDel = container.querySelector('#prop-btn-del');
      const btnDelIcon = container.querySelector('#prop-btn-del-icon');
      const doDel = () => {
        this.engine.removeNode(node.id);
        this.selectedNodeIds.delete(node.id);
        this._renderAllNodes();
        this._updatePropertiesInspector();
        this._needsRedraw = true;
      };
      if (btnDel) btnDel.addEventListener('click', doDel);
      if (btnDelIcon) btnDelIcon.addEventListener('click', doDel);
    }

    _refreshConsoleLogs() {
      if (!this.consoleDrawer) return;
      const countEl = this.container.querySelector('#logic-console-count');
      const subCount = this.container.querySelector('#console-sub-count');
      const logsBody = this.container.querySelector('#console-logs-container');

      const count = this.engine.logs.length;
      if (countEl) countEl.textContent = count;
      if (subCount) subCount.textContent = `${count} messages`;

      if (!logsBody) return;

      if (count === 0) {
        logsBody.innerHTML = `<div class="console-empty">No debug output yet. Use "Print / Debug" nodes to log signals here.</div>`;
        return;
      }

      logsBody.innerHTML = this.engine.logs
        .slice(-60)
        .map((log) => `
          <div class="console-entry level-${log.level}">
            <span class="console-time">${log.time}</span>
            <span class="console-node">[${log.nodeTitle}]</span>
            <span class="console-msg">${log.message}</span>
          </div>
        `)
        .join('');

      // Auto scroll to bottom
      logsBody.scrollTop = logsBody.scrollHeight;
    }

    // ── Render Loop: Grid, Wires, and Minimap ──
    _startRenderLoop() {
      const render = () => {
        this._renderCanvasLayers();
        this._renderMinimap();
        this._animFrame = requestAnimationFrame(render);
      };
      this._animFrame = requestAnimationFrame(render);
    }

    _renderCanvasLayers() {
      if (!this.bgCtx) return;
      const ctx = this.bgCtx;
      const w = this.bgCanvas.width;
      const h = this.bgCanvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw Infinite Grid (Unreal Engine Blueprint Dark Grid Aesthetic)
      this._drawBlueprintGrid(ctx, w, h);

      // 2. Draw Curved Bezier Wires
      this._drawWires(ctx);

      // 3. Highlight executing nodes
      for (const node of this.engine.getAllNodes()) {
        const el = this.nodeElements.get(node.id);
        if (el) {
          el.classList.toggle('executing', Boolean(node.isExecuting));
          el.classList.toggle('has-error', Boolean(node.hasError));
        }
      }
    }

    _drawBlueprintGrid(ctx, w, h) {
      const stepMinor = 24 * this.zoom;
      const stepMajor = 120 * this.zoom;

      const oxMinor = ((this.panX % stepMinor) + stepMinor) % stepMinor;
      const oyMinor = ((this.panY % stepMinor) + stepMinor) % stepMinor;

      ctx.save();
      // Minor dot grid
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let x = oxMinor; x < w; x += stepMinor) {
        for (let y = oyMinor; y < h; y += stepMinor) {
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }

      // Major grid lines
      const oxMajor = ((this.panX % stepMajor) + stepMajor) % stepMajor;
      const oyMajor = ((this.panY % stepMajor) + stepMajor) % stepMajor;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = oxMajor; x < w; x += stepMajor) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = oyMajor; y < h; y += stepMajor) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    _drawWires(ctx) {
      const wires = this.engine.getAllWires();
      const now = Date.now();

      for (const wire of wires) {
        const fromPos = this._getSocketWorldPos(wire.fromNode, wire.fromSocket, false);
        const toPos = this._getSocketWorldPos(wire.toNode, wire.toSocket, true);
        if (!fromPos || !toPos) continue;

        // Convert world coords to screen
        const p0x = fromPos.x * this.zoom + this.panX;
        const p0y = fromPos.y * this.zoom + this.panY;
        const p1x = toPos.x * this.zoom + this.panX;
        const p1y = toPos.y * this.zoom + this.panY;

        const isExec = wire.type === SOCKET_TYPES.EXEC;
        const baseColor = SOCKET_COLORS[wire.type] || '#ffffff';
        const isPulse = now - wire.pulseTime < 300;

        // Draw curved Bezier path
        ctx.save();
        ctx.beginPath();
        const dx = Math.max(40, Math.abs(p1x - p0x) * 0.55);
        ctx.moveTo(p0x, p0y);
        ctx.bezierCurveTo(p0x + dx, p0y, p1x - dx, p1y, p1x, p1y);

        ctx.strokeStyle = isPulse ? '#ffffff' : baseColor;
        ctx.lineWidth = isExec ? 3.0 : 2.2;
        ctx.lineCap = 'round';

        if (isPulse) {
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 12;
        } else if (isExec) {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
          ctx.shadowBlur = 4;
        }

        ctx.stroke();

        // Execution arrow chevron mid-way
        if (isExec) {
          const midX = 0.5 * (p0x + p1x);
          const midY = 0.5 * (p0y + p1y);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(midX + 4, midY);
          ctx.lineTo(midX - 4, midY - 4);
          ctx.lineTo(midX - 2, midY);
          ctx.lineTo(midX - 4, midY + 4);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }

      // Draw active wire pulling preview
      if (this.connectingWire) {
        const p0x = this.connectingWire.startX * this.zoom + this.panX;
        const p0y = this.connectingWire.startY * this.zoom + this.panY;
        const p1x = this.connectingWire.currentX * this.zoom + this.panX;
        const p1y = this.connectingWire.currentY * this.zoom + this.panY;

        const color = SOCKET_COLORS[this.connectingWire.fromType] || '#ffffff';

        ctx.save();
        ctx.beginPath();
        const dx = Math.max(30, Math.abs(p1x - p0x) * 0.5);
        ctx.moveTo(p0x, p0y);
        ctx.bezierCurveTo(p0x + dx, p0y, p1x - dx, p1y, p1x, p1y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.restore();
      }
    }

    _getSocketWorldPos(nodeId, socketId, isInput) {
      const card = this.nodeElements.get(nodeId);
      if (!card) return null;

      const sockEl = card.querySelector(
        `.logic-socket[data-socket-id="${socketId}"][data-dir="${isInput ? 'in' : 'out'}"]`
      );
      if (!sockEl) return null;

      const cardRect = card.getBoundingClientRect();
      const sRect = sockEl.getBoundingClientRect();
      const node = this.engine.getNode(nodeId);
      if (!node) return null;

      const relX = (sRect.left + sRect.width / 2 - cardRect.left) / this.zoom;
      const relY = (sRect.top + sRect.height / 2 - cardRect.top) / this.zoom;

      return {
        x: node.x + relX,
        y: node.y + relY,
      };
    }

    // ── Interactive Minimap ──
    _renderMinimap() {
      if (!this.minimapCtx) return;
      const ctx = this.minimapCtx;
      const mw = this.minimapCanvas.width;
      const mh = this.minimapCanvas.height;

      ctx.clearRect(0, 0, mw, mh);
      ctx.fillStyle = 'rgba(20, 20, 24, 0.9)';
      ctx.fillRect(0, 0, mw, mh);

      const nodes = this.engine.getAllNodes();
      if (nodes.length === 0) return;

      // Compute bounding box of all nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + 180 > maxX) maxX = n.x + 180;
        if (n.y + 120 > maxY) maxY = n.y + 120;
      }

      const padding = 100;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;

      const spanX = Math.max(400, maxX - minX);
      const spanY = Math.max(300, maxY - minY);
      const scale = Math.min((mw - 10) / spanX, (mh - 10) / spanY);

      // Render miniature node rectangles
      for (const n of nodes) {
        const cat = CATEGORIES[n.category.toUpperCase()] || CATEGORIES.UTILITIES;
        const nx = 5 + (n.x - minX) * scale;
        const ny = 5 + (n.y - minY) * scale;
        const nw = Math.max(6, 180 * scale);
        const nh = Math.max(4, 80 * scale);

        ctx.fillStyle = cat.color;
        ctx.fillRect(nx, ny, nw, nh);
      }

      // Render current viewport view box
      const vpRect = this.viewport.getBoundingClientRect();
      const viewWorldX0 = -this.panX / this.zoom;
      const viewWorldY0 = -this.panY / this.zoom;
      const viewWorldW = vpRect.width / this.zoom;
      const viewWorldH = vpRect.height / this.zoom;

      const vx = 5 + (viewWorldX0 - minX) * scale;
      const vy = 5 + (viewWorldY0 - minY) * scale;
      const vw = viewWorldW * scale;
      const vh = viewWorldH * scale;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(vx, vy, vw, vh);
    }

    // ── Serialization & Integration ──
    serialize() {
      return {
        ...this.engine.serialize(),
        view: {
          panX: this.panX,
          panY: this.panY,
          zoom: this.zoom,
        },
      };
    }

    deserialize(data) {
      if (!data) return;
      this.engine.deserialize(data);
      if (data.view) {
        this.panX = Number(data.view.panX) || 140;
        this.panY = Number(data.view.panY) || 120;
        this.zoom = Number(data.view.zoom) || 1.0;
      }
      this._renderAllNodes();
      this._updateTransform();
      this._updatePropertiesInspector();
    }
  }

  // ── Global Export ──
  global.OptiLab = global.OptiLab || {};
  global.OptiLab.LogicEditor = LogicEditor;

})(typeof window !== 'undefined' ? window : globalThis);
