/**
 * OptiLab — Node-Based Visual Logic System (logic.js)
 *
 * Professional visual node-based programming engine inspired by
 * Unreal Engine Blueprints and Blender Geometry Nodes.
 *
 * Provides:
 *  - Typed Socket architecture (Execution & Data)
 *  - 7 Core Node Categories:
 *      1. Events (Simulation Started/Stopped, Sensor Detects/Stops Light, On Value Changed)
 *      2. Optical Inputs (Get Sensor Intensity, Sensor State, Laser State, Detected Wavelength)
 *      3. Logic (AND, OR, NOT, XOR, Branch, Compare, Greater Than, Less Than, Equal)
 *      4. Math (Add, Subtract, Multiply, Divide, Clamp, Map Range)
 *      5. Variables (Get Variable, Set Variable, Create Variable)
 *      6. LED Outputs (Turn LED ON/OFF, Set LED Brightness, Set LED Color)
 *      7. Utilities (Delay, Print / Debug, Bool to Number, Number to Bool)
 *  - Deterministic evaluation engine with cycle/loop protection
 *  - Event-driven + real-time optical simulation integration
 *  - Full serialization for .optp project files and IndexedDB
 */

(function (global) {
  'use strict';

  // ── Socket Types & Colors ──
  const SOCKET_TYPES = {
    EXEC: 'exec',
    BOOLEAN: 'boolean',
    NUMBER: 'number',
    STRING: 'string',
    COLOR: 'color',
    ANY: 'any',
  };

  const SOCKET_COLORS = {
    [SOCKET_TYPES.EXEC]: '#ffffff',
    [SOCKET_TYPES.BOOLEAN]: '#ef4444',
    [SOCKET_TYPES.NUMBER]: '#06b6d4',
    [SOCKET_TYPES.STRING]: '#f59e0b',
    [SOCKET_TYPES.COLOR]: '#a855f7',
    [SOCKET_TYPES.ANY]: '#94a3b8',
  };

  // ── Node Categories ──
  const CATEGORIES = {
    EVENTS: { id: 'events', label: 'Events', color: '#d97706', icon: '⚡' },
    INPUTS: { id: 'inputs', label: 'Optical Inputs', color: '#0284c7', icon: '👁' },
    LOGIC: { id: 'logic', label: 'Logic', color: '#2563eb', icon: '🔀' },
    MATH: { id: 'math', label: 'Math', color: '#059669', icon: '∑' },
    VARIABLES: { id: 'variables', label: 'Variables', color: '#7c3aed', icon: '📦' },
    OUTPUTS: { id: 'outputs', label: 'LED Outputs', color: '#dc2626', icon: '💡' },
    UTILITIES: { id: 'utilities', label: 'Utilities', color: '#475569', icon: '🛠' },
  };

  // ── Unique ID Generators ──
  let _nodeIdCounter = 0;
  let _wireIdCounter = 0;
  function nextNodeId() {
    return 'node_' + Date.now().toString(36) + '_' + (++_nodeIdCounter);
  }
  function nextWireId() {
    return 'wire_' + Date.now().toString(36) + '_' + (++_wireIdCounter);
  }

  // ── Helper Cast Functions ──
  function toBool(val) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val > 0;
    if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
    return Boolean(val);
  }

  function toNum(val, def = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : def;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // ── Node Definitions Catalog ──
  const NODE_DEFS = {
    // ══════════════════════════════════════════════════════════════════
    // 1. EVENTS
    // ══════════════════════════════════════════════════════════════════
    'event-simulation-started': {
      type: 'event-simulation-started',
      category: 'events',
      title: 'Simulation Started',
      description: 'Fires execution signal when logic simulation starts or project runs.',
      inputs: [],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
      ],
      defaultProps: {},
    },

    'event-simulation-stopped': {
      type: 'event-simulation-stopped',
      category: 'events',
      title: 'Simulation Stopped',
      description: 'Fires execution signal when logic simulation pauses or stops.',
      inputs: [],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
      ],
      defaultProps: {},
    },

    'event-sensor-detects': {
      type: 'event-sensor-detects',
      category: 'events',
      title: 'Sensor Detects Light',
      description: 'Fires when an optical detector starts receiving light rays.',
      inputs: [],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
        { id: 'sensorId', name: 'Sensor ID', type: SOCKET_TYPES.STRING },
        { id: 'intensity', name: 'Intensity', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {
        sensorId: '', // empty means any sensor
      },
    },

    'event-sensor-stops': {
      type: 'event-sensor-stops',
      category: 'events',
      title: 'Sensor Stops Detecting Light',
      description: 'Fires when an optical detector ceases receiving light rays.',
      inputs: [],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
        { id: 'sensorId', name: 'Sensor ID', type: SOCKET_TYPES.STRING },
      ],
      defaultProps: {
        sensorId: '',
      },
    },

    'event-value-changed': {
      type: 'event-value-changed',
      category: 'events',
      title: 'On Value Changed',
      description: 'Fires whenever a watched variable or sensor reading changes value.',
      inputs: [],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
        { id: 'value', name: 'Value', type: SOCKET_TYPES.ANY },
        { id: 'oldValue', name: 'Old Value', type: SOCKET_TYPES.ANY },
      ],
      defaultProps: {
        watchTarget: 'sensor', // 'sensor' or 'variable'
        targetId: '',
        varName: '',
      },
    },

    // ══════════════════════════════════════════════════════════════════
    // 2. OPTICAL INPUTS
    // ══════════════════════════════════════════════════════════════════
    'input-sensor-intensity': {
      type: 'input-sensor-intensity',
      category: 'inputs',
      title: 'Get Sensor Intensity',
      description: 'Reads current light intensity (0–100%) from an optical detector.',
      inputs: [],
      outputs: [
        { id: 'intensity', name: 'Intensity', type: SOCKET_TYPES.NUMBER },
        { id: 'raw', name: 'Raw Power', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {
        sensorId: '',
      },
      evaluateData(node, socketId, ctx) {
        const det = ctx.findDetector(node.properties.sensorId);
        if (!det) return 0;
        const raw = det.totalIntensity || 0;
        // Scaled to 0-100% where full single laser ray is 100%
        const intensity = det.detected
          ? Math.min(100, Math.round(Math.max(det.peakIntensity * 100, Math.min(100, raw * 20))))
          : 0;
        return socketId === 'raw' ? Math.round(raw * 100) / 100 : intensity;
      },
    },

    'input-sensor-state': {
      type: 'input-sensor-state',
      category: 'inputs',
      title: 'Get Sensor State',
      description: 'Checks whether an optical detector is currently detecting light (True/False).',
      inputs: [],
      outputs: [
        { id: 'detected', name: 'Detected', type: SOCKET_TYPES.BOOLEAN },
      ],
      defaultProps: {
        sensorId: '',
      },
      evaluateData(node, _socketId, ctx) {
        const det = ctx.findDetector(node.properties.sensorId);
        return Boolean(det && det.detected);
      },
    },

    'input-laser-state': {
      type: 'input-laser-state',
      category: 'inputs',
      title: 'Get Laser State',
      description: 'Reads state and intensity from a Laser or LED source.',
      inputs: [],
      outputs: [
        { id: 'isOn', name: 'Is On', type: SOCKET_TYPES.BOOLEAN },
        { id: 'intensity', name: 'Intensity (%)', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {
        laserId: '',
      },
      evaluateData(node, socketId, ctx) {
        const laser = ctx.findLaser(node.properties.laserId);
        if (!laser) return socketId === 'isOn' ? false : 0;
        const isOn = laser.enabled !== false && laser.intensity > 0.001;
        if (socketId === 'isOn') return isOn;
        return Math.round((laser.intensity || 0) * 100);
      },
    },

    'input-detected-wavelength': {
      type: 'input-detected-wavelength',
      category: 'inputs',
      title: 'Get Detected Wavelength',
      description: 'Returns the dominant wavelength (in nanometers) detected by the optical sensor.',
      inputs: [],
      outputs: [
        { id: 'wavelength', name: 'Wavelength (nm)', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {
        sensorId: '',
      },
      evaluateData(node, _socketId, ctx) {
        const det = ctx.findDetector(node.properties.sensorId);
        return det && det.detected ? det.avgWavelength || 550 : 0;
      },
    },

    // ══════════════════════════════════════════════════════════════════
    // 3. LOGIC
    // ══════════════════════════════════════════════════════════════════
    'logic-and': {
      type: 'logic-and',
      category: 'logic',
      title: 'AND',
      description: 'Returns True if both input A and input B are True.',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.BOOLEAN, defaultValue: false },
        { id: 'b', name: 'B', type: SOCKET_TYPES.BOOLEAN, defaultValue: false },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.BOOLEAN },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        const a = toBool(ctx.getInputValue(node, 'a'));
        const b = toBool(ctx.getInputValue(node, 'b'));
        return a && b;
      },
    },

    'logic-or': {
      type: 'logic-or',
      category: 'logic',
      title: 'OR',
      description: 'Returns True if at least one input is True.',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.BOOLEAN, defaultValue: false },
        { id: 'b', name: 'B', type: SOCKET_TYPES.BOOLEAN, defaultValue: false },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.BOOLEAN },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        const a = toBool(ctx.getInputValue(node, 'a'));
        const b = toBool(ctx.getInputValue(node, 'b'));
        return a || b;
      },
    },

    'logic-not': {
      type: 'logic-not',
      category: 'logic',
      title: 'NOT',
      description: 'Inverts boolean input (True becomes False, False becomes True).',
      inputs: [
        { id: 'in', name: 'In', type: SOCKET_TYPES.BOOLEAN, defaultValue: false },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.BOOLEAN },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        return !toBool(ctx.getInputValue(node, 'in'));
      },
    },

    'logic-xor': {
      type: 'logic-xor',
      category: 'logic',
      title: 'XOR',
      description: 'Returns True if exactly one of A or B is True, but not both.',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.BOOLEAN, defaultValue: false },
        { id: 'b', name: 'B', type: SOCKET_TYPES.BOOLEAN, defaultValue: false },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.BOOLEAN },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        const a = toBool(ctx.getInputValue(node, 'a'));
        const b = toBool(ctx.getInputValue(node, 'b'));
        return a !== b;
      },
    },

    'logic-branch': {
      type: 'logic-branch',
      category: 'logic',
      title: 'Branch (If / Else)',
      description: 'Routes execution flow along True or False branch based on Condition.',
      inputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
        { id: 'condition', name: 'Condition', type: SOCKET_TYPES.BOOLEAN, defaultValue: false },
      ],
      outputs: [
        { id: 'true', name: 'True', type: SOCKET_TYPES.EXEC },
        { id: 'false', name: 'False', type: SOCKET_TYPES.EXEC },
      ],
      defaultProps: {},
      execute(node, ctx) {
        const cond = toBool(ctx.getInputValue(node, 'condition'));
        const outSocket = cond ? 'true' : 'false';
        ctx.triggerExecOut(node, outSocket);
      },
    },

    'logic-compare': {
      type: 'logic-compare',
      category: 'logic',
      title: 'Compare',
      description: 'Compares two numeric values using selectable operator (=, ≠, >, <, ≥, ≤).',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'b', name: 'B', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.BOOLEAN },
      ],
      defaultProps: {
        operator: '>', // '==', '!=', '>', '<', '>=', '<='
      },
      evaluateData(node, _socketId, ctx) {
        const a = toNum(ctx.getInputValue(node, 'a'));
        const b = toNum(ctx.getInputValue(node, 'b'));
        const op = node.properties.operator || '>';
        switch (op) {
          case '==': return Math.abs(a - b) < 0.0001;
          case '!=': return Math.abs(a - b) >= 0.0001;
          case '>':  return a > b;
          case '<':  return a < b;
          case '>=': return a >= b;
          case '<=': return a <= b;
          default:   return false;
        }
      },
    },

    'logic-greater-than': {
      type: 'logic-greater-than',
      category: 'logic',
      title: 'Greater Than',
      description: 'Returns True if A is strictly greater than B.',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'b', name: 'B', type: SOCKET_TYPES.NUMBER, defaultValue: 50 },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.BOOLEAN },
      ],
      defaultProps: {
        threshold: 50,
      },
      evaluateData(node, _socketId, ctx) {
        const a = toNum(ctx.getInputValue(node, 'a'));
        const b = toNum(ctx.getInputValue(node, 'b', node.properties.threshold ?? 50));
        return a > b;
      },
    },

    'logic-less-than': {
      type: 'logic-less-than',
      category: 'logic',
      title: 'Less Than',
      description: 'Returns True if A is strictly less than B.',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'b', name: 'B', type: SOCKET_TYPES.NUMBER, defaultValue: 50 },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.BOOLEAN },
      ],
      defaultProps: {
        threshold: 50,
      },
      evaluateData(node, _socketId, ctx) {
        const a = toNum(ctx.getInputValue(node, 'a'));
        const b = toNum(ctx.getInputValue(node, 'b', node.properties.threshold ?? 50));
        return a < b;
      },
    },

    'logic-equal': {
      type: 'logic-equal',
      category: 'logic',
      title: 'Equal',
      description: 'Returns True if A equals B.',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.ANY, defaultValue: 0 },
        { id: 'b', name: 'B', type: SOCKET_TYPES.ANY, defaultValue: 0 },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.BOOLEAN },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        const a = ctx.getInputValue(node, 'a');
        const b = ctx.getInputValue(node, 'b');
        if (typeof a === 'number' && typeof b === 'number') {
          return Math.abs(a - b) < 0.0001;
        }
        return a == b;
      },
    },

    // ══════════════════════════════════════════════════════════════════
    // 4. MATH
    // ══════════════════════════════════════════════════════════════════
    'math-add': {
      type: 'math-add',
      category: 'math',
      title: 'Add',
      description: 'Calculates the sum of A and B (A + B).',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'b', name: 'B', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        const a = toNum(ctx.getInputValue(node, 'a'));
        const b = toNum(ctx.getInputValue(node, 'b'));
        return Math.round((a + b) * 1000) / 1000;
      },
    },

    'math-subtract': {
      type: 'math-subtract',
      category: 'math',
      title: 'Subtract',
      description: 'Calculates the difference of A and B (A - B).',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'b', name: 'B', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        const a = toNum(ctx.getInputValue(node, 'a'));
        const b = toNum(ctx.getInputValue(node, 'b'));
        return Math.round((a - b) * 1000) / 1000;
      },
    },

    'math-multiply': {
      type: 'math-multiply',
      category: 'math',
      title: 'Multiply',
      description: 'Calculates the product of A and B (A × B).',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.NUMBER, defaultValue: 1 },
        { id: 'b', name: 'B', type: SOCKET_TYPES.NUMBER, defaultValue: 1 },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        const a = toNum(ctx.getInputValue(node, 'a', 1));
        const b = toNum(ctx.getInputValue(node, 'b', 1));
        return Math.round(a * b * 1000) / 1000;
      },
    },

    'math-divide': {
      type: 'math-divide',
      category: 'math',
      title: 'Divide',
      description: 'Calculates the quotient of A and B (A ÷ B), safe against divide-by-zero.',
      inputs: [
        { id: 'a', name: 'A', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'b', name: 'B', type: SOCKET_TYPES.NUMBER, defaultValue: 1 },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        const a = toNum(ctx.getInputValue(node, 'a'));
        const b = toNum(ctx.getInputValue(node, 'b', 1));
        if (Math.abs(b) < 1e-9) return 0;
        return Math.round((a / b) * 1000) / 1000;
      },
    },

    'math-clamp': {
      type: 'math-clamp',
      category: 'math',
      title: 'Clamp',
      description: 'Constrains a value to lie between a specified Min and Max range.',
      inputs: [
        { id: 'val', name: 'Value', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'min', name: 'Min', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'max', name: 'Max', type: SOCKET_TYPES.NUMBER, defaultValue: 100 },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {
        min: 0,
        max: 100,
      },
      evaluateData(node, _socketId, ctx) {
        const val = toNum(ctx.getInputValue(node, 'val'));
        const min = toNum(ctx.getInputValue(node, 'min', node.properties.min ?? 0));
        const max = toNum(ctx.getInputValue(node, 'max', node.properties.max ?? 100));
        return clamp(val, Math.min(min, max), Math.max(min, max));
      },
    },

    'math-map-range': {
      type: 'math-map-range',
      category: 'math',
      title: 'Map Range',
      description: 'Linearly re-maps a value from one range [InMin, InMax] to another [OutMin, OutMax].',
      inputs: [
        { id: 'val', name: 'Value', type: SOCKET_TYPES.NUMBER, defaultValue: 50 },
        { id: 'inMin', name: 'In Min', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'inMax', name: 'In Max', type: SOCKET_TYPES.NUMBER, defaultValue: 100 },
        { id: 'outMin', name: 'Out Min', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'outMax', name: 'Out Max', type: SOCKET_TYPES.NUMBER, defaultValue: 1 },
      ],
      outputs: [
        { id: 'result', name: 'Result', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        const v = toNum(ctx.getInputValue(node, 'val', 0));
        const inMin = toNum(ctx.getInputValue(node, 'inMin', 0));
        const inMax = toNum(ctx.getInputValue(node, 'inMax', 100));
        const outMin = toNum(ctx.getInputValue(node, 'outMin', 0));
        const outMax = toNum(ctx.getInputValue(node, 'outMax', 1));
        const spanIn = inMax - inMin;
        if (Math.abs(spanIn) < 1e-9) return outMin;
        const normalized = (v - inMin) / spanIn;
        return Math.round((outMin + normalized * (outMax - outMin)) * 1000) / 1000;
      },
    },

    'math-random': {
      type: 'math-random',
      category: 'math',
      title: 'Random Number',
      description: 'Generates a pseudo-random number between Min and Max (float or whole integer).',
      inputs: [
        { id: 'min', name: 'Min', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
        { id: 'max', name: 'Max', type: SOCKET_TYPES.NUMBER, defaultValue: 100 },
      ],
      outputs: [
        { id: 'val', name: 'Value', type: SOCKET_TYPES.NUMBER },
        { id: 'int', name: 'Integer', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {
        min: 0,
        max: 100,
        integer: false,
      },
      evaluateData(node, socketId, ctx) {
        const min = toNum(ctx.getInputValue(node, 'min', node.properties.min ?? 0));
        const max = toNum(ctx.getInputValue(node, 'max', node.properties.max ?? 100));
        const low = Math.min(min, max);
        const high = Math.max(min, max);
        const rnd = low + Math.random() * (high - low);
        if (socketId === 'int' || Boolean(node.properties.integer)) {
          return Math.round(rnd);
        }
        return Math.round(rnd * 1000) / 1000;
      },
    },

    // ══════════════════════════════════════════════════════════════════
    // 5. VARIABLES
    // ══════════════════════════════════════════════════════════════════
    'variable-get': {
      type: 'variable-get',
      category: 'variables',
      title: 'Get Variable',
      description: 'Retrieves the current value of a named graph variable.',
      inputs: [],
      outputs: [
        { id: 'val', name: 'Value', type: SOCKET_TYPES.ANY },
      ],
      defaultProps: {
        varName: 'myVar',
      },
      evaluateData(node, _socketId, ctx) {
        const name = String(node.properties.varName || 'myVar');
        return ctx.getVariable(name);
      },
    },

    'variable-set': {
      type: 'variable-set',
      category: 'variables',
      title: 'Set Variable',
      description: 'Assigns a new value to a named graph variable and passes execution.',
      inputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
        { id: 'val', name: 'Value', type: SOCKET_TYPES.ANY, defaultValue: 0 },
      ],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
        { id: 'val', name: 'Value', type: SOCKET_TYPES.ANY },
      ],
      defaultProps: {
        varName: 'myVar',
      },
      execute(node, ctx) {
        const name = String(node.properties.varName || 'myVar');
        const value = ctx.getInputValue(node, 'val');
        ctx.setVariable(name, value);
        ctx.triggerExecOut(node, 'exec');
      },
      evaluateData(node, _socketId, ctx) {
        const name = String(node.properties.varName || 'myVar');
        return ctx.getVariable(name);
      },
    },

    'variable-create': {
      type: 'variable-create',
      category: 'variables',
      title: 'Create Variable',
      description: 'Declares a graph variable with an initial default value.',
      inputs: [],
      outputs: [
        { id: 'val', name: 'Value', type: SOCKET_TYPES.ANY },
      ],
      defaultProps: {
        varName: 'counter',
        varType: 'number',
        initialValue: 0,
      },
      evaluateData(node, _socketId, ctx) {
        const name = String(node.properties.varName || 'counter');
        return ctx.getVariable(name, node.properties.initialValue ?? 0);
      },
    },

    // ══════════════════════════════════════════════════════════════════
    // 6. LED OUTPUTS
    // ══════════════════════════════════════════════════════════════════
    'output-led-on': {
      type: 'output-led-on',
      category: 'outputs',
      title: 'Turn LED ON',
      description: 'Powers on the referenced Laser, White LED or RGB LED source.',
      inputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
      ],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
      ],
      defaultProps: {
        targetId: '', // empty defaults to first laser/LED
      },
      execute(node, ctx) {
        const laser = ctx.findLaser(node.properties.targetId);
        if (laser) {
          laser.enabled = true;
          if (laser.intensity <= 0.001) {
            laser.intensity = 1.0;
          }
          ctx.requestOpticsUpdate();
          ctx.log(node, `Turned ON: ${laser.type} (${laser.id})`, 'info');
        } else {
          ctx.log(node, 'No target LED/Laser found on optical bench', 'warn');
        }
        ctx.triggerExecOut(node, 'exec');
      },
    },

    'output-led-off': {
      type: 'output-led-off',
      category: 'outputs',
      title: 'Turn LED OFF',
      description: 'Powers off the referenced Laser, White LED or RGB LED source.',
      inputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
      ],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
      ],
      defaultProps: {
        targetId: '',
      },
      execute(node, ctx) {
        const laser = ctx.findLaser(node.properties.targetId);
        if (laser) {
          laser.enabled = false;
          ctx.requestOpticsUpdate();
          ctx.log(node, `Turned OFF: ${laser.type} (${laser.id})`, 'info');
        } else {
          ctx.log(node, 'No target LED/Laser found on optical bench', 'warn');
        }
        ctx.triggerExecOut(node, 'exec');
      },
    },

    'output-led-brightness': {
      type: 'output-led-brightness',
      category: 'outputs',
      title: 'Set LED Brightness',
      description: 'Modulates brightness level (0% - 100%) of target Laser or LED.',
      inputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
        { id: 'brightness', name: 'Brightness (%)', type: SOCKET_TYPES.NUMBER, defaultValue: 100 },
      ],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
      ],
      defaultProps: {
        targetId: '',
        defaultBrightness: 100,
      },
      execute(node, ctx) {
        const laser = ctx.findLaser(node.properties.targetId);
        if (laser) {
          const raw = toNum(ctx.getInputValue(node, 'brightness', node.properties.defaultBrightness ?? 100));
          const normalized = clamp(raw > 1.0 ? raw / 100 : raw, 0, 1);
          laser.intensity = normalized;
          laser.enabled = normalized > 0.001;
          ctx.requestOpticsUpdate();
          ctx.log(node, `Set brightness to ${Math.round(normalized * 100)}% on ${laser.id}`, 'info');
        }
        ctx.triggerExecOut(node, 'exec');
      },
    },

    'output-led-color': {
      type: 'output-led-color',
      category: 'outputs',
      title: 'Set LED Color',
      description: 'Sets wavelength or RGB channels on the target light source.',
      inputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
        { id: 'r', name: 'R', type: SOCKET_TYPES.NUMBER, defaultValue: 1.0 },
        { id: 'g', name: 'G', type: SOCKET_TYPES.NUMBER, defaultValue: 1.0 },
        { id: 'b', name: 'B', type: SOCKET_TYPES.NUMBER, defaultValue: 1.0 },
        { id: 'wavelength', name: 'Wavelength (nm)', type: SOCKET_TYPES.NUMBER, defaultValue: 550 },
      ],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
      ],
      defaultProps: {
        targetId: '',
      },
      execute(node, ctx) {
        const laser = ctx.findLaser(node.properties.targetId);
        if (laser) {
          if (laser.isRgbLed && typeof laser.setRgb === 'function') {
            const r = clamp(toNum(ctx.getInputValue(node, 'r', 1.0)), 0, 1);
            const g = clamp(toNum(ctx.getInputValue(node, 'g', 1.0)), 0, 1);
            const b = clamp(toNum(ctx.getInputValue(node, 'b', 1.0)), 0, 1);
            laser.setRgb(r, g, b);
          } else if (typeof laser.setWavelength === 'function') {
            const wl = toNum(ctx.getInputValue(node, 'wavelength', 550));
            laser.setWavelength(wl);
          }
          ctx.requestOpticsUpdate();
          ctx.log(node, `Updated color on ${laser.id}`, 'info');
        }
        ctx.triggerExecOut(node, 'exec');
      },
    },

    // ══════════════════════════════════════════════════════════════════
    // 7. UTILITIES
    // ══════════════════════════════════════════════════════════════════
    'utility-delay': {
      type: 'utility-delay',
      category: 'utilities',
      title: 'Delay',
      description: 'Pauses execution flow for specified duration in milliseconds.',
      inputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
        { id: 'duration', name: 'Duration (ms)', type: SOCKET_TYPES.NUMBER, defaultValue: 500 },
      ],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
      ],
      defaultProps: {
        duration: 500,
      },
      execute(node, ctx) {
        const dur = Math.max(10, toNum(ctx.getInputValue(node, 'duration', node.properties.duration ?? 500)));
        ctx.scheduleDelay(node, dur, () => {
          ctx.triggerExecOut(node, 'exec');
        });
      },
    },

    'utility-print-debug': {
      type: 'utility-print-debug',
      category: 'utilities',
      title: 'Print / Debug',
      description: 'Logs message or value to the Logic Console with timestamp.',
      inputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
        { id: 'value', name: 'Value', type: SOCKET_TYPES.ANY, defaultValue: 'Hello OptiLab' },
      ],
      outputs: [
        { id: 'exec', name: '', type: SOCKET_TYPES.EXEC },
      ],
      defaultProps: {},
      execute(node, ctx) {
        const val = ctx.getInputValue(node, 'value');
        ctx.log(node, `[Print] ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`, 'debug');
        ctx.triggerExecOut(node, 'exec');
      },
    },

    'utility-bool-to-number': {
      type: 'utility-bool-to-number',
      category: 'utilities',
      title: 'Boolean to Number',
      description: 'Converts boolean value to number (True = 1, False = 0).',
      inputs: [
        { id: 'in', name: 'Bool', type: SOCKET_TYPES.BOOLEAN, defaultValue: false },
      ],
      outputs: [
        { id: 'out', name: 'Number', type: SOCKET_TYPES.NUMBER },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        return toBool(ctx.getInputValue(node, 'in')) ? 1 : 0;
      },
    },

    'utility-number-to-bool': {
      type: 'utility-number-to-bool',
      category: 'utilities',
      title: 'Number to Boolean',
      description: 'Converts number to boolean (greater than 0 = True, otherwise False).',
      inputs: [
        { id: 'in', name: 'Number', type: SOCKET_TYPES.NUMBER, defaultValue: 0 },
      ],
      outputs: [
        { id: 'out', name: 'Bool', type: SOCKET_TYPES.BOOLEAN },
      ],
      defaultProps: {},
      evaluateData(node, _socketId, ctx) {
        return toNum(ctx.getInputValue(node, 'in')) > 0;
      },
    },
  };

  // ── Logic Node Model ──
  class LogicNode {
    constructor(type, x = 100, y = 100, customId = null) {
      const def = NODE_DEFS[type];
      if (!def) {
        throw new Error(`Unknown logic node type: "${type}"`);
      }
      this.id = customId || nextNodeId();
      this.type = type;
      this.category = def.category;
      this.title = def.title;
      this.x = Math.round(x);
      this.y = Math.round(y);

      // Deep copy socket definitions
      this.inputs = def.inputs.map((s) => ({ ...s }));
      this.outputs = def.outputs.map((s) => ({ ...s }));

      // Properties & custom inline input values for disconnected sockets
      this.properties = { ...def.defaultProps };
      this.customValues = {};

      // Initialize default values for inputs
      for (const inp of this.inputs) {
        if (inp.defaultValue !== undefined) {
          this.customValues[inp.id] = inp.defaultValue;
        }
      }

      // Live Execution State
      this.isExecuting = false;
      this.execPulseTimer = null;
      this.hasError = false;
      this.errorMessage = '';
      this.lastOutputValues = {};
    }

    toJSON() {
      return {
        id: this.id,
        type: this.type,
        title: this.title,
        x: this.x,
        y: this.y,
        properties: { ...this.properties },
        customValues: { ...this.customValues },
      };
    }

    static fromJSON(data) {
      if (!data || !data.type || !NODE_DEFS[data.type]) {
        return null;
      }
      const node = new LogicNode(data.type, data.x, data.y, data.id);
      if (data.properties && typeof data.properties === 'object') {
        node.properties = { ...node.properties, ...data.properties };
      }
      if (data.customValues && typeof data.customValues === 'object') {
        node.customValues = { ...node.customValues, ...data.customValues };
      }
      if (data.title) {
        node.title = data.title;
      }
      return node;
    }
  }

  // ── Logic Wire Model ──
  class LogicWire {
    constructor(fromNodeId, fromSocketId, toNodeId, toSocketId, type = SOCKET_TYPES.EXEC, customId = null) {
      this.id = customId || nextWireId();
      this.fromNode = fromNodeId;
      this.fromSocket = fromSocketId;
      this.toNode = toNodeId;
      this.toSocket = toSocketId;
      this.type = type;
      this.pulseTime = 0; // timestamp when exec pulse traveled
    }

    toJSON() {
      return {
        id: this.id,
        fromNode: this.fromNode,
        fromSocket: this.fromSocket,
        toNode: this.toNode,
        toSocket: this.toSocket,
        type: this.type,
      };
    }

    static fromJSON(data) {
      if (!data || !data.fromNode || !data.fromSocket || !data.toNode || !data.toSocket) {
        return null;
      }
      return new LogicWire(
        data.fromNode,
        data.fromSocket,
        data.toNode,
        data.toSocket,
        data.type || SOCKET_TYPES.EXEC,
        data.id
      );
    }
  }

  // ── Logic Engine ──
  class LogicEngine {
    constructor(app = null) {
      this.app = app; // OptiLabApp reference
      this.nodes = new Map(); // id -> LogicNode
      this.wires = new Map(); // id -> LogicWire
      this.variables = new Map(); // name -> value

      // Execution Engine Control
      this.running = false;
      this.tickRate = 30; // Hz
      this._timer = null;
      this._activeDelays = new Set();
      this.executionCount = 0;
      this.lastTickTime = 0;

      // Telemetry cache to detect optical sensor transitions
      this._sensorStates = new Map(); // sensorId -> { detected, intensity, wavelength }

      // Console logs
      this.logs = [];
      this.maxLogs = 200;
      this.onLogCallback = null;
      this.onExecutionStateChange = null;
    }

    // ── Graph Construction ──
    addNode(type, x = 100, y = 100) {
      const node = new LogicNode(type, x, y);
      this.nodes.set(node.id, node);
      return node;
    }

    removeNode(nodeId) {
      if (!this.nodes.has(nodeId)) return false;
      // Remove any connected wires first
      const connected = Array.from(this.wires.values()).filter(
        (w) => w.fromNode === nodeId || w.toNode === nodeId
      );
      for (const w of connected) {
        this.wires.delete(w.id);
      }
      this.nodes.delete(nodeId);
      return true;
    }

    getNode(nodeId) {
      return this.nodes.get(nodeId);
    }

    getAllNodes() {
      return Array.from(this.nodes.values());
    }

    getAllWires() {
      return Array.from(this.wires.values());
    }

    connect(fromNodeId, fromSocketId, toNodeId, toSocketId) {
      const fromNode = this.nodes.get(fromNodeId);
      const toNode = this.nodes.get(toNodeId);
      if (!fromNode || !toNode) return null;
      if (fromNodeId === toNodeId) return null; // No self loops directly

      const outSocket = fromNode.outputs.find((s) => s.id === fromSocketId);
      const inSocket = toNode.inputs.find((s) => s.id === toSocketId);
      if (!outSocket || !inSocket) return null;

      // Type compatibility verification
      if (!this.isCompatible(outSocket.type, inSocket.type)) {
        return null;
      }

      // Check if target input already has a connection; single connection per input socket
      const existingInWire = Array.from(this.wires.values()).find(
        (w) => w.toNode === toNodeId && w.toSocket === toSocketId
      );
      if (existingInWire) {
        this.wires.delete(existingInWire.id);
      }

      const wire = new LogicWire(fromNodeId, fromSocketId, toNodeId, toSocketId, outSocket.type);
      this.wires.set(wire.id, wire);
      return wire;
    }

    disconnect(wireId) {
      return this.wires.delete(wireId);
    }

    isCompatible(fromType, toType) {
      if (fromType === toType) return true;
      if (toType === SOCKET_TYPES.ANY || fromType === SOCKET_TYPES.ANY) return true;
      // Allow number <-> boolean implicit cast
      if (
        (fromType === SOCKET_TYPES.NUMBER && toType === SOCKET_TYPES.BOOLEAN) ||
        (fromType === SOCKET_TYPES.BOOLEAN && toType === SOCKET_TYPES.NUMBER)
      ) {
        return true;
      }
      return false;
    }

    clear() {
      this.stop();
      this._cancelAllDelays();
      this.nodes.clear();
      this.wires.clear();
      this.variables.clear();
      this.logs = [];
      this._sensorStates.clear();
      if (this.onLogCallback) this.onLogCallback();
    }

    // ── Variable Store ──
    getVariable(name, def = 0) {
      if (this.variables.has(name)) {
        return this.variables.get(name);
      }
      return def;
    }

    setVariable(name, value) {
      const old = this.variables.get(name);
      this.variables.set(name, value);
      if (old !== value) {
        this._fireEvent('event-value-changed', {
          watchTarget: 'variable',
          varName: name,
          value,
          oldValue: old,
        });
      }
    }

    // ── Logging & Diagnostics ──
    log(node, message, level = 'info') {
      const entry = {
        id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        time: new Date().toLocaleTimeString(),
        timestamp: Date.now(),
        nodeId: node ? node.id : 'engine',
        nodeTitle: node ? node.title : 'System',
        message: String(message),
        level,
      };
      this.logs.push(entry);
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
      if (typeof this.onLogCallback === 'function') {
        this.onLogCallback(entry);
      }
    }

    clearLogs() {
      this.logs = [];
      if (typeof this.onLogCallback === 'function') {
        this.onLogCallback();
      }
    }

    // ── Execution Engine Controls ──
    start() {
      if (this.running) return;
      this.running = true;
      this.executionCount = 0;
      this.log(null, 'Logic execution started', 'info');

      // Trigger Simulation Started events
      this._fireEvent('event-simulation-started');

      if (this.onExecutionStateChange) this.onExecutionStateChange(true);

      const intervalMs = Math.round(1000 / this.tickRate);
      this._timer = setInterval(() => this.tick(), intervalMs);
    }

    stop() {
      if (!this.running) return;
      this.running = false;
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
      this._cancelAllDelays();

      // Trigger Simulation Stopped events
      this._fireEvent('event-simulation-stopped');

      this.log(null, 'Logic execution stopped', 'info');
      if (this.onExecutionStateChange) this.onExecutionStateChange(false);
    }

    step() {
      const wasRunning = this.running;
      if (wasRunning) this.stop();
      this.tick(true);
    }

    reset() {
      this.stop();
      this._cancelAllDelays();
      for (const node of this.nodes.values()) {
        node.isExecuting = false;
        node.hasError = false;
        node.errorMessage = '';
      }
      this.variables.clear();
      this._sensorStates.clear();
      this.log(null, 'Logic execution reset', 'info');
    }

    _cancelAllDelays() {
      for (const timerId of this._activeDelays) {
        clearTimeout(timerId);
      }
      this._activeDelays.clear();
    }

    // ── Real-Time Simulation Tick ──
    tick(force = false) {
      if (!this.running && !force) return;
      this.executionCount++;
      this.lastTickTime = Date.now();

      // 1. Synchronize and observe optical detectors on the bench
      this._checkSensorTransitions();

      // 2. Continuous Reactive Evaluation for active data graphs
      // Check if there are active branch or output nodes needing real-time evaluation
      this._evaluateReactiveTriggers();
    }

    _checkSensorTransitions() {
      if (!this.app || !this.app.components) return;

      const detectors = this.app.components.filter((c) => c.type === 'optical-detector');

      for (const det of detectors) {
        const id = det.id;
        const prev = this._sensorStates.get(id) || {
          detected: false,
          intensity: 0,
          wavelength: 0,
        };

        const nowDetected = Boolean(det.detected);
        const nowIntensity = det.detected
          ? Math.min(100, Math.round(Math.max(det.peakIntensity * 100, Math.min(100, (det.totalIntensity || 0) * 20))))
          : 0;
        const nowWavelength = det.avgWavelength || 550;

        // Transition: detected false -> true
        if (!prev.detected && nowDetected) {
          this._fireEvent('event-sensor-detects', {
            sensorId: id,
            intensity: nowIntensity,
          });
        }
        // Transition: detected true -> false
        else if (prev.detected && !nowDetected) {
          this._fireEvent('event-sensor-stops', {
            sensorId: id,
          });
        }

        // Value changed on sensor intensity
        if (Math.abs(prev.intensity - nowIntensity) > 2) {
          this._fireEvent('event-value-changed', {
            watchTarget: 'sensor',
            targetId: id,
            value: nowIntensity,
            oldValue: prev.intensity,
          });
        }

        this._sensorStates.set(id, {
          detected: nowDetected,
          intensity: nowIntensity,
          wavelength: nowWavelength,
        });
      }
    }

    _evaluateReactiveTriggers() {
      // In visual node programming, when Branch or outputs are connected downstream of
      // continuous events (like Simulation Started, or real-time reactive tick):
      const starterNodes = Array.from(this.nodes.values()).filter(
        (n) => n.type === 'event-simulation-started'
      );
      for (const startNode of starterNodes) {
        const ctx = this._createExecutionContext();
        this._pulseNode(startNode);
        ctx.triggerExecOut(startNode, 'exec');
      }
    }

    _fireEvent(eventType, payload = {}) {
      const eventNodes = Array.from(this.nodes.values()).filter((n) => n.type === eventType);

      for (const node of eventNodes) {
        // Filter by sensorId if specific sensor is requested
        if (node.properties.sensorId && payload.sensorId && node.properties.sensorId !== payload.sensorId) {
          continue;
        }
        if (node.properties.watchTarget && payload.watchTarget && node.properties.watchTarget !== payload.watchTarget) {
          continue;
        }

        const ctx = this._createExecutionContext();
        this._pulseNode(node);

        // Populate event output values
        if (payload.sensorId) node.lastOutputValues['sensorId'] = payload.sensorId;
        if (payload.intensity !== undefined) node.lastOutputValues['intensity'] = payload.intensity;
        if (payload.value !== undefined) node.lastOutputValues['value'] = payload.value;
        if (payload.oldValue !== undefined) node.lastOutputValues['oldValue'] = payload.oldValue;

        // Trigger execution output
        ctx.triggerExecOut(node, 'exec');
      }
    }

    _pulseNode(node) {
      node.isExecuting = true;
      if (node.execPulseTimer) clearTimeout(node.execPulseTimer);
      node.execPulseTimer = setTimeout(() => {
        node.isExecuting = false;
      }, 150);
    }

    _pulseWire(wire) {
      wire.pulseTime = Date.now();
    }

    // ── Execution Context & Deterministic Evaluation ──
    _createExecutionContext() {
      const self = this;
      let callDepth = 0;
      const MAX_CALL_DEPTH = 300; // loop protection limit

      const ctx = {
        engine: self,
        app: self.app,

        findDetector(id) {
          if (!self.app || !self.app.components) return null;
          if (id) {
            const found = self.app.components.find((c) => c.id === id);
            if (found) return found;
          }
          // Default to first detector on bench
          return self.app.components.find((c) => c.type === 'optical-detector') || null;
        },

        findLaser(id) {
          if (!self.app || !self.app.components) return null;
          if (id) {
            const found = self.app.components.find((c) => c.id === id);
            if (found) return found;
          }
          // Default to first laser or LED on bench
          return (
            self.app.components.find(
              (c) => c.type === 'laser' || c.type === 'white-led' || c.type === 'rgb-led'
            ) || null
          );
        },

        requestOpticsUpdate() {
          if (self.app && typeof self.app.requestUpdate === 'function') {
            self.app.requestUpdate();
          }
        },

        getVariable(name, def = 0) {
          return self.getVariable(name, def);
        },

        setVariable(name, value) {
          self.setVariable(name, value);
        },

        log(node, msg, level) {
          self.log(node, msg, level);
        },

        scheduleDelay(node, durationMs, callback) {
          self._pulseNode(node);
          const tid = setTimeout(() => {
            self._activeDelays.delete(tid);
            try {
              callback();
            } catch (err) {
              self._handleError(node, err);
            }
          }, durationMs);
          self._activeDelays.add(tid);
        },

        getInputValue(node, socketId, fallback = undefined) {
          // Check if socket is connected via a wire
          const wire = Array.from(self.wires.values()).find(
            (w) => w.toNode === node.id && w.toSocket === socketId
          );

          if (!wire) {
            // Unconnected socket: read inline custom value or fallback
            if (node.customValues[socketId] !== undefined) {
              return node.customValues[socketId];
            }
            return fallback;
          }

          // Socket is connected: pull-evaluate source node
          const fromNode = self.nodes.get(wire.fromNode);
          if (!fromNode) return fallback;

          return ctx.evaluateDataOutput(fromNode, wire.fromSocket);
        },

        evaluateDataOutput(fromNode, fromSocketId) {
          const def = NODE_DEFS[fromNode.type];
          if (!def) return 0;

          try {
            if (typeof def.evaluateData === 'function') {
              const res = def.evaluateData(fromNode, fromSocketId, ctx);
              fromNode.lastOutputValues[fromSocketId] = res;
              return res;
            }
            // Return cached or event output
            return fromNode.lastOutputValues[fromSocketId] ?? 0;
          } catch (err) {
            self._handleError(fromNode, err);
            return 0;
          }
        },

        triggerExecOut(node, outSocketId) {
          callDepth++;
          if (callDepth > MAX_CALL_DEPTH) {
            self._handleError(node, new Error('Infinite execution loop prevented (Call depth > 300)'));
            return;
          }

          self._pulseNode(node);

          // Find outgoing execution wires
          const outWires = Array.from(self.wires.values()).filter(
            (w) => w.fromNode === node.id && w.fromSocket === outSocketId
          );

          for (const wire of outWires) {
            self._pulseWire(wire);
            const nextNode = self.nodes.get(wire.toNode);
            if (!nextNode) continue;

            const def = NODE_DEFS[nextNode.type];
            if (def && typeof def.execute === 'function') {
              try {
                def.execute(nextNode, ctx);
              } catch (err) {
                self._handleError(nextNode, err);
              }
            }
          }
        },
      };

      return ctx;
    }

    _handleError(node, err) {
      if (node) {
        node.hasError = true;
        node.errorMessage = err.message || 'Execution error';
      }
      this.log(node, `Error: ${err.message}`, 'error');
    }

    // ── Working Example Graph Requirement ──
    // Optical Sensor -> Get Sensor Intensity -> Greater Than (50) -> Branch
    // Branch TRUE -> Turn LED OFF
    // Branch FALSE -> Turn LED ON
    loadExampleGraph(sensorId = '', targetLedId = '') {
      this.clear();

      // 1. Simulation Started Event Node
      const evStart = this.addNode('event-simulation-started', 80, 160);

      // 2. Optical Sensor Intensity Node
      const sensorNode = this.addNode('input-sensor-intensity', 80, 320);
      sensorNode.properties.sensorId = sensorId;

      // 3. Greater Than (50) Node
      const gtNode = this.addNode('logic-greater-than', 320, 320);
      gtNode.properties.threshold = 50;
      gtNode.customValues['b'] = 50;

      // 4. Branch (If / Else) Node
      const branchNode = this.addNode('logic-branch', 560, 200);

      // 5. Turn LED OFF Node (Branch TRUE)
      const ledOffNode = this.addNode('output-led-off', 800, 140);
      ledOffNode.properties.targetId = targetLedId;

      // 6. Turn LED ON Node (Branch FALSE)
      const ledOnNode = this.addNode('output-led-on', 800, 320);
      ledOnNode.properties.targetId = targetLedId;

      // Connect Sockets:
      // exec: Simulation Started -> Branch
      this.connect(evStart.id, 'exec', branchNode.id, 'exec');

      // data: Get Sensor Intensity -> Greater Than (A)
      this.connect(sensorNode.id, 'intensity', gtNode.id, 'a');

      // data: Greater Than (Result) -> Branch (Condition)
      this.connect(gtNode.id, 'result', branchNode.id, 'condition');

      // exec: Branch TRUE -> Turn LED OFF
      this.connect(branchNode.id, 'true', ledOffNode.id, 'exec');

      // exec: Branch FALSE -> Turn LED ON
      this.connect(branchNode.id, 'false', ledOnNode.id, 'exec');

      this.log(null, 'Loaded default working Logic Graph: Sensor -> Greater Than 50 -> Branch -> LED OFF / ON', 'info');
      this.start();
    }

    // ── Serialization & Project Integration (.optp) ──
    serialize() {
      return {
        version: 1,
        running: this.running,
        tickRate: this.tickRate,
        variables: Array.from(this.variables.entries()).map(([name, value]) => ({
          name,
          value,
        })),
        nodes: Array.from(this.nodes.values()).map((n) => n.toJSON()),
        wires: Array.from(this.wires.values()).map((w) => w.toJSON()),
      };
    }

    deserialize(data) {
      if (!data || typeof data !== 'object') {
        this.loadExampleGraph();
        return;
      }

      this.clear();

      // Restore Variables
      if (Array.isArray(data.variables)) {
        for (const v of data.variables) {
          if (v && v.name) {
            this.variables.set(v.name, v.value);
          }
        }
      }

      // Restore Nodes
      if (Array.isArray(data.nodes)) {
        for (const nData of data.nodes) {
          const node = LogicNode.fromJSON(nData);
          if (node) {
            this.nodes.set(node.id, node);
          }
        }
      }

      // Restore Wires
      if (Array.isArray(data.wires)) {
        for (const wData of data.wires) {
          const wire = LogicWire.fromJSON(wData);
          if (wire && this.nodes.has(wire.fromNode) && this.nodes.has(wire.toNode)) {
            this.wires.set(wire.id, wire);
          }
        }
      }

      if (data.tickRate) {
        this.tickRate = Number(data.tickRate) || 30;
      }

      // If imported graph is empty, load standard example
      if (this.nodes.size === 0) {
        this.loadExampleGraph();
      } else {
        // Start running restored graph
        this.start();
      }
    }
  }

  // ── Export to Global OptiLab Namespace ──
  global.OptiLab = global.OptiLab || {};
  global.OptiLab.SOCKET_TYPES = SOCKET_TYPES;
  global.OptiLab.SOCKET_COLORS = SOCKET_COLORS;
  global.OptiLab.CATEGORIES = CATEGORIES;
  global.OptiLab.NODE_DEFS = NODE_DEFS;
  global.OptiLab.LogicNode = LogicNode;
  global.OptiLab.LogicWire = LogicWire;
  global.OptiLab.LogicEngine = LogicEngine;

})(typeof window !== 'undefined' ? window : globalThis);
