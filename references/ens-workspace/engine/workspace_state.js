import {
  normalizeDoorPosition,
  snapRoomPosition,
} from '/static/js/room_render_core.js?v=20260413-room-grid-fix-5';

export const DEFAULT_DIMS = Object.freeze({
  width: 6,
  depth: 3,
  height: 2.48,
});

export const DEFAULT_OPEN_SIDES = Object.freeze({
  front: true,
  back: false,
  left: false,
  right: false,
});

export const DEFAULT_PERMISSIONS = Object.freeze({
  managerQuotes: true,
  managerAssets: true,
  managerLogs: true,
});

export const DEFAULT_BRANDING = Object.freeze({
  mode: 'text',
  scope: 'front',
  logoAssetId: null,
});

export const DEFAULT_QUOTE = Object.freeze({
  currency: 'USD',
  includeVat: false,
  vatRate: 0.2,
  billingStatus: 'draft',
});

const LIGHTING_PRESETS = new Set(['neutral', 'exhibition', 'accent', 'spotlight', 'ambient', 'led', 'pendant']);
const BRANDING_MODES = new Set(['text', 'logo', 'logo_text']);
const BRANDING_SCOPES = new Set(['front', 'all_visible']);
const BOOTH_STYLES = new Set(['octanorm', 'maxima']);
const BUILD_MODES = new Set(['panel', 'yekpare']);
const FASCIA_OPTIONS = new Set(['classic', 'full', 'custom']);
const SITE_OBJECT_TYPES = new Set(['text']);

export function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeDims(raw = {}) {
  const width = Number(raw.width);
  const depth = Number(raw.depth);
  const height = Number(raw.height);

  return {
    width: Number.isFinite(width) ? Math.max(2, Number(width.toFixed(2))) : DEFAULT_DIMS.width,
    depth: Number.isFinite(depth) ? Math.max(2, Number(depth.toFixed(2))) : DEFAULT_DIMS.depth,
    height: Number.isFinite(height) ? Math.max(2.2, Number(height.toFixed(2))) : DEFAULT_DIMS.height,
  };
}

export function normalizeOpenSides(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    front: Boolean(safe.front ?? DEFAULT_OPEN_SIDES.front),
    back: Boolean(safe.back ?? DEFAULT_OPEN_SIDES.back),
    left: Boolean(safe.left ?? DEFAULT_OPEN_SIDES.left),
    right: Boolean(safe.right ?? DEFAULT_OPEN_SIDES.right),
  };
}

export function normalizePermissions(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    managerQuotes: Boolean(safe.managerQuotes ?? DEFAULT_PERMISSIONS.managerQuotes),
    managerAssets: Boolean(safe.managerAssets ?? DEFAULT_PERMISSIONS.managerAssets),
    managerLogs: Boolean(safe.managerLogs ?? DEFAULT_PERMISSIONS.managerLogs),
  };
}

export function normalizeBranding(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const mode = String(safe.mode || safe.brandingMode || DEFAULT_BRANDING.mode).toLowerCase();
  const scope = String(safe.scope || safe.brandingScope || DEFAULT_BRANDING.scope).toLowerCase();
  const logoAssetId = Number(safe.logoAssetId ?? safe.logo_asset_id);
  return {
    mode: BRANDING_MODES.has(mode) ? mode : DEFAULT_BRANDING.mode,
    scope: BRANDING_SCOPES.has(scope) ? scope : DEFAULT_BRANDING.scope,
    logoAssetId: Number.isFinite(logoAssetId) && logoAssetId > 0 ? logoAssetId : null,
  };
}

export function normalizeQuote(raw = {}, booth = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const boothSafe = booth && typeof booth === 'object' ? booth : {};
  const currency = String(safe.currency || boothSafe.currency || DEFAULT_QUOTE.currency).toUpperCase();
  const vatRate = Number(safe.vatRate ?? boothSafe.vatRate);
  const billingStatus = String(safe.billingStatus || boothSafe.billingStatus || DEFAULT_QUOTE.billingStatus).toLowerCase();
  return {
    currency: ['USD', 'EUR', 'GBP', 'TRY'].includes(currency) ? currency : DEFAULT_QUOTE.currency,
    includeVat: Boolean(safe.includeVat ?? boothSafe.includeVat ?? DEFAULT_QUOTE.includeVat),
    vatRate: Number.isFinite(vatRate) ? Math.max(0, Math.min(1, Number(vatRate.toFixed(4)))) : DEFAULT_QUOTE.vatRate,
    billingStatus: ['draft', 'issued', 'paid'].includes(billingStatus) ? billingStatus : DEFAULT_QUOTE.billingStatus,
  };
}

export function createDefaultSceneState() {
  return {
    dims: { ...DEFAULT_DIMS },
    booth: {
      openSides: { ...DEFAULT_OPEN_SIDES },
      fascia: true,
      fasciaOption: 'classic',
      fasciaText: 'Company Name',
      buildMode: 'panel',
      mode: 'panel',
      boothStyle: 'octanorm',
    },
    branding: { ...DEFAULT_BRANDING },
    quote: { ...DEFAULT_QUOTE },
    permissions: { ...DEFAULT_PERMISSIONS },
    panels: [],
    columns: [],
    rooms: [],
    models: [],
    siteObjects: [],
    items: [],
    view: 'Perspective',
    lightingPreset: 'exhibition',
    grid: true,
    preview: false,
    snap: true,
    snapStep: 0.5,
    rotationSnap: 90,
    measure: false,
    roomPositionMode: 'snapped',
  };
}

function normalizeModelDimensions(raw = {}, size = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const normalized = {};
  const width = Number(safe.width ?? safe.diameter ?? ((Number(size.width) || 0) * 100));
  const depth = Number(safe.depth ?? safe.width ?? safe.diameter ?? ((Number(size.depth) || 0) * 100));
  const height = Number(safe.height ?? ((Number(size.height) || 0) * 100));
  const diameter = safe.diameter == null || safe.diameter === '' ? Number.NaN : Number(safe.diameter);

  if (Number.isFinite(width) && width > 0) normalized.width = Number(width.toFixed(2));
  if (Number.isFinite(depth) && depth > 0) normalized.depth = Number(depth.toFixed(2));
  if (Number.isFinite(height) && height > 0) normalized.height = Number(height.toFixed(2));
  if (Number.isFinite(diameter) && diameter > 0) normalized.diameter = Number(diameter.toFixed(2));
  return normalized;
}

function normalizeModel(raw = {}, index = 0) {
  const position = raw.position && typeof raw.position === 'object' ? raw.position : {};
  const rotation = raw.rotation && typeof raw.rotation === 'object' ? raw.rotation : {};
  const size = raw.size && typeof raw.size === 'object' ? raw.size : {};
  const scale = Number(raw.scale);
  const price = Number(raw.price);
  const code = String(raw.code || raw.id || raw.asset_id || raw.assetId || '').trim();
  const type = String(raw.type || (raw.shape ? 'parametric' : 'asset')).trim().toLowerCase();
  const shape = String(raw.shape || '').trim().toLowerCase();
  const referenceImage = raw.reference_image || raw.referenceImage || raw.reference_image_path || null;
  const objectKind = String(raw.objectKind || raw.object_kind || (shape === 'rail_light' ? 'light' : 'furniture')).trim().toLowerCase();
  const lightType = String(raw.lightType || raw.light_type || '').trim().toLowerCase() || null;
  const railPosition = Number(raw.railPosition ?? raw.rail_position);
  const wallMounted = Boolean(raw.wallMounted || raw.wall_mounted || shape === 'wall_shelf');
  const minSize = wallMounted ? 0.03 : 0.2;

  return {
    id: String(raw.id || `model-${index + 1}`),
    asset_id: String(raw.asset_id || raw.assetId || code || raw.type || `asset-${index + 1}`),
    code,
    name: String(raw.name || raw.asset_id || raw.assetId || `Item ${index + 1}`),
    category: String(raw.category || 'Furniture'),
    type: type || 'asset',
    shape: shape || null,
    objectKind: objectKind || 'furniture',
    lightType,
    railPosition: Number.isFinite(railPosition) ? Math.max(0, Math.min(1, Number(railPosition.toFixed(4)))) : null,
    wallMounted,
    wallId: raw.wallId || raw.wall_id || null,
    dimensions: normalizeModelDimensions(raw.dimensions, size),
    reference_image: referenceImage ? String(referenceImage) : null,
    price: Number.isFinite(price) ? Number(price.toFixed(2)) : 0,
    color: String(raw.color || '#cbd5e1'),
    glb_url: raw.glb_url || raw.glbUrl || null,
    size: {
      width: Math.max(minSize, Number(size.width) || 1),
      depth: Math.max(minSize, Number(size.depth) || 1),
      height: Math.max(minSize, Number(size.height) || 1),
    },
    position: {
      x: Number(position.x) || 0,
      y: Number(position.y) || 0,
      z: Number(position.z) || 0,
    },
    rotation: {
      x: Number(rotation.x) || 0,
      y: Number(rotation.y) || 0,
      z: Number(rotation.z) || 0,
    },
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
  };
}

function normalizeRoom(raw = {}, index = 0, dims = DEFAULT_DIMS, options = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const position = safe.position && typeof safe.position === 'object' ? safe.position : {};
  const width = Number(safe.width);
  const depth = Number(safe.depth);
  const height = Number(safe.height);
  const roomWidth = Number.isFinite(width) ? Math.max(1, Math.min(30, Number(width.toFixed(3)))) : 3;
  const roomDepth = Number.isFinite(depth) ? Math.max(1, Math.min(30, Number(depth.toFixed(3)))) : 3;
  const roomHeight = Number.isFinite(height) ? Math.max(1.8, Math.min(10, Number(height.toFixed(3)))) : 2.4;
  const positionMode = String(safe.positionMode || safe.position_mode || '').toLowerCase();
  const preservePosition = Boolean(options?.preservePosition)
    || positionMode === 'exact'
    || safe.snap === false;
  return {
    id: String(safe.id || `room-${index + 1}`),
    width: roomWidth,
    depth: roomDepth,
    height: roomHeight,
    position: preservePosition
      ? clampRoomPosition(position, { width: roomWidth, depth: roomDepth }, dims)
      : snapRoomPosition(position, { width: roomWidth, depth: roomDepth }, dims),
    positionMode: preservePosition ? 'exact' : 'snapped',
    hasDoor: safe.hasDoor !== false,
    hasCeiling: Boolean(safe.hasCeiling),
    doorPosition: normalizeDoorPosition(safe.doorPosition),
  };
}

function clampRoomPosition(position = {}, dimensions = {}, dims = DEFAULT_DIMS) {
  const width = Number(dimensions.width) || 3;
  const depth = Number(dimensions.depth) || 3;
  const boothWidth = Math.max(1, Number(dims?.width) || DEFAULT_DIMS.width);
  const boothDepth = Math.max(1, Number(dims?.depth) || DEFAULT_DIMS.depth);
  const maxX = Math.max(0, (boothWidth - width) / 2);
  const maxZ = Math.max(0, (boothDepth - depth) / 2);
  const rawX = Number(position.x) || 0;
  const rawZ = Number(position.z) || 0;
  return {
    x: Number(Math.min(maxX, Math.max(-maxX, rawX)).toFixed(4)),
    y: 0,
    z: Number(Math.min(maxZ, Math.max(-maxZ, rawZ)).toFixed(4)),
  };
}

function normalizeSiteObject(raw = {}, index = 0) {
  const position = raw.position && typeof raw.position === 'object' ? raw.position : {};
  const rotation = raw.rotation && typeof raw.rotation === 'object' ? raw.rotation : {};
  const scale = Number(raw.scale);
  const fontSize = Number(raw.fontSize ?? raw.font_size);
  const width = Number(raw.width);
  const height = Number(raw.height);
  const type = String(raw.type || 'text').toLowerCase();
  const text = String(raw.text || raw.content || `Text ${index + 1}`);

  return {
    id: String(raw.id || `text-${index + 1}`),
    type: SITE_OBJECT_TYPES.has(type) ? type : 'text',
    text,
    color: String(raw.color || '#4b5563'),
    fontSize: Number.isFinite(fontSize) ? Math.max(18, Math.min(120, Math.round(fontSize))) : 40,
    width: Number.isFinite(width) ? Math.max(0.8, Number(width.toFixed(3))) : Math.min(3.4, Math.max(1.2, text.length * 0.12)),
    height: Number.isFinite(height) ? Math.max(0.2, Number(height.toFixed(3))) : 0.48,
    position: {
      x: Number(position.x) || 0,
      y: Number(position.y) || 1.45,
      z: Number(position.z) || 0,
    },
    rotation: {
      x: Number(rotation.x) || 0,
      y: Number(rotation.y) || 0,
      z: Number(rotation.z) || 0,
    },
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
  };
}

export function normalizeScene(scene = {}) {
  const base = createDefaultSceneState();
  const safe = scene && typeof scene === 'object' ? scene : {};
  const booth = safe.booth && typeof safe.booth === 'object' ? safe.booth : {};
  const branding = safe.branding && typeof safe.branding === 'object'
    ? safe.branding
    : (booth.branding && typeof booth.branding === 'object' ? booth.branding : {});
  const quote = safe.quote && typeof safe.quote === 'object'
    ? safe.quote
    : (booth.quote && typeof booth.quote === 'object' ? booth.quote : {});
  const permissions = safe.permissions && typeof safe.permissions === 'object'
    ? safe.permissions
    : (booth.permissions && typeof booth.permissions === 'object' ? booth.permissions : {});
  const boothStyle = String(booth.boothStyle || base.booth.boothStyle).toLowerCase();
  const buildMode = String(booth.buildMode || booth.mode || base.booth.buildMode).toLowerCase();
  const fasciaOption = String(booth.fasciaOption || booth.fasciaMode || base.booth.fasciaOption).toLowerCase();
  const snapStep = Number(safe.snapStep ?? safe.snap_step);
  const rotationSnap = Number(safe.rotationSnap ?? safe.rotation_snap);
  const dims = normalizeDims(safe.dims);
  const roomPositionMode = String(safe.roomPositionMode || safe.room_position_mode || '').toLowerCase();
  const preserveRoomPositions = roomPositionMode === 'exact';

  return {
    ...base,
    dims,
    booth: {
      ...base.booth,
      ...booth,
      openSides: normalizeOpenSides(booth.openSides),
      boothStyle: BOOTH_STYLES.has(boothStyle) ? boothStyle : base.booth.boothStyle,
      fasciaText: String(booth.fasciaText || base.booth.fasciaText),
      fasciaOption: FASCIA_OPTIONS.has(fasciaOption) ? fasciaOption : base.booth.fasciaOption,
      buildMode: BUILD_MODES.has(buildMode) ? buildMode : base.booth.buildMode,
      mode: BUILD_MODES.has(buildMode) ? buildMode : base.booth.mode,
      fascia: booth.fascia !== false,
    },
    branding: normalizeBranding(branding),
    quote: normalizeQuote(quote, booth),
    permissions: normalizePermissions(permissions),
    panels: Array.isArray(safe.panels) ? cloneValue(safe.panels) : [],
    columns: Array.isArray(safe.columns) ? cloneValue(safe.columns) : [],
    rooms: Array.isArray(safe.rooms)
      ? safe.rooms.map((room, index) => normalizeRoom(room, index, dims, { preservePosition: preserveRoomPositions }))
      : [],
    models: Array.isArray(safe.models) ? safe.models.map(normalizeModel) : [],
    siteObjects: Array.isArray(safe.siteObjects) ? safe.siteObjects.map(normalizeSiteObject) : [],
    items: Array.isArray(safe.items) ? cloneValue(safe.items) : [],
    view: safe.view === 'Top' ? 'Top' : 'Perspective',
    lightingPreset: LIGHTING_PRESETS.has(String(safe.lightingPreset || '').toLowerCase())
      ? String(safe.lightingPreset).toLowerCase()
      : base.lightingPreset,
    grid: safe.grid !== false,
    preview: Boolean(safe.preview),
    snap: safe.snap !== false,
    snapStep: Number.isFinite(snapStep) ? Math.max(0.1, Math.min(2, Number(snapStep.toFixed(2)))) : base.snapStep,
    rotationSnap: Number.isFinite(rotationSnap) ? Math.max(1, Math.min(180, Math.round(rotationSnap))) : base.rotationSnap,
    measure: Boolean(safe.measure),
    roomPositionMode: preserveRoomPositions ? 'exact' : base.roomPositionMode,
  };
}
