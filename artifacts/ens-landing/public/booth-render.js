// @ts-check
/**
 * ─── The bridge contract ──────────────────────────────────────────────────
 *
 * This file draws the booth as SVG. A separate module script inside
 * booth-render.html draws the GLB furniture with three.js over the top. They
 * share one realm and talk three ways, and until now none of the three was
 * described anywhere:
 *
 *   1. `window.__*` globals - state and callbacks handed across (below).
 *   2. postMessage, in both directions, with the parent workspace.
 *   3. Bare cross-file calls: the module reaches into this file by name.
 *
 * What made that costly is not the absence of types on its own - it is that
 * every value crossing is coerced with `Number(x) || 0` and every cross-file
 * call is guarded with a fallback of `0`. A renamed field does not throw; the
 * model quietly renders at the origin, or on the floor. That is how rail
 * lights came to sit on the carpet with nothing raised on either side.
 *
 * These typedefs do not remove the coercions. They write down what is supposed
 * to cross, so the next rename is a type error rather than a silent zero.
 */

/**
 * One placed item, as far as the bridge is concerned. The renderer reads more
 * than this; these are the fields the GLB layer depends on.
 * @typedef {object} GlbPlacedItem
 * @property {string|number} [id]
 * @property {string} [sku]
 * @property {string} [catalogId]
 * @property {string} [name]
 * @property {string} [kind]
 * @property {string} [shape]
 * @property {string} [modelUrl]
 * @property {number} [x] Booth-space X, 0..width.
 * @property {number} [z] Booth-space Z, 0..depth.
 * @property {number} [y] Mount height. Absent means "derive it".
 * @property {number} [w]
 * @property {number} [d]
 * @property {number} [h]
 * @property {number} [rotationX]
 * @property {number} [rotationY]
 * @property {number} [rotationZ]
 * @property {number} [rotation] Legacy alias for rotationY.
 */

/**
 * The scene snapshot handed to the GLB layer on every render pass.
 * @typedef {object} GlbState
 * @property {number} width
 * @property {number} depth
 * @property {number} height
 * @property {number} fasciaHeight
 * @property {{back: boolean, left: boolean, right: boolean, front: boolean}} wallsVisible
 * @property {number[]} cam
 * @property {number[]} target
 * @property {number} fov
 * @property {GlbPlacedItem[]} placedItems
 * @property {string|null} selectedItemId
 */

/**
 * Measured size of a loaded model against the size the catalogue claims, which
 * is how the GLB layer decides its scale.
 * @typedef {object} GlbPhysicalBounds
 * @property {number} width
 * @property {number} depth
 * @property {number} height
 * @property {number} targetWidth
 * @property {number} targetDepth
 * @property {number} targetHeight
 */

/**
 * @typedef {object} GlbPixelCoverage
 * @property {number} width
 * @property {number} height
 * @property {number} visiblePixels
 */

/**
 * Lighting handed to the three.js rig. Colours are hex integers, not strings -
 * they go straight into Color.setHex.
 * @typedef {object} LightingRig
 * @property {number} hemi
 * @property {number} key
 * @property {number} fill
 * @property {number} keyColor
 * @property {number} fillColor
 */

/**
 * The globals the two halves share. Nine of them, none previously declared.
 * @typedef {Window & typeof globalThis & {
 *   __pendingGlbState?: GlbState,
 *   __lastGlbState?: GlbState,
 *   __updateGlbLayer?: (state: GlbState) => void | Promise<void>,
 *   __glbVisibleItems?: Set<string>,
 *   __glbPhysicalBounds?: Map<string, GlbPhysicalBounds>,
 *   __applyGlbLighting?: (rig: LightingRig) => void,
 *   __lightingRig?: LightingRig,
 *   __shellOccluderCount?: number,
 *   __readGlbPixelCoverage?: () => GlbPixelCoverage,
 * }} RendererWindow
 */

/**
 * Messages this renderer posts to the parent workspace.
 *
 * Sixteen types across seventeen call sites - `workspaceItemSelected` and
 * `workspaceItemRotated` are each posted from two places, and the catalogue
 * drop site chooses between two types on one line. Two of these are posted
 * from booth-render.html rather than here.
 *
 * @typedef {{type: 'boothRendererReady'}} MsgRendererReady
 * @typedef {{type: 'boothRendererError', message: string}} MsgRendererError
 * @typedef {{type: 'boothUpdateAck', width: number, depth: number, height: number, selectedPartId: string|null}} MsgUpdateAck
 * @typedef {{type: 'workspaceItemMoved', id: string, x: number, z: number, w?: number, y?: number, rotationY?: number}} MsgItemMoved
 * @typedef {{type: 'workspaceItemRemoved', id: string}} MsgItemRemoved
 * @typedef {{type: 'workspaceItemRotated', id: string, rotationY: number}} MsgItemRotated
 * @typedef {{type: 'workspaceItemSelected', id: string|null, partId?: string, roomId?: string, partType?: string, label?: string, meta?: string, xPct?: number, yPct?: number}} MsgItemSelected
 * @typedef {{type: 'workspaceItemDeleteRequested', id: string}} MsgItemDeleteRequested
 * @typedef {{type: 'workspaceRoomMoved', id: string, x: number, z: number}} MsgRoomMoved
 * @typedef {{type: 'workspaceRoomPatched', id: string, doorOpen?: boolean, doorSwing?: string}} MsgRoomPatched
 * @typedef {{type: 'workspaceFrontSupportsMoved', positions: number[], suppressedDefaultPositions: number[]}} MsgFrontSupportsMoved
 * @typedef {{type: 'workspaceGestureEnd', kind: string}} MsgGestureEnd
 * @typedef {{type: 'workspaceShortcut', action: string}} MsgShortcut
 * @typedef {{type: 'pinRequested', x: number, y: number, partId: string}} MsgPinRequested
 * @typedef {{type: 'catalogDropPreview'|'catalogDropCommitted', catalogId: string, valid: boolean, reason: string|null, x: number, z: number, w?: number, y?: number, rotationY?: number, mounted?: boolean}} MsgCatalogDrop
 *
 * @typedef {MsgRendererReady|MsgRendererError|MsgUpdateAck|MsgItemMoved|MsgItemRemoved
 *   |MsgItemRotated|MsgItemSelected|MsgItemDeleteRequested|MsgRoomMoved|MsgRoomPatched
 *   |MsgFrontSupportsMoved|MsgGestureEnd|MsgShortcut|MsgPinRequested|MsgCatalogDrop
 * } OutboundMessage
 */

/**
 * Messages the parent workspace posts in. Five types.
 *
 * @typedef {{type: 'boothUpdate'} & Record<string, unknown>} MsgBoothUpdate
 * @typedef {{type: 'catalogDragPreview', xPct: number, yPct: number, item: GlbPlacedItem}} MsgCatalogDragPreview
 * @typedef {{type: 'catalogDragCommit', xPct: number, yPct: number, item: GlbPlacedItem}} MsgCatalogDragCommit
 * @typedef {{type: 'catalogDragCancel'}} MsgCatalogDragCancel
 * @typedef {{type: 'workspaceItemRemove', id: string}} MsgItemRemove
 *
 * @typedef {MsgBoothUpdate|MsgCatalogDragPreview|MsgCatalogDragCommit
 *   |MsgCatalogDragCancel|MsgItemRemove
 * } InboundMessage
 */

/** The shared globals, reached through one declared alias rather than nine undeclared ones. */
const rendererWindow = /** @type {RendererWindow} */ (window);

/*
 * Booth renderer - the perspective-projected SVG engine.
 *
 * Lifted out of booth-render.html unchanged. It was a 3,762-line inline
 * <script>, which meant the page could not run under a Content-Security-Policy
 * of script-src 'self': enforcing the policy blocked it outright and took the
 * booth with it, so the policy had to stay report-only and protected nothing.
 *
 * Still a classic script, deliberately. It communicates with the bundled
 * three.js module through globals - window.__glbVisibleItems and friends, plus
 * top-level declarations the module feature-detects - and a classic external
 * script keeps exactly that scope and still runs before deferred modules.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Booth renderer — perspective-projected SVG.
// Config via URL params: w, d, h, name, style (octa|maxima), open (front,back,left,right)
// Live updates via postMessage: { type:'boothUpdate', w, d, h, name, style, open }
// ─────────────────────────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
const VW = 1600, VH = 1000;

// ── Read URL params ──────────────────────────────────────────────────────────
const _P = new URLSearchParams(location.search);
let BW = Math.max(1, parseFloat(_P.get('w')  || '6'));    // booth width (X)
let BD = Math.max(1, parseFloat(_P.get('d')  || '3'));    // booth depth (Z)
let BH = Math.max(0.8, parseFloat(_P.get('h') || '2.20')); // wall panel height
const FH = 0.30;                                           // fascia height (fixed)
const EX = 0.04;                                           // profile thickness 40mm
let COMPANY_NAME = decodeURIComponent(_P.get('name') || 'Company Name');
let PANELS_BACK = Math.max(1, Math.round(BW));
let PANELS_SIDE = Math.max(1, Math.round(BD));
/**
 * Legibility of the stand against the studio background.
 *
 * The stand is near-white (#f8fafc) on a near-white backdrop (#eef0f2): a
 * measured 1.09:1. Panel seams were drawn at rgba(120,124,130,0.11) and 0.2px,
 * an eleven-percent hairline, so individual panels could not be counted by eye
 * and the whole stand dissolved into the floor.
 *
 * These raise edge definition and drop a contact shadow, without touching the
 * stand's own colours. `legibility` in the query string picks an intensity so
 * the levels can be compared side by side: soft | normal | strong.
 */
const LEGIBILITY_LEVELS = {
  soft:   { seam: 'rgba(96,102,110,0.20)', seamW: 0.34, ground: 0.38 },
  normal: { seam: 'rgba(88,95,104,0.32)',  seamW: 0.46, ground: 0.54 },
  strong: { seam: 'rgba(72,79,88,0.46)',   seamW: 0.62, ground: 0.68 },
};
const LEGIBILITY = LEGIBILITY_LEVELS[_P.get('legibility')] || LEGIBILITY_LEVELS.normal;

/**
 * Near-plane losses, made audible.
 *
 * There is no clipping step in this renderer. `project()` returns null for a
 * vertex behind the near plane, and the draw loop drops the *whole* polygon
 * rather than trimming it, so a face that straddles the plane does not degrade -
 * it disappears, completely and without a word. That is how a 44 x 32 m ground
 * quad went unnoticed as never drawn at all in the view the workspace opens on:
 * the absence read as a background gradient, and nothing anywhere disagreed.
 *
 * This does not clip anything. It gives the absence a name. Run the renderer
 * with ?debug=clipping and every face lost this way is reported once per pass,
 * grouped by part, with how many of its vertices fell behind the plane.
 *
 * Off unless asked for: a dropped face is normal and frequent for geometry
 * genuinely behind the camera, so this is a diagnostic, not a warning anyone
 * should meet by accident.
 */
const DEBUG_CLIPPING = _P.get('debug') === 'clipping';
/** @type {Map<string, {type: string, faces: number, verts: number, lost: number}> | null} */
let clippedThisPass = null;

function recordClippedFace(face, projected, sourceLabel) {
  if (!clippedThisPass) clippedThisPass = new Map();
  const partId = String(face.partId || '(unnamed)');
  const key = sourceLabel ? sourceLabel + ' · ' + partId : partId;
  const entry = clippedThisPass.get(key) || {
    type: sourceLabel || partTypeFor(partId) || 'unknown',
    faces: 0,
    verts: projected.length,
    lost: 0,
  };
  entry.faces += 1;
  entry.lost += projected.filter((point) => !point).length;
  clippedThisPass.set(key, entry);
}

function reportClippedFaces() {
  if (!clippedThisPass || clippedThisPass.size === 0) return;
  const rows = [...clippedThisPass.entries()];
  const total = rows.reduce((sum, [, entry]) => sum + entry.faces, 0);
  console.warn(
    `[booth-render] ${total} face(s) dropped by near-plane clipping and not drawn ` +
    `(${rows.length} distinct part(s)):`
  );
  for (const [key, entry] of rows) {
    console.warn(
      `  ${key}  type=${entry.type}  ${entry.faces} face(s)  ` +
      `${entry.verts} vertices, ${entry.lost} behind the near plane`
    );
  }
  clippedThisPass = null;
}

let CARPET_COLOR = _P.get('carpet') || '#3b3e44';
let WALL_COLOR = _P.get('wall') || '#f8fafc';
let FRAME_COLOR = _P.get('frame') || '#b8bdc3';
let FASCIA_COLOR = _P.get('fasciaColor') || '#ffffff';

let placedItems = [];
let rooms = [];
let FASCIA_ENABLED = _P.get('fascia') !== '0';
// Read from the query string like every other render setting, so the option
// can be previewed and tested standalone; postMessage still overrides it.
let FASCIA_OPTION = (function () {
  const v = String(_P.get('fasciaOption') || '').toLowerCase();
  return (v === 'classic' || v === 'full' || v === 'custom') ? v : 'full';
})();
/**
 * Width in metres of the centred ("classic") fascia sign.
 *
 * Zero means "derive from the stand": 38% of the stand width, clamped to
 * 2.15-3.4 m. Set FASCIA_SIGN_WIDTH_M (via the fasciaSignWidthM message field)
 * to pin an exact width, e.g. 2 for a 2 m sign. The 'full' option ignores this
 * and spans the whole rail.
 */
let FASCIA_SIGN_WIDTH_M = parseFloat(_P.get('fasciaSignWidthM') || '0') || 0;
function fasciaSignWidthM(standWidth) {
  if (FASCIA_SIGN_WIDTH_M > 0) return Math.max(0.4, Math.min(FASCIA_SIGN_WIDTH_M, standWidth));
  return Math.min(Math.max(standWidth * 0.38, 2.15), 3.4);
}
let LIGHTING_PRESET = 'exhibition';
let pins = [];
let pinMode = false;
let panelOverrides = {};
let invalidItemIds = new Set();
let frontSupportPositions = [];
let suppressedDefaultPositions = [];
let catalogDropPreview = null;
/**
 * The drag in progress - an item, a room or a support - or null.
 *
 * Declared up here with the rest of the renderer's state rather than beside the
 * pointer handlers that own it. The draw loop asks whether anything is being
 * dragged, to decide whether to open the rooms up, and the handlers are set up
 * after the first render: left where it was, a `let` in its temporal dead zone
 * threw on the opening frame of any stand that already had a room in it.
 */
let objectDrag = null;

function notifyRendererError(error) {
  const message = error && error.message ? String(error.message) : String(error || 'Renderer failed');
  window.parent.postMessage({ type: 'boothRendererError', message }, '*');
}

window.addEventListener('error', (event) => {
  notifyRendererError(event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  notifyRendererError(event.reason || 'Unhandled renderer promise rejection');
});

/**
 * Lighting presets.
 *
 * These used to change two backdrop greys and nothing else - "exhibition" and
 * "spotlight" differed by about three per cent of grey behind the booth - so
 * choosing one appeared to do nothing at all. They now drive the shading of the
 * booth itself: how hard the facet shading falls on the SVG geometry, and the
 * intensity and colour of the three lights the GLB models are lit by.
 *
 *   faceShade / itemShade  strength of the darkening on unlit faces, so a
 *                          spotlight rig reads as high contrast and an ambient
 *                          one as flat.
 *   hemi / key / fill      the three.js rig. keyColor and fillColor carry the
 *                          colour temperature.
 */
const LIGHTING_PRESETS = {
  neutral:    { bg: ['#eef0f2', '#c9ccd0'], faceShade: 0.44, itemShade: 0.22,
                hemi: 2.6, key: 1.9, fill: 1.40, keyColor: 0xffffff, fillColor: 0xffffff },
  exhibition: { bg: ['#f3f4f6', '#b8bcc1'], faceShade: 0.55, itemShade: 0.28,
                hemi: 2.2, key: 2.6, fill: 1.15, keyColor: 0xffffff, fillColor: 0xdbeafe },
  accent:     { bg: ['#eef2ff', '#c7d2fe'], faceShade: 0.60, itemShade: 0.32,
                hemi: 1.8, key: 2.9, fill: 1.55, keyColor: 0xf0f6ff, fillColor: 0xc7d2fe },
  spotlight:  { bg: ['#f8fafc', '#9aa3b0'], faceShade: 0.78, itemShade: 0.46,
                hemi: 1.1, key: 4.2, fill: 0.45, keyColor: 0xffffff, fillColor: 0xbfd4ee },
  ambient:    { bg: ['#f4f1ec', '#d8d0c3'], faceShade: 0.32, itemShade: 0.16,
                hemi: 3.3, key: 1.1, fill: 1.30, keyColor: 0xfff3e0, fillColor: 0xffe9c9 },
};

/** The rig currently in force. Read by the shading pass and by the GLB layer. */
let LIGHTING = LIGHTING_PRESETS.exhibition;

function applyLightingPreset() {
  LIGHTING = LIGHTING_PRESETS[LIGHTING_PRESET] || LIGHTING_PRESETS.exhibition;
  const root = document.documentElement;
  root.style.setProperty('--bg-top', LIGHTING.bg[0]);
  root.style.setProperty('--bg-bot', LIGHTING.bg[1]);
  // The GLB layer owns its own lights. Publish the rig either way: the module
  // may not have finished loading yet, and it reads this on startup.
  rendererWindow.__lightingRig = LIGHTING;
  if (typeof rendererWindow.__applyGlbLighting === 'function') rendererWindow.__applyGlbLighting(LIGHTING);
}

function normalizeHex(value, fallback) {
  const text = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function shadeColor(hex, amount) {
  const safe = normalizeHex(hex, '#ffffff').slice(1);
  const rgb = [0, 2, 4].map(i => parseInt(safe.slice(i, i + 2), 16));
  const target = amount >= 0 ? 255 : 0;
  const ratio = Math.min(1, Math.abs(amount));
  const out = rgb.map(channel => Math.round(channel + (target - channel) * ratio));
  return '#' + out.map(channel => channel.toString(16).padStart(2, '0')).join('');
}

function setGradientStops(id, colors) {
  const stops = document.querySelectorAll(`#${id} stop`);
  stops.forEach((stop, index) => {
    stop.setAttribute('stop-color', colors[Math.min(index, colors.length - 1)]);
  });
}

function applyFinishColors() {
  WALL_COLOR = normalizeHex(WALL_COLOR, '#f8fafc');
  FRAME_COLOR = normalizeHex(FRAME_COLOR, '#b8bdc3');
  FASCIA_COLOR = normalizeHex(FASCIA_COLOR, '#ffffff');
  setGradientStops('panel', [shadeColor(WALL_COLOR, 0.08), shadeColor(WALL_COLOR, -0.08)]);
  setGradientStops('panel-side', [shadeColor(WALL_COLOR, 0.02), shadeColor(WALL_COLOR, -0.18)]);
  setGradientStops('panel-shade', [shadeColor(WALL_COLOR, -0.12), shadeColor(WALL_COLOR, -0.30)]);
  setGradientStops('alu', [shadeColor(FRAME_COLOR, -0.20), shadeColor(FRAME_COLOR, 0.10), shadeColor(FRAME_COLOR, 0.28), shadeColor(FRAME_COLOR, -0.10), shadeColor(FRAME_COLOR, -0.28)]);
  setGradientStops('alu-h', [shadeColor(FRAME_COLOR, 0.20), shadeColor(FRAME_COLOR, 0.02), shadeColor(FRAME_COLOR, -0.22)]);
  setGradientStops('alu-cap', [shadeColor(FRAME_COLOR, 0.25), shadeColor(FRAME_COLOR, -0.05)]);
  setGradientStops('fascia', [shadeColor(FASCIA_COLOR, 0.04), shadeColor(FASCIA_COLOR, -0.08)]);
}

const _openInit = new Set((_P.get('open') || 'front').split(',').map(s=>s.trim()).filter(Boolean));
let wallsVisible = {
  back:  !_openInit.has('back'),
  left:  !_openInit.has('left'),
  right: !_openInit.has('right'),
  front: !_openInit.has('front'),
};

// ── Camera ───────────────────────────────────────────────────────────────────
const VIEWS = {
  '3q':    { azimuth: Math.PI * 0.22,  elevation: Math.PI * 0.13, distance: 13.5 },
  'front': { azimuth: 0,               elevation: Math.PI * 0.06, distance: 14.5 },
  'side':  { azimuth: Math.PI * 0.5,   elevation: Math.PI * 0.06, distance: 13.0 },
  'top':   { azimuth: 0.0001,          elevation: Math.PI * 0.49, distance: 12.0 },
};

function defaultTarget() { return [0, (BH + FH) * 0.5, BD * 0.35]; }
const camState = { ...VIEWS['3q'], target: defaultTarget() };
let cam, fwd, right, up;
const upVec = [0, 1, 0];
const fov   = 30;

function updateCamera() {
  const { azimuth, elevation, distance, target } = camState;
  cam = [
    target[0] + distance * Math.cos(elevation) * Math.sin(azimuth),
    target[1] + distance * Math.sin(elevation),
    target[2] + distance * Math.cos(elevation) * Math.cos(azimuth),
  ];
  fwd   = norm(sub(target, cam));
  right = norm(cross(fwd, upVec));
  up    = cross(right, fwd);
}

// ── Studio lighting ──────────────────────────────────────────────────────────
const lightDir = norm([-0.45, 1.0, 0.55]);
const fillDir  = norm([ 0.7,  0.4, 0.2]);

// ── Math helpers ─────────────────────────────────────────────────────────────
function sub(a,b){ return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function add(a,b){ return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function len(a){ return Math.hypot(a[0],a[1],a[2]); }
function norm(a){ const l=len(a); return l<1e-9?[0,1,0]:[a[0]/l,a[1]/l,a[2]/l]; }

const fScale = 1 / Math.tan((fov * Math.PI / 180) / 2);
const aspect = VW / VH;
updateCamera();
applyLightingPreset();
applyFinishColors();

function project(p) {
  const v = sub(p, cam);
  const x = dot(v, right);
  const y = dot(v, up);
  const z = dot(v, fwd);
  if (z <= 0.05) return null;
  const sx = (x * fScale / aspect / z) * (VW/2) + VW/2;
  const sy = -(y * fScale / z) * (VH/2) + VH/2 + 90;
  return { x: sx, y: sy, depth: z };
}

function eventToSvgPoint(e) {
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svgEl.getScreenCTM().inverse());
}

function screenToFloorPoint(e) {
  const p = eventToSvgPoint(e);
  const xCam = ((p.x - VW / 2) / (VW / 2)) * aspect / fScale;
  const yCam = -((p.y - 90 - VH / 2) / (VH / 2)) / fScale;
  const dir = norm(add(add(fwd, right.map(v => v * xCam)), up.map(v => v * yCam)));
  if (Math.abs(dir[1]) < 0.0001) return null;
  const t = -cam[1] / dir[1];
  if (t <= 0) return null;
  return add(cam, dir.map(v => v * t));
}

function screenRatioToFloorPoint(xPct, yPct) {
  const rect = svgEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return screenToFloorPoint({
    clientX: rect.left + Math.max(0, Math.min(1, Number(xPct) || 0)) * rect.width,
    clientY: rect.top + Math.max(0, Math.min(1, Number(yPct) || 0)) * rect.height,
  });
}

// ── Geometry builder ─────────────────────────────────────────────────────────
let faces = [];
let _gid = 0;
let columnStyle = (_P.get('style') === 'maxima') ? 'maxima' : 'octa';

function rotateFurniturePoint(p, props) {
  if (!props || !props.rotRad) return p;
  const ox = Number(props.originX) || 0;
  const oz = Number(props.originZ) || 0;
  const c = Math.cos(props.rotRad);
  const s = Math.sin(props.rotRad);
  const dx = p[0] - ox;
  const dz = p[2] - oz;
  return [ox + dx * c - dz * s, p[1], oz + dx * s + dz * c];
}

function rotateFurnitureNormal(n, props) {
  if (!props || !props.rotRad) return n;
  const c = Math.cos(props.rotRad);
  const s = Math.sin(props.rotRad);
  return [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c];
}

function pushBox(min, max, props) {
  const gid = ++_gid;
  const [x0,y0,z0] = min, [x1,y1,z1] = max;
  const xfPts = (pts) => pts.map(p => rotateFurniturePoint(p, props));
  const xfNormal = (normal) => rotateFurnitureNormal(normal, props);
  // Everything the caller asked for first, everything this box knows about
  // itself after. The order is the whole point and it must stay this way round.
  //
  // This literal used to set its per-face fields and *then* spread props over
  // them, so any caller that happened to pass a field of the same name silently
  // won. Three have been lost to it: `renderOrder` (twenty-one furniture call
  // sites whose layer values never once ran), `normal` (every wall of every
  // room shared one direction, so two of the four were culled from every view
  // and the frame stood there with no panel in it), and `partId` (all six faces
  // of a box answered to one id, so nothing could address a single face).
  //
  // A box has six faces, pointing six ways, each its own part of the drawing.
  // Nothing outside may say otherwise, and now nothing can.
  const f = (pts, normal, suffix) => faces.push({
    ...props,
    pts: xfPts(pts),
    gid,
    partId: (props.partId || 'part') + '-' + gid + suffix,
    normal: xfNormal(normal),
  });
  f([[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]], [1,0,0], ':+x');
  f([[x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1]], [-1,0,0], ':-x');
  f([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], [0,0,1], ':+z');
  f([[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]], [0,0,-1], ':-z');
  f([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], [0,1,0], ':+y');
  f([[x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0]], [0,-1,0], ':-y');
  return gid;
}

function pushPrism(cx, cz, y0, y1, radius, segments, props) {
  const gid = ++_gid;
  const verts = [];
  const offset = Math.PI / segments;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2 + offset;
    const p = rotateFurniturePoint([cx + Math.cos(a) * radius, 0, cz + Math.sin(a) * radius], props);
    verts.push([p[0], p[2], a]);
  }
  if (!props.noSides) {
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      const zi = verts[i][1], zj = verts[j][1];
      const xi = verts[i][0], xj = verts[j][0];
      const ma = ((i + 0.5) / segments) * Math.PI * 2 + offset;
      // Props first, per-face data after - see the note in pushBox().
      faces.push({
        ...props,
        pts: [[xi, y0, zi], [xj, y0, zj], [xj, y1, zj], [xi, y1, zi]],
        normal: rotateFurnitureNormal([Math.cos(ma), 0, Math.sin(ma)], props),
        gid,
        partId: (props.partId || 'part') + '-' + gid + ':side' + i,
        hasFacetEdge: true,
      });
    }
  }
  faces.push({ ...props, pts: verts.map(([x, z]) => [x, y1, z]), normal: [0,1,0], gid,
    partId: (props.partId||'part')+'-'+gid+':+y' });
  faces.push({ ...props, pts: verts.slice().reverse().map(([x, z]) => [x, y0, z]), normal: [0,-1,0], gid,
    partId: (props.partId||'part')+'-'+gid+':-y' });
  return gid;
}

/**
 * A real oval plate: an ellipse extruded to a thickness, not an ellipse painted
 * on something rectangular.
 *
 * The "custom" fascia option used to draw its oval as a flat polygon laid over
 * the rectangular name plate. Two things came of that. The oval read as an
 * outline rather than as an object - no thickness, no shading, no edge - and
 * the rectangular plate was still there underneath it, so the sign overlapped
 * the board it was supposed to be. This builds the plate as the oval, so there
 * is one object and it is the shape it claims to be.
 *
 * `axis` is the direction the plate is extruded along: 'z' for the front and
 * back fascia, 'x' for the sides. The ellipse is drawn in the other two.
 */
function pushOvalPlate(centre, halfW, halfH, near, far, axis, segments, props) {
  const gid = ++_gid;
  const [cu, cy] = centre;
  const lo = Math.min(near, far);
  const hi = Math.max(near, far);
  const rim = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    rim.push([cu + Math.cos(a) * halfW, cy + Math.sin(a) * halfH]);
  }
  const at = (u, y, depth) => (axis === 'x' ? [depth, y, u] : [u, y, depth]);
  const push = (pts, normal, suffix) => faces.push({
    ...props,
    pts,
    gid,
    partId: (props.partId || 'oval') + '-' + gid + suffix,
    normal,
    hasFacetEdge: true,
  });
  // The rim, one quad per segment, each facing outward from the centre.
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    const [u0, y0] = rim[i];
    const [u1, y1] = rim[j];
    const mid = ((i + 0.5) / segments) * Math.PI * 2;
    const nu = Math.cos(mid);
    const ny = Math.sin(mid);
    push(
      [at(u0, y0, lo), at(u1, y1, lo), at(u1, y1, hi), at(u0, y0, hi)],
      axis === 'x' ? [0, ny, nu] : [nu, ny, 0],
      ':rim' + i,
    );
  }
  // Both faces of the plate, so it reads from in front and from behind.
  push(rim.map(([u, y]) => at(u, y, hi)), axis === 'x' ? [1, 0, 0] : [0, 0, 1], ':+face');
  push(rim.slice().reverse().map(([u, y]) => at(u, y, lo)), axis === 'x' ? [-1, 0, 0] : [0, 0, -1], ':-face');
  return gid;
}

function pushFurnitureShadow(cx, cz, w, d, props) {
  const y = 0.018;
  const padX = Math.max(0.08, w * 0.10);
  const padZ = Math.max(0.08, d * 0.10);
  const pts = [
    [cx - w / 2 - padX, y, cz - d / 2 - padZ],
    [cx + w / 2 + padX, y, cz - d / 2 - padZ],
    [cx + w / 2 + padX, y, cz + d / 2 + padZ],
    [cx - w / 2 - padX, y, cz + d / 2 + padZ],
  ].map(point => rotateFurniturePoint(point, props));
  faces.push({
    pts,
    normal: [0,1,0],
    fill: 'rgba(0,0,0,0.16)',
    partId: (props.partId || 'furniture') + '-contact-shadow',
    renderOrder: -0.05,
    isFurnitureShadow: true,
  });
}

/**
 * The two systems, at the sizes ENS actually builds them.
 *
 * Ported from getSystemProfile() in the reference engine
 * (references/ens-workspace/engine/booth_render_core.js), the same source the
 * fascia stack above came from. Only the fascia half had been ported: the
 * structure was drawn at EX for both systems, so the *only* thing that changed
 * between Octanorm and Maxima was an octagon becoming a square at the same 40
 * mm across - a few pixels at any usable zoom. Switching system produced a
 * booth that looked identical, while the take-off, the weights and the price
 * all moved.
 *
 * Maxima's upright is 80 mm against Octanorm's 45 - nearly double - and its
 * rails are almost three times as deep. That is what the difference is supposed
 * to look like.
 */
const ENS_SYSTEM = {
  octanorm: { uprightWidth: 0.045, uprightSegments: 8, railHeight: 0.07,  railDepth: 0.02,  wallThickness: 0.05,
              label: 'Ø 45 mm', meta: 'Ø 45 mm Octanorm upright · 8 grooves · anodized' },
  maxima:   { uprightWidth: 0.08,  uprightSegments: 4, railHeight: 0.094, railDepth: 0.055, wallThickness: 0.08,
              label: '80 mm', meta: '80 × 80 mm Maxima upright · anodized' },
};

function ensSystemProfile() {
  return ENS_SYSTEM[columnStyle === 'maxima' ? 'maxima' : 'octanorm'];
}

function pushPost(cx, cz, y0, y1, props) {
  const profile = ensSystemProfile();
  const T = profile.uprightWidth;
  pushBox(
    [cx - T*0.55, y0 - 0.005, cz - T*0.55],
    [cx + T*0.55, y0 + 0.018, cz + T*0.55],
    { fill: '#2a2d33', isAlu: true, partId: (props.partId||'post')+'-foot',
      partLabel: 'Foot cap', partMeta: 'Adjustable base · nylon' }
  );
  pushBox(
    [cx - T*0.58, y1 - T*0.55, cz - T*0.58],
    [cx + T*0.58, y1 + T*0.05, cz + T*0.58],
    { fill: 'url(#alu-cap)', isAlu: true, partId: (props.partId||'post')+'-cube',
      partLabel: 'Connector cube', partMeta: 'K-block joint · die-cast aluminum' }
  );
  // Octanorm's extrusion is round with eight grooves; Maxima's is a square box.
  // Both are drawn as prisms so the only thing that varies is the segment count
  // and the size - four segments on a square is the square.
  if (profile.uprightSegments >= 8) {
    // Spread first, fixed fields after. With the spread last, a caller that
    // happened to pass `fill` or `isOctaPost` would silently overwrite what
    // makes this a post - the same construction that cost pushBox its
    // renderOrder, normal and partId. No caller collides today; this is so
    // none ever can.
    return pushPrism(cx, cz, y0 + 0.018, y1 - T*0.55, T * 0.5, profile.uprightSegments,
      { ...props, fill: 'url(#alu)', isAlu: true, isOctaPost: true });
  }
  return pushBox(
    [cx - T/2, y0 + 0.018, cz - T/2],
    [cx + T/2, y1 - T*0.55, cz + T/2],
    { ...props, fill: 'url(#alu)', isAlu: true, isMaximaPost: true }
  );
}

function cz_clamp(v, off) { return v + off; }

function buildWall(name, p1, p2, numPanels, normal, options = {}) {
  const wallLen = Math.hypot(p2[0]-p1[0], p2[2]-p1[2]);
  const dir = [(p2[0]-p1[0])/wallLen, 0, (p2[2]-p1[2])/wallLen];
  const perp = [-dir[2], 0, dir[0]];
  const T = EX;
  const bayLen = wallLen / numPanels;
  const drawPanels = options.panels !== false;

  if (drawPanels) for (let i = 0; i < numPanels; i++) {
    const s0 = i * bayLen + EX * 0.6;
    const s1 = (i + 1) * bayLen - EX * 0.6;
    const x1p = p1[0] + dir[0] * s0, z1p = p1[2] + dir[2] * s0;
    const x2p = p1[0] + dir[0] * s1, z2p = p1[2] + dir[2] * s1;
    const off = EX * 0.15;
    const partId = 'panel-' + name + '-' + i;
    const override = (typeof panelOverrides !== 'undefined' && panelOverrides) ? panelOverrides[partId] : null;
    let fillVal = 'url(#panel)';
    let fillSideVal = 'url(#panel-side)';
    let brandText = null;
    let brandColor = '#111827';
    let brandScale = 0.15;
    let designImageUrl = null;
    let designOpacity = 1;
    if (override) {
      if (override.color) {
        fillVal = override.color;
        fillSideVal = shadeColor(override.color, -0.15);
      }
      if (override.brandText) {
        brandText = override.brandText;
      }
      if (override.brandColor) {
        brandColor = override.brandColor;
      }
      if (override.brandScale != null) {
        brandScale = parseFloat(override.brandScale);
      }
      if (override.designImageUrl) {
        designImageUrl = String(override.designImageUrl);
      }
      if (override.designOpacity != null) {
        designOpacity = Math.max(0.15, Math.min(1, parseFloat(override.designOpacity) || 1));
      }
    }
    const graphicFit = override && override.graphicFit ? override.graphicFit : 'cover';
    const graphicsOnPrimaryFace = name !== 'front';
    const primaryBrandText = graphicsOnPrimaryFace ? brandText : null;
    const primaryDesignImageUrl = graphicsOnPrimaryFace ? designImageUrl : null;
    const reverseBrandText = graphicsOnPrimaryFace ? null : brandText;
    const reverseDesignImageUrl = graphicsOnPrimaryFace ? null : designImageUrl;
    faces.push({
      pts: [
        [x1p - perp[0]*off, EX*0.5, z1p - perp[2]*off],
        [x2p - perp[0]*off, EX*0.5, z2p - perp[2]*off],
        [x2p - perp[0]*off, BH - EX*0.5, z2p - perp[2]*off],
        [x1p - perp[0]*off, BH - EX*0.5, z1p - perp[2]*off],
      ],
      fill: fillVal, normal,
      partId: partId,
      partLabel: 'Infill panel · ' + name + ' bay ' + (i+1),
      partMeta: Math.round(bayLen*1000-40) + ' × ' + Math.round((BH-EX)*1000) + ' mm · ' + (override && override.color ? 'custom color' : 'white laminate'),
      brandText: primaryBrandText,
      brandColor,
      brandScale,
      designImageUrl: primaryDesignImageUrl,
      designOpacity,
      graphicFit,
    });
    faces.push({
      pts: [
        [x2p + perp[0]*off, EX*0.5, z2p + perp[2]*off],
        [x1p + perp[0]*off, EX*0.5, z1p + perp[2]*off],
        [x1p + perp[0]*off, BH - EX*0.5, z1p + perp[2]*off],
        [x2p + perp[0]*off, BH - EX*0.5, z2p + perp[2]*off],
      ],
      fill: fillSideVal,
      normal: [-normal[0], -normal[1], -normal[2]],
      partId: partId,
      partLabel: 'Infill panel · ' + name + ' bay ' + (i+1),
      partMeta: Math.round(bayLen*1000-40) + ' × ' + Math.round((BH-EX)*1000) + ' mm · reverse face',
      brandText: reverseBrandText,
      brandColor,
      brandScale,
      designImageUrl: reverseDesignImageUrl,
      designOpacity,
      graphicFit,
    });
  }

  let postDefs = drawPanels
    ? Array.from({ length: numPanels + 1 }, (_, i) => ({ s: i * bayLen, id: 'post-' + name + '-' + i, label: 'Vertical post - ' + name + ' #' + (i + 1) }))
    : [{ s: 0, id: 'post-' + name + '-0', label: 'Vertical post - ' + name + ' #1' }, { s: wallLen, id: 'post-' + name + '-' + numPanels, label: 'Vertical post - ' + name + ' #' + (numPanels + 1) }];
  if (!drawPanels && name === 'front' && BW >= 5) {
    const supports = activeFrontSupportPositions();
    postDefs = [
      { s: 0, id: 'post-front-0', label: 'Vertical post - front corner' },
      ...supports.map((value, index) => ({ s: value, id: 'post-front-support-' + index, label: 'Movable front support - ' + value.toFixed(2) + ' m' })),
      { s: wallLen, id: 'post-front-' + numPanels, label: 'Vertical post - front corner' },
    ];
  }
  for (const post of postDefs) {
    const s = post.s;
    const cx = p1[0] + dir[0] * s;
    const cz = p1[2] + dir[2] * s;
    pushPost(cx, cz, 0, BH + FH, {
      partId: post.id,
      partLabel: post.label,
      partMeta: ensSystemProfile().meta,
    });
  }

  // Rail section by system, from the same reference profile as the upright.
  // Both rails were EX-square whichever system was chosen, which is the other
  // half of why the two looked alike: Maxima rails are nearly three times as
  // deep as Octanorm's.
  const railProfile = ensSystemProfile();
  const railH = railProfile.railHeight;
  const railD = railProfile.railDepth;
  const railMeta = `${Math.round(railH * 1000)} x ${Math.round(railD * 1000)} mm ${columnStyle === 'maxima' ? 'Maxima' : 'Octanorm'} rail`;
  const isAlongX = Math.abs(dir[0]) > Math.abs(dir[2]);
  if (isAlongX) {
    const xMin = Math.min(p1[0], p2[0]) - T/2;
    const xMax = Math.max(p1[0], p2[0]) + T/2;
    pushBox([xMin, BH - railH/2, cz_clamp(p1[2], -railD/2)],
            [xMax, BH + railH/2, cz_clamp(p1[2], +railD/2)],
            { fill: 'url(#alu-h)', isAlu: true, partId: 'rail-top-' + name,
              partLabel: 'Top rail · ' + name, partMeta: railMeta });
    pushBox([xMin, 0, cz_clamp(p1[2], -railD/2)],
            [xMax, railH*0.7, cz_clamp(p1[2], +railD/2)],
            { fill: 'url(#alu-h)', isAlu: true, partId: 'rail-bot-' + name,
              partLabel: 'Bottom rail · ' + name, partMeta: railMeta });
  } else {
    const zMin = Math.min(p1[2], p2[2]) - T/2;
    const zMax = Math.max(p1[2], p2[2]) + T/2;
    pushBox([cz_clamp(p1[0], -railD/2), BH - railH/2, zMin],
            [cz_clamp(p1[0], +railD/2), BH + railH/2, zMax],
            { fill: 'url(#alu-h)', isAlu: true, partId: 'rail-top-' + name,
              partLabel: 'Top rail · ' + name, partMeta: railMeta });
    pushBox([cz_clamp(p1[0], -railD/2), 0, zMin],
            [cz_clamp(p1[0], +railD/2), railH*0.7, zMax],
            { fill: 'url(#alu-h)', isAlu: true, partId: 'rail-bot-' + name,
              partLabel: 'Bottom rail · ' + name, partMeta: railMeta });
  }

  return { dir, perp, wallLen, numPanels, bayLen };
}

function buildBoothGeometry() {
  faces = [];
  _gid = 0;

  buildWall('back',  [-BW/2, 0,  0],  [ BW/2, 0,  0],  PANELS_BACK, [0, 0,  1], { panels: wallsVisible.back });
  buildWall('right', [ BW/2, 0,  0],  [ BW/2, 0, BD],  PANELS_SIDE, [-1,0,  0], { panels: wallsVisible.right });
  buildWall('left',  [-BW/2, 0,  0],  [-BW/2, 0, BD],  PANELS_SIDE, [1, 0,  0], { panels: wallsVisible.left });
  buildWall('front', [-BW/2, 0, BD],  [ BW/2, 0, BD],  PANELS_BACK, [0, 0,  1], { panels: wallsVisible.front });

  buildFascia();
  buildCeilingSupportRail();
  buildCarpet();
  buildRooms();
  buildPlacedItems();
}

function buildCeilingSupportRail() {
  const railW = Math.max(EX * 1.35, 0.055);
  const railY = BH + Math.min(FH * 0.42, 0.13);
  const y0 = railY - railW / 2;
  const y1 = railY + railW / 2;
  activeFrontSupportPositions().forEach((value, index) => {
    const x = -BW / 2 + value;
    pushBox([x - railW / 2, y0 + railW * 0.08, 0], [x + railW / 2, y1 + railW * 0.08, BD], {
      fill: 'url(#alu-cap)',
      isAlu: true,
      softEdge: true,
      partId: 'rail-ceiling-support-' + index,
      partLabel: 'Ceiling support rail - ' + value.toFixed(2) + ' m',
      partMeta: 'Cross support profile - aligned to front support column',
      renderOrder: 0.33,
    });
  });
}

/**
 * Where each room was actually built, in booth coordinates.
 *
 * buildRooms() clamps a room into the stand before drawing it, and skips any
 * wall the room borrows from the shell, so neither the extents nor the list of
 * walls can be read off the record. The cutaway and the mounting runs have to
 * agree with the picture rather than with the record, so they read this instead
 * of re-deriving the clamp and drifting from it.
 *
 * Keys are room ids; values carry the built extents and which walls exist.
 */
const roomGeometry = new Map();

function buildRooms() {
  roomGeometry.clear();
  for (const room of rooms) {
    const w = Math.max(0.5, Number(room.width) || 2);
    const d = Math.max(0.5, Number(room.depth) || 2);
    const h = Math.min(BH, Math.max(1.8, Number(room.height) || BH));
    const cx = -BW / 2 + Math.max(w / 2, Math.min(BW - w / 2, (room.x != null && room.x !== '') ? Number(room.x) : w / 2));
    const cz = Math.max(d / 2, Math.min(BD - d / 2, (room.z != null && room.z !== '') ? Number(room.z) : d / 2));
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    // A room edge flush with the stand borrows that shell wall instead of
    // building its own - but only if the shell actually has a wall there. An
    // open side has no panel, so a room pushed against one was skipping a wall
    // that nothing else was building: the storeroom stood open to the aisle,
    // with a gap exactly where its wall should have been.
    const shellTol = 0.012;
    const skipLeft = wallsVisible.left && x0 <= -BW / 2 + shellTol;
    const skipRight = wallsVisible.right && x1 >= BW / 2 - shellTol;
    const skipBack = wallsVisible.back && z0 <= shellTol;
    const skipFront = wallsVisible.front && z1 >= BD - shellTol;
    const label = room.name || 'Room';
    const meta = `${w.toFixed(1)} x ${d.toFixed(1)} x ${h.toFixed(1)} m`;
    roomGeometry.set(String(room.id), {
      id: String(room.id), name: label, cx, cz, x0, x1, z0, z1, h,
      built: { back: !skipBack, front: !skipFront, left: !skipLeft, right: !skipRight },
    });
    const roomCommon = { roomId: room.id, softEdge: true, renderOrder: 0.00005 };
    const wallBoxCommon = { roomId: room.id, renderOrder: 0.00005 };
    const wallFinish = ['frosted', 'glass', 'dark'].includes(room.wallFinish) ? room.wallFinish : 'white';
    const wallFill = wallFinish === 'glass'
      ? 'rgba(210,232,245,0.42)'
      : wallFinish === 'frosted'
        ? 'rgba(232,240,248,0.72)'
        : wallFinish === 'dark'
          ? 'rgba(38,43,51,0.88)'
          : 'url(#panel)';
    const sideWallFill = wallFinish === 'glass'
      ? 'rgba(190,222,238,0.38)'
      : wallFinish === 'frosted'
        ? 'rgba(226,235,244,0.68)'
        : wallFinish === 'dark'
          ? 'rgba(28,32,39,0.84)'
          : 'url(#panel-side)';
    const wallInsetFill = wallFinish === 'glass'
      ? 'rgba(185,220,238,0.28)'
      : wallFinish === 'frosted'
        ? 'rgba(235,242,250,0.52)'
        : wallFinish === 'dark'
          ? 'rgba(24,28,34,0.62)'
          : 'url(#panel)';
    const floorFill = /^#[0-9a-f]{6}$/i.test(String(room.floorColor || '')) ? room.floorColor : 'rgba(29,78,216,0.16)';
    const roomDesignImageUrl = typeof room.designImageUrl === 'string' ? room.designImageUrl : '';
    const roomDesignOpacity = Math.max(0.15, Math.min(1, Number(room.designOpacity) || 1));
    const doorSlot = room.doorPosition === 'left' || room.doorPosition === 'right' ? room.doorPosition : 'center';
    const requestedDoorSide = ['back', 'left', 'right'].includes(room.doorSide) ? room.doorSide : 'front';
    const availableDoorSides = [
      !skipFront && 'front',
      !skipBack && 'back',
      !skipLeft && 'left',
      !skipRight && 'right',
    ].filter(Boolean);
    const doorSide = availableDoorSides.includes(requestedDoorSide) ? requestedDoorSide : availableDoorSides[0] || requestedDoorSide;
    const requestedDesignWall = ['front', 'left', 'right'].includes(room.designWall) ? room.designWall : 'back';
    const roomDesignWall = room.hasDoor && requestedDesignWall === doorSide
      ? ['back', 'front', 'left', 'right'].find(side => side !== doorSide)
      : requestedDesignWall;
    const roomDesignFit = room.designFit === 'contain' || room.designFit === 'stretch' ? room.designFit : 'cover';
    const doorSpan = doorSide === 'left' || doorSide === 'right' ? d : w;
    const doorAxisStart = doorSide === 'left' || doorSide === 'right' ? z0 : x0;
    const sectionCount = Math.max(1, Math.floor(doorSpan));
    const sectionWidth = doorSpan / sectionCount;
    const doorIndex = doorSlot === 'left' ? 0 : doorSlot === 'right' ? sectionCount - 1 : Math.round((sectionCount - 1) / 2);
    const doorAxisCenter = doorAxisStart + sectionWidth * (doorIndex + 0.5);
    const doorCenterX = doorSide === 'front' || doorSide === 'back' ? doorAxisCenter : cx;
    const doorCenterZ = doorSide === 'left' || doorSide === 'right' ? doorAxisCenter : cz;
    const maxDoorWidth = Math.max(0.55, Math.min(1.4, doorSpan - 0.16));
    const doorW = Math.min(maxDoorWidth, Math.max(0.55, Number(room.doorWidth) || Math.min(0.9, sectionWidth * 0.82)));
    const doorH = Math.min(2.1, h * 0.88);

    pushBox([x0, 0.02, z0], [x1, 0.08, z1], {
      fill: floorFill,
      partId: room.id + '-floor',
      partLabel: label + ' floor',
      partMeta: meta,
      ...roomCommon
    });
    if (!skipBack && room.hasDoor && doorSide === 'back') {
      pushBox([x0, 0, z0], [doorCenterX - doorW/2, h, z0 + EX], {
        fill: wallFill,
        partId: room.id + '-back-left',
        partLabel: label + ' wall',
        partMeta: meta + ' · door',
        roomWall: 'back',
        ...wallBoxCommon
      });
      pushBox([doorCenterX + doorW/2, 0, z0], [x1, h, z0 + EX], {
        fill: wallFill,
        partId: room.id + '-back-right',
        partLabel: label + ' wall',
        partMeta: meta + ' · door',
        roomWall: 'back',
        ...wallBoxCommon
      });
      pushBox([doorCenterX - doorW/2, doorH, z0], [doorCenterX + doorW/2, h, z0 + EX], {
        fill: wallFill,
        partId: room.id + '-back-header',
        partLabel: label + ' door header',
        partMeta: meta,
        roomWall: 'back',
        ...wallBoxCommon
      });
    } else if (!skipBack) {
    pushBox([x0, 0, z0], [x1, h, z0 + EX], {
      fill: wallFill,
      partId: room.id + '-back',
      partLabel: label + ' wall',
      partMeta: meta,
      roomWall: 'back',
      ...wallBoxCommon
    });
    }
    if (!skipFront && room.hasDoor && doorSide === 'front') {
      pushBox([x0, 0, z1 - EX], [doorCenterX - doorW/2, h, z1], {
        fill: wallFill,
        partId: room.id + '-front-left',
        partLabel: label + ' wall',
        partMeta: meta + ' · door',
        roomWall: 'front',
        ...wallBoxCommon
      });
      pushBox([doorCenterX + doorW/2, 0, z1 - EX], [x1, h, z1], {
        fill: wallFill,
        partId: room.id + '-front-right',
        partLabel: label + ' wall',
        partMeta: meta + ' · door',
        roomWall: 'front',
        ...wallBoxCommon
      });
      pushBox([doorCenterX - doorW/2, doorH, z1 - EX], [doorCenterX + doorW/2, h, z1], {
        fill: wallFill,
        partId: room.id + '-front-header',
        partLabel: label + ' door header',
        partMeta: meta,
        roomWall: 'front',
        ...wallBoxCommon
      });
    } else if (!skipFront) {
    pushBox([x0, 0, z1 - EX], [x1, h, z1], {
      fill: wallFill,
      partId: room.id + '-front',
      partLabel: label + ' wall',
      partMeta: room.hasDoor ? meta + ' · door' : meta,
      roomWall: 'front',
      ...wallBoxCommon
    });
    }
    if (!skipLeft && room.hasDoor && doorSide === 'left') {
      pushBox([x0, 0, z0], [x0 + EX, h, doorCenterZ - doorW/2], {
        fill: sideWallFill,
        partId: room.id + '-left-back',
        partLabel: label + ' wall',
        partMeta: meta + ' · door',
        roomWall: 'left',
        ...wallBoxCommon
      });
      pushBox([x0, 0, doorCenterZ + doorW/2], [x0 + EX, h, z1], {
        fill: sideWallFill,
        partId: room.id + '-left-front',
        partLabel: label + ' wall',
        partMeta: meta + ' · door',
        roomWall: 'left',
        ...wallBoxCommon
      });
      pushBox([x0, doorH, doorCenterZ - doorW/2], [x0 + EX, h, doorCenterZ + doorW/2], {
        fill: sideWallFill,
        partId: room.id + '-left-header',
        partLabel: label + ' door header',
        partMeta: meta,
        roomWall: 'left',
        ...wallBoxCommon
      });
    } else if (!skipLeft) {
    pushBox([x0, 0, z0], [x0 + EX, h, z1], {
      fill: sideWallFill,
      partId: room.id + '-left',
      partLabel: label + ' wall',
      partMeta: meta,
      roomWall: 'left',
      ...wallBoxCommon
    });
    }
    if (!skipRight && room.hasDoor && doorSide === 'right') {
      pushBox([x1 - EX, 0, z0], [x1, h, doorCenterZ - doorW/2], {
        fill: sideWallFill,
        partId: room.id + '-right-back',
        partLabel: label + ' wall',
        partMeta: meta + ' · door',
        roomWall: 'right',
        ...wallBoxCommon
      });
      pushBox([x1 - EX, 0, doorCenterZ + doorW/2], [x1, h, z1], {
        fill: sideWallFill,
        partId: room.id + '-right-front',
        partLabel: label + ' wall',
        partMeta: meta + ' · door',
        roomWall: 'right',
        ...wallBoxCommon
      });
      pushBox([x1 - EX, doorH, doorCenterZ - doorW/2], [x1, h, doorCenterZ + doorW/2], {
        fill: sideWallFill,
        partId: room.id + '-right-header',
        partLabel: label + ' door header',
        partMeta: meta,
        roomWall: 'right',
        ...wallBoxCommon
      });
    } else if (!skipRight) {
    pushBox([x1 - EX, 0, z0], [x1, h, z1], {
      fill: sideWallFill,
      partId: room.id + '-right',
      partLabel: label + ' wall',
      partMeta: meta,
      roomWall: 'right',
      ...wallBoxCommon
    });
    }

    // Room walls are built from the same 1 m modules as the booth, so they need
    // the same uprights between panels. Without them a room read as one blank
    // slab per side - a plain box dropped into a booth made of panels, which is
    // not what gets built on site.
    const roomMullion = EX * 0.85;
    const roomPostFill = 'url(#alu)';
    const pushRoomPosts = (side, ax, from, to, fixed) => {
      const span = Math.abs(to - from);
      const bays = Math.max(1, Math.round(span));
      if (bays < 2 && span < 1.6) return;           // a single narrow panel has no joint
      for (let n = 1; n < bays; n += 1) {
        const at = from + (to - from) * (n / bays);
        const lo = at - roomMullion / 2;
        const hi = at + roomMullion / 2;
        const common = {
          fill: roomPostFill,
          partId: room.id + '-' + side + '-post-' + n,
          partLabel: label + ' upright',
          partMeta: meta,
          ...wallBoxCommon,
          // Above the wall slab it sits on. Within the tie window this is
          // settled by depth and insertion order rather than by the layer
          // itself, since the upright stands proud of the wall on both faces.
          renderOrder: 0.00008,
        };
        // Stand the upright proud of the wall on both faces. Drawn flush it was
        // coplanar with the slab, and the painter's algorithm put the wall in
        // front of it - the posts were there and simply never visible.
        const proud = EX * 0.45;
        if (ax === 'x') pushBox([lo, 0, fixed - proud], [hi, h, fixed + EX + proud], common);
        else pushBox([fixed - proud, 0, lo], [fixed + EX + proud, h, hi], common);
      }
    };
    if (!skipBack)  pushRoomPosts('back',  'x', x0, x1, z0);
    if (!skipFront) pushRoomPosts('front', 'x', x0, x1, z1 - EX);
    if (!skipLeft)  pushRoomPosts('left',  'z', z0, z1, x0);
    if (!skipRight) pushRoomPosts('right', 'z', z0, z1, x1 - EX);

    if (room.hasCeiling) {
      pushBox([x0, h, z0], [x1, h + EX, z1], {
        fill: 'rgba(226,232,240,0.76)',
        partId: room.id + '-ceiling',
        partLabel: label + ' ceiling',
        partMeta: meta,
        ...roomCommon
      });
    }
    if (roomDesignImageUrl) {
      const graphicInset = 0.08;
      const graphicBottom = 0.16;
      const graphicTop = h - 0.12;
      let graphicPoints;
      let graphicNormal;
      if (roomDesignWall === 'front') {
        const z = z1 - EX - 0.014;
        graphicPoints = [
          [x1 - graphicInset, graphicBottom, z],
          [x0 + graphicInset, graphicBottom, z],
          [x0 + graphicInset, graphicTop, z],
          [x1 - graphicInset, graphicTop, z],
        ];
        graphicNormal = [0, 0, -1];
      } else if (roomDesignWall === 'left') {
        const x = x0 + EX + 0.014;
        graphicPoints = [
          [x, graphicBottom, z0 + graphicInset],
          [x, graphicBottom, z1 - graphicInset],
          [x, graphicTop, z1 - graphicInset],
          [x, graphicTop, z0 + graphicInset],
        ];
        graphicNormal = [1, 0, 0];
      } else if (roomDesignWall === 'right') {
        const x = x1 - EX - 0.014;
        graphicPoints = [
          [x, graphicBottom, z1 - graphicInset],
          [x, graphicBottom, z0 + graphicInset],
          [x, graphicTop, z0 + graphicInset],
          [x, graphicTop, z1 - graphicInset],
        ];
        graphicNormal = [-1, 0, 0];
      } else {
        const z = z0 + EX + 0.014;
        graphicPoints = [
          [x0 + graphicInset, graphicBottom, z],
          [x1 - graphicInset, graphicBottom, z],
          [x1 - graphicInset, graphicTop, z],
          [x0 + graphicInset, graphicTop, z],
        ];
        graphicNormal = [0, 0, 1];
      }
      faces.push({
        pts: graphicPoints,
        normal: graphicNormal,
        fill: 'transparent',
        designImageUrl: roomDesignImageUrl,
        designOpacity: roomDesignOpacity,
        graphicFit: roomDesignFit,
        designWall: roomDesignWall,
        // Hides with the wall it is printed on, so a cut-away wall does not
        // leave its graphic floating in the opening.
        roomWall: roomDesignWall,
        partId: room.id + '-wall-image',
        partLabel: label + ' wall image',
        partMeta: `Uploaded room wall graphic · ${roomDesignWall} wall · ${roomDesignFit}`,
        roomId: room.id,
        renderOrder: 0.00006,
      });
    }
    addRoomProfilesAndDoor(room, { x0, x1, z0, z1, h, doorSide, doorCenterX, doorCenterZ, doorW, doorH, label, meta, roomCommon, wallInsetFill, skipLeft, skipRight, skipBack, skipFront });
  }
}

function addRoomProfilesAndDoor(room, geom) {
  const { x0, x1, z0, z1, h, doorSide, doorCenterX, doorCenterZ, doorW, doorH, label, meta, roomCommon, wallInsetFill, skipLeft, skipRight, skipBack, skipFront } = geom;
  const rail = Math.max(EX * 1.25, 0.055);
  const half = rail / 2;
  const profileFill = 'url(#alu)';
  const railFill = 'url(#alu-h)';
  const capFill = 'url(#alu-cap)';
  const common = {
    ...roomCommon,
    isAlu: true,
    softEdge: true,
    renderOrder: 0.00007,
  };
  const doorOpen = room.doorOpen === true;
  const doorSwing = ['right-in', 'left-out', 'right-out'].includes(room.doorSwing) ? room.doorSwing : 'left-in';

  function addPost(x, z, id) {
    pushBox([x - half, 0, z - half], [x + half, h, z + half], {
      ...common,
      fill: profileFill,
      partId: `${room.id}-profile-${id}`,
      partLabel: `${label} room upright`,
      partMeta: 'Room aluminum upright',
    });
  }

  function addRailX(z, y, id, fromX = x0, toX = x1) {
    if (toX - fromX <= 0.04) return;
    pushBox([fromX - half, y - half, z - half], [toX + half, y + half, z + half], {
      ...common,
      fill: y > h * 0.5 ? capFill : railFill,
      partId: `${room.id}-rail-${id}`,
      partLabel: `${label} room rail`,
      partMeta: 'Room horizontal rail',
    });
  }

  function addRailZ(x, y, id, fromZ = z0, toZ = z1) {
    if (toZ - fromZ <= 0.04) return;
    pushBox([x - half, y - half, fromZ - half], [x + half, y + half, toZ + half], {
      ...common,
      fill: y > h * 0.5 ? capFill : railFill,
      partId: `${room.id}-rail-${id}`,
      partLabel: `${label} room rail`,
      partMeta: 'Room horizontal rail',
    });
  }

  function addInsetX(fromX, toX, z, normal, id, side, skip = false) {
    if (skip || toX - fromX <= rail * 2.8) return;
    const margin = Math.min(0.09, (toX - fromX) * 0.14);
    const y0 = rail * 1.45;
    const y1 = h - rail * 1.35;
    const zz = z + normal[2] * 0.012;
    faces.push({
      pts: [[fromX + margin, y0, zz], [toX - margin, y0, zz], [toX - margin, y1, zz], [fromX + margin, y1, zz]],
      normal,
      fill: wallInsetFill,
      partId: `${room.id}-panel-inset-${id}`,
      partLabel: `${label} framed infill panel`,
      partMeta: 'Room wall infill panel with reveal',
      roomId: room.id,
      roomWall: side,
      softEdge: true,
      renderOrder: 0.00006,
    });
  }

  function addInsetZ(fromZ, toZ, x, normal, id, side, skip = false) {
    if (skip || toZ - fromZ <= rail * 2.8) return;
    const margin = Math.min(0.09, (toZ - fromZ) * 0.14);
    const y0 = rail * 1.45;
    const y1 = h - rail * 1.35;
    const xx = x + normal[0] * 0.012;
    faces.push({
      pts: [[xx, y0, fromZ + margin], [xx, y0, toZ - margin], [xx, y1, toZ - margin], [xx, y1, fromZ + margin]],
      normal,
      fill: wallInsetFill,
      partId: `${room.id}-panel-inset-${id}`,
      partLabel: `${label} framed infill panel`,
      partMeta: 'Room wall infill panel with reveal',
      roomId: room.id,
      roomWall: side,
      softEdge: true,
      renderOrder: 0.00006,
    });
  }

  const skippedDoorWall = (doorSide === 'front' && skipFront)
    || (doorSide === 'back' && skipBack)
    || (doorSide === 'left' && skipLeft)
    || (doorSide === 'right' && skipRight);
  const activeDoor = room.hasDoor && !skippedDoorWall;
  const doorAxisCenter = doorSide === 'front' || doorSide === 'back' ? doorCenterX : doorCenterZ;
  const doorMin = doorAxisCenter - doorW / 2;
  const doorMax = doorAxisCenter + doorW / 2;
  const doorUsesX = doorSide === 'front' || doorSide === 'back';
  const isDoorBay = (side, from, to) => activeDoor
    && doorSide === side
    && from >= doorMin - 0.001
    && to <= doorMax + 0.001;
  const isInsideDoor = (side, value) => activeDoor
    && doorSide === side
    && value > doorMin + 0.001
    && value < doorMax - 0.001;
  const moduleX = Math.max(1, Math.round(x1 - x0));
  const moduleZ = Math.max(1, Math.round(z1 - z0));
  const xStops = new Set([x0, x1]);
  const zStops = new Set([z0, z1]);
  for (let i = 1; i < moduleX; i++) xStops.add(Number((x0 + ((x1 - x0) * i) / moduleX).toFixed(4)));
  for (let i = 1; i < moduleZ; i++) zStops.add(Number((z0 + ((z1 - z0) * i) / moduleZ).toFixed(4)));
  if (activeDoor && doorUsesX) {
    xStops.add(Number(doorMin.toFixed(4)));
    xStops.add(Number(doorMax.toFixed(4)));
  } else if (activeDoor) {
    zStops.add(Number(doorMin.toFixed(4)));
    zStops.add(Number(doorMax.toFixed(4)));
  }

  for (const x of xStops) {
    if (!skipBack && !isInsideDoor('back', x)) addPost(x, z0, `back-${x}`);
    if (!skipFront && !isInsideDoor('front', x)) addPost(x, z1, `front-${x}`);
  }
  for (const z of zStops) {
    const atBack = Math.abs(z - z0) < 0.001;
    const atFront = Math.abs(z - z1) < 0.001;
    // Skip corners already added by the xStops loop to avoid double-posting
    const alreadyHandled = (atBack && !skipBack) || (atFront && !skipFront);
    if (!skipLeft && !alreadyHandled && !isInsideDoor('left', z)) addPost(x0, z, `left-${z}`);
    if (!skipRight && !alreadyHandled && !isInsideDoor('right', z)) addPost(x1, z, `right-${z}`);
  }

  const sortedX = [...xStops].sort((a, b) => a - b);
  const sortedZ = [...zStops].sort((a, b) => a - b);
  for (let i = 0; i < sortedX.length - 1; i++) {
    if (!skipBack) addInsetX(sortedX[i], sortedX[i + 1], z0 + EX + 0.006, [0, 0, 1], `back-${i}`, 'back', isDoorBay('back', sortedX[i], sortedX[i + 1]));
    if (!skipFront) addInsetX(sortedX[i], sortedX[i + 1], z1 - EX - 0.006, [0, 0, -1], `front-${i}`, 'front', isDoorBay('front', sortedX[i], sortedX[i + 1]));
  }
  for (let i = 0; i < sortedZ.length - 1; i++) {
    if (!skipLeft) addInsetZ(sortedZ[i], sortedZ[i + 1], x0 + EX + 0.006, [1, 0, 0], `left-${i}`, 'left', isDoorBay('left', sortedZ[i], sortedZ[i + 1]));
    if (!skipRight) addInsetZ(sortedZ[i], sortedZ[i + 1], x1 - EX - 0.006, [-1, 0, 0], `right-${i}`, 'right', isDoorBay('right', sortedZ[i], sortedZ[i + 1]));
  }

  if (!skipBack) {
    addRailX(z0, h, 'back-top');
    if (activeDoor && doorSide === 'back') {
      addRailX(z0, rail, 'back-bottom-left', x0, doorMin);
      addRailX(z0, rail, 'back-bottom-right', doorMax, x1);
      addRailX(z0, doorH, 'back-door-header', doorMin, doorMax);
    } else {
      addRailX(z0, rail, 'back-bottom');
    }
  }
  if (!skipFront) {
    addRailX(z1, h, 'front-top');
    if (activeDoor && doorSide === 'front') {
      addRailX(z1, rail, 'front-bottom-left', x0, doorMin);
      addRailX(z1, rail, 'front-bottom-right', doorMax, x1);
      addRailX(z1, doorH, 'front-door-header', doorMin, doorMax);
    } else {
      addRailX(z1, rail, 'front-bottom');
    }
  }
  if (!skipLeft) {
    addRailZ(x0, h, 'left-top');
    if (activeDoor && doorSide === 'left') {
      addRailZ(x0, rail, 'left-bottom-back', z0, doorMin);
      addRailZ(x0, rail, 'left-bottom-front', doorMax, z1);
      addRailZ(x0, doorH, 'left-door-header', doorMin, doorMax);
    } else {
      addRailZ(x0, rail, 'left-bottom');
    }
  }
  if (!skipRight) {
    addRailZ(x1, h, 'right-top');
    if (activeDoor && doorSide === 'right') {
      addRailZ(x1, rail, 'right-bottom-back', z0, doorMin);
      addRailZ(x1, rail, 'right-bottom-front', doorMax, z1);
      addRailZ(x1, doorH, 'right-door-header', doorMin, doorMax);
    } else {
      addRailZ(x1, rail, 'right-bottom');
    }
  }

  if (!activeDoor) return;
  const doorThickness = Math.max(EX * 0.62, 0.026);
  const isRightHinge = doorSwing.startsWith('right');
  const opensIn = doorSwing.endsWith('in');
  const closedMin = doorMin + rail * 0.38;
  const closedMax = doorMax - rail * 0.38;
  const hingeAxis = isRightHinge ? closedMax : closedMin;
  const baseSwingRad = doorOpen
    ? (isRightHinge ? (opensIn ? Math.PI * 0.46 : -Math.PI * 0.46) : (opensIn ? -Math.PI * 0.46 : Math.PI * 0.46))
    : 0;
  const swingDirection = doorSide === 'back' || doorSide === 'right' ? -1 : 1;
  const wallAxis = doorSide === 'front' ? z1 : doorSide === 'back' ? z0 : doorSide === 'left' ? x0 : x1;
  const doorTransform = doorUsesX
    ? { originX: hingeAxis, originZ: wallAxis, rotRad: baseSwingRad * swingDirection }
    : { originX: wallAxis, originZ: hingeAxis, rotRad: baseSwingRad * swingDirection };
  const panelMin = doorUsesX
    ? [closedMin, rail * 0.65, wallAxis - doorThickness / 2]
    : [wallAxis - doorThickness / 2, rail * 0.65, closedMin];
  const panelMax = doorUsesX
    ? [closedMax, doorH, wallAxis + doorThickness / 2]
    : [wallAxis + doorThickness / 2, doorH, closedMax];
  pushBox(panelMin, panelMax, {
    ...roomCommon,
    ...doorTransform,
    fill: 'rgba(247,249,252,0.94)',
    // Inside the room's own layer band, so depth decides where the leaf sits
    // rather than a layer number. It used to be lifted clear of the band to
    // guarantee it beat the wall it hangs in - which also lifted it above every
    // *other* wall, so a door on the far side of a room was drawn on top of the
    // near wall and appeared to float in the middle of a solid panel. That was
    // invisible while two of the four walls were not being drawn at all; with
    // the walls fixed it is the first thing you see.
    //
    // Depth is now enough. The leaf stands proud of the wall plane on both
    // faces, so it wins against the wall it belongs to; the handle stands proud
    // of the leaf on the inward face, so it wins from inside the room and is
    // correctly hidden by the leaf from outside - which is where an inward
    // handle actually is.
    partId: `${room.id}-door-panel`,
    partLabel: `${label} door panel`,
    partMeta: `${meta} - hinged room door`,
    softEdge: true,
    roomDoorToggle: true,
    renderOrder: 0.00009,
  });
  const panelWidth = Math.max(0.4, closedMax - closedMin);
  const handleAxis = isRightHinge ? closedMin + Math.min(0.16, panelWidth * 0.2) : closedMax - Math.min(0.16, panelWidth * 0.2);
  const handleY = Math.min(1.1, doorH * 0.52);
  const inward = doorSide === 'front' ? -1 : doorSide === 'back' ? 1 : doorSide === 'left' ? 1 : -1;
  const handleBaseA = wallAxis + inward * 0.018;
  const handleBaseB = wallAxis + inward * 0.038;
  const handleGripA = wallAxis + inward * 0.038;
  const handleGripB = wallAxis + inward * 0.06;
  const handleBaseMin = doorUsesX
    ? [handleAxis - 0.035, handleY - 0.09, Math.min(handleBaseA, handleBaseB)]
    : [Math.min(handleBaseA, handleBaseB), handleY - 0.09, handleAxis - 0.035];
  const handleBaseMax = doorUsesX
    ? [handleAxis + 0.035, handleY + 0.09, Math.max(handleBaseA, handleBaseB)]
    : [Math.max(handleBaseA, handleBaseB), handleY + 0.09, handleAxis + 0.035];
  pushBox(handleBaseMin, handleBaseMax, {
    ...roomCommon,
    ...doorTransform,
    fill: '#d6dde6',
    partId: `${room.id}-door-handle-base`,
    partLabel: `${label} door handle`,
    partMeta: 'Metal handle plate',
    softEdge: true,
    roomDoorToggle: true,
    renderOrder: 0.00009,
  });
  const handleGripMin = doorUsesX
    ? [handleAxis - 0.09, handleY - 0.015, Math.min(handleGripA, handleGripB)]
    : [Math.min(handleGripA, handleGripB), handleY - 0.015, handleAxis - 0.09];
  const handleGripMax = doorUsesX
    ? [handleAxis + 0.09, handleY + 0.015, Math.max(handleGripA, handleGripB)]
    : [Math.max(handleGripA, handleGripB), handleY + 0.015, handleAxis + 0.09];
  pushBox(handleGripMin, handleGripMax, {
    ...roomCommon,
    ...doorTransform,
    fill: '#c8d0da',
    partId: `${room.id}-door-handle-grip`,
    partLabel: `${label} door handle grip`,
    partMeta: 'Metal pull handle',
    softEdge: true,
    roomDoorToggle: true,
    renderOrder: 0.00009,
  });
}

function furnitureShape(item) {
  const code = String(item.sku || item.catalogId || item.code || '').trim().toLowerCase();
  const name = String(item.name || '').trim().toLowerCase();
  const declared = String(item.shape || '').trim().toLowerCase();
  const known = ['round_table','rect_table','counter','shelf','wall_shelf','cabinet','cube','chair','bar_stool','light','rail_light','box'];
  if (item.kind === 'asset') return 'asset';
  if (known.includes(declared)) return declared;
  if (item.kind === 'light' || code === '417' || code === '418' || code === 'fascia_light' || name.includes('light')) return 'rail_light';
  if (['103', '107', '110'].includes(code) || name.includes('round') || name.includes('glass table')) return 'round_table';
  if (['105', '111', '112', '113', '211', '212', '508'].includes(code)) return 'rect_table';
  if (['149', '250-b', '309'].includes(code) || name.includes('chair')) return 'chair';
  if (['255-b', '307', '513'].includes(code) || name.includes('stool')) return 'bar_stool';
  if (['208', '209', '215', '458', '461'].includes(code) || name.includes('counter') || name.includes('desk')) return 'counter';
  if (code === 'ws-001' || name.includes('wall shelf')) return 'wall_shelf';
  if (['213'].includes(code) || name.includes('shelf')) return 'shelf';
  if (['216'].includes(code) || name.includes('cupboard') || name.includes('cabinet')) return 'cabinet';
  if (['201', '205', '206'].includes(code) || name.includes('showcase')) return 'box';
  if (['217', '218'].includes(code) || name.includes('cube')) return 'cube';
  if (name.includes('table')) return 'rect_table';
  return 'box';
}

function pushFurnitureItem(item, x, y, z, w, d, h, color, partLabel, partMeta, q) {
  const id = `${item.id || item.sku || 'item'}-${q}`;
  const shape = furnitureShape(item);
  const rotation = ((Number(item.rotationY ?? item.rotation) || 0) % 360) * Math.PI / 180;
  const isCeilingFixture = shape === 'light' || shape === 'rail_light';
  if (!isCeilingFixture) y = Math.max(y, 0.035);
  /**
   * Every part of an item shares one layer, and what decides the order *within*
   * an item is the sequence these are pushed in - nothing else.
   *
   * That is worth stating because the code used to claim otherwise. Twenty-one
   * call sites below carried explicit renderOrder values - a table top at 1, its
   * post at 2, its base at 3 - and every one of them was dead: `...common` is
   * spread last in those literals, so this renderOrder overwrote them all. The
   * declarations had never once taken effect, and the furniture looked right
   * only because the push order happens to agree with the intent.
   *
   * Making them live is not the fix. The booth shell carries no renderOrder at
   * all, so it sits at 0, and the fascia occupies 0.42-0.96. Switching the
   * spread order was tried: the table top jumped to 1 and drew straight through
   * the fascia beam, and a showcase drew over the wall behind it. Those values
   * were written against a layer scheme that does not exist.
   *
   * So: one layer for the whole item, insertion order within it. To put a part
   * in front of another part, push it later - and if the two are coplanar, that
   * is the only thing that will decide it.
   */
  const common = { partLabel, partMeta, isFurniture: true, itemId: item.id, rotRad: rotation, originX: x, originZ: z, renderOrder: 0.00003 };
  const topColor = color || '#e8e2d8';
  if (!isCeilingFixture) pushFurnitureShadow(x, z, w, d, common);
  // Anything with a GLB draws only an invisible pick-box here; the model is
  // the thing you see. Ceiling fixtures used to be excluded from this, so a
  // light with a model drew the amber stand-in block as well as the model -
  // two lights, one of them a yellow cube.
  if (item.modelUrl) {
    pushBox([x - w/2, y, z - d/2], [x + w/2, y + Math.max(0.18, h), z + d/2], {
      // `common` goes first so the keys below win. Spread last - as it was -
      // its partMeta replaced the one on the next-but-one line, and the model
      // path this pick-box exists to carry never reached the inspector. That
      // is the one thing worth knowing when a model fails to load: which file
      // did not arrive.
      ...common,
      fill: 'rgba(37,99,235,0.001)',
      partId: id + '-glb-hitbox',
      partLabel,
      partMeta: item.modelUrl || partMeta,
      softEdge: true,
      skipSelectionHighlight: true,
    });
    return;
  }
  if (shape === 'asset') {
    pushBox([x - w/2, y, z - d/2], [x + w/2, y + Math.min(0.06, h * 0.12), z + d/2], {
      fill: 'rgba(29,78,216,0.18)', partId: id + '-asset-footprint', softEdge: true, ...common,
    });
    pushBox([x - w*0.30, y + Math.min(0.06, h * 0.12), z - d*0.30], [x + w*0.30, y + h, z + d*0.30], {
      fill: topColor, partId: id + '-asset-proxy', partLabel: partLabel + ' · GLB proxy', partMeta: (item.modelUrl || partMeta), softEdge: true, ...common,
    });
    pushBox([x - w*0.18, y + h, z - d*0.18], [x + w*0.18, y + h + Math.min(0.08, h * 0.12), z + d*0.18], {
      fill: '#ffffff', partId: id + '-asset-highlight', softEdge: true, ...common,
    });
    return;
  }

  if (shape === 'light' || shape === 'rail_light') {
    const lightColor = item.sku === '418' ? '#ffd166' : '#fff3b0';
    const railW = Math.max(0.14, w * 0.72);
    pushBox([x - railW/2, y - 0.035, z - 0.055], [x + railW/2, y + 0.025, z + 0.055], {
      fill: '#2f3540', partId: id + '-rail-light-body', softEdge: true, ...common,
    });
    pushBox([x - railW*0.32, y + 0.025, z - 0.03], [x + railW*0.32, y + 0.06, z + 0.03], {
      fill: '#59606a', partId: id + '-rail-light-bracket', softEdge: true, ...common,
    });
    pushPrism(x, z, y - 0.14, y - 0.03, 0.105, 12, {
      fill: lightColor, partId: id + '-rail-light-lens', softEdge: true, ...common,
    });
    return;
  }

  if (shape === 'round_table') {
    const radius = Math.max(w, d) / 2;
    const topThickness = 0.035;
    const postHalf = 0.022;
    pushPrism(x, z, y + h - topThickness, y + h, radius, 56, {
      fill: topColor, partId: id + '-table-top', softEdge: true, noFacetShade: true, noSides: true, ...common,
    });
    pushBox([x - postHalf, y + 0.03, z - postHalf], [x + postHalf, y + h - topThickness, z + postHalf], {
      fill: '#464b54', partId: id + '-table-post', softEdge: true, ...common,
    });
    pushPrism(x, z, y, y + 0.018, Math.min(radius * 0.34, 0.14), 40, {
      fill: '#444952', partId: id + '-table-base', softEdge: true, noFacetShade: true, noSides: true, ...common,
    });
    return;
  }

  if (shape === 'rect_table') {
    const topThickness = 0.045;
    const apron = 0.028;
    const legHalf = 0.022;
    const legInsetX = Math.min(0.16, w * 0.18);
    const legInsetZ = Math.min(0.14, d * 0.18);
    pushBox([x - w/2, y + h - topThickness, z - d/2], [x + w/2, y + h, z + d/2], {
      fill: topColor, partId: id + '-table-top', softEdge: true, ...common,
    });
    pushBox([x - w/2 + 0.04, y + h - topThickness - apron, z - d/2 + 0.04], [x + w/2 - 0.04, y + h - topThickness, z + d/2 - 0.04], {
      fill: '#d7cabc', partId: id + '-table-apron', softEdge: true, ...common,
    });
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz],i)=>{
      const lx = x + sx * (w / 2 - legInsetX);
      const lz = z + sz * (d / 2 - legInsetZ);
      pushBox([lx - legHalf, y, lz - legHalf], [lx + legHalf, y + h - topThickness - apron, lz + legHalf], {
        fill: '#4b5058', partId: id + '-table-leg-' + i, softEdge: true, ...common,
      });
    });
    return;
  }

  if (shape === 'chair' || shape === 'bar_stool') {
    const seatH = shape === 'bar_stool' ? Math.min(h * 0.72, 0.72) : Math.min(h * 0.48, 0.45);
    if (shape === 'bar_stool') {
      const radius = Math.min(w, d) * 0.42;
      pushPrism(x, z, y + seatH, y + seatH + 0.07, radius, 36, {
        fill: '#f8f5ef', partId: id + '-round-seat', softEdge: true, noFacetShade: true, noSides: true, ...common,
      });
      pushPrism(x, z, y + 0.035, y + seatH, 0.026, 18, {
        fill: '#444952', partId: id + '-stool-post', softEdge: true, noFacetShade: true, ...common,
      });
      pushPrism(x, z, y, y + 0.026, Math.min(w,d)*0.28, 28, {
        fill: '#444952', partId: id + '-stool-base', softEdge: true, noFacetShade: true, noSides: true, ...common,
      });
      pushBox([x - radius * 0.72, y + seatH * 0.45, z + radius * 0.18], [x + radius * 0.72, y + seatH * 0.45 + 0.025, z + radius * 0.24], {
        fill: '#525861', partId: id + '-footrest', softEdge: true, ...common,
      });
    } else {
      const cushion = '#f7f1e8';
      const legW = 0.018;
      pushBox([x - w*0.44, y + seatH, z - d*0.42], [x + w*0.44, y + seatH + 0.06, z + d*0.40], {
        fill: cushion, partId: id + '-seat-cushion', softEdge: true, ...common,
      });
      pushBox([x - w*0.40, y + seatH + 0.07, z + d*0.30], [x + w*0.40, y + h, z + d*0.40], {
        fill: cushion, partId: id + '-back-panel', softEdge: true, ...common,
      });
      pushBox([x - w*0.34, y + seatH + 0.14, z + d*0.285], [x + w*0.34, y + h - 0.05, z + d*0.30], {
        fill: '#ffffff', partId: id + '-back-highlight', softEdge: true, ...common,
      });
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz],i)=>{
        const lx = x + sx*(w*0.34);
        const lz = z + sz*(d*0.31);
        pushBox([lx - legW, y, lz - legW], [lx + legW, y + seatH, lz + legW], {
          fill: '#4d535c', partId: id + '-chair-leg-' + i, softEdge: true, ...common,
        });
      });
    }
    return;
  }

  if (shape === 'counter') {
    const bodyColor = topColor || '#ddd5cb';
    const insetColor = '#f8f4ee';
    const shadowColor = '#b8ab9b';
    const plinthH = Math.min(0.07, h * 0.08);
    const topH = Math.min(0.095, h * 0.10);
    pushBox([x - w/2 + 0.025, y + plinthH, z - d/2 + 0.015], [x + w/2 - 0.025, y + h - topH, z + d/2 - 0.015], {
      fill: bodyColor, partId: id + '-counter-body', softEdge: true, ...common,
    });
    pushBox([x - w/2 + 0.075, y + 0.16, z - d/2 - 0.014], [x + w/2 - 0.075, y + h - topH - 0.07, z - d/2 + 0.018], {
      fill: insetColor, partId: id + '-counter-front-inset', softEdge: true, ...common,
    });
    pushBox([x - w/2 + 0.11, y + 0.2, z - d/2 - 0.021], [x + w/2 - 0.11, y + 0.225, z - d/2 + 0.004], {
      fill: shadowColor, partId: id + '-counter-inset-shadow-top', softEdge: true, ...common,
    });
    pushBox([x - w/2 - 0.015, y + h - topH, z - d/2 - 0.04], [x + w/2 + 0.015, y + h + 0.025, z + d/2 + 0.035], {
      fill: '#ffffff', partId: id + '-counter-top-slab', softEdge: true, ...common,
    });
    pushBox([x - w/2 + 0.02, y + h - topH - 0.025, z - d/2 - 0.018], [x + w/2 - 0.02, y + h - topH, z + d/2 + 0.012], {
      fill: '#d7cab8', partId: id + '-counter-top-underlip', softEdge: true, ...common,
    });
    pushBox([x - w/2 + 0.07, y, z - d/2 + 0.04], [x + w/2 - 0.07, y + plinthH, z + d/2 - 0.04], {
      fill: '#4b5058', partId: id + '-counter-plinth', softEdge: true, ...common,
    });
    [-1, 1].forEach((sx, i) => {
      pushBox([x + sx * (w/2 - 0.035) - 0.006, y + 0.11, z - d/2 - 0.016], [x + sx * (w/2 - 0.035) + 0.006, y + h - topH - 0.08, z - d/2 + 0.01], {
        fill: 'rgba(130,122,112,0.26)', partId: id + '-counter-front-seam-' + i, softEdge: true, ...common,
      });
    });
    return;
  }

  if (shape === 'wall_shelf') {
    const shelfY = Math.max(0.9, y + h);
    pushBox([x - w/2, shelfY, z - d/2], [x + w/2, shelfY + 0.045, z + d/2], {
      fill: topColor, partId: id + '-wall-shelf-plank', softEdge: true, ...common,
    });
    [-0.35, 0.35].forEach((sx, i) => {
      pushBox([x + sx*w - 0.018, shelfY - 0.22, z - d*0.48], [x + sx*w + 0.018, shelfY, z - d*0.40], {
        fill: '#9aa1aa', partId: id + '-wall-shelf-bracket-' + i, softEdge: true, ...common,
      });
      pushBox([x + sx*w - 0.075, shelfY - 0.22, z - d*0.48], [x + sx*w + 0.075, shelfY - 0.19, z - d*0.40], {
        fill: '#9aa1aa', partId: id + '-wall-shelf-support-' + i, softEdge: true, ...common,
      });
    });
    return;
  }

  if (shape === 'shelf' || shape === 'cabinet') {
    const frame = '#d7dee6';
    const glass = 'rgba(207,224,238,0.34)';
    pushBox([x - w/2, y, z - d/2], [x + w/2, y + 0.055, z + d/2], {
      fill: '#dfe3e8', partId: id + '-case-plinth', softEdge: true, ...common,
    });
    pushBox([x - w/2, y + h - 0.055, z - d/2], [x + w/2, y + h, z + d/2], {
      fill: frame, partId: id + '-case-top', softEdge: true, ...common,
    });
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz],i)=>{
      const px = x + sx * (w/2 - 0.02);
      const pz = z + sz * (d/2 - 0.02);
      pushBox([px - 0.018, y, pz - 0.018], [px + 0.018, y + h, pz + 0.018], {
        fill: frame, partId: id + '-case-post-' + i, softEdge: true, ...common,
      });
    });
    const shelves = shape === 'shelf' ? 3 : 2;
    for (let i = 1; i <= shelves; i++) {
      const sy = y + (h / (shelves + 1)) * i;
      pushBox([x - w/2 + 0.03, sy, z - d/2 - 0.01], [x + w/2 - 0.03, sy + 0.035, z + d/2 + 0.01], {
        fill: '#ffffff', partId: id + '-shelf-' + i, softEdge: true, ...common,
      });
    }
    pushBox([x - w/2 + 0.018, y + 0.055, z - d/2 - 0.012], [x + w/2 - 0.018, y + 0.085, z - d/2 + 0.015], {
      fill: '#bfc8d1', partId: id + '-case-front-bottom-rail', softEdge: true, ...common,
    });
    pushBox([x - w/2 + 0.018, y + h - 0.085, z - d/2 - 0.012], [x + w/2 - 0.018, y + h - 0.055, z - d/2 + 0.015], {
      fill: '#eef2f5', partId: id + '-case-front-top-rail', softEdge: true, ...common,
    });
    if (shape === 'cabinet') {
      pushBox([x - w/2 + 0.04, y + 0.08, z - d/2 - 0.012], [x, y + h - 0.08, z - d/2 + 0.018], {
        fill: 'rgba(255,255,255,0.58)', partId: id + '-cabinet-left-door', softEdge: true, ...common,
      });
      pushBox([x, y + 0.08, z - d/2 - 0.012], [x + w/2 - 0.04, y + h - 0.08, z - d/2 + 0.018], {
        fill: 'rgba(255,255,255,0.52)', partId: id + '-cabinet-right-door', softEdge: true, ...common,
      });
      pushBox([x - 0.035, y + h*0.48, z - d/2 - 0.025], [x + 0.035, y + h*0.56, z - d/2 + 0.005], {
        fill: '#b9c1cb', partId: id + '-cabinet-handle', softEdge: true, ...common,
      });
      pushBox([x - 0.006, y + 0.11, z - d/2 - 0.026], [x + 0.006, y + h - 0.11, z - d/2 + 0.006], {
        fill: 'rgba(125,132,142,0.26)', partId: id + '-cabinet-door-gap', softEdge: true, ...common,
      });
    } else {
      pushBox([x - w/2 + 0.035, y + 0.08, z - d/2 - 0.012], [x + w/2 - 0.035, y + h - 0.08, z - d/2 + 0.018], {
        fill: glass, partId: id + '-shelf-glass-front', softEdge: true, ...common,
      });
      pushBox([x - w/2 + 0.055, y + 0.13, z - d/2 - 0.02], [x + w/2 - 0.055, y + h - 0.13, z - d/2 - 0.006], {
        fill: 'rgba(255,255,255,0.28)', partId: id + '-shelf-glass-reflection', softEdge: true, ...common,
      });
    }
    return;
  }

  const code = String(item.sku || item.catalogId || '').toLowerCase();
  const isShowcase = ['201','205','206'].includes(code) || String(item.name || '').toLowerCase().includes('showcase');
  if (isShowcase || shape === 'cube' || shape === 'box') {
    const glassFill = isShowcase ? 'rgba(222,236,246,0.30)' : topColor;
    pushBox([x - w/2, y, z - d/2], [x + w/2, y + Math.min(0.06, h * 0.14), z + d/2], {
      fill: '#dce2e8', partId: id + '-display-plinth', softEdge: true, ...common,
    });
    pushBox([x - w/2, y + h - Math.min(0.06, h * 0.14), z - d/2], [x + w/2, y + h, z + d/2], {
      fill: '#f7f9fb', partId: id + '-display-top', softEdge: true, ...common,
    });
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz],i)=>{
      const px = x + sx * (w/2 - 0.018);
      const pz = z + sz * (d/2 - 0.018);
      pushBox([px - 0.014, y, pz - 0.014], [px + 0.014, y + h, pz + 0.014], {
        fill: '#c9d1da', partId: id + '-display-post-' + i, softEdge: true, ...common,
      });
    });
    pushBox([x - w/2 + 0.03, y + 0.07, z - d/2 - 0.008], [x + w/2 - 0.03, y + h - 0.07, z - d/2 + 0.016], {
      fill: glassFill, partId: id + '-display-glass-front', softEdge: true, ...common,
    });
    if (isShowcase) {
      const shelfCount = h > 1.2 ? 3 : 2;
      for (let i = 1; i <= shelfCount; i++) {
        const sy = y + h * (i / (shelfCount + 1));
        pushBox([x - w/2 + 0.045, sy, z - d/2 + 0.035], [x + w/2 - 0.045, sy + 0.025, z + d/2 - 0.035], {
          fill: 'rgba(255,255,255,0.78)', partId: id + '-display-shelf-' + i, softEdge: true, ...common,
        });
      }
      if (code === '205' || code === '206' || String(item.name || '').toLowerCase().includes('lighted')) {
        pushBox([x - w/2 + 0.08, y + h - 0.11, z - d/2 + 0.02], [x + w/2 - 0.08, y + h - 0.08, z + d/2 - 0.02], {
          fill: '#fff3b0', partId: id + '-display-light-strip', softEdge: true, ...common,
        });
      }
    }
    return;
  }

  pushBox([x - w/2, y, z - d/2], [x + w/2, y + h, z + d/2], {
    fill: topColor,
    partId: id + '-box',
    ...common,
  });
}

function buildPlacedItems() {
  let counterCount = 0;
  let seatingCount = 0;
  let tableCount = 0;
  let lightCount = 0;
  let generalCount = 0;

  for (const item of placedItems) {
    const qty = item.qty || 1;
    for (let q = 0; q < qty; q++) {
      let x = Number.isFinite(Number(item.x)) ? -BW / 2 + Number(item.x) : 0;
      let y = 0;
      let z = Number.isFinite(Number(item.z)) ? Number(item.z) : 0;
      let w = item.w || 0.6, d = item.d || 0.6, h = item.h || 0.8;
      let color = item.color || '#e67e22';
      let partLabel = item.name;
      let partMeta = `${item.sku} · ${w.toFixed(1)}×${d.toFixed(1)}×${h.toFixed(1)}m`;

      const idLower = item.name.toLowerCase();
      const hasExplicitPosition = Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.z));
      if (!hasExplicitPosition && (idLower.includes('counter') || idLower.includes('reception'))) {
        x = (counterCount - (qty - 1) / 2) * 1.5;
        z = BD - 0.9;
        y = 0;
        counterCount++;
      } else if (!hasExplicitPosition && (idLower.includes('table') || idLower.includes('desk'))) {
        x = -BW * 0.2 + (tableCount - (qty - 1) / 2) * 1.8;
        z = BD * 0.45;
        y = 0;
        tableCount++;
      } else if (!hasExplicitPosition && (idLower.includes('chair') || idLower.includes('stool') || idLower.includes('seating'))) {
        if (tableCount > 0) {
          const angle = (seatingCount * Math.PI * 2) / Math.max(1, qty);
          x = -BW * 0.2 + Math.cos(angle) * 0.7;
          z = BD * 0.45 + Math.sin(angle) * 0.7;
        } else {
          x = (seatingCount - (qty - 1) / 2) * 1.2;
          z = BD - 1.5;
        }
        y = 0;
        seatingCount++;
      } else if (idLower.includes('spotlight') || idLower.includes('light') || idLower.includes('led') || item.kind === 'light') {
        // A light that has been placed keeps exactly where it was placed. This
        // branch used to run the auto-arrangement regardless, and then set
        // y = BH unconditionally - overwriting the height two lines above - so
        // a light dragged onto a rail was redrawn hanging in the middle of the
        // booth. The `else` fallback put it at x = 0, z = BD/2, dead centre,
        // which is exactly where they were turning up.
        const wallPos = lightCount % 3;
        if (hasExplicitPosition) {
          // Re-seat the fixture on the nearest profile every frame. The rails
          // move when the booth is resized, and a light left on its old
          // coordinate would be hanging beside one instead of on it. This is
          // idempotent - a light already on a rail is zero distance from it.
          const hit = nearestRailRun(x, z);
          if (hit) {
            const seat = railMountPoint(hit, d);
            x = seat.x;
            z = seat.z;
          }
          y = mountedBaseY(item);
        } else {
          if (wallPos === 0 && wallsVisible.back) {
            x = -BW/2 + ((lightCount / 3) + 1) * (BW / 5);
            z = 0.05;
          } else if (wallPos === 1 && wallsVisible.left) {
            x = -BW/2 + 0.05;
            z = ((lightCount / 3) + 1) * (BD / 5);
          } else if (wallsVisible.right) {
            x = BW/2 - 0.05;
            z = ((lightCount / 3) + 1) * (BD / 5);
          } else {
            // No wall to hang from: put it on the back rail rather than
            // stranding it in the middle of the floor.
            x = 0;
            z = 0.05;
          }
          y = railLightY();
        }
        // Keep the catalogue's real size. Forcing a 15 cm cube here is what drew
        // the amber block instead of the fixture.
        if (!(w > 0) || !(d > 0) || !(h > 0)) { w = 0.15; d = 0.15; h = 0.15; }
        color = color || '#f1c40f';
        lightCount++;
      } else if (!hasExplicitPosition) {
        const cols = 2;
        const row = Math.floor(generalCount / cols);
        const col = generalCount % cols;
        x = BW * 0.25 + col * 1.0;
        z = BD * 0.3 + row * 1.0;
        y = 0;
        generalCount++;
      }

      // Drawing must not move what it draws - see placedItemRenderXZ.
      const clamped = placedItemRenderXZ(item, x, z);
      x = clamped.x;
      z = clamped.z;
      syncCorrectedItemPosition(item, x, z);

      pushFurnitureItem(item, x, y, z, w, d, h, color, partLabel, partMeta, q);
    }
  }
}


/* ── Wall mounting constraints ─────────────────────────────────────────────
 *
 * Three families of object do not sit on the floor and must not be dragged as
 * though they did:
 *
 *   wall_shelf / shelf  mounted to a wall panel, spanning its full width, and
 *                       moving one whole panel at a time. A shelf half way
 *                       across a joint is not buildable.
 *   rail_light / light  carried on the top beam of a wall frame, sliding
 *                       horizontally along that beam only.
 *   everything else     free on the floor, but snapping flush when pushed up
 *                       against a wall, so a counter can sit against the back
 *                       wall without a millimetre of daylight behind it.
 *
 * The wall runs below mirror the buildWall() calls exactly - same corners, same
 * panel counts - so a slot computed here lands on the panel that is drawn.
 * Open sides are skipped: nothing mounts to a wall that is not there.
 */
const WALL_FLUSH_RANGE_M = 0.35; // how near a wall ordinary furniture snaps flush
// Placeable plan around the stand. Mirrors PLAN_MARGIN_M in workspace-transform.ts.
const PLAN_MARGIN_M = 3;

function boothWallRuns() {
  // All four sides, always. An open side still has its uprights and its top
  // beam - the frame is what furniture is pushed against and what a light
  // rides - so skipping sides without panels meant furniture could only be
  // placed against some edges of the booth and not others.
  return [
    { name:'back',  axis:'x', from:-BW/2, to:BW/2, fixed:0,     panels:PANELS_BACK, inX:0,  inZ:1  },
    { name:'front', axis:'x', from:-BW/2, to:BW/2, fixed:BD,    panels:PANELS_BACK, inX:0,  inZ:-1 },
    { name:'left',  axis:'z', from:0,     to:BD,   fixed:-BW/2, panels:PANELS_SIDE, inX:1,  inZ:0  },
    { name:'right', axis:'z', from:0,     to:BD,   fixed:BW/2,  panels:PANELS_SIDE, inX:-1, inZ:0  },
    ...roomWallRuns(),
  ];
}

/**
 * The same runs, for the walls of every room in the stand.
 *
 * A room is built out of the identical 1 m modules as the shell, with the same
 * uprights and the same top rail, so everything the booth walls support a room
 * wall supports too: a shelf takes the width of the panel it lands on, a light
 * rides the top rail, and a counter pushed against it sits flush. None of that
 * worked inside a room before - boothWallRuns() listed the four shell walls and
 * nothing else, so a storeroom was a place furniture could stand in and not a
 * place anything could be fixed to.
 *
 * Two runs per wall, one for each face: a shelf hangs inside a room or outside
 * it, and which one you get is decided by where the item is, not by a rule.
 * Walls that a room borrows from the shell are skipped - those are already in
 * the list above, and a doubled run is a slot furniture fights over.
 */
function roomWallRuns() {
  const runs = [];
  for (const geom of roomGeometry.values()) {
    // roomGeometry records what was last *built*, and a room can be removed
    // without a rebuild having happened yet. Mounting to the walls of a room
    // that is no longer in the stand is worse than mounting to nothing.
    if (!rooms.some(room => String(room.id) === geom.id)) continue;
    const modulesX = Math.max(1, Math.round(geom.x1 - geom.x0));
    const modulesZ = Math.max(1, Math.round(geom.z1 - geom.z0));
    const add = (side, axis, from, to, outerFixed, innerFixed, inX, inZ, panels) => {
      if (!geom.built[side]) return;
      const shared = { axis, from, to, panels, railY: geom.h, wallHeight: geom.h, roomId: geom.id };
      runs.push({ ...shared, name: `room:${geom.id}:${side}:in`,  face: 'in',  fixed: innerFixed, inX,  inZ  });
      runs.push({ ...shared, name: `room:${geom.id}:${side}:out`, face: 'out', fixed: outerFixed, inX: -inX, inZ: -inZ });
    };
    add('back',  'x', geom.x0, geom.x1, geom.z0,      geom.z0 + EX, 0,  1,  modulesX);
    add('front', 'x', geom.x0, geom.x1, geom.z1,      geom.z1 - EX, 0, -1,  modulesX);
    add('left',  'z', geom.z0, geom.z1, geom.x0,      geom.x0 + EX, 1,  0,  modulesZ);
    add('right', 'z', geom.z0, geom.z1, geom.x1,      geom.x1 - EX, -1, 0,  modulesZ);
  }
  return runs;
}

/**
 * The height the top profile of a run sits at.
 *
 * A room's rail is at the room's own height, which is at most the booth's and
 * usually lower. Without this a light mounted on a room wall was pinned to the
 * booth's ceiling rail and hung above the room it was supposed to be lighting.
 */
function runRailY(run) {
  const roomRail = run && Number(run.railY);
  if (!Number.isFinite(roomRail) || roomRail <= 0) return railLightY();
  // Mirrors railLightY() against the room's own top rail: addRailZ/addRailX
  // centre that profile on the room height, so its underside is half a profile
  // below, and the fixture hangs from it by its bracket.
  const rail = Math.max(EX * 1.25, 0.055);
  return Math.max(0, roomRail - rail / 2 - RAIL_LIGHT_BRACKET_RISE);
}

/** The height a shelf defaults to on a given run. */
function runShelfY(run) {
  const height = run && Number(run.wallHeight) > 0 ? Number(run.wallHeight) : BH;
  return Math.min(Math.max(0.9, height * 0.55), Math.max(0, height - 0.25));
}

/**
 * The wall faces something standing at (x, z) can actually be fixed to.
 *
 * Both faces of a room wall are in the list, and only one of them is reachable
 * from any given spot: standing in a storeroom you can hang a shelf on the
 * inside of its walls and on nothing else, and standing outside it you can
 * reach the outside of those same walls but not through them. Without this a
 * shelf dropped in a room mounted on whichever face happened to be a centimetre
 * nearer, and ended up hanging on the wrong side of the wall.
 *
 * The shell's own runs stay reachable from both: a room flush against the stand
 * borrows that shell wall instead of building its own, so the shell run is the
 * only thing there is to mount to.
 */
function runsReachableFrom(runs, x, z) {
  const room = roomContainingPoint(x, z);
  if (!room) {
    // Out on the stand floor: the shell, and the outside of every room.
    return runs.filter(run => !run.roomId || run.face === 'out');
  }
  const insideId = String(room.id);
  const geom = roomGeometry.get(insideId);
  // A room flush with the stand borrows that shell wall rather than building
  // its own, so the shell run is the only thing on that side to fix to. Every
  // other shell run - including the ceiling cross rails that pass over an
  // open-topped room - is on the far side of a wall from in here.
  const borrowed = new Set(geom
    ? ['back', 'front', 'left', 'right'].filter(side => !geom.built[side])
    : []);
  return runs.filter(run => {
    if (!run.roomId) return borrowed.has(run.name);
    return String(run.roomId) === insideId && run.face === 'in';
  });
}

/** Whether (x, z) lies within the stretch of wall a run covers, plus a margin. */
function withinRunExtent(run, x, z, margin = 0) {
  const along = run.axis === 'x' ? x : z;
  const lo = Math.min(run.from, run.to) - margin;
  const hi = Math.max(run.from, run.to) + margin;
  return along >= lo && along <= hi;
}

/** Distance from (x,z) to a wall run, and how far along the run that lands. */
function wallRunProjection(run, x, z) {
  const along = run.axis === 'x' ? x : z;
  const across = run.axis === 'x' ? z : x;
  const lo = Math.min(run.from, run.to), hi = Math.max(run.from, run.to);
  const clampedAlong = Math.max(lo, Math.min(hi, along));
  return {
    along: clampedAlong,
    distance: Math.abs(across - run.fixed) + Math.abs(along - clampedAlong),
  };
}

/** Panel centres along one wall run, in draw order. */
function panelSlotsForRun(run) {
  const span = run.to - run.from;
  const count = Math.max(1, run.panels);
  const bay = span / count;
  const slots = [];
  for (let i = 0; i < count; i++) {
    slots.push({ run, index: i, bay: Math.abs(bay), along: run.from + (i + 0.5) * bay });
  }
  return slots;
}

/** Where an item of the given depth sits when mounted on a slot. */
function slotMountPoint(slot, depth) {
  const run = slot.run;
  const inset = Math.max(0.03, (Number(depth) || 0.3) / 2);
  return run.axis === 'x'
    ? { x: slot.along, z: run.fixed + run.inZ * inset }
    : { x: run.fixed + run.inX * inset, z: slot.along };
}

function nearestPanelSlot(x, z) {
  let best = null;
  for (const run of runsReachableFrom(boothWallRuns(), x, z)) {
    const projection = wallRunProjection(run, x, z);
    for (const slot of panelSlotsForRun(run)) {
      const gap = projection.distance + Math.abs(slot.along - projection.along) * 0.35;
      if (!best || gap < best.gap) best = { slot, gap, distance: projection.distance };
    }
  }
  return best;
}

/**
 * Constrains a dragged item to whatever it is allowed to move along. Returns a
 * position, or null to leave the caller's floor placement alone. Mutates width
 * and rotation for shelves, which take the geometry of the panel they land on.
 */
function applyWallMountConstraint(item, x, z) {
  const shape = furnitureShape(item);

  if (shape === 'wall_shelf' || shape === 'shelf') {
    const hit = nearestPanelSlot(x, z);
    if (!hit) return null;
    // A shelf is exactly its panel wide, less a small reveal so the end caps
    // clear the uprights.
    item.w = Math.max(0.2, hit.slot.bay - 0.06);
    item.rotationY = hit.slot.run.axis === 'x' ? 0 : 90;
    // Never above the wall it is now on. A shelf carried from the booth shell
    // onto a lower room wall kept its old height and hung over the top of it.
    const wallHeight = Number(hit.slot.run.wallHeight) > 0 ? Number(hit.slot.run.wallHeight) : BH;
    const wanted = Number(item.y) > 0 ? Number(item.y) : runShelfY(hit.slot.run);
    item.y = Math.min(wanted, Math.max(0, wallHeight - 0.25));
    return slotMountPoint(hit.slot, item.d);
  }

  if (shape === 'rail_light' || shape === 'light') {
    const hit = nearestRailRun(x, z);
    if (!hit) return null;
    // Lights ride the overhead profile: free to slide along it, pinned to its
    // height and never anywhere else. Which profile that is now includes the
    // top rail of every room wall, so a storeroom can be lit from its own frame.
    item.rotationY = hit.run.axis === 'x' ? 0 : 90;
    item.y = runRailY(hit.run);
    return railMountPoint(hit, item.d);
  }

  // Ordinary furniture: snap flush to every wall within reach, testing the two
  // axes independently. Snapping only to the single nearest wall is what made
  // corners impossible - a counter in a corner is against two walls at once,
  // and picking one left the other side floating.
  const footprint = rotatedFootprint(item.w, item.d, item.rotationY ?? item.rotation);
  let snappedX = x;
  let snappedZ = z;
  let snapped = false;
  const insideBooth = Math.abs(x) <= BW / 2 && z >= 0 && z <= BD;
  for (const run of insideBooth ? runsReachableFrom(boothWallRuns(), x, z) : []) {
    // Only where the wall actually runs. The shell's walls span the whole
    // stand, so this never mattered until room walls joined the list - and a
    // room wall three metres away has no business pulling a counter onto its
    // line. The half-footprint margin lets an item still tuck into the corner
    // at either end of the run.
    const reach = run.axis === 'x' ? footprint.w / 2 : footprint.d / 2;
    if (!withinRunExtent(run, x, z, reach)) continue;
    // Measured from the item's near EDGE to the wall, not from its centre to
    // where its centre would end up. Those are the same distance only for an
    // item of no size: a 1.02 m counter seats with its centre 0.51 m off the
    // wall, so aiming the pointer at the wall itself put the centre 0.51 m
    // past the target - beyond the 0.35 m range - and the snap never fired.
    // Pushing furniture straight at a wall was the one gesture that could not
    // seat it against one, and a corner needs it to fire on both axes at once.
    const half = run.axis === 'x' ? footprint.d / 2 : footprint.w / 2;
    const depthIn = run.axis === 'x' ? (z - run.fixed) * run.inZ : (x - run.fixed) * run.inX;
    if (depthIn - half > WALL_FLUSH_RANGE_M) continue;
    // ...but only from the face's own side. depthIn goes negative once the
    // pointer is past the wall plane, which is not "pressed hard against it" -
    // it is standing on the other side of it, where the opposite face's run
    // belongs. Without this a counter dropped inside a room was grabbed by the
    // *outside* of that room's far wall and thrown a metre across the stand.
    // The tolerance is what lets a corner work at all: aiming straight at the
    // wall line puts depthIn at exactly zero.
    if (depthIn < -0.02) continue;
    if (run.axis === 'x') { snappedZ = run.fixed + run.inZ * half; snapped = true; }
    else { snappedX = run.fixed + run.inX * half; snapped = true; }
  }
  // Rest on whatever is underneath, so a laptop dropped on a desk stays on it.
  item.y = supportSurfaceHeight(snapped ? snappedX : x, snapped ? snappedZ : z, item.id);
  return snapped ? { x: snappedX, z: snappedZ } : null;
}

/**
 * Keeps a mounted point inside the booth without pulling it off its wall.
 * The point is already correct across the wall; only the along-wall travel
 * needs bounding.
 */
function clampMountedPoint(point) {
  return {
    x: Math.max(-BW / 2, Math.min(BW / 2, Number(point.x) || 0)),
    z: Math.max(0, Math.min(BD, Number(point.z) || 0)),
  };
}

/**
 * Height of the highest surface underneath (x, z) that an item could rest on.
 *
 * Dropping a laptop onto a table should put it on the table. Without this every
 * item is grounded at zero, so anything placed over a desk or counter sank
 * through it onto the carpet.
 *
 * Only floor-standing furniture counts as a surface: a wall shelf or a light is
 * not something else gets stacked on, and an item never supports itself.
 */
function supportSurfaceHeight(x, z, excludeId) {
  let top = 0;
  for (const other of placedItems) {
    if (String(other.id) === String(excludeId)) continue;
    if (isWallMountedItem(other)) continue;
    const otherX = (Number(other.x) || 0) - BW / 2;
    const otherZ = Number(other.z) || 0;
    const foot = rotatedFootprint(other.w, other.d, other.rotationY ?? other.rotation);
    if (Math.abs(x - otherX) > foot.w / 2) continue;
    if (Math.abs(z - otherZ) > foot.d / 2) continue;
    const otherTop = (Number(other.y) || 0) + (Number(other.h) || 0);
    if (otherTop > top) top = otherTop;
  }
  return top;
}

/* resolvePlacedItemPosition() and nearestFreePlacedItemPosition() used to live
 * here. They pushed an item out of the pocket around every upright and then
 * searched for the nearest free spot, and they were called from the renderers
 * as well as from placement - so drawing a booth moved the furniture in it, on
 * every frame, and wrote the result back. Furniture could not be put in a
 * corner because a corner has uprights in it.
 *
 * Deleted rather than left unused: they read as the obvious thing to call.
 * Placement goes through resolveDropPosition(); drawing goes through
 * placedItemRenderXZ(); neither relocates anything.
 */

/**
 * The nearest spot to (x, z) where this item can actually be put down, or null
 * if there is none within reach.
 *
 * Read the note above before calling this. What was deleted was not the idea of
 * searching - it was searching from the *draw* path, which moved furniture on
 * every frame and wrote the result back. This has exactly one caller, the
 * pointer-release handler, and it runs once per gesture. Nothing that draws may
 * call it, and neither may anything that runs per frame.
 *
 * Rings outward on the same 5 cm grid the drag snaps to, nearest offset first,
 * and each candidate goes through resolveDropPosition() so a rescued item obeys
 * the same wall, room and mounting rules as a dragged one. The probe is a copy
 * because that function mutates what it resolves.
 */
function nearestValidPlacement(item, x, z, maxRadius = 0.8) {
  const step = 0.05;
  const rings = Math.max(1, Math.round(maxRadius / step));
  const rotation = item.rotationY ?? item.rotation;
  for (let ring = 1; ring <= rings; ring += 1) {
    const offsets = [];
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dz = -ring; dz <= ring; dz += 1) {
        // The ring itself, not the filled square - the inside was searched on
        // the previous pass.
        if (Math.max(Math.abs(dx), Math.abs(dz)) === ring) offsets.push([dx, dz]);
      }
    }
    // A square ring is not a circle, so order what is on it by true distance.
    offsets.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
    for (const [dx, dz] of offsets) {
      const at = resolveDropPosition({ ...item }, x + dx * step, z + dz * step);
      if (!itemCollisionReason(item.id, at.x, at.z, item.w, item.d, rotation)) return at;
    }
  }
  return null;
}

/* ── Where a placed item goes ───────────────────────────────────────────────
 *
 * Two operations, and only two. They were previously written out at four call
 * sites between them, which is why fixing placement took four rounds: each fix
 * was correct and a different copy quietly overrode it on the next frame.
 *
 *   resolveDropPosition   what a drag or a drop decides. May change the item -
 *                         a shelf takes its panel's width, a light its rail
 *                         height - so it runs only on user interaction.
 *   placedItemRenderXZ    where an already-placed item draws. Never changes the
 *                         item. Both renderers call this and nothing else, so
 *                         drawing a booth can no longer move what is in it.
 */

/**
 * Resolves a drag or drop to a final position, applying mounting rules.
 * Mutates `item` where mounting demands it (width, rotation, height).
 */
function resolveDropPosition(item, x, z) {
  const footprint = rotatedFootprint(item.w, item.d, item.rotationY ?? item.rotation);
  const mounted = applyWallMountConstraint(item, x, z);
  // A shelf or a light is already fixed to a profile and owns no floor, so the
  // room walls are not a limit on it - it is mounted *to* one.
  if (mounted && isWallMountedItem(item)) return clampMountedPoint(mounted);
  const inBooth = mounted
    ? clampMountedPoint(mounted)
    : clampPlacedItemToBooth(x, z, footprint.w, footprint.d);
  return applyRoomLimits(inBooth.x, inBooth.z, footprint.w, footprint.d);
}

/**
 * Where an already-placed item draws: inside the booth, and nowhere else.
 * Deliberately does not consult obstacles or other items - a renderer that
 * relocates what it is drawing is how furniture used to slide out of corners.
 */
function placedItemRenderXZ(item, x, z) {
  // Clamp against the *rotated* footprint. Using the raw w and d meant a turned
  // item was bounded by the wrong axis: a 1.0 x 0.55 counter rotated 90 degrees
  // occupies 0.55 across x, but was held back as though it occupied 1.0 - a
  // phantom 0.225 m margin at the edge of the carpet. Worse, the SVG path
  // writes this result back onto the item, so the margin was re-applied on
  // every frame and the counter could never be pushed to the edge.
  const footprint = rotatedFootprint(item.w, item.d, item.rotationY ?? item.rotation);
  return clampPlacedItemToBooth(x, z, footprint.w, footprint.d);
}

/**
 * Underside of the ceiling support rail - the beam a spotlight clamps onto.
 *
 * Mirrors buildCeilingSupportRail(): centreline at BH + min(FH * 0.42, 0.13),
 * profile railW deep. Lights hang from this, not from the top of the wall
 * panels, which is roughly 100 mm lower and left them sitting under the rail
 * rather than on it.
 */
function lightRailUnderside() {
  // Match what buildCeilingSupportRail actually draws. The box is nudged up by
  // railW * 0.08, so its underside is railW * 0.42 below the centre line.
  const railW = Math.max(EX * 1.35, 0.055);
  return BH + Math.min(FH * 0.42, 0.13) - railW * 0.42;
}

/** How far a rail light's bracket rises above the item's own y - see drawItem. */
const RAIL_LIGHT_BRACKET_RISE = 0.06;

/**
 * The y a rail light is drawn at.
 *
 * The fixture hangs *from* this point rather than standing on it: the bracket
 * rises above it and the lens drops below. Clamping onto a beam therefore means
 * putting the bracket top at the beam's underside. Placing the fixture's base
 * there instead - `underside - h`, the obvious reading - hung every light a
 * full fixture-height too low, which is most of why they looked stranded in
 * mid-air rather than fixed to anything.
 */
function railLightY() {
  return Math.max(0, lightRailUnderside() - RAIL_LIGHT_BRACKET_RISE);
}

/**
 * Every overhead profile a light can clamp onto.
 *
 * Two kinds, and missing the second is what made this look unfixable: the top
 * beam of each of the four wall frames, and the ceiling support rails, which
 * cross the booth front to back at the support-column positions. Lights used to
 * snap to `boothWallRuns()` - the wall lines only - so on a booth whose lighting
 * belongs on a centre rail there was nothing to clamp to and the fixture
 * stopped against a wall, nowhere near a rail.
 */
function boothRailRuns() {
  const runs = boothWallRuns().map((run) => ({ ...run, kind: 'beam' }));
  activeFrontSupportPositions().forEach((value, index) => {
    // Cross rails have no inward normal - a light sits on the rail, not beside
    // it - so inX and inZ are zero and the wall inset below vanishes for them.
    runs.push({
      name: 'rail-' + index, axis: 'z', from: 0, to: BD,
      fixed: -BW / 2 + value, inX: 0, inZ: 0, panels: 1, kind: 'rail',
    });
  });
  return runs;
}

/** The overhead profile nearest (x, z), and how far along it that lands. */
function nearestRailRun(x, z) {
  let best = null;
  for (const run of runsReachableFrom(boothRailRuns(), x, z)) {
    const projection = wallRunProjection(run, x, z);
    if (!best || projection.distance < best.distance) {
      best = { run, along: projection.along, distance: projection.distance };
    }
  }
  return best;
}

/** Where a light clamped to `hit` sits, in booth coordinates. */
function railMountPoint(hit, itemDepth) {
  const inset = Math.max(0.05, (Number(itemDepth) || 0.2) / 2);
  return hit.run.axis === 'x'
    ? { x: hit.along, z: hit.run.fixed + hit.run.inZ * inset }
    : { x: hit.run.fixed + hit.run.inX * inset, z: hit.along };
}

/**
 * The height an item's base sits at.
 *
 * A stored y is trusted when it is set, but a mounted item must never fall back
 * to the floor: a rail light cannot stand on the carpet and a wall shelf cannot
 * rest on it, so a missing or zero y for those is derived rather than believed.
 * Items placed before mounting existed carry y = 0, and reading that literally
 * is what left lights lying on the floor next to the furniture.
 */
function mountedBaseY(item) {
  const shape = furnitureShape(item);
  // A rail light's height is not the designer's to choose - it is wherever the
  // profile is - so it is derived every time rather than read back. Trusting a
  // stored y here is the third reason this looked unfixable: every light in an
  // already-saved booth kept the mid-wall height it was given back when lights
  // had no rail to hang from, so the mount code computed the right answer and
  // the draw code threw it away on the very next frame.
  const itemX = (Number(item && item.x) || 0) - BW / 2;
  const itemZ = Number(item && item.z) || 0;
  if (shape === 'light' || shape === 'rail_light') {
    // Whichever profile it is nearest, not always the booth's ceiling rail -
    // a light clamped to a room's top rail belongs at that room's height.
    const hit = nearestRailRun(itemX, itemZ);
    return runRailY(hit && hit.run);
  }
  const stored = Number(item && item.y);
  if (Number.isFinite(stored) && stored > 0) return stored;
  if (shape === 'wall_shelf' || shape === 'shelf') {
    const hit = nearestPanelSlot(itemX, itemZ);
    return runShelfY(hit && hit.slot.run);
  }
  return 0;
}

/** True when the item is mounted rather than standing on the floor. */
function isWallMountedItem(item) {
  const shape = furnitureShape(item);
  return shape === 'wall_shelf' || shape === 'shelf' || shape === 'rail_light' || shape === 'light';
}


/* ── Placement rules ───────────────────────────────────────────────────────
 *
 * These used to be implemented here, a second time, in booth-centred
 * coordinates and untyped. The two copies drifted: they measured room interiors
 * differently until recently, and they still disagreed on how much daylight two
 * items need - this half let go at 2 cm and the workspace refused under 6 cm, so
 * a drag could put something down that the workspace then rejected with nothing
 * to explain why.
 *
 * The rules now live once, in workspace-geometry.ts, compiled to
 * /workspace-placement.js and loaded immediately before this file. What is left
 * here is the coordinate shift and nothing else: this file draws the booth
 * centred on the origin, and the rules measure from its front-left corner.
 */
/**
 * The compiled placement rules, or nothing to draw.
 *
 * This used to read `: null`, which looked like a graceful fallback and was
 * not one - every use below dereferences it unconditionally, so a missing
 * bundle surfaced later as "Cannot read properties of null (reading
 * 'rotatedItemFootprint')" at whichever drag happened to touch it first.
 *
 * Failing hard is the right behaviour: without these rules the renderer would
 * accept placements the workspace then refuses, which is the drift this bundle
 * exists to prevent. So it fails here instead, names its own cause, and tells
 * the parent through the channel that already shows a renderer error, rather
 * than pretending there is a degraded mode.
 */
if (typeof ENSPlacement === 'undefined') {
  const detail =
    '/workspace-placement.js did not load, so the booth has no placement rules. ' +
    'It is a committed build artifact - run: node scripts/build-placement-bundle.mjs';
  notifyRendererError(new Error(detail));
  throw new Error(detail);
}
const PLACEMENT = ENSPlacement;

/** The stand as the rules expect to receive it. */
function placementWorld() {
  return {
    items: placedItems,
    rooms,
    booth: { width: BW, depth: BD, height: BH, system: columnStyle === 'maxima' ? 'maxima' : 'octanorm' },
    frontSupports: activeFrontSupportPositions(),
  };
}

/** Booth-centred x to workspace x, and back. */
function toWorldX(centredX) { return (Number(centredX) || 0) + BW / 2; }
function toCentredX(worldX) { return (Number(worldX) || 0) - BW / 2; }

function rotatedFootprint(w, d, rotationY = 0) {
  const size = PLACEMENT.rotatedItemFootprint({
    w: Math.max(0.06, Number(w) || 0.3),
    d: Math.max(0.06, Number(d) || 0.3),
    rotationY: Number(rotationY) || 0,
  });
  return { w: size.width, d: size.depth };
}

/** Why a footprint cannot stand at this booth-centred spot, or '' when it can. */
function itemCollisionReason(excludeId, cx, cz, w, d, rotationY = 0) {
  return PLACEMENT.placementReason(placementWorld(), excludeId == null ? null : String(excludeId), {
    x: toWorldX(cx), z: Number(cz) || 0,
    w: Math.max(0.06, Number(w) || 0.3), d: Math.max(0.06, Number(d) || 0.3),
    rotationY: Number(rotationY) || 0,
  });
}

function checkItemCollision(excludeId, cx, cz, w, d, rotationY = 0) {
  return Boolean(itemCollisionReason(excludeId, cx, cz, w, d, rotationY));
}

/** Why a room cannot stand where it is being dragged, or '' when it can. */
function roomPlacementCollisionReason(excludeId, candidateRoom) {
  return PLACEMENT.roomPlacementReason(
    { ...candidateRoom, id: candidateRoom.id ?? excludeId },
    rooms.filter(room => String(room.id) !== String(excludeId)),
    placedItems,
  );
}

/**
 * Why a booth-centred footprint cannot stand in this room, or '' when it can.
 *
 * Booth-centred in, world out, like every other wrapper here: rooms are stored
 * in world space, so the x has to cross over before the rule sees it. The
 * footprint arrives already rotated, so rotationY is deliberately not passed
 * on - footprintRect() would turn it a second time.
 */
function roomItemCollisionReason(shape, room) {
  return PLACEMENT.roomItemPlacementReason(
    { x: toWorldX(Number(shape.x) || 0), z: Number(shape.z) || 0, w: shape.w, d: shape.d },
    room,
  );
}

/** The room whose footprint contains a booth-centred point, or null. */
function roomContainingPoint(cx, cz) {
  return PLACEMENT.roomContainingPoint(rooms, toWorldX(cx), Number(cz) || 0);
}

/**
 * Makes a room's walls a limit rather than a warning, in booth-centred space.
 * Drag and drop only - drawing must never relocate what it draws.
 */
function applyRoomLimits(cx, cz, w, d) {
  const at = PLACEMENT.applyRoomLimits(rooms, toWorldX(cx), Number(cz) || 0,
    Math.max(0.06, Number(w) || 0.3), Math.max(0.06, Number(d) || 0.3));
  return { x: toCentredX(at.x), z: at.z };
}

function clampPlacedItemToBooth(x, z, w, d) {
  const at = PLACEMENT.clampItemToBooth(placementWorld().booth, toWorldX(x), Number(z) || 0,
    Math.max(0.06, Number(w) || 0.3), Math.max(0.06, Number(d) || 0.3));
  return { x: toCentredX(at.x), z: at.z };
}

function evaluateCatalogPlacement(data) {
  const item = data && data.item && typeof data.item === 'object' ? data.item : {};
  const catalogId = String(item.catalogId || '');
  const w = Math.max(0.06, Number(item.w) || 0.5);
  const d = Math.max(0.06, Number(item.d) || 0.5);
  const h = Math.max(0.06, Number(item.h) || 0.8);
  const rotationY = Number(item.rotationY) || 0;
  const hit = screenRatioToFloorPoint(data.xPct, data.yPct);
  if (!catalogId || !hit) {
    return { catalogId, valid: false, reason: 'Move onto the booth floor', x: BW / 2, z: BD / 2, w, d, h, rotationY };
  }

  const rawX = Number(hit[0]) || 0;
  const rawZ = Number(hit[2]) || 0;
  const floorTolerance = 0.08;
  const reach = PLAN_MARGIN_M + floorTolerance;
  const overFloor = rawX >= -BW / 2 - reach && rawX <= BW / 2 + reach && rawZ >= -reach && rawZ <= BD + reach;

  // A shelf or a light dropped from the catalogue mounts straight away, so the
  // preview shows where it will actually land rather than a floor position it
  // will jump away from on release.
  const probe = { shape: item.shape, sku: item.sku, name: item.name, w, d, rotationY };
  const before = { w: probe.w, rotationY: probe.rotationY };
  const clamped = resolveDropPosition(probe, rawX, rawZ);
  const mounted = isWallMountedItem(probe)
    || probe.w !== before.w
    || probe.rotationY !== before.rotationY;
  // An overlap is worth flagging but must not refuse the placement: a designer
  // putting a counter tight against a post knows what they are drawing better
  // than a collision box does. Only being off the floor blocks a drop.
  const advisory = mounted
    ? null
    : itemCollisionReason(null, clamped.x, clamped.z, w, d, rotationY);
  // A room conflict is the one overlap that is not advisory: the workspace
  // refuses the placement outright, so a preview that reads "release to place"
  // and is then rejected with a toast is just a lie. Wall crossings cannot
  // happen any more - resolveDropPosition clamps into the room - so in practice
  // this is the door clearance.
  const roomBlock = mounted
    ? ''
    : rooms.reduce((found, room) => found || roomItemCollisionReason(
        { x: clamped.x, z: clamped.z, ...rotatedFootprint(w, d, rotationY) }, room), '');
  const placeable = overFloor && !roomBlock;
  const reason = !overFloor ? 'Move onto the booth floor' : (roomBlock || advisory);
  return {
    catalogId,
    name: String(item.name || 'Furniture'),
    valid: placeable,
    reason: placeable ? (reason || 'Release to place') : reason,
    x: clamped.x + BW / 2,
    z: clamped.z,
    boothX: clamped.x,
    boothZ: clamped.z,
    // The *mounted* geometry, not what was dragged. resolveDropPosition widens
    // a shelf to the panel it lands on, turns it to face the wall, and pins a
    // light to rail height. Returning the pre-mount values meant a freshly
    // dropped shelf was stored at catalogue width, rotation 0 and floor height,
    // so it visibly snapped into place and then jumped back out until the next
    // move corrected it.
    w: probe.w,
    d,
    h,
    rotationY: probe.rotationY,
    y: Number.isFinite(Number(probe.y)) ? Number(probe.y) : undefined,
    mounted,
    color: String(item.color || '#6b7280'),
  };
}

function drawCatalogDropPreview() {
  const group = document.getElementById('catalogDropGroup');
  if (!group) return;
  group.innerHTML = '';
  const preview = catalogDropPreview;
  if (!preview) return;

  const angle = (Number(preview.rotationY) || 0) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfW = Math.max(0.03, Number(preview.w) || 0.5) / 2;
  const halfD = Math.max(0.03, Number(preview.d) || 0.5) / 2;
  const corners = [
    [-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD],
  ].map(([dx, dz]) => [
    preview.boothX + dx * cos - dz * sin,
    0.018,
    preview.boothZ + dx * sin + dz * cos,
  ]);
  const projected = corners.map(project);
  if (projected.some(point => !point)) return;

  const valid = Boolean(preview.valid);
  const polygon = document.createElementNS(SVG_NS, 'polygon');
  polygon.setAttribute('data-catalog-drop-preview', valid ? 'valid' : 'invalid');
  polygon.setAttribute('points', projected.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '));
  polygon.setAttribute('fill', valid ? 'rgba(47,125,58,0.24)' : 'rgba(194,65,12,0.24)');
  polygon.setAttribute('stroke', valid ? '#2f7d3a' : '#c2410c');
  polygon.setAttribute('stroke-width', '2.4');
  polygon.setAttribute('stroke-dasharray', '10 7');
  polygon.setAttribute('vector-effect', 'non-scaling-stroke');
  group.appendChild(polygon);

  const center = project([preview.boothX, 0.025, preview.boothZ]);
  if (!center) return;
  const marker = document.createElementNS(SVG_NS, 'circle');
  marker.setAttribute('cx', center.x.toFixed(2));
  marker.setAttribute('cy', center.y.toFixed(2));
  marker.setAttribute('r', '5');
  marker.setAttribute('fill', valid ? '#2f7d3a' : '#c2410c');
  marker.setAttribute('stroke', '#ffffff');
  marker.setAttribute('stroke-width', '2');
  group.appendChild(marker);
}

// Global flag set during drag so the SVG renderer can highlight collisions.
let dragHasCollision = false;
/** Why the item under the pointer cannot be put down here, or '' when it can. */
let dragCollisionReason = '';

/**
 * Fascia assembly, ported from the ENS reference renderer
 * (booth_designer_pro/app/static/workspace/engine/booth_render_core.js —
 * getSystemProfile + addOpenSideFascia).
 *
 * ENS builds the fascia as three stacked parts rather than one thick board:
 *
 *      top rail     0.07   (0.09 maxima)
 *      MDF body     0.11   (0.145)
 *      bottom rail  0.07   (0.09)
 *                          = 0.25 total (0.325 maxima)
 *
 * and mounts the sign as a separate plate standing proud of the body:
 *
 *   plateOffset = railD/2 + frameBump + bodyD/2 + signT/2 + signGap
 *
 * The stack is scaled to the configured fascia height (FH) so an existing
 * stand keeps its overall dimensions.
 */
const ENS_FASCIA = {
  octanorm: { railH: 0.07, railD: 0.02, bodyH: 0.11,  bodyD: 0.006, bump: 0.02,  signGap: 0.012, signScale: 0.44, signMax: 2.8, signH: 0.30 },
  maxima:   { railH: 0.09, railD: 0.05, bodyH: 0.145, bodyD: 0.018, bump: 0.016, signGap: 0.016, signScale: 0.54, signMax: 3.2, signH: 0.38 },
};
const ENS_SIGN_THICKNESS = 0.018;

function ensFasciaProfile() {
  const b = ENS_FASCIA[columnStyle === 'maxima' ? 'maxima' : 'octanorm'];
  const k = FH / (b.railH * 2 + b.bodyH);   // scale reference stack to FH
  return {
    railH: b.railH * k, bodyH: b.bodyH * k,
    // ENS mounts a 0.30 sign on a 0.25 band (1.2x, overhanging). Our FH is
    // already 0.30 by default, so the reference height is used unscaled and
    // capped to the band: the plate reads as fitted rather than oversized.
    signH: Math.min(b.signH, FH),
    railD: b.railD, bodyD: b.bodyD, bump: b.bump,
    signGap: b.signGap, signScale: b.signScale, signMax: b.signMax,
    signT: ENS_SIGN_THICKNESS,
  };
}

function buildFascia() {
  if (!FASCIA_ENABLED) return;
  const P = ensFasciaProfile();
  const railH = P.railH;
  const boardH = P.bodyH;
  const yB = BH + railH;                 // MDF body sits between the two rails
  const yT = yB + boardH;
  const boardFill = 'url(#fascia)';
  const fasciaMeta = FASCIA_OPTION === 'full' ? 'Full wrap mounted fascia board' : (FASCIA_OPTION === 'custom' ? 'Custom mounted fascia board' : 'Mounted fascia board');
  const boardDepth = P.bodyD;
  const rail = P.railD;
  const offset = EX * 0.5;

  function getFasciaOverride(side) {
    const key = `fascia-${side}`;
    return (typeof panelOverrides !== 'undefined' && panelOverrides && panelOverrides[key]) ? panelOverrides[key] : {};
  }

  function fasciaFill(side) {
    const override = getFasciaOverride(side);
    return override && override.color ? String(override.color) : boardFill;
  }

  function hasMountedNamePlate(side) {
    return side === 'front' || wallsVisible[side] === false;
  }

  function addFasciaGraphicFace(pts, normal, side) {
    const override = getFasciaOverride(side);
    const designImageUrl = override && override.designImageUrl ? String(override.designImageUrl) : '';
    const brandText = override && override.brandText ? String(override.brandText).slice(0, 40) : '';
    // Artwork on an aisle-facing fascia belongs to its mounted nameplate.
    // Rendering it here as well would create a second detached full-board label.
    if (hasMountedNamePlate(side)) return;
    if (!designImageUrl && !brandText) return;
    faces.push({
      pts,
      normal,
      fill: 'transparent',
      isFascia: side,
      signOnly: true,
      partId: `fascia-${side}-graphic-face`,
      partLabel: `Fascia graphic face Â· ${side}`,
      partMeta: 'Custom logo / printed fascia artwork',
      softEdge: true,
      renderOrder: 0.61,
      brandText,
      brandColor: override.brandColor || '#23262c',
      brandScale: override.brandScale != null ? Math.max(0.08, Math.min(0.45, parseFloat(override.brandScale) || 0.2)) : 0.2,
      designImageUrl,
      designOpacity: override.designOpacity != null ? Math.max(0.15, Math.min(1, parseFloat(override.designOpacity) || 1)) : 1,
      graphicFit: 'contain',
    });
  }


  function addSignFace(pts, normal, side) {
    if (!hasMountedNamePlate(side)) return;
    const override = getFasciaOverride(side);
    const designImageUrl = override && override.designImageUrl ? String(override.designImageUrl) : '';
    const signLabel = override && override.brandText
      ? String(override.brandText).slice(0, 40)
      : String(COMPANY_NAME || 'Company Name').slice(0, 40);
    faces.push({
      pts,
      normal: normal || [0,0,1],
      fill: 'transparent',
      isFascia: side,
      signText: true,
      signLabel,
      signColor: override.brandColor || '#4b5563',
      signScale: override.brandScale != null ? Math.max(0.08, Math.min(0.45, parseFloat(override.brandScale) || 0.2)) : 0.2,
      designImageUrl,
      designOpacity: override.designOpacity != null ? Math.max(0.15, Math.min(1, parseFloat(override.designOpacity) || 1)) : 1,
      graphicFit: 'contain',
      signOnly: true,
      partId: `fascia-${side}-text-face`,
      partLabel: `Fascia sign text face · ${side}`,
      partMeta: `Company text on ${side} fascia board`,
      softEdge: true,
      renderOrder: 0.96
    });
  }

  /**
   * Sign board geometry, matching the ENS reference renderer
   * (booth_render_core.js -> addOpenSideFascia).
   *
   * The board is a real mounted plate that stands proud of the fascia body,
   * not a rectangle painted onto it. Reference offsets:
   *   plateOffset = railT/2 + frameBump + mdfT/2 + signT/2 + signGap ~= 54 mm
   * with an 18 mm thick board. Ours previously stood only 4 mm proud, which
   * read as an inset panel rather than a fitted board.
   *
   * `span` is the length of the rail this board is mounted on.
   */
  /**
   * The oval sign's real size, in metres.
   *
   * Width is capped against its own height so the plate stays a recognisable
   * oval rather than a sliver: a full-width ellipse on a 0.30 m band is nearly
   * nine times as wide as it is tall, which reads as a lens. Five to one is
   * about what these signs actually are. The height is the band's, so the oval
   * sits inside the fascia and overlaps nothing.
   */
  const OVAL_MAX_ASPECT = 5;
  function ovalSignSize(span, boardH) {
    const height = boardH;
    const width = Math.max(0.5, Math.min(span, height * OVAL_MAX_ASPECT));
    return { width, height };
  }

  function signBoardGeometry(span) {
    const full = FASCIA_OPTION === 'full';
    const width = full
      ? Math.max(0.6, span - 0.04)
      : (FASCIA_SIGN_WIDTH_M > 0
          ? Math.max(0.4, Math.min(FASCIA_SIGN_WIDTH_M, span - 0.04))
          : Math.min(Math.max(span * P.signScale, 1.8), Math.min(P.signMax, Math.max(0.6, span - 0.2))));
    // Taller than the old plate so it reads as a fitted board, still inside
    // the fascia assembly so the booth silhouette is unchanged.
    // Reference plate is taller than the MDF body and overhangs it.
    const height = P.signH;
    const plateOffset = P.railD / 2 + P.bump + P.bodyD / 2 + P.signT / 2 + P.signGap;
    return {
      width,
      height,
      near: plateOffset - P.signT / 2,
      far: plateOffset + P.signT / 2,
      textGap: plateOffset + P.signT / 2 + P.signGap,
    };
  }

  function addFrontBackNamePlate(side, exteriorZ, outward) {
    if (!hasMountedNamePlate(side)) return;
    const geo = signBoardGeometry(BW);
    const signW = geo.width;
    const signH = geo.height;
    const x0 = -signW / 2;
    const x1 = signW / 2;
    const y0 = BH + (FH - signH) * 0.50;   // centred on the whole assembly
    const y1 = y0 + signH;
    const z0 = exteriorZ + outward * geo.near;
    const z1 = exteriorZ + outward * geo.far;
    // The custom option's plate IS the oval, inscribed in the same band the
    // rectangular plate occupies - so it is proportioned to the fascia and
    // overlaps nothing, where the painted-on oval overlapped the plate beneath
    // it and stood taller than the board.
    const plateProps = {
      fill: '#fbfcfd',
      isFascia: side,
      partId: `fascia-${side}-name-plate`,
      partLabel: `${side} fascia company name plate`,
      partMeta: 'Thin banner-style company name fascia plate',
      softEdge: true,
      renderOrder: 0.64,
    };
    if (FASCIA_OPTION === 'custom') {
      const oval = ovalSignSize(signW, signH);
      pushOvalPlate([(x0 + x1) / 2, (y0 + y1) / 2], oval.width / 2, oval.height / 2,
        Math.min(z0, z1), Math.max(z0, z1), 'z', 48, plateProps);
    } else {
    pushBox([x0, y0, Math.min(z0, z1)], [x1, y1, Math.max(z0, z1)], {
      fill: '#fbfcfd',
      isFascia: side,
      partId: `fascia-${side}-name-plate`,
      partLabel: `${side} fascia company name plate`,
      partMeta: 'Thin banner-style company name fascia plate',
      softEdge: true,
      renderOrder: 0.64
    });
    }
    const faceZ = exteriorZ + outward * geo.textGap;
    addSignFace([[x0,y0,faceZ],[x1,y0,faceZ],[x1,y1,faceZ],[x0,y1,faceZ]], [0,0,outward], side);
  }

  function addSideNamePlate(side, exteriorX, outward) {
    if (!hasMountedNamePlate(side)) return;
    const usableDepth = Math.max(0.8, BD - offset * 2);
    const geo = signBoardGeometry(usableDepth);
    const signW = geo.width;
    const signH = geo.height;
    const z0 = BD * 0.5 - signW * 0.5;
    const z1 = BD * 0.5 + signW * 0.5;
    const y0 = BH + (FH - signH) * 0.50;   // centred on the whole assembly
    const y1 = y0 + signH;
    const x0 = exteriorX + outward * geo.near;
    const x1 = exteriorX + outward * geo.far;
    const plateProps = {
      fill: '#fbfcfd',
      isFascia: side,
      partId: `fascia-${side}-name-plate`,
      partLabel: `${side} fascia company name plate`,
      partMeta: 'Thin banner-style company name fascia plate',
      softEdge: true,
      renderOrder: 0.64,
    };
    if (FASCIA_OPTION === 'custom') {
      const oval = ovalSignSize(signW, signH);
      pushOvalPlate([(z0 + z1) / 2, (y0 + y1) / 2], oval.width / 2, oval.height / 2,
        Math.min(x0, x1), Math.max(x0, x1), 'x', 48, plateProps);
    } else {
    pushBox([Math.min(x0, x1), y0, z0], [Math.max(x0, x1), y1, z1], {
      fill: '#fbfcfd',
      isFascia: side,
      partId: `fascia-${side}-name-plate`,
      partLabel: `${side} fascia company name plate`,
      partMeta: 'Thin banner-style company name fascia plate',
      softEdge: true,
      renderOrder: 0.64
    });
    }
    const faceX = exteriorX + outward * geo.textGap;
    addSignFace([[faceX,y0,z0],[faceX,y0,z1],[faceX,y1,z1],[faceX,y1,z0]], [outward,0,0], side);
  }


  function addFrontBack(side, z, normal, exteriorZ) {
    const minZ = Math.min(z, exteriorZ) - boardDepth / 2;
    const maxZ = Math.max(z, exteriorZ) + boardDepth / 2;
    pushBox([-BW/2, yB, minZ], [BW/2, yT, maxZ], {
      fill: fasciaFill(side),
      isFascia: side,
      partId: `fascia-${side}-body`,
      partLabel: `Fascia board · ${side}`,
      partMeta: fasciaMeta + ' · rail-mounted board',
      softEdge: true,
      renderOrder: 0.42
    });
    const exteriorFace = [[-BW/2,yB,exteriorZ],[BW/2,yB,exteriorZ],[BW/2,yT,exteriorZ],[-BW/2,yT,exteriorZ]];
    addFasciaGraphicFace(exteriorFace, normal, side);
    addFrontBackNamePlate(side, exteriorZ, side === 'front' ? 1 : -1);
    pushBox([-BW/2, yT, Math.min(z, exteriorZ) - rail/2], [BW/2, yT + railH, Math.max(z, exteriorZ) + rail/2], { fill:'url(#alu-cap)', isAlu:true, partId:`fascia-${side}-top-rail`, partLabel:'Fascia top rail', partMeta:'Aluminum rail carrier' });
    pushBox([-BW/2, yB - railH * 0.55, Math.min(z, exteriorZ) - rail/2], [BW/2, yB, Math.max(z, exteriorZ) + rail/2], { fill:'url(#alu-h)', isAlu:true, partId:`fascia-${side}-bottom-rail`, partLabel:'Fascia bottom rail', partMeta:'Slim aluminum lower rail' });
    pushBox([-BW/2 - rail/2, yB - railH, Math.min(z, exteriorZ) - rail/2], [-BW/2 + rail/2, yT + railH, Math.max(z, exteriorZ) + rail/2], { fill:'url(#alu)', isAlu:true, partId:`fascia-${side}-left-end`, partLabel:'Fascia end upright', partMeta:'Closed rail end cap' });
    pushBox([BW/2 - rail/2, yB - railH, Math.min(z, exteriorZ) - rail/2], [BW/2 + rail/2, yT + railH, Math.max(z, exteriorZ) + rail/2], { fill:'url(#alu)', isAlu:true, partId:`fascia-${side}-right-end`, partLabel:'Fascia end upright', partMeta:'Closed rail end cap' });
    for (const sx of [-1, 0, 1]) {
      pushBox([sx * BW / 3 - 0.018, yB - railH, z - 0.01], [sx * BW / 3 + 0.018, yT + railH, z + 0.01], { fill:'url(#alu)', isAlu:true, partId:`fascia-${side}-bracket-${sx}`, partLabel:'Fascia rail bracket', partMeta:'Vertical rail bracket' });
    }
  }

  function addSide(side, x, normal, exteriorX) {
    const z0 = offset;
    const z1 = BD - offset;
    const minX = Math.min(x, exteriorX) - boardDepth / 2;
    const maxX = Math.max(x, exteriorX) + boardDepth / 2;
    pushBox([minX, yB, z0], [maxX, yT, z1], {
      fill: fasciaFill(side),
      isFascia: side,
      partId: `fascia-${side}-body`,
      partLabel: `Fascia board · ${side}`,
      partMeta: fasciaMeta + ' · rail-mounted board',
      softEdge: true,
      renderOrder: 0.42
    });
    addFasciaGraphicFace([[exteriorX,yB,z0],[exteriorX,yB,z1],[exteriorX,yT,z1],[exteriorX,yT,z0]], normal, side);
    addSideNamePlate(side, exteriorX, side === 'right' ? 1 : -1);
    pushBox([Math.min(x, exteriorX) - rail/2, yT, z0], [Math.max(x, exteriorX) + rail/2, yT + railH, z1], { fill:'url(#alu-cap)', isAlu:true, partId:`fascia-${side}-top-rail`, partLabel:'Fascia top rail', partMeta:'Aluminum rail carrier' });
    pushBox([Math.min(x, exteriorX) - rail/2, yB - railH * 0.55, z0], [Math.max(x, exteriorX) + rail/2, yB, z1], { fill:'url(#alu-h)', isAlu:true, partId:`fascia-${side}-bottom-rail`, partLabel:'Fascia bottom rail', partMeta:'Slim aluminum lower rail' });
    pushBox([Math.min(x, exteriorX) - rail/2, yB - railH, z0 - rail/2], [Math.max(x, exteriorX) + rail/2, yT + railH, z0 + rail/2], { fill:'url(#alu)', isAlu:true, partId:`fascia-${side}-back-end`, partLabel:'Fascia end upright', partMeta:'Closed rail end cap' });
    pushBox([Math.min(x, exteriorX) - rail/2, yB - railH, z1 - rail/2], [Math.max(x, exteriorX) + rail/2, yT + railH, z1 + rail/2], { fill:'url(#alu)', isAlu:true, partId:`fascia-${side}-front-end`, partLabel:'Fascia end upright', partMeta:'Closed rail end cap' });
    for (const z of [z0 + (z1 - z0) * 0.28, z0 + (z1 - z0) * 0.72]) {
      pushBox([x - 0.01, yB - railH, z - 0.018], [x + 0.01, yT + railH, z + 0.018], { fill:'url(#alu)', isAlu:true, partId:`fascia-${side}-bracket-${z.toFixed(1)}`, partLabel:'Fascia rail bracket', partMeta:'Vertical rail bracket' });
    }
  }

  // Fascia is a continuous structural perimeter and is intentionally independent
  // from wall visibility. An open wall keeps its complete fascia and rail assembly.
  addFrontBack('back', offset - boardDepth, [0,0,1], offset);
  addFrontBack('front', BD - offset + boardDepth, [0,0,-1], BD - offset);
  addSide('left', -BW/2 + offset - boardDepth, [-1,0,0], -BW/2 + offset);
  addSide('right', BW/2 - offset + boardDepth, [1,0,0], BW/2 - offset);
}

function buildCarpet() {
  faces.push({
    pts: [
      [-BW/2 + EX*1.2, 0.012,  0 + EX*1.2],
      [ BW/2 - EX*1.2, 0.012,  0 + EX*1.2],
      [ BW/2 - EX*1.2, 0.012, BD - EX*0.2],
      [-BW/2 + EX*1.2, 0.012, BD - EX*0.2],
    ],
    fill: CARPET_COLOR, normal: [0,1,0], isCarpet: true, renderOrder: -0.2,
    partId: 'carpet', partLabel: 'Carpet · interior',
    partMeta: 'Charcoal needle-punch · ' + BW.toFixed(1) + ' × ' + BD.toFixed(1) + ' m',
  });
}

buildBoothGeometry();

// ── Floor ────────────────────────────────────────────────────────────────────
function buildFloor() {
  const g = document.getElementById('floorGroup');
  // The ground quad has to fall inside the projection to be drawn at all, and
  // it was fixed at 44 x 32 m. Its far corners sit outside the frustum in the
  // default three-quarter view, so `every(Boolean)` was false and the whole
  // block was skipped - the floor was never drawn there at all, and what reads
  // as ground is the background gradient showing through. The largest extent
  // that actually projects is used instead: measured at 8 m in three-quarter,
  // 12 m from the front and side, more from overhead.
  let floorVerts = null;
  for (const reach of [20, 16, 12, 10, 8, 6]) {
    const verts = [
      [-reach, 0, -reach], [reach, 0, -reach],
      [reach, 0, BD + reach], [-reach, 0, BD + reach],
    ].map(project);
    if (verts.every(Boolean)) { floorVerts = verts; break; }
    if (DEBUG_CLIPPING) {
      // Same failure as the draw loop, reached by another route: the ground is
      // chosen by trying extents until one projects, and every rejected extent
      // is a quad that would have vanished silently.
      recordClippedFace({ partId: `ground-plane@${reach}m` }, verts, 'floor');
    }
  }
  if (floorVerts) {
    const path = floorVerts.map(p=>`${p.x},${p.y}`).join(' ');
    const fp = document.createElementNS(SVG_NS, 'polygon');
    fp.setAttribute('points', path); fp.setAttribute('fill', 'url(#floor)');
    g.appendChild(fp);
  }

  // Drawn outside that block on purpose: each line clips itself, so the plan
  // survives even when the ground quad cannot be drawn.
  {
    // Metre lines on the ground, in world space so they converge with the
    // floor. The old #tile pattern was drawn in screen space: it stayed a flat
    // rectangular mesh no matter where the camera was, which read as wallpaper
    // behind the stand rather than as a plan underneath it. They fade with
    // distance so the plot around the stand is the part that reads.
    const planReach = 6;
    const x0 = -BW / 2 - planReach, x1 = BW / 2 + planReach;
    const z0 = -planReach, z1 = BD + planReach;
    const planLine = (a, b, distance) => {
      const pa = project(a), pb = project(b);
      if (!pa || !pb) return;
      const fade = Math.max(0, 1 - distance / planReach);
      const ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('x1', pa.x.toFixed(2)); ln.setAttribute('y1', pa.y.toFixed(2));
      ln.setAttribute('x2', pb.x.toFixed(2)); ln.setAttribute('y2', pb.y.toFixed(2));
      ln.setAttribute('stroke', 'rgba(38,45,56,' + (0.045 + 0.105 * fade).toFixed(3) + ')');
      ln.setAttribute('stroke-width', (0.7 + 0.25 * fade).toFixed(2));
      g.appendChild(ln);
    };
    for (let x = Math.ceil(x0); x <= x1; x += 1) {
      planLine([x, 0, z0], [x, 0, z1], Math.max(0, Math.abs(x) - BW / 2));
    }
    for (let z = Math.ceil(z0); z <= z1; z += 1) {
      const outside = z < 0 ? -z : Math.max(0, z - BD);
      planLine([x0, 0, z], [x1, 0, z], outside);
    }

  }
  // Contact shadow under the stand footprint. Without it a near-white stand on
  // a near-white floor has no visual anchor and reads as floating.
  const shadowPad = 0.16;
  const shadowVerts = [
    [-BW/2 - shadowPad, 0.004, 0 - shadowPad],
    [ BW/2 + shadowPad, 0.004, 0 - shadowPad],
    [ BW/2 + shadowPad, 0.004, BD + shadowPad],
    [-BW/2 - shadowPad, 0.004, BD + shadowPad],
  ].map(project);
  if (shadowVerts.every(Boolean)) {
    const sp = document.createElementNS(SVG_NS, 'polygon');
    sp.setAttribute('points', shadowVerts.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '));
    sp.setAttribute('fill', 'rgba(24,28,34,1)');
    sp.setAttribute('filter', 'url(#ground-shadow)');
    sp.setAttribute('opacity', String(LEGIBILITY.ground));
    sp.setAttribute('pointer-events', 'none');
    g.appendChild(sp);
  }

  // The plot the stand occupies. This is the line that separates "the plan"
  // from "the booth" - set out from the stand rather than under it, both
  // because the walls stand on the footprint and would cover it, and because
  // an exhibitor's plot really is the ground allotted around the structure.
  // Drawn after the shadow: the shadow's blur is wide enough to erase it.
  const plotPad = 0.34;
  const plotVerts = [
    [-BW / 2 - plotPad, 0.002, -plotPad], [BW / 2 + plotPad, 0.002, -plotPad],
    [BW / 2 + plotPad, 0.002, BD + plotPad], [-BW / 2 - plotPad, 0.002, BD + plotPad],
  ].map(project);
  if (plotVerts.every(Boolean)) {
    const plot = document.createElementNS(SVG_NS, 'polygon');
    plot.setAttribute('points', plotVerts.map(pt => pt.x.toFixed(2) + ',' + pt.y.toFixed(2)).join(' '));
    plot.setAttribute('fill', 'none');
    plot.setAttribute('stroke', 'rgba(28,34,44,0.55)');
    plot.setAttribute('stroke-width', '1.8');
    plot.setAttribute('stroke-dasharray', '11 8');
    plot.setAttribute('pointer-events', 'none');
    g.appendChild(plot);
  }

  const carpetVerts = [
    [-BW/2 + EX*1.2, 0.018, 0 + EX*1.2],
    [ BW/2 - EX*1.2, 0.018, 0 + EX*1.2],
    [ BW/2 - EX*1.2, 0.018, BD - EX*0.2],
    [-BW/2 + EX*1.2, 0.018, BD - EX*0.2],
  ].map(project);
  if (carpetVerts.every(Boolean)) {
    const carpetPath = carpetVerts.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const carpet = document.createElementNS(SVG_NS, 'polygon');
    carpet.setAttribute('points', carpetPath);
    carpet.setAttribute('fill', CARPET_COLOR);
    carpet.setAttribute('stroke', selectedKey === 'carpet' ? '#2f7df6' : 'rgba(20,22,26,0.32)');
    carpet.setAttribute('stroke-width', selectedKey === 'carpet' ? '2.2' : '0.8');
    carpet.setAttribute('data-pid', 'carpet');
    carpet.setAttribute('data-type', 'carpet');
    carpet.setAttribute('data-label', 'Carpet');
    carpet.setAttribute('data-meta', `${BW.toFixed(1)} × ${BD.toFixed(1)} m`);
    g.appendChild(carpet);
  }
  const shCenter = project([0, 0, BD * 0.35]);
  if (shCenter) {
    const sh = document.createElementNS(SVG_NS, 'ellipse');
    sh.setAttribute('cx', shCenter.x); sh.setAttribute('cy', shCenter.y + 14);
    sh.setAttribute('rx', Math.max(300, BW*90)); sh.setAttribute('ry', Math.max(60, BD*30));
    sh.setAttribute('fill', 'url(#shadow)'); sh.setAttribute('opacity', '0.7');
    g.appendChild(sh);
  }

  buildPlanDimensions(g, plotPad);
}

/**
 * Drafting dimensions on the ground, faded in as the camera comes overhead.
 *
 * The top view was only a camera angle: same lighting, same shading, same
 * everything, just seen from above - so switching to it barely registered as a
 * change of mode. Dimensions are what makes a plan a plan, and bringing them in
 * on the way up means the switch reads as entering a drawing rather than as
 * orbiting the camera. They fade out again on the way back to a 3D view, where
 * they would only be clutter across the stand.
 */
function buildPlanDimensions(g, plotPad) {
  const planMix = Math.max(0, Math.min(1, (camState.elevation - Math.PI * 0.30) / (Math.PI * 0.15)));
  if (planMix < 0.02) return;

  const off = plotPad + 0.62;
  const tick = 0.20;
  const stroke = 'rgba(26,32,42,' + (0.66 * planMix).toFixed(3) + ')';
  const ink = 'rgba(22,28,38,' + (0.9 * planMix).toFixed(3) + ')';

  const line = (a, b, width) => {
    const pa = project(a), pb = project(b);
    if (!pa || !pb) return;
    const el = document.createElementNS(SVG_NS, 'line');
    el.setAttribute('x1', pa.x.toFixed(2)); el.setAttribute('y1', pa.y.toFixed(2));
    el.setAttribute('x2', pb.x.toFixed(2)); el.setAttribute('y2', pb.y.toFixed(2));
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', String(width));
    el.setAttribute('pointer-events', 'none');
    g.appendChild(el);
  };

  const label = (at, text) => {
    const pt = project(at);
    if (!pt) return;
    const el = document.createElementNS(SVG_NS, 'text');
    el.setAttribute('x', pt.x.toFixed(2));
    el.setAttribute('y', pt.y.toFixed(2));
    el.setAttribute('fill', ink);
    el.setAttribute('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');
    el.setAttribute('font-size', '19');
    el.setAttribute('font-weight', '600');
    el.setAttribute('letter-spacing', '0.6');
    el.setAttribute('text-anchor', 'middle');
    el.setAttribute('dominant-baseline', 'middle');
    el.setAttribute('paint-order', 'stroke');
    el.setAttribute('stroke', 'rgba(236,238,241,' + (0.85 * planMix).toFixed(3) + ')');
    el.setAttribute('stroke-width', '4');
    el.setAttribute('pointer-events', 'none');
    el.textContent = text;
    g.appendChild(el);
  };

  // Width, run along the back edge. The camera looks at BD * 0.35, so a
  // dimension set out past the front edge falls off the bottom of the frame at
  // the very moment the plan view is meant to show it.
  const wz = -off;
  line([-BW / 2, 0.003, wz], [BW / 2, 0.003, wz], 1.5);
  line([-BW / 2, 0.003, wz - tick], [-BW / 2, 0.003, wz + tick], 1.5);
  line([BW / 2, 0.003, wz - tick], [BW / 2, 0.003, wz + tick], 1.5);
  label([0, 0.003, wz - 0.44], BW.toFixed(1) + ' m');

  // Depth, run down the left edge.
  const dx = -BW / 2 - off;
  line([dx, 0.003, 0], [dx, 0.003, BD], 1.5);
  line([dx - tick, 0.003, 0], [dx + tick, 0.003, 0], 1.5);
  line([dx - tick, 0.003, BD], [dx + tick, 0.003, BD], 1.5);
  label([dx - 0.52, 0.003, BD / 2], BD.toFixed(1) + ' m');
}


// ── Booth grid ────────────────────────────────────────────────────────────────
function buildGrid() {
  const g = document.getElementById('gridGroup');
  if (!g) return;
  g.innerHTML = '';

  const GX0 = -BW / 2, GX1 = BW / 2, GZ0 = 0, GZ1 = BD;

  // Update clip path to booth footprint
  const clipPoly = document.getElementById('carpet-clip-poly');
  if (clipPoly) {
    const corners = [[GX0,0,GZ0],[GX1,0,GZ0],[GX1,0,GZ1],[GX0,0,GZ1]]
      .map(project).filter(Boolean);
    if (corners.length === 4)
      clipPoly.setAttribute('points', corners.map(p => p.x + ',' + p.y).join(' '));
  }

  function gridSet(step, stroke, width) {
    const nX = Math.round((GX1 - GX0) / step);
    for (let i = 0; i <= nX; i++) {
      const x = GX0 + i * step;
      const a = project([x, 0, GZ0]), b = project([x, 0, GZ1]);
      if (!a || !b) continue;
      const ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y);
      ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
      ln.setAttribute('stroke', stroke); ln.setAttribute('stroke-width', width);
      g.appendChild(ln);
    }
    const nZ = Math.round((GZ1 - GZ0) / step);
    for (let i = 0; i <= nZ; i++) {
      const z = GZ0 + i * step;
      const a = project([GX0, 0, z]), b = project([GX1, 0, z]);
      if (!a || !b) continue;
      const ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y);
      ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
      ln.setAttribute('stroke', stroke); ln.setAttribute('stroke-width', width);
      g.appendChild(ln);
    }
  }

  // Draw finest first → major on top, so major lines are never dimmed by fine ones.
  // White semi-transparent lines — visible on dark and light carpets alike.
  gridSet(0.1, 'rgba(255,255,255,0.08)', '0.35');
  gridSet(0.5, 'rgba(255,255,255,0.18)', '0.6');
  gridSet(1.0, 'rgba(255,255,255,0.38)', '1.0');
}

// ── Shading ───────────────────────────────────────────────────────────────────
function faceIntensity(face) {
  let n = face.normal;
  if (!n) {
    const v1 = sub(face.pts[1], face.pts[0]);
    const v2 = sub(face.pts[2], face.pts[0]);
    n = norm(cross(v1, v2));
  }
  const key  = Math.max(0, dot(n, lightDir));
  const fill = Math.max(0, dot(n, fillDir)) * 0.35;
  const amb  = 0.55;
  return Math.min(1, amb + key * 0.45 + fill);
}

function avgDepth(face) {
  let sum = 0;
  for (const p of face.pts) sum += dot(sub(p, cam), fwd);
  return sum / face.pts.length;
}

function renderOrder(face) {
  return Number(face.renderOrder || 0);
}

/**
 * Units the surface coordinate system counts in, per metre of real panel.
 *
 * The graphics on a panel are placed in the panel's own coordinates rather than
 * on the screen, so their sizes are real lengths - a brand set at 0.2 of panel
 * height is 0.2 x 2.4 = 0.48 m of lettering. Written straight into SVG that is
 * `font-size="0.48"`, small enough that some rasterisers lose the hinting, so
 * the surface counts centimetres and the matrix scales them back down.
 */
const SURFACE_UNITS_PER_M = 100;

/**
 * The transform that puts a graphic *on* a panel instead of in front of it.
 *
 * Artwork and brand text used to be laid out in screen space: the image went
 * into the bounding box of the projected panel and was clipped to it, and the
 * text was drawn horizontally at the panel's centre. Neither was attached to
 * the wall in any way - orbit the stand and the logo stayed upright and square
 * while the panel it was supposedly printed on turned away, so a graphic
 * changed shape every time the booth moved.
 *
 * This returns the panel's own surface as a coordinate system: origin at its
 * top-left corner, +x across the panel, +y down it, both in centimetres of real
 * panel. Anything drawn in those coordinates is painted on the wall and follows
 * it, because the matrix is rebuilt from the projected corners on every frame.
 *
 * Every face that carries a graphic is built with pts[0..1] along its bottom
 * edge and pts[2..3] along its top, so the corners can be read directly.
 *
 * The mapping is affine, which is exact for the rotation, scale and shear of a
 * panel and approximates only its perspective taper - measured at 2-5% of panel
 * width across the stand's own views. A projective map cannot be expressed as
 * an SVG transform at all; the alternative is slicing every graphic into a mesh
 * of separately transformed tiles, which is a great deal of machinery for a few
 * pixels at one corner.
 */
function faceSurface(face, proj) {
  if (!face.pts || face.pts.length < 4 || proj.length < 4) return null;
  // Which way round the panel was wound is not consistent, and it cannot be:
  // buildWall() runs the side walls back-to-front and the back wall
  // left-to-right, and each bay is pushed twice with its reverse face in the
  // opposite order. Read literally, half the panels in a stand printed their
  // artwork mirrored - a brand on the left-hand wall came out back to front.
  //
  // The test is handedness. Take the across and down vectors along the surface;
  // their cross product points out of the face when the pair reads left-to-right
  // to somebody standing in front of it. When it points the same way as the
  // face's own normal instead, this corner is the far end of the panel, and the
  // opposite corner is the one to start from.
  const u = sub(face.pts[2], face.pts[3]);
  const v = sub(face.pts[0], face.pts[3]);
  const outward = face.normal || norm(cross(u, v));
  const mirrored = dot(cross(u, v), outward) > 0;
  const originIndex = mirrored ? 2 : 3;
  const acrossIndex = mirrored ? 3 : 2;
  const downIndex = mirrored ? 1 : 0;
  const origin = proj[originIndex];
  const across = proj[acrossIndex];
  const down = proj[downIndex];
  const wM = len(sub(face.pts[acrossIndex], face.pts[originIndex]));
  const hM = len(sub(face.pts[downIndex], face.pts[originIndex]));
  if (!(wM > 1e-4) || !(hM > 1e-4)) return null;
  const w = wM * SURFACE_UNITS_PER_M;
  const h = hM * SURFACE_UNITS_PER_M;
  const round = value => Math.round(value * 100000) / 100000;
  return {
    w,
    h,
    transform: 'matrix('
      + round((across.x - origin.x) / w) + ',' + round((across.y - origin.y) / w) + ','
      + round((down.x - origin.x) / h) + ',' + round((down.y - origin.y) / h) + ','
      + round(origin.x) + ',' + round(origin.y) + ')',
  };
}

// ── Render ────────────────────────────────────────────────────────────────────
let selectedKey = null;
let selectedItemId = null;
let selectedRoomId = null;
/**
 * The workspace's selection, mirrored here so a drag can carry all of it.
 *
 * The renderer does not own selection - clicks are reported upward and the
 * workspace decides - so this arrives on boothUpdate. Dragging any member moves
 * every member by the same offset; dragging anything else moves only itself.
 */
let selectedItemIds = [];

/* ── Room cutaway ──────────────────────────────────────────────────────────
 *
 * A room is a closed box, so from outside it you see four walls and nothing
 * else - which is right for a client view and useless for arranging what goes
 * inside one. The walls nearest the camera are therefore ghosted back while a
 * room is being worked on, the way a plan drawing cuts through them: the
 * aluminium frame stays solid so the room still reads as built, and only the
 * infill goes translucent.
 *
 * Nothing is persisted. A room is opened up while it is selected, while an item
 * inside it is selected, while anything is being dragged, and while an item is
 * being dragged in from the catalogue - in other words exactly while someone is
 * working in it - and is solid again the moment they stop.
 */
const ROOM_CUTAWAY_OPACITY = 0.14;

/** Rooms that should open up for the work in progress. */
function roomsUnderEdit() {
  const ids = new Set();
  if (!roomGeometry.size) return ids;
  // Any drag at all, and any catalogue drop in flight, opens every room: the
  // designer cannot aim at an interior they cannot see.
  if (objectDrag || catalogDropPreview) {
    for (const id of roomGeometry.keys()) ids.add(id);
    return ids;
  }
  if (selectedRoomId && roomGeometry.has(String(selectedRoomId))) ids.add(String(selectedRoomId));
  if (selectedItemId) {
    const item = placedItems.find(entry => String(entry.id) === String(selectedItemId));
    const room = item ? roomContainingPoint((Number(item.x) || 0) - BW / 2, Number(item.z) || 0) : null;
    if (room) ids.add(String(room.id));
  }
  return ids;
}

/**
 * Which room walls stand between the camera and the room they enclose.
 * Returns a set of "roomId|side" keys; the draw loop ghosts those faces.
 */
function cutawayRoomWalls() {
  const open = new Set();
  const editing = roomsUnderEdit();
  if (!editing.size) return open;
  for (const id of editing) {
    const geom = roomGeometry.get(id);
    if (!geom) continue;
    const toCamX = cam[0] - geom.cx;
    const toCamZ = cam[2] - geom.cz;
    const length = Math.hypot(toCamX, toCamZ) || 1;
    const dirX = toCamX / length;
    const dirZ = toCamZ / length;
    // Outward normal of each wall, in the plan. A wall is in the way when its
    // outward face is turned towards the camera; the threshold keeps a wall
    // seen almost edge-on solid, so a straight-on view opens one wall and a
    // three-quarter view opens two.
    const sides = [
      ['back', 0, -1], ['front', 0, 1], ['left', -1, 0], ['right', 1, 0],
    ];
    for (const [side, nx, nz] of sides) {
      if (!geom.built[side]) continue;
      if (nx * dirX + nz * dirZ > 0.2) open.add(id + '|' + side);
    }
  }
  return open;
}

function drawSelectedItemGizmo(container) {
  // Whatever is under the pointer, as well as whatever is selected. Selection
  // only happens on a click that did not turn into a drag, so an item picked up
  // and moved without being clicked first had no gizmo - and the gizmo card is
  // where the "cannot go here, because..." warning lives. The feedback existed
  // and was shown to nobody unless they had selected the item beforehand.
  const gizmoItemId = selectedItemId
    || (objectDrag && objectDrag.type === 'item' ? objectDrag.itemId : null);
  if (!gizmoItemId) return;
  const item = placedItems.find(entry => String(entry.id) === String(gizmoItemId));
  if (!item) return;
  const x = Number.isFinite(Number(item.x)) ? -BW / 2 + Number(item.x) : 0;
  const z = Number.isFinite(Number(item.z)) ? Number(item.z) : BD / 2;
  const h = Math.max(0.2, Number(item.h) || 0.8);
  const base = [x, h + 0.08, z];
  const p0 = project(base);
  const px = project([x + 0.48, h + 0.08, z]);
  const py = project([x, h + 0.56, z]);
  const pz = project([x, h + 0.08, z + 0.48]);
  if (!p0 || !px || !py || !pz) return;

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('pointer-events', 'none');

  function axis(to, color, label) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', p0.x.toFixed(2)); line.setAttribute('y1', p0.y.toFixed(2));
    line.setAttribute('x2', to.x.toFixed(2)); line.setAttribute('y2', to.y.toFixed(2));
    line.setAttribute('stroke', color); line.setAttribute('stroke-width', '2.2');
    line.setAttribute('stroke-linecap', 'round');
    g.appendChild(line);
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', to.x.toFixed(2)); dot.setAttribute('cy', to.y.toFixed(2));
    dot.setAttribute('r', '4'); dot.setAttribute('fill', color);
    g.appendChild(dot);
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', (to.x + 7).toFixed(2)); text.setAttribute('y', (to.y + 3).toFixed(2));
    text.setAttribute('fill', color); text.setAttribute('font-size', '10');
    text.setAttribute('font-weight', '800'); text.textContent = label;
    g.appendChild(text);
  }

  axis(px, '#d63b3b', 'X');
  axis(py, '#28a05f', 'Y');
  axis(pz, '#2563eb', 'Z');

  const rotDeg = (((Number(item.rotationY) || 0) % 360) + 360) % 360;
  const rotLabel = rotDeg !== 0 ? `  ↻ ${rotDeg.toFixed(0)}°` : '';
  const lockLabel = item.locked ? '  LOCKED' : '';
  const labelText = `${item.name || 'Item'}  ${item.sku || item.catalogId || ''}`.trim();
  const metaText = `${Number(item.w || 0).toFixed(2)} × ${Number(item.d || 0).toFixed(2)} × ${Number(item.h || 0).toFixed(2)} m${rotLabel}${lockLabel}`;
  const collisionText = dragHasCollision && objectDrag?.type === 'item' ? '⚠ ' + (dragCollisionReason || 'Overlap') : null;
  const labelX = p0.x + 12;
  const labelY = p0.y - (collisionText ? 60 : 44);
  const cardHeight = collisionText ? 54 : 38;
  // The warning is a sentence now, not the word "Overlap", so it has to be
  // measured like the other two or it runs out of the card.
  const width = Math.max(130, Math.min(320, Math.max(
    labelText.length, metaText.length, (collisionText || '').length * 0.86,
  ) * 6.2 + 34));
  const borderColor = collisionText ? 'rgba(230,60,32,0.6)' : 'rgba(37,99,235,0.45)';
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', labelX.toFixed(2)); rect.setAttribute('y', labelY.toFixed(2));
  rect.setAttribute('width', width.toFixed(2)); rect.setAttribute('height', String(cardHeight));
  rect.setAttribute('rx', '6'); rect.setAttribute('fill', 'rgba(255,255,255,0.92)');
  rect.setAttribute('stroke', borderColor);
  g.appendChild(rect);
  const name = document.createElementNS(SVG_NS, 'text');
  name.setAttribute('x', (labelX + 10).toFixed(2)); name.setAttribute('y', (labelY + 16).toFixed(2));
  name.setAttribute('fill', '#1a1d22'); name.setAttribute('font-size', '11');
  name.setAttribute('font-weight', '700'); name.textContent = labelText;
  g.appendChild(name);
  const meta = document.createElementNS(SVG_NS, 'text');
  meta.setAttribute('x', (labelX + 10).toFixed(2)); meta.setAttribute('y', (labelY + 30).toFixed(2));
  meta.setAttribute('fill', '#6b7079'); meta.setAttribute('font-size', '9.5');
  meta.textContent = metaText;
  g.appendChild(meta);
  if (collisionText) {
    const warn = document.createElementNS(SVG_NS, 'text');
    warn.setAttribute('x', (labelX + 10).toFixed(2)); warn.setAttribute('y', (labelY + 46).toFixed(2));
    warn.setAttribute('fill', '#e63c20'); warn.setAttribute('font-size', '9.5');
    warn.setAttribute('font-weight', '700'); warn.textContent = collisionText;
    g.appendChild(warn);
  }

  // Rotation buttons — ◁ −15° and ▷ +15° — shown below the gizmo card.
  // Provides mouse-based rotation in addition to the [ / ] keyboard shortcuts.
  const btnY = labelY + cardHeight + 6;
  const btnSize = 22;
  [['◁', -15, labelX], ['▷', +15, labelX + btnSize + 4]].forEach(([label, delta, bx]) => {
    const btn = document.createElementNS(SVG_NS, 'rect');
    btn.setAttribute('x', String(bx)); btn.setAttribute('y', String(btnY));
    btn.setAttribute('width', String(btnSize)); btn.setAttribute('height', String(btnSize));
    btn.setAttribute('rx', '4');
    btn.setAttribute('fill', 'rgba(255,255,255,0.9)');
    btn.setAttribute('stroke', 'rgba(37,99,235,0.4)');
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.locked) return;
      const currentY = Number.isFinite(Number(item.rotationY)) ? Number(item.rotationY) : 0;
      const newY = ((currentY + Number(delta)) % 360 + 360) % 360;
      window.parent.postMessage({ type: 'workspaceItemRotated', id: gizmoItemId, rotationY: newY }, '*');
    });
    g.appendChild(btn);
    const lbl = document.createElementNS(SVG_NS, 'text');
    lbl.setAttribute('x', String(Number(bx) + btnSize / 2)); lbl.setAttribute('y', String(btnY + 14));
    lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('font-size', '12');
    lbl.setAttribute('fill', '#2563eb'); lbl.setAttribute('pointer-events', 'none');
    lbl.textContent = String(label);
    g.appendChild(lbl);
  });

  container.appendChild(g);
}

function renderBooth() {
  const g = document.getElementById('boothGroup');
  // Sort indices, not copies. This used to spread every face into a fresh
  // object to carry two extra fields - 1,586 allocations of a fifteen-property
  // record per frame, measured at 5.65 ms of a 29 ms pass. The depth and layer
  // each face sorts on live in typed arrays beside it instead, which also keeps
  // the comparator free of function calls.
  const faceCount = faces.length;
  const faceDepth = new Float64Array(faceCount);
  const faceLayer = new Float64Array(faceCount);
  for (let i = 0; i < faceCount; i++) {
    faceDepth[i] = avgDepth(faces[i]);
    faceLayer[i] = renderOrder(faces[i]);
  }
  const sorted = new Array(faceCount);
  for (let i = 0; i < faceCount; i++) sorted[i] = i;
  sorted.sort((a, b) => {
    const layer = faceLayer[a] - faceLayer[b];
    if (Math.abs(layer) > 0.0001) return layer;
    const depth = faceDepth[b] - faceDepth[a];
    if (Math.abs(depth) > 0.0001) return depth;
    return a - b;
  });

  const container = document.createElementNS(SVG_NS, 'g');
  g.appendChild(container);

  // One decision per pass, not per face: which room walls the camera is
  // currently looking through. See cutawayRoomWalls().
  const openRoomWalls = cutawayRoomWalls();

  for (const faceIndex of sorted) {
    const face = faces[faceIndex];
    if (face.isCarpet) continue;
    const ghosted = face.roomWall && openRoomWalls.has(face.roomId + '|' + face.roomWall);
    // A ghosted wall's graphic is dropped rather than faded - a printed panel
    // read through its own wall is noise, not information.
    if (ghosted && face.designImageUrl) continue;
    const proj = face.pts.map(project);
    if (proj.some(p => !p)) {
      if (DEBUG_CLIPPING) recordClippedFace(face, proj);
      continue;
    }

    if (face.normal) {
      const camDir = norm(sub(face.pts[0], cam));
      if (dot(face.normal, camDir) > 0.08) continue;
    }

    const intensity = faceIntensity(face);
    // Built by hand rather than map/toFixed/join. This is the hottest line in
    // the renderer - two toFixed calls per vertex across every face came to
    // 10.3 ms of a 29 ms pass, more than the entire DOM cost. Rounding to two
    // decimals the arithmetic way gives SVG the same geometry; the only
    // difference is that a whole number now writes as "10" rather than "10.00",
    // which the parser treats identically.
    let points = '';
    for (let i = 0; i < proj.length; i++) {
      const point = proj[i];
      if (i > 0) points += ' ';
      points += Math.round(point.x * 100) / 100 + ',' + Math.round(point.y * 100) / 100;
    }

    // The seam used to be a whole extra polygon laid over the face: 804 of the
    // 2,157 nodes in a measured stand, each carrying its own copy of the same
    // points to stroke an outline the face already had. It now rides on
    // whichever polygon is drawn *last* for this face - the shade when there is
    // one, the fill otherwise - so the picture is unchanged and the node is not
    // created at all.
    const wantsSeam = !face.signOnly && !(face.softEdge && face.hasFacetEdge);
    const seamStroke = face.softEdge
      ? LEGIBILITY.seam
      : (face.isAlu ? 'rgba(80,85,92,0.55)' : 'rgba(170,175,182,0.42)');
    const seamWidth = face.softEdge ? String(LEGIBILITY.seamW) : (face.isAlu ? '0.5' : '0.4');
    const wantsShade = !face.signOnly && intensity < 0.98 && !face.noFacetShade;

    if (!face.signOnly) {
      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', points);
      poly.setAttribute('fill', face.fill);
      if (ghosted) {
        // fill-opacity, not opacity, so the seam still draws the panel's outline
        // at full strength - a cut-away wall reads as a wall you are looking
        // through rather than as a wall that is not there.
        poly.setAttribute('fill-opacity', String(ROOM_CUTAWAY_OPACITY));
        // The near wall is drawn last, so left clickable it would swallow every
        // click meant for what is inside the room.
        poly.setAttribute('pointer-events', 'none');
      }
      if (wantsSeam && !wantsShade) {
        poly.setAttribute('stroke', seamStroke);
        poly.setAttribute('stroke-width', seamWidth);
        poly.setAttribute('stroke-linejoin', 'round');
      }
      if (face.partId) {
        poly.setAttribute('data-pid', face.partId);
        poly.setAttribute('data-type', partTypeFor(face.partId));
        poly.setAttribute('data-label', face.partLabel || face.partId);
        poly.setAttribute('data-meta', face.partMeta || '');
      }
      if (face.itemId) {
        poly.setAttribute('data-item-id', face.itemId);
        poly.style.cursor = 'move';
      }
      if (face.roomId) {
        poly.setAttribute('data-room-id', face.roomId);
        poly.style.cursor = 'move';
      }
      // Which wall of the room this belongs to, and whether it is currently cut
      // away. Read by the renderer verification, and the only handle anything
      // outside has on a wall that is built but not drawn.
      if (face.roomWall) {
        poly.setAttribute('data-room-wall', face.roomWall);
        if (ghosted) poly.setAttribute('data-room-cutaway', '1');
      }
      if (face.roomDoorToggle) {
        poly.setAttribute('data-door-toggle', '1');
        poly.style.cursor = 'pointer';
      }
      container.appendChild(poly);
    }

    // Artwork and brand text are printed on the panel, in the panel's own
    // surface coordinates - see faceSurface(). Both used to be composed in
    // screen space, which is why a logo stayed square and upright while the
    // wall carrying it turned away.
    if (face.designImageUrl || face.brandText) {
      const screenW = Math.hypot(proj[1].x - proj[0].x, proj[1].y - proj[0].y);
      const screenH = Math.hypot(proj[3].x - proj[0].x, proj[3].y - proj[0].y);
      const camDir = norm(sub(face.pts[0], cam));
      const facing = face.normal ? Math.abs(dot(face.normal, camDir)) : 1;
      const surface = screenW > 28 && screenH > 15 && facing > 0.1 ? faceSurface(face, proj) : null;
      if (surface) {
        const printed = document.createElementNS(SVG_NS, 'g');
        printed.setAttribute('transform', surface.transform);
        printed.setAttribute('pointer-events', 'none');

        if (face.designImageUrl && (face.signOnly || face.graphicFit === 'contain')) {
          const backing = document.createElementNS(SVG_NS, 'rect');
          backing.setAttribute('x', '0');
          backing.setAttribute('y', '0');
          backing.setAttribute('width', surface.w.toFixed(2));
          backing.setAttribute('height', surface.h.toFixed(2));
          backing.setAttribute('fill', face.signOnly ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.12)');
          printed.appendChild(backing);
        }

        if (face.designImageUrl) {
          const img = document.createElementNS(SVG_NS, 'image');
          img.setAttribute('href', face.designImageUrl);
          img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', face.designImageUrl);
          img.setAttribute('x', '0');
          img.setAttribute('y', '0');
          img.setAttribute('width', surface.w.toFixed(2));
          img.setAttribute('height', surface.h.toFixed(2));
          // An <image> establishes its own viewport and `slice` is clipped to
          // it, so filling the panel needs no clip path. The screen-space
          // version built a clipPath and a polygon for every graphic on every
          // frame purely to cut the image back to the panel it sat on.
          img.setAttribute('preserveAspectRatio', face.graphicFit === 'stretch' ? 'none' : face.graphicFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice');
          img.setAttribute('opacity', String(face.designOpacity ?? 1));
          printed.appendChild(img);
        }

        if (face.brandText) {
          // Lettering measured against the panel rather than against the
          // screen: a brand set at 0.2 is a fifth of the panel's height and
          // stays that fraction of it from every distance and angle.
          const fit = Math.min(
            surface.h * (face.brandScale || 0.15),
            surface.w / Math.max(4, face.brandText.length) * 1.2,
          );
          const t = document.createElementNS(SVG_NS, 'text');
          t.setAttribute('x', (surface.w / 2).toFixed(2));
          t.setAttribute('y', (surface.h / 2 + fit * 0.34).toFixed(2));
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('fill', face.brandColor || '#ffffff');
          t.setAttribute('font-family', 'SamsungOne, Samsung One, SamsungOne UI, Samsung Sharp Sans, -apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, system-ui, sans-serif');
          t.setAttribute('font-size', fit.toFixed(2));
          t.setAttribute('font-weight', '700');
          t.textContent = face.brandText;
          printed.appendChild(t);
        }

        container.appendChild(printed);
      }
    }

    if (wantsShade) {
      const sh = document.createElementNS(SVG_NS, 'polygon');
      sh.setAttribute('points', points);
      const shadeScale = ghosted ? ROOM_CUTAWAY_OPACITY : 1;
      const alpha = Math.max(0, (1 - intensity)) * (face.isFurniture ? LIGHTING.itemShade : LIGHTING.faceShade) * shadeScale;
      sh.setAttribute('fill', '#000');
      // fill-opacity rather than opacity, so the seam below can carry its own
      // alpha instead of being faded along with the shading.
      sh.setAttribute('fill-opacity', alpha.toFixed(3));
      if (wantsSeam) {
        sh.setAttribute('stroke', seamStroke);
        sh.setAttribute('stroke-width', seamWidth);
        sh.setAttribute('stroke-linejoin', 'round');
      }
      sh.setAttribute('pointer-events', 'none');
      container.appendChild(sh);
    }

    if (face.signText) {
      const mid = [
        (face.pts[0][0]+face.pts[1][0]+face.pts[2][0]+face.pts[3][0])/4,
        (face.pts[0][1]+face.pts[1][1]+face.pts[2][1]+face.pts[3][1])/4,
        (face.pts[0][2]+face.pts[1][2]+face.pts[2][2]+face.pts[3][2])/4,
      ];
      const pM = project(mid);
      if (pM) {
        const screenW = Math.hypot(proj[1].x-proj[0].x, proj[1].y-proj[0].y);
        const screenH = Math.hypot(proj[3].x-proj[0].x, proj[3].y-proj[0].y);
        const camDir = norm(sub(face.pts[0], cam));
        const facing = face.normal ? Math.abs(dot(face.normal, camDir)) : 1;
        if (screenW < 90 || screenH < 8 || facing < 0.18) continue;
        const blend3 = (a, b, t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
        const pointOnFace = (u, v) => {
          const bot = blend3(face.pts[0], face.pts[1], u);
          const top = blend3(face.pts[3], face.pts[2], u);
          return blend3(bot, top, v);
        };
        const uvP = (u, v) => project(pointOnFace(u, v));
        const addPoly = (pts4, fill, opacity, stroke, sw) => {
          if (pts4.some(p=>!p)) return;
          const el = document.createElementNS(SVG_NS, 'polygon');
          el.setAttribute('points', pts4.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '));
          el.setAttribute('fill', fill);
          if (opacity != null) el.setAttribute('opacity', String(opacity));
          if (stroke) { el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', String(sw||1)); }
          el.setAttribute('pointer-events', 'none');
          container.appendChild(el);
        };
        let signAngle = Math.atan2(proj[1].y - proj[0].y, proj[1].x - proj[0].x) * 180 / Math.PI;
        if (signAngle > 90) signAngle -= 180;
        if (signAngle < -90) signAngle += 180;
        const addText = (x, y, text, fs, col) => {
          const t = document.createElementNS(SVG_NS, 'text');
          t.setAttribute('x', x); t.setAttribute('y', y);
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('fill', col||'#23262c');
          t.setAttribute('font-family', 'SamsungOne, SamsungOne UI, Samsung Sharp Sans, system-ui, sans-serif');
          t.setAttribute('font-size', String(fs));
          t.setAttribute('font-weight', '700');
          t.setAttribute('letter-spacing', '0.04em');
          t.setAttribute('transform', `rotate(${signAngle.toFixed(3)} ${pM.x.toFixed(2)} ${pM.y.toFixed(2)})`);
          t.textContent = text;
          t.setAttribute('pointer-events', 'none');
          container.appendChild(t);
        };

        /**
         * Sign plate on a fascia board.
         *
         * `plateW` is the sign width in METRES and is honoured — it used to be
         * accepted and then ignored, which is why the "Standard" and "Full
         * length" fascia options rendered identically despite a price
         * difference.
         *
         * fullBleed (the "full" option) draws no plate outline at all: the
         * fascia board is already the white band, so the sign is simply large
         * centred type running the length of the rail. Adding an inset
         * rectangle on top of it is what produced the "rail inside a rail"
         * look.
         */
        const addCenteredNamePlate = (plateW, plateFill, plateStroke, textColor, opts) => {
          const fullBleed = !!(opts && opts.fullBleed);
          const faceWm = Math.hypot(face.pts[1][0] - face.pts[0][0], face.pts[1][2] - face.pts[0][2]);
          const label = String(face.signLabel || COMPANY_NAME || 'Company Name').slice(0, 40);

          // Horizontal half-extent of the sign, as a fraction of this face.
          const requestedW = Number(plateW) > 0 ? Number(plateW) : faceWm;
          const halfU = fullBleed
            ? 0.5
            : Math.max(0.06, Math.min(0.49, requestedW / Math.max(0.001, faceWm) / 2));
          const u0 = 0.5 - halfU, u1 = 0.5 + halfU;
          const widthU = u1 - u0;

          if (!fullBleed) {
            addPoly([uvP(u0,0.08), uvP(u1,0.08), uvP(u1,0.92), uvP(u0,0.92)],
                    plateFill || 'rgba(255,255,255,0)', null, plateStroke || '#c7ccd4', 1.25);
          }

          const scale = Math.max(0.08, Math.min(0.45, Number(face.signScale) || 0.2));
          const fs = fullBleed
            ? Math.max(10, Math.min(44, screenH * 0.60, (screenW * widthU) / Math.max(5, label.length) * 1.85))
            : Math.max(9, Math.min(28, screenH * Math.max(0.52, scale * 3.1),
                                   (screenW * widthU) / Math.max(5, label.length) * 1.65, faceWm * 16));
          addText(pM.x, pM.y + fs*0.34, label, fs.toFixed(1), face.signColor || textColor || '#4b5563');
        };

        if (FASCIA_OPTION === 'classic') {
          // Centred plate at a real width: 38% of the stand, clamped to 2.15-3.4 m.
          addCenteredNamePlate(fasciaSignWidthM(BW), '#fbfcfd', '#c7ccd4', '#4b5563');

        } else if (FASCIA_OPTION === 'custom') {
          // The oval is real geometry now - an ellipse extruded to a plate, built
          // in buildFascia() - so all that belongs here is the lettering on it.
          // This used to paint an oval polygon over the rectangular plate, which
          // is why it read as an outline and why it overlapped the board.
          const label = String(face.signLabel || COMPANY_NAME || 'Company Name').slice(0, 40);
          // Against the oval's real width - it is capped by aspect, so the old
          // full-board figure would have set type too large to fit on it.
          const boardWm = Math.hypot(face.pts[1][0] - face.pts[0][0], face.pts[1][2] - face.pts[0][2]);
          const boardHm = Math.max(0.01, face.pts[3][1] - face.pts[0][1]);
          const ovW = Math.max(0.5, Math.min(boardWm, boardHm * 5));
          const fs = Math.max(8, Math.min(20, screenH * 0.42,
            (screenW * (ovW / Math.max(0.001, boardWm))) / Math.max(5, label.length) * 1.5));
          addText(pM.x, pM.y + fs * 0.36, label, fs.toFixed(1), face.signColor || '#14213d');

        } else {
          // 'full' — edge-to-edge band, no inset plate, large centred type.
          addCenteredNamePlate(BW, null, null, '#23262c', { fullBleed: true });
        }
      }
    }
  }

  // Selection highlight — orange/red if dragging over a collision, blue otherwise
  if (selectedKey) {
    const isColliding = dragHasCollision && objectDrag && (objectDrag.type === 'item' || objectDrag.type === 'room');
    const fillColor  = isColliding ? 'rgba(255,90,60,0.22)' : 'rgba(91,140,255,0.18)';
    const strokeColor = isColliding ? '#e63c20' : '#3a6dd9';
    for (const face of sorted) {
      if (canonicalPartId(face.partId) !== selectedKey) continue;
      if (face.skipSelectionHighlight) continue;
      const proj = face.pts.map(project);
      if (proj.some(p=>!p)) continue;
      if (face.normal) {
        const camDir = norm(sub(face.pts[0], cam));
        if (dot(face.normal, camDir) > 0.08) continue;
      }
      const points = proj.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
      const sel = document.createElementNS(SVG_NS, 'polygon');
      sel.setAttribute('points', points);
      sel.setAttribute('fill', fillColor);
      sel.setAttribute('stroke', strokeColor); sel.setAttribute('stroke-width', '1.4');
      sel.setAttribute('pointer-events', 'none');
      container.appendChild(sel);
    }
  }
  drawInvalidItemWarnings(container);
  drawGlbLoadingIndicators(container);
  drawSelectedItemGizmo(container);
}

function renderAll() {
  document.getElementById('floorGroup').innerHTML = '';
  document.getElementById('boothGroup').innerHTML = '';
  document.getElementById('gridGroup').innerHTML = '';
  buildFloor();
  renderBooth();
  buildGrid();
  placeAnnotations();
  updateHud();
  drawCatalogDropPreview();
  // One report per pass, after both the ground and the draw loop have had their
  // chance to lose something.
  if (DEBUG_CLIPPING) reportClippedFaces();
  rendererWindow.__pendingGlbState = {
      width: BW,
      depth: BD,
      height: BH,
      fasciaHeight: FH,
      wallsVisible: { ...wallsVisible },
      cam,
      target: camState.target,
      fov,
      placedItems,
      selectedItemId,
      // The GLB layer draws on top of the SVG and knows nothing about rooms, so
      // furniture inside one used to float in front of the walls that enclose
      // it. These are what the depth-only occluders are built from - and the
      // cut-away walls are listed so a ghosted wall stops occluding too.
      rooms: [...roomGeometry.values()],
      openRoomWalls: [...cutawayRoomWalls()],
    };
  if (rendererWindow.__updateGlbLayer) {
    rendererWindow.__updateGlbLayer(rendererWindow.__pendingGlbState);
  }
}
window.renderAll = renderAll;
renderAll();

// ── Interaction ───────────────────────────────────────────────────────────────
const svgEl = document.getElementById('scene');
let dragging = false, lastX = 0, lastY = 0, didDrag = false;
svgEl.style.cursor = 'grab';
const pointers = new Map();
let pinchPrev = 0;
let pendingClickPart = null;

function partTypeFor(partId) {
  if (!partId) return 'shell';
  if (partId.startsWith('panel-')) return 'panel';
  if (partId === 'carpet') return 'carpet';
  if (partId.startsWith('post-')) return 'frame';
  if (partId.startsWith('rail-') || partId.includes('-rail') || partId.includes('-bracket')) return 'frame';
  if (partId.startsWith('fascia-')) return 'fascia';
  if (partId.includes('door')) return 'room';
  return 'shell';
}

/**
 * A face's id with the face marker removed - the part it belongs to.
 *
 * pushBox(), pushPrism() and pushOvalPlate() give every face its own id
 * ("r1-back-482:+x", "fascia-front-name-plate-91:rim7") so a single face can be
 * addressed. Anything asking about the *part* wants this. Every suffix those
 * three append has to be listed below, or the part it belongs to goes unnamed.
 * It is not the same question as canonicalPartId(), which additionally folds a
 * whole family down to one selection key ("fascia-front-body" -> "fascia-front").
 */
function basePartId(partId) {
  return String(partId || '').replace(/-\d+:(?:[-+][xyz]|side\d+|rim\d+|[-+]face)$/, '');
}

function canonicalPartId(partId) {
  if (!partId) return '';
  const text = basePartId(partId);
  const panel = text.match(/panel-(front|back|left|right)-\d+/);
  if (panel) return panel[0];
  const support = text.match(/post-front-support-\d+/);
  if (support) return support[0];
  const post = text.match(/post-(front|back|left|right)-\d+/);
  if (post) return post[0];
  const fascia = text.match(/fascia-(front|back|left|right)/);
  if (fascia) return fascia[0];
  const rail = text.match(/rail-(front|back|left|right|front-ceiling|back-ceiling|left-ceiling|right-ceiling|ceiling-cross-left-right)/);
  if (rail) return rail[0];
  if (text.includes('carpet')) return 'carpet';
  // Rooms, furniture and room doors have no family to fold into; the face
  // marker is already off, courtesy of basePartId above.
  return text;
}

function notifyItemMoved(item) {
  // Mounting changes more than position: a shelf takes the width of the panel
  // it lands on, both shelves and lights rotate to face their wall, and a light
  // is pinned to beam height. Reporting only x and z meant React kept the old
  // width and rotation and re-rendered them straight back - the item visibly
  // snapped into place and then jumped out of it again.
  window.parent.postMessage({
    type: 'workspaceItemMoved',
    id: item.id,
    x: Number(item.x || 0),
    z: Number(item.z || 0),
    w: Number(item.w) || undefined,
    y: Number.isFinite(Number(item.y)) ? Number(item.y) : undefined,
    rotationY: Number.isFinite(Number(item.rotationY)) ? Number(item.rotationY) : undefined,
  }, '*');
}

function syncCorrectedItemPosition(item, boothX, boothZ) {
  if (!item || item.id == null) return;
  const nextX = boothX + BW / 2;
  const nextZ = boothZ;
  const currentX = Number(item.x || 0);
  const currentZ = Number(item.z || 0);
  if (Math.abs(currentX - nextX) < 0.001 && Math.abs(currentZ - nextZ) < 0.001) return;
  item.x = nextX;
  item.z = nextZ;
  notifyItemMoved(item);
}

function notifyRoomMoved(room) {
  window.parent.postMessage({
    type: 'workspaceRoomMoved',
    id: room.id,
    x: Number(room.x || 0),
    z: Number(room.z || 0),
  }, '*');
}

function defaultFrontSupportPositions() {
  const positions = [];
  if (BW >= 5) for (let value = 3; value < BW - 0.001; value += 3) positions.push(value);
  return positions;
}

function activeFrontSupportPositions() {
  const defaults = defaultFrontSupportPositions();
  const custom = Array.isArray(frontSupportPositions) ? frontSupportPositions : [];
  const suppressed = Array.isArray(suppressedDefaultPositions) ? suppressedDefaultPositions : [];
  const merged = [...custom];
  defaults.forEach(value => {
    if (suppressed.some(s => Math.abs(s - value) < 0.12)) return;
    if (!merged.some(existing => Math.abs(Number(existing) - value) < 0.12)) merged.push(value);
  });
  return merged
    .map(value => Math.max(0.45, Math.min(BW - 0.45, Number(value) || 0)))
    .filter((value, index, list) => value > 0.45 && value < BW - 0.45 && list.findIndex(other => Math.abs(other - value) < 0.12) === index)
    .sort((a, b) => a - b);
}

function notifyFrontSupportMoved() {
  window.parent.postMessage({
    type: 'workspaceFrontSupportsMoved',
    positions: activeFrontSupportPositions(),
    suppressedDefaultPositions: Array.isArray(suppressedDefaultPositions) ? suppressedDefaultPositions : [],
  }, '*');
}

function notifyRoomPatched(room, patch) {
  window.parent.postMessage({
    type: 'workspaceRoomPatched',
    id: room.id,
    ...patch,
  }, '*');
}

// Show a small "⟳ 3D" badge over any furniture item whose GLB model is still
// fetching. Disappears automatically once __glbVisibleItems contains the item.
function drawGlbLoadingIndicators(container) {
  const glbVisible = rendererWindow.__glbVisibleItems || new Set();
  for (const item of placedItems) {
    if (!item.modelUrl) continue;
    const keyId = String(item.id || item.sku || item.modelUrl);
    if (glbVisible.has(keyId)) continue;
    // GLB hasn't loaded yet — find the projected top-center of this item.
    const x = Number.isFinite(Number(item.x)) ? -BW / 2 + Number(item.x) : 0;
    const z = Number.isFinite(Number(item.z)) ? Number(item.z) : BD / 2;
    const h = Math.max(0.2, Number(item.h) || 0.8);
    const p = project([x, h + 0.25, z]);
    if (!p) continue;
    const bx = p.x - 18, by = p.y - 9;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', bx.toFixed(1)); rect.setAttribute('y', by.toFixed(1));
    rect.setAttribute('width', '36'); rect.setAttribute('height', '16');
    rect.setAttribute('rx', '4'); rect.setAttribute('fill', 'rgba(20,22,26,0.72)');
    rect.setAttribute('pointer-events', 'none');
    container.appendChild(rect);
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', p.x.toFixed(1)); label.setAttribute('y', (by + 11).toFixed(1));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#e2e4ef'); label.setAttribute('font-size', '9');
    label.setAttribute('font-weight', '600'); label.setAttribute('pointer-events', 'none');
    label.textContent = '⟳ 3D';
    container.appendChild(label);
  }
}

function drawInvalidItemWarnings(container) {
  if (!invalidItemIds || invalidItemIds.size === 0) return;
  placedItems.forEach(item => {
    if (!invalidItemIds.has(String(item.id))) return;
    const x = Number.isFinite(Number(item.x)) ? -BW / 2 + Number(item.x) : 0;
    const z = Number.isFinite(Number(item.z)) ? Number(item.z) : 0;
    const w = Math.max(0.12, Number(item.w) || 0.6);
    const d = Math.max(0.12, Number(item.d) || 0.6);
    const pad = 0.07;
    const props = {
      rotRad: ((Number(item.rotationY ?? item.rotation) || 0) % 360) * Math.PI / 180,
      originX: x,
      originZ: z,
    };
    const pts3 = [
      [x - w / 2 - pad, 0.085, z - d / 2 - pad],
      [x + w / 2 + pad, 0.085, z - d / 2 - pad],
      [x + w / 2 + pad, 0.085, z + d / 2 + pad],
      [x - w / 2 - pad, 0.085, z + d / 2 + pad],
    ].map(point => rotateFurniturePoint(point, props));
    const pts2 = pts3.map(project);
    if (pts2.some(point => !point)) return;
    const points = pts2.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    const fill = document.createElementNS(SVG_NS, 'polygon');
    fill.setAttribute('points', points);
    fill.setAttribute('fill', 'rgba(245, 113, 67, 0.16)');
    fill.setAttribute('stroke', '#f57143');
    fill.setAttribute('stroke-width', '2');
    fill.setAttribute('stroke-linejoin', 'round');
    fill.setAttribute('stroke-dasharray', '6 4');
    fill.setAttribute('pointer-events', 'none');
    container.appendChild(fill);
  });
}

svgEl.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  svgEl.setPointerCapture(e.pointerId);
  didDrag = false;
  const selectableTarget = e.target?.closest?.('[data-pid]') || null;
  const clickedPartId = selectableTarget?.getAttribute?.('data-pid') || '';
  pendingClickPart = clickedPartId ? {
    pid: canonicalPartId(clickedPartId),
    rawPid: clickedPartId,
    itemId: selectableTarget?.getAttribute?.('data-item-id') || null,
    roomId: selectableTarget?.getAttribute?.('data-room-id') || null,
    isDoorToggle: selectableTarget?.getAttribute?.('data-door-toggle') === '1',
    partType: selectableTarget?.getAttribute?.('data-type') || partTypeFor(clickedPartId),
    label: selectableTarget?.getAttribute?.('data-label') || clickedPartId,
    meta: selectableTarget?.getAttribute?.('data-meta') || '',
  } : null;
  if (pendingClickPart?.isDoorToggle) {
    dragging = false;
    svgEl.style.cursor = 'pointer';
    e.preventDefault();
    return;
  }
  const itemId = selectableTarget?.getAttribute?.('data-item-id');
  const roomId = selectableTarget?.getAttribute?.('data-room-id');
  const supportMatch = clickedPartId.match(/post-front-support-(\d+)/);
  if (supportMatch) {
    const hit = screenToFloorPoint(e);
    if (hit) {
      const supportIndex = Number(supportMatch[1]) || 0;
      const positions = activeFrontSupportPositions();
      const currentX = positions[supportIndex] ?? defaultFrontSupportPositions()[supportIndex] ?? Math.min(3, BW / 2);
      objectDrag = {
        type: 'frontSupport',
        pointerId: e.pointerId,
        supportIndex,
        originalX: currentX,
        offsetX: (-BW / 2 + currentX) - hit[0],
      };
      dragging = false;
      svgEl.style.cursor = 'ew-resize';
      e.preventDefault();
      return;
    }
  }
  if (itemId) {
    const item = placedItems.find(entry => String(entry.id) === String(itemId));
    if (item?.locked) {
      dragging = false;
      objectDrag = null;
      svgEl.style.cursor = 'pointer';
      e.preventDefault();
      return;
    }
    const hit = item ? screenToFloorPoint(e) : null;
    if (item && hit) {
      // Snapshot where every selected item started, so the group can be moved
      // by an offset rather than each item chasing the pointer.
      const groupIds = selectedItemIds.includes(String(itemId)) ? selectedItemIds : [String(itemId)];
      const group = groupIds
        .map(id => placedItems.find(entry => String(entry.id) === String(id)))
        .filter(entry => entry && !entry.locked && String(entry.id) !== String(itemId))
        .map(entry => ({ id: String(entry.id), startX: Number(entry.x || 0), startZ: Number(entry.z || 0),
                         lastValidX: Number(entry.x || 0), lastValidZ: Number(entry.z || 0) }));
      objectDrag = {
        type: 'item',
        pointerId: e.pointerId,
        itemId,
        offsetX: (-BW / 2 + Number(item.x || 0)) - hit[0],
        offsetZ: Number(item.z || 0) - hit[2],
        startX: Number(item.x || 0),
        startZ: Number(item.z || 0),
        lastValidX: Number(item.x || 0),
        lastValidZ: Number(item.z || 0),
        group,
      };
      dragging = false;
      svgEl.style.cursor = 'move';
      e.preventDefault();
      return;
    }
  }
  if (roomId) {
    const room = rooms.find(entry => String(entry.id) === String(roomId));
    if (room && room.locked) {
      e.preventDefault();
      return;
    }
    const hit = room ? screenToFloorPoint(e) : null;
    if (room && hit) {
      objectDrag = {
        type: 'room',
        pointerId: e.pointerId,
        roomId,
        offsetX: (-BW / 2 + Number(room.x || 0)) - hit[0],
        offsetZ: Number(room.z || 0) - hit[2],
        lastValidX: Number(room.x || 0),
        lastValidZ: Number(room.z || 0),
      };
      dragging = false;
      svgEl.style.cursor = 'move';
      e.preventDefault();
      return;
    }
  }
  if (pointers.size === 1) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    svgEl.style.cursor = 'grabbing';
  } else if (pointers.size === 2) {
    dragging = false;
    const p = [...pointers.values()];
    pinchPrev = Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y);
  }
});

svgEl.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (objectDrag && objectDrag.pointerId === e.pointerId) {
    const hit = screenToFloorPoint(e);
    if (hit && objectDrag.type === 'item') {
      const item = placedItems.find(entry => String(entry.id) === String(objectDrag.itemId));
      if (!item) return;
      const nextX = hit[0] + objectDrag.offsetX + BW / 2;
      const nextZ = hit[2] + objectDrag.offsetZ;
      const rawX = -BW / 2 + Math.round(nextX * 20) / 20;
      const rawZ = Math.round(nextZ * 20) / 20;

      // Mounting rules and the booth clamp both live in resolveDropPosition.
      // Shelves follow their panel, lights their rail, everything else keeps
      // the floor point it was dragged to.
      const clamped = resolveDropPosition(item, rawX, rawZ);
      item.x = clamped.x + BW / 2;
      item.z = clamped.z;
      // A mounted item shares no floor space with anything, so floor collision
      // does not apply to it.
      // The reason, not just the fact. itemCollisionReason() has always
      // returned a sentence a designer can act on - "Crosses Storage wall",
      // "Blocked by a booth support" - and the drag threw it away for a
      // boolean, so the gizmo could only ever say "Overlap" no matter what was
      // actually wrong.
      dragCollisionReason = isWallMountedItem(item)
        ? ''
        : itemCollisionReason(item.id, clamped.x, clamped.z, item.w, item.d, item.rotationY ?? item.rotation);
      dragHasCollision = Boolean(dragCollisionReason);
      if (!dragHasCollision) {
        objectDrag.lastValidX = item.x;
        objectDrag.lastValidZ = item.z;
      }

      // Everything else in the selection follows by the same offset. Each one
      // is still resolved on its own - a shelf in the group keeps following its
      // panel, a counter still seats flush - so the group moves together
      // without any member landing somewhere it could not be dragged to.
      const groupDX = item.x - objectDrag.startX;
      const groupDZ = item.z - objectDrag.startZ;
      for (const member of objectDrag.group || []) {
        const other = placedItems.find(entry => String(entry.id) === String(member.id));
        if (!other) continue;
        const at = resolveDropPosition(other, member.startX + groupDX - BW / 2, member.startZ + groupDZ);
        other.x = at.x + BW / 2;
        other.z = at.z;
        const memberBlocked = isWallMountedItem(other)
          ? ''
          : itemCollisionReason(other.id, at.x, at.z, other.w, other.d, other.rotationY ?? other.rotation);
        if (memberBlocked) {
          if (!dragCollisionReason) dragCollisionReason = memberBlocked;
          dragHasCollision = true;
        } else {
          member.lastValidX = other.x;
          member.lastValidZ = other.z;
        }
        notifyItemMoved(other);
      }
      didDrag = true;
      notifyItemMoved(item);
      buildBoothGeometry();
      renderAll();
    } else if (hit && objectDrag.type === 'room') {
      const room = rooms.find(entry => String(entry.id) === String(objectDrag.roomId));
      if (!room) return;
      if (room.locked) return;
      const w = Number(room.width) || 1;
      const d = Number(room.depth) || 1;
      const nextX = hit[0] + objectDrag.offsetX + BW / 2;
      const nextZ = hit[2] + objectDrag.offsetZ;
      const minX = w / 2;
      const maxX = BW - w / 2;
      const minZ = d / 2;
      const maxZ = BD - d / 2;
      // 5 cm, the same grid furniture uses. A 0.5 m grid meant a room could
      // only stop at half-metre stations, so it could rarely be lined up with
      // anything already in the booth.
      let snappedX = Math.max(minX, Math.min(maxX, Math.round(nextX * 20) / 20));
      let snappedZ = Math.max(minZ, Math.min(maxZ, Math.round(nextZ * 20) / 20));
      const cornerSnap = 0.32;
      if (Math.abs(nextX - minX) <= cornerSnap) snappedX = minX;
      if (Math.abs(nextX - maxX) <= cornerSnap) snappedX = maxX;
      if (Math.abs(nextZ - minZ) <= cornerSnap) snappedZ = minZ;
      if (Math.abs(nextZ - maxZ) <= cornerSnap) snappedZ = maxZ;
      room.x = snappedX;
      room.z = snappedZ;
      dragHasCollision = Boolean(roomPlacementCollisionReason(room.id, room));
      if (!dragHasCollision) {
        objectDrag.lastValidX = room.x;
        objectDrag.lastValidZ = room.z;
      }
      didDrag = true;
      if (!dragHasCollision) notifyRoomMoved(room);
      buildBoothGeometry();
      renderAll();
    } else if (hit && objectDrag.type === 'frontSupport') {
      const nextX = Math.max(0.45, Math.min(BW - 0.45, Math.round((hit[0] + objectDrag.offsetX + BW / 2) * 20) / 20));
      const defaults = defaultFrontSupportPositions();
      // If dragging a default support, suppress that default so it doesn't re-appear
      if (defaults.some(p => Math.abs(p - objectDrag.originalX) < 0.12)) {
        if (!suppressedDefaultPositions.some(p => Math.abs(p - objectDrag.originalX) < 0.12)) {
          suppressedDefaultPositions = [...suppressedDefaultPositions, objectDrag.originalX];
        }
      }
      // Update custom positions: remove old, add new
      const custom = Array.isArray(frontSupportPositions) ? frontSupportPositions : [];
      const withoutOld = custom.filter(p => Math.abs(p - objectDrag.originalX) >= 0.12);
      withoutOld.push(nextX);
      frontSupportPositions = withoutOld;
      objectDrag.originalX = nextX;
      didDrag = true;
      notifyFrontSupportMoved();
      buildBoothGeometry();
      renderAll();
    }
    e.preventDefault();
    return;
  }
  if (pointers.size === 2) {
    const p = [...pointers.values()];
    const dist = Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y);
    if (pinchPrev > 0) {
      const f = pinchPrev / dist;
      camState.distance = Math.max(7, Math.min(28, camState.distance * f));
    }
    pinchPrev = dist;
    updateCamera(); renderAll(); return;
  }
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
  lastX = e.clientX; lastY = e.clientY;
  camState.azimuth   -= dx * 0.005;
  camState.elevation += dy * 0.0035;
  camState.elevation  = Math.max(-0.1, Math.min(1.35, camState.elevation));
  updateCamera(); renderAll();
});

function endPointer(e) {
  if (objectDrag && objectDrag.pointerId === e.pointerId) {
    if (objectDrag.type === 'item') {
      const item = placedItems.find(entry => String(entry.id) === String(objectDrag.itemId));
      if (item) {
        if (dragHasCollision) {
          // Put it down beside where it was aimed rather than back where it
          // came from. The spring-back was the whole of the old feedback: an
          // item dragged across the stand onto something would vanish from
          // under the pointer and reappear at its start, which reads as the
          // drag having failed rather than as the spot being taken.
          const rescue = nearestValidPlacement(item, Number(item.x) - BW / 2, Number(item.z));
          if (rescue) {
            const settled = resolveDropPosition(item, rescue.x, rescue.z);
            item.x = settled.x + BW / 2;
            item.z = settled.z;
          } else {
            // Nowhere within reach. Falling back to the last good spot is the
            // behaviour this replaced, so a crowded stand is never worse off.
            item.x = objectDrag.lastValidX;
            item.z = objectDrag.lastValidZ;
          }
          // The rest of the group goes back to its own last good spot. Rescuing
          // each member separately would pull the selection apart, which is the
          // one thing a group move must not do.
          for (const member of objectDrag.group || []) {
            const other = placedItems.find(entry => String(entry.id) === String(member.id));
            if (!other) continue;
            other.x = member.lastValidX;
            other.z = member.lastValidZ;
            notifyItemMoved(other);
          }
          buildBoothGeometry();
          renderAll();
        }
        notifyItemMoved(item);
      }
    } else if (objectDrag.type === 'room') {
      const room = rooms.find(entry => String(entry.id) === String(objectDrag.roomId));
      if (room) {
        // A room stays where it is put. It used to spring back to its last
        // non-overlapping position on release, so a room pushed into a corner
        // that clipped anything at all simply refused to go there. Overlaps
        // are still drawn in the collision colour while dragging.
        notifyRoomMoved(room);
      }
    } else if (objectDrag.type === 'frontSupport') {
      notifyFrontSupportMoved();
    }
    // Tell the workspace the gesture is finished. Every frame of a drag posts
    // a move and none of them is a commit point, so without this the workspace
    // has no way to know when a drag ended - which is why dragging an item, a
    // room or a support was invisible to undo entirely.
    if (didDrag) {
      window.parent.postMessage({ type: 'workspaceGestureEnd', kind: objectDrag.type }, '*');
    }
    objectDrag = null;
    dragHasCollision = false;
    dragCollisionReason = '';
  }
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchPrev = 0;
  if (pointers.size === 0) { dragging = false; svgEl.style.cursor = 'grab'; }
}

svgEl.addEventListener('pointerup', (e) => {
  if (!didDrag && pendingClickPart?.pid) {
    const pid = pendingClickPart.pid;
    if (pendingClickPart.isDoorToggle) {
      const roomId = pendingClickPart.roomId;
      const room = rooms.find(entry => String(entry.id) === String(roomId));
      if (room) {
        room.doorOpen = !room.doorOpen;
        notifyRoomPatched(room, { doorOpen: room.doorOpen });
        buildBoothGeometry();
        renderAll();
      }
    }

    if (pinMode) {
      const face = faces.find(f => canonicalPartId(f.partId) === pid);
      if (face) {
        let cx = 0, cy = 0, cz = 0;
        for (const p of face.pts) {
          cx += p[0];
          cy += p[1];
          cz += p[2];
        }
        cx /= face.pts.length;
        cy /= face.pts.length;
        cz /= face.pts.length;

        const projected = project([cx, cy, cz]);
        const svgRect = svgEl.getBoundingClientRect();
        if (projected && svgRect.width > 0 && svgRect.height > 0) {
          window.parent.postMessage({
            type: 'pinRequested',
            x: Math.max(0, Math.min(100, (projected.x / VW) * 100)),
            y: Math.max(0, Math.min(100, (projected.y / VH) * 100)),
            partId: pid
          }, '*');
        }
      }
      pendingClickPart = null;
      endPointer(e);
      return;
    }

    selectedKey = pid;
    selectedItemId = pendingClickPart.itemId;
    selectedRoomId = pendingClickPart.roomId || null;
    const selectedPoint = eventToSvgPoint(e);
    window.parent.postMessage({
      type: 'workspaceItemSelected',
      id: selectedItemId,
      // Shift or the platform modifier means "add to what is already picked".
      // The workspace owns the selection; this only reports the intent.
      additive: Boolean(e.shiftKey || e.metaKey || e.ctrlKey),
      roomId: pendingClickPart.roomId,
      partId: selectedKey,
      partType: pendingClickPart.roomId ? 'room' : (pendingClickPart.partType || partTypeFor(selectedKey)),
      label: pendingClickPart.label,
      meta: pendingClickPart.meta,
      xPct: Math.max(0, Math.min(100, (selectedPoint.x / VW) * 100)),
      yPct: Math.max(0, Math.min(100, (selectedPoint.y / VH) * 100)),
    }, '*');
    document.getElementById('sel-label').textContent = selectedKey ? pendingClickPart.label : '—';
    document.getElementById('sel-meta').textContent  = selectedKey ? pendingClickPart.meta  : '';
    document.getElementById('sel-card').style.display = selectedKey ? 'block' : 'none';
    renderAll();
  } else if (!didDrag && e.target.tagName === 'svg' && selectedKey) {
    selectedKey = null;
    selectedItemId = null;
    selectedRoomId = null;
    document.getElementById('sel-card').style.display = 'none';
    window.parent.postMessage({ type: 'workspaceItemSelected', id: null, partId: null }, '*');
    renderAll();
  }
  pendingClickPart = null;
  endPointer(e);
});
svgEl.addEventListener('pointercancel', (e) => {
  pendingClickPart = null;
  endPointer(e);
});
// Keyboard shortcuts only reach the parent while focus is outside this iframe,
// and clicking the booth puts focus inside it - so the canvas forwards them
// itself. Without this Ctrl+Z stops working the moment you touch the design,
// which is the moment you are most likely to want it.
window.addEventListener('keydown', (e) => {
  const target = e.target;
  if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = String(e.key || '').toLowerCase();
  let action = '';
  // This list has to match the workspace's own keydown handler. Clicking the
  // booth moves focus into this iframe and the parent stops seeing key events,
  // so anything the workspace binds and this does not forward simply stops
  // working the moment the designer touches the stand - which is exactly when
  // they want it.
  if (mod && key === 'z') action = e.shiftKey ? 'redo' : 'undo';
  else if (mod && key === 'y') action = 'redo';
  else if (mod && key === 'd') action = 'duplicate';
  else if (key === 'delete' || key === 'backspace') action = 'delete';
  else if (key === 'escape') action = 'deselect';
  else if (key === '[') action = 'rotate-ccw';
  else if (key === ']') action = 'rotate-cw';
  // Shift takes a metre instead of one grid step. The workspace comment has
  // promised this since the nudges were written and nothing implemented it.
  else if (key === 'arrowleft') action = e.shiftKey ? 'nudge-left-far' : 'nudge-left';
  else if (key === 'arrowright') action = e.shiftKey ? 'nudge-right-far' : 'nudge-right';
  else if (key === 'arrowup') action = e.shiftKey ? 'nudge-up-far' : 'nudge-up';
  else if (key === 'arrowdown') action = e.shiftKey ? 'nudge-down-far' : 'nudge-down';
  if (!action) return;
  e.preventDefault();
  window.parent.postMessage({ type: 'workspaceShortcut', action }, '*');
});

svgEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  const f = e.deltaY > 0 ? 1.08 : 0.93;
  camState.distance = Math.max(7, Math.min(28, camState.distance * f));
  updateCamera(); renderAll();
}, { passive: false });

// ── View preset buttons ───────────────────────────────────────────────────────
function animateTo(target, ms = 600) {
  const start = { azimuth: camState.azimuth, elevation: camState.elevation, distance: camState.distance };
  const startT = performance.now();
  let dAz = target.azimuth - start.azimuth;
  while (dAz >  Math.PI) dAz -= Math.PI * 2;
  while (dAz < -Math.PI) dAz += Math.PI * 2;
  function step(t) {
    const k = Math.min(1, (t - startT) / ms);
    const e = k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k+2, 2)/2;
    camState.azimuth   = start.azimuth + dAz * e;
    camState.elevation = start.elevation + (target.elevation - start.elevation) * e;
    camState.distance  = start.distance + (target.distance - start.distance) * e;
    updateCamera(); renderAll();
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
document.querySelectorAll('#view-toolbar button[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#view-toolbar button[data-view]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    animateTo(VIEWS[btn.dataset.view]);
  });
});
document.getElementById('btn-reset').addEventListener('click', () => {
  document.querySelectorAll('#view-toolbar button[data-view]').forEach(b=>b.classList.remove('active'));
  document.querySelector('#view-toolbar button[data-view="3q"]').classList.add('active');
  camState.target = defaultTarget();
  animateTo(VIEWS['3q']);
});

// ── Column profile toggle ─────────────────────────────────────────────────────
// Sync button active state to initial columnStyle param
document.querySelectorAll('#profile-toolbar button[data-prof]').forEach(btn => {
  btn.classList.toggle('active', btn.dataset.prof === columnStyle);
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) return;
    document.querySelectorAll('#profile-toolbar button[data-prof]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    columnStyle = btn.dataset.prof;
    buildBoothGeometry(); renderAll();
  });
});

// ── HUD text update ───────────────────────────────────────────────────────────
function updateHud() {
  let az = (camState.azimuth * 180 / Math.PI) % 360;
  if (az < 0) az += 360;
  const camAzEl = document.getElementById('cam-az');
  if (camAzEl) camAzEl.textContent = Math.round(az) + '°';
  document.getElementById('hud-dims').textContent = BW.toFixed(1) + ' × ' + BD.toFixed(1) + ' m';
  document.getElementById('hud-height').textContent = (BH + FH).toFixed(2) + ' m total';
  document.getElementById('hud-system').textContent = columnStyle === 'maxima' ? 'Maxima' : 'Octanorm';
  // Was a hardcoded "40 mm profile" in the page, which was wrong for both
  // systems and identical for each.
  const profileEl = document.getElementById('hud-profile');
  if (profileEl) profileEl.textContent = ensSystemProfile().label + ' profile';
  // Determine booth type from open sides
  const openCount = [!wallsVisible.back,!wallsVisible.left,!wallsVisible.right,!wallsVisible.front].filter(Boolean).length;
  document.getElementById('hud-type').textContent = openCount >= 3 ? 'Island' : openCount === 2 ? 'Corner' : openCount === 1 ? 'Open Side' : 'Enclosed';
}

// ── Dimension annotations (screen-space) ─────────────────────────────────────
function placeAnnotations() {
  const existingPins = document.querySelectorAll('.svg-3d-pin');
  existingPins.forEach(p => p.remove());

  const svg = document.getElementById('scene');
  const rect = svg.getBoundingClientRect();
  function toScreen(p) {
    return { x: rect.left + (p.x / VW) * rect.width, y: rect.top + (p.y / VH) * rect.height };
  }

  for (const pin of pins) {
    let px, py, pz;
    if (pin.z !== undefined) {
      px = pin.x;
      py = pin.y;
      pz = pin.z;
    } else {
      px = -BW/2 + (pin.x / 100) * BW;
      py = 0.05;
      pz = (pin.y / 100) * BD;
    }

    const proj = project([px, py, pz]);
    if (!proj) continue;

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'svg-3d-pin');
    g.style.cursor = 'pointer';

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', proj.x);
    circle.setAttribute('cy', proj.y);
    circle.setAttribute('r', '11');
    circle.setAttribute('fill', '#c2410c');
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '1.8');
    g.appendChild(circle);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', proj.x);
    text.setAttribute('y', proj.y + 3.5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-family', 'SamsungOne, sans-serif');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-weight', '700');
    text.textContent = pin.num;
    g.appendChild(text);

    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = pin.text;
    g.appendChild(title);

    g.addEventListener('mouseenter', () => {
      circle.setAttribute('r', '13');
      circle.setAttribute('fill', '#ea580c');
    });
    g.addEventListener('mouseleave', () => {
      circle.setAttribute('r', '11');
      circle.setAttribute('fill', '#c2410c');
    });

    svg.appendChild(g);
  }

  const wA = project([-BW/2, 0, 0.35]);
  const wB = project([ BW/2, 0, 0.35]);
  const dimW = document.getElementById('dim-w');
  dimW.querySelector('.lbl').textContent = BW.toFixed(1) + ' m';
  if (wA && wB) {
    const cx=(wA.x+wB.x)/2, cy=(wA.y+wB.y)/2+18;
    const s=toScreen({x:cx,y:cy});
    dimW.style.left=(s.x-22)+'px'; dimW.style.top=s.y+'px'; dimW.style.opacity='1';
  }
  const dA = project([BW/2+0.4, 0, 0]);
  const dB = project([BW/2+0.4, 0, BD]);
  const dimD = document.getElementById('dim-d');
  dimD.querySelector('.lbl').textContent = BD.toFixed(1) + ' m';
  if (dA && dB) {
    const cx=(dA.x+dB.x)/2, cy=(dA.y+dB.y)/2;
    const s=toScreen({x:cx,y:cy});
    dimD.style.left=s.x+'px'; dimD.style.top=(s.y-8)+'px'; dimD.style.opacity='1';
  }
  const hA = project([-BW/2-0.45, 0,      0]);
  const hB = project([-BW/2-0.45, BH+FH,  0]);
  const dimH = document.getElementById('dim-h');
  dimH.querySelector('.lbl').textContent = (BH+FH).toFixed(2) + ' m';
  if (hA && hB) {
    const cx=(hA.x+hB.x)/2, cy=(hA.y+hB.y)/2;
    const s=toScreen({x:cx,y:cy});
    dimH.style.left=(s.x-46)+'px'; dimH.style.top=(s.y-8)+'px'; dimH.style.opacity='1';
  }
}

window.addEventListener('resize', renderAll);

// ── Live config via postMessage ───────────────────────────────────────────────
window.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'catalogDragCancel') {
    catalogDropPreview = null;
    drawCatalogDropPreview();
    return;
  }
  if (e.data.type === 'catalogDragPreview' || e.data.type === 'catalogDragCommit') {
    const result = evaluateCatalogPlacement(e.data);
    catalogDropPreview = result;
    drawCatalogDropPreview();
    window.parent.postMessage({
      type: e.data.type === 'catalogDragCommit' ? 'catalogDropCommitted' : 'catalogDropPreview',
      catalogId: result.catalogId,
      valid: result.valid,
      reason: result.reason,
      x: result.x,
      z: result.z,
      w: result.w,
      y: result.y,
      rotationY: result.rotationY,
      mounted: Boolean(result.mounted),
    }, '*');
    if (e.data.type === 'catalogDragCommit') {
      catalogDropPreview = null;
      requestAnimationFrame(drawCatalogDropPreview);
    }
    return;
  }
  if (e.data.type === 'workspaceItemRemove') {
    const id = String(e.data.id || '');
    if (!id) return;
    placedItems = placedItems.filter(item => String(item.id) !== id);
    if (String(selectedItemId || '') === id) {
      selectedItemId = null;
      selectedKey = null;
      selectedRoomId = null;
      const card = document.getElementById('sel-card');
      if (card) card.style.display = 'none';
    }
    renderAll();
    window.parent.postMessage({ type: 'workspaceItemRemoved', id }, '*');
    return;
  }
  if (e.data.type !== 'boothUpdate') return;
  const d = e.data;
  if (d.w      != null) BW = Math.max(1, parseFloat(d.w));
  if (d.d      != null) BD = Math.max(1, parseFloat(d.d));
  if (d.h      != null) BH = Math.max(0.8, parseFloat(d.h));
  if (d.name   != null) COMPANY_NAME = String(d.name);
  if (d.carpet != null) CARPET_COLOR = String(d.carpet);
  if (d.wall != null) WALL_COLOR = String(d.wall);
  if (d.frame != null) FRAME_COLOR = String(d.frame);
  if (d.fasciaColor != null) FASCIA_COLOR = String(d.fasciaColor);
  applyFinishColors();
  if (d.placedItems != null) {
    placedItems = Array.isArray(d.placedItems) ? d.placedItems : [];
    if (selectedItemId != null && !placedItems.some(item => String(item.id) === String(selectedItemId))) {
      selectedItemId = null;
      selectedKey = null;
      const card = document.getElementById('sel-card');
      if (card) card.style.display = 'none';
      const label = document.getElementById('sel-label');
      if (label) label.textContent = '—';
      const meta = document.getElementById('sel-meta');
      if (meta) meta.textContent = '';
    }
  }
  if (d.rooms != null) rooms = Array.isArray(d.rooms) ? d.rooms : [];
  if (d.selectedItemIds != null) {
    selectedItemIds = Array.isArray(d.selectedItemIds) ? d.selectedItemIds.map(String) : [];
  }
  // Selecting a room in the workspace panel has to open it up here as well -
  // otherwise a room picked from the list stays a closed box and there is no
  // way to see what is being changed inside it.
  if (d.activeRoomId !== undefined) selectedRoomId = d.activeRoomId ? String(d.activeRoomId) : null;
  if (d.fasciaEnabled != null) FASCIA_ENABLED = d.fasciaEnabled !== false;
  if (d.fasciaOption != null) FASCIA_OPTION = String(d.fasciaOption || 'classic');
  if (d.fasciaSignWidthM != null) FASCIA_SIGN_WIDTH_M = Math.max(0, parseFloat(d.fasciaSignWidthM) || 0);
  if (d.lightingPreset != null) {
    LIGHTING_PRESET = String(d.lightingPreset || 'exhibition');
    applyLightingPreset();
  }
  if (d.panelOverrides != null) panelOverrides = d.panelOverrides;
  if (d.frontSupportPositions != null) frontSupportPositions = Array.isArray(d.frontSupportPositions) ? d.frontSupportPositions : [];
  if (d.suppressedDefaultPositions != null) suppressedDefaultPositions = Array.isArray(d.suppressedDefaultPositions) ? d.suppressedDefaultPositions : [];
  if (d.invalidItemIds != null) invalidItemIds = new Set(Array.isArray(d.invalidItemIds) ? d.invalidItemIds.map(String) : []);
  if (d.pins   != null) pins = d.pins;
  if (d.pinMode != null) pinMode = d.pinMode;
  if (d.style != null) {
    columnStyle = d.style === 'maxima' ? 'maxima' : 'octa';
    document.querySelectorAll('#profile-toolbar button[data-prof]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.prof === columnStyle);
    });
  }
  PANELS_BACK = Math.max(1, Math.round(BW));
  PANELS_SIDE = Math.max(1, Math.round(BD));
  if (d.open != null) {
    const open = new Set(String(d.open).split(',').map(s=>s.trim()).filter(Boolean));
    wallsVisible = {
      back:  !open.has('back'),
      left:  !open.has('left'),
      right: !open.has('right'),
      front: !open.has('front'),
    };
  }
  camState.target = defaultTarget();
  updateCamera();
  buildBoothGeometry();
  renderAll();
  window.parent.postMessage({
    type: 'boothUpdateAck',
    width: BW,
    depth: BD,
    height: BH,
    selectedPartId: selectedKey,
  }, '*');
});

window.parent.postMessage({ type: 'boothRendererReady' }, '*');
