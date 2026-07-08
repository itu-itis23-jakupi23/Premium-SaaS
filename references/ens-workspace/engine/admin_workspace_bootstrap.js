import { createSceneRuntime } from '/static/workspace/engine/scene_runtime.js?v=20260428-dark-scene';
import { createStructureLayout, mountBooth, renderFurniture, renderSiteObjects } from '/static/workspace/engine/booth_render_core.js?v=20260428-dark-scene';
import {
  normalizeDoorPosition,
  normalizeRoom,
  renderRooms,
  snapWallMountedModelToWalls,
} from '/static/js/room_render_core.js?v=20260413-room-grid-fix-5';
import {
  cloneValue,
  createDefaultSceneState,
  normalizeBranding,
  normalizeDims,
  normalizeOpenSides,
  normalizePermissions,
  normalizeQuote,
  normalizeScene,
} from '/static/workspace/engine/workspace_state.js?v=20260413-room-grid-fix-5';
import { createAdminWorkspaceApi } from '/static/workspace/engine/workspace_api.js?v=20260402-workspace-api-security';
import {
  cloneFurnitureCatalog,
  getFurnitureCatalogItemByCode,
  getFurnitureCatalogLabel,
} from '/static/workspace/furniture/furniture_catalog.js?v=20260412-room-system';
import {
  cloneLightsCatalog,
  getLightCatalogItemByCode,
  getLightCatalogItemByType,
  getLightCatalogLabel,
} from '/static/workspace/furniture/lights_catalog.js?v=20260329-light-catalog';
import { findWorkspaceUi } from '/static/workspace/engine/ui/selectors.js?v=20260404-workspace-dom-layer';
import { showWorkspaceToast } from '/static/workspace/engine/ui/toasts.js?v=20260404-admin-workspace-bootstrap-modules';
import {
  createWorkspacePanelController,
  createWorkspacePanelRenderers,
} from '/static/workspace/engine/ui/panels.js?v=20260413-door-position-fix';
import { createWorkspaceOverlayController } from '/static/workspace/engine/ui/modals.js?v=20260404-admin-workspace-bootstrap-modules';
import {
  canEditWorkspace,
  createWorkspaceVersionController,
  getSendState,
  localSceneStorageKey,
  persistWorkspaceScene,
  updateContextUi,
  updateDirtyUi,
  updateSendButtonUi,
  updateVersionUi,
} from '/static/workspace/engine/workspace/state_bridge.js?v=20260405-admin-workspace-bootstrap-modules';
import {
  createWorkspaceEventBindings,
  createWorkspaceRuntimeBindings,
} from '/static/workspace/engine/workspace/events.js?v=20260413-room-grid-fix-5';
import {
  createWorkspaceContext,
  createWorkspacePublicApi,
  initializeWorkspace,
  installWorkspaceGlobals,
  loadCatalog,
  loadWorkspaceData,
} from '/static/workspace/engine/workspace/init.js?v=20260413-room-grid-fix-5';

const DEFAULT_FURNITURE_CATALOG = [...cloneFurnitureCatalog(), ...cloneLightsCatalog()];
const DEFAULT_LOCAL_STORAGE_PREFIX = 'bdp_admin_workspace';
const LIGHTING_PRESETS = [
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'accent', label: 'Accent' },
  { value: 'spotlight', label: 'Spotlight' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'led', label: 'LED Strip' },
  { value: 'pendant', label: 'Pendant' },
];
const RAIL_LIGHT_LIMIT = 8;
const RAIL_LIGHT_PROFILE = Object.freeze({
  octanorm: Object.freeze({ fasciaRailDepth: 0.02, fasciaFrameBump: 0.02 }),
  maxima: Object.freeze({ fasciaRailDepth: 0.05, fasciaFrameBump: 0.016 }),
});
const FASCIA_OPTIONS = [
  { value: 'classic', label: 'Standard (2.0m)', price: 1200, minWidth: 2 },
  { value: 'full', label: 'Full Length', price: 1800, minWidth: 2 },
  { value: 'custom', label: 'Movetech Oval', price: 2500, minWidth: 3, requiresText: true },
];

let activeWorkspace = null;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function defaultAdminSendState(ctx) {
  const canSend = Boolean(ctx.workspaceId);
  const clientName = ctx.meta?.client?.full_name || 'client';
  return {
    allowed: canSend,
    title: canSend
      ? `Send this design to ${clientName} for review`
      : 'Save this workspace as a real client project before sending it to the client',
    ariaLabel: canSend ? `Send to ${clientName}` : 'Send to client',
    note: canSend
      ? `Ready to send the latest design to ${clientName}.`
      : 'Save this workspace as a real client project before sending it to the client.',
  };
}

async function defaultAdminSendWorkspace(ctx) {
  return ctx.api.sendWorkspaceToClient(ctx.workspaceId, {
    source: 'admin_portal',
  });
}

async function defaultAdminHandleSendSuccess(ctx, result) {
  ctx.meta = {
    ...(ctx.meta || {}),
    workspace: {
      ...(ctx.meta?.workspace || {}),
      ...(result.workspace || {}),
    },
    client: result.client || ctx.meta?.client || null,
    exhibition: result.exhibition || ctx.meta?.exhibition || null,
    review: result.review || ctx.meta?.review || null,
    subscription_request: result.subscription_request || ctx.meta?.subscription_request || null,
  };
  if (result.project_manager) ctx.meta.project_manager = result.project_manager;
  if (result.permissions) ctx.permissions = result.permissions;
  showWorkspaceToast(`Design sent to ${ctx.meta?.client?.full_name || 'client'}`);
}

function normalizeBoothStyle(value) {
  return String(value || '').trim().toLowerCase() === 'maxima' ? 'maxima' : 'octanorm';
}

function normalizeBuildMode(value) {
  return String(value || '').trim().toLowerCase() === 'yekpare' ? 'yekpare' : 'panel';
}

function normalizeLightingPreset(value) {
  const next = String(value || '').trim().toLowerCase();
  return LIGHTING_PRESETS.some((preset) => preset.value === next) ? next : 'exhibition';
}

function normalizeFasciaOption(value) {
  const next = String(value || '').trim().toLowerCase();
  if (next === 'standard') return 'classic';
  if (next === 'movetech' || next === 'oval') return 'custom';
  if (next === 'full-length' || next === 'full_length' || next === 'fullrail') return 'full';
  return FASCIA_OPTIONS.some((option) => option.value === next) ? next : 'classic';
}

function normalizeSnapStep(value) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0.1, Math.min(2, Number(next.toFixed(2)))) : 0.5;
}

function normalizeRotationSnap(value) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(1, Math.min(180, Math.round(next))) : 90;
}

function clampRailPosition(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0.5;
  return Math.max(0, Math.min(1, Number(next.toFixed(4))));
}

function isRailLightAsset(asset) {
  return String(asset?.objectKind || '').trim().toLowerCase() === 'light'
    || String(asset?.shape || '').trim().toLowerCase() === 'rail_light';
}

function isRailLightModel(model) {
  return String(model?.objectKind || '').trim().toLowerCase() === 'light'
    || String(model?.shape || '').trim().toLowerCase() === 'rail_light'
    || String(model?.lightType || model?.light_type || '').trim().length > 0;
}

function isWallMountedAsset(asset) {
  return Boolean(asset?.wallMounted || asset?.wall_mounted)
    || String(asset?.shape || '').trim().toLowerCase() === 'wall_shelf';
}

function isWallMountedModel(model) {
  return Boolean(model?.wallMounted || model?.wall_mounted)
    || String(model?.shape || '').trim().toLowerCase() === 'wall_shelf';
}

function getRailLightProfile(sceneState) {
  const boothStyle = normalizeBoothStyle(sceneState?.booth?.boothStyle);
  return RAIL_LIGHT_PROFILE[boothStyle] || RAIL_LIGHT_PROFILE.octanorm;
}

function getRailLightRailPositionFromWorldX(sceneState, x) {
  const width = Math.max(2, Number(sceneState?.dims?.width) || 6);
  return clampRailPosition((Number(x) + (width / 2)) / width);
}

function getRailLightWorldPosition(sceneState, railPosition = 0.5) {
  const width = Math.max(2, Number(sceneState?.dims?.width) || 6);
  const depth = Math.max(2, Number(sceneState?.dims?.depth) || 3);
  const height = Math.max(2.2, Number(sceneState?.dims?.height) || 2.48);
  const profile = getRailLightProfile(sceneState);
  const normalizedRailPosition = clampRailPosition(railPosition);
  return {
    x: Number((-width / 2 + (normalizedRailPosition * width)).toFixed(4)),
    y: Number(height.toFixed(4)),
    z: Number((depth / 2 + profile.fasciaFrameBump + (profile.fasciaRailDepth / 2)).toFixed(4)),
  };
}

function getDefaultRailLightTilt(model) {
  const lightType = String(model?.lightType || model?.light_type || '').trim().toLowerCase();
  const lightCatalogItem = getLightCatalogItemByType(lightType, DEFAULT_FURNITURE_CATALOG);
  return Number.isFinite(Number(model?.defaultTilt))
    ? Number(model.defaultTilt)
    : (lightCatalogItem?.defaultTilt ?? 0.28);
}

function getRailLightTilt(model) {
  const current = Number(model?.rotation?.x);
  return Number.isFinite(current) ? current : getDefaultRailLightTilt(model);
}

function normalizeRailLightRotation(rotation = {}, fallbackTilt = 0.28) {
  const x = Number(rotation.x);
  return {
    x: Number.isFinite(x) ? clamp(x, 0, 1.35) : clamp(Number(fallbackTilt), 0, 1.35),
    y: 0,
    z: 0,
  };
}

function stabilizeRailLightPlacement(ctx, model, options = {}) {
  const sceneState = ctx?.sceneState || ctx || {};
  const railPosition = options.railPosition != null
    ? clampRailPosition(options.railPosition)
    : (Number.isFinite(Number(model?.railPosition))
      ? clampRailPosition(model.railPosition)
      : getRailLightRailPositionFromWorldX(sceneState, model?.position?.x));
  model.railPosition = railPosition;
  model.position = getRailLightWorldPosition(sceneState, railPosition);
  model.rotation = normalizeRailLightRotation(model.rotation || {}, options.defaultTilt ?? getDefaultRailLightTilt(model));
}

function stabilizeSceneModelPlacement(ctx, model, options = {}) {
  if (isRailLightModel(model)) {
    stabilizeRailLightPlacement(ctx, model, options);
    return;
  }
  stabilizeFurniturePlacement(ctx, model, options);
}

function countRailLights(ctx) {
  return (ctx.sceneState?.models || []).filter((model) => isRailLightModel(model)).length;
}

function buildRailLightAsset(type = 'spot') {
  return getLightCatalogItemByType(type, DEFAULT_FURNITURE_CATALOG)
    || getLightCatalogItemByType('spot', DEFAULT_FURNITURE_CATALOG);
}

function getFasciaOptionMeta(value) {
  const key = normalizeFasciaOption(value);
  return FASCIA_OPTIONS.find((option) => option.value === key) || FASCIA_OPTIONS[0];
}

function ensureStructure(scene) {
  if (!Array.isArray(scene.panels) || !scene.panels.length || !Array.isArray(scene.columns) || !scene.columns.length) {
    const structure = createStructureLayout(scene.dims);
    scene.panels = structure.panels;
    scene.columns = structure.columns;
  }
  return scene;
}

function rebuildStructure(scene) {
  const structure = createStructureLayout(scene.dims);
  scene.panels = structure.panels;
  scene.columns = structure.columns;
  return scene;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getModelDimensions(model) {
  const size = model?.size || {};
  const scale = Math.max(0.05, Number(model?.scale) || 1);
  return {
    width: Math.max(0.05, (Number(size.width) || 1) * scale),
    depth: Math.max(0.05, (Number(size.depth) || 1) * scale),
    height: Math.max(0.05, (Number(size.height) || 1) * scale),
  };
}

function getModelFootprint(model) {
  const size = getModelDimensions(model);
  const rotationY = Number(model?.rotation?.y) || 0;
  const cos = Math.abs(Math.cos(rotationY));
  const sin = Math.abs(Math.sin(rotationY));
  return {
    halfWidth: Math.max(0.025, ((size.width * cos) + (size.depth * sin)) / 2),
    halfDepth: Math.max(0.025, ((size.width * sin) + (size.depth * cos)) / 2),
    height: size.height,
  };
}

function getModelBounds(model) {
  const footprint = getModelFootprint(model);
  const position = model?.position || {};
  const x = Number(position.x) || 0;
  const z = Number(position.z) || 0;
  return {
    left: x - footprint.halfWidth,
    right: x + footprint.halfWidth,
    back: z - footprint.halfDepth,
    front: z + footprint.halfDepth,
    halfWidth: footprint.halfWidth,
    halfDepth: footprint.halfDepth,
  };
}

function clampModelToBooth(model, dims) {
  const footprint = getModelFootprint(model);
  const maxX = Math.max(0, ((Number(dims.width) || 6) / 2) - footprint.halfWidth);
  const maxZ = Math.max(0, ((Number(dims.depth) || 3) / 2) - footprint.halfDepth);
  model.position.x = clamp(Number(model.position.x) || 0, -maxX, maxX);
  model.position.y = Math.max(0, Number(model.position.y) || 0);
  model.position.z = clamp(Number(model.position.z) || 0, -maxZ, maxZ);
}

function maybeSnapAxis(current, candidate, threshold, state) {
  const delta = Math.abs(current - candidate);
  if (delta <= threshold && delta < state.delta) {
    state.value = candidate;
    state.delta = delta;
  }
}

function applyFurnitureSnapping(model, dims, others = [], options = {}) {
  const threshold = Math.max(0.08, Number(options.threshold) || 0.18);
  const bounds = getModelBounds(model);
  const xState = { value: Number(model.position.x) || 0, delta: Number.POSITIVE_INFINITY };
  const zState = { value: Number(model.position.z) || 0, delta: Number.POSITIVE_INFINITY };
  const wallLeft = -((Number(dims.width) || 6) / 2) + bounds.halfWidth;
  const wallRight = ((Number(dims.width) || 6) / 2) - bounds.halfWidth;
  const wallBack = -((Number(dims.depth) || 3) / 2) + bounds.halfDepth;
  const wallFront = ((Number(dims.depth) || 3) / 2) - bounds.halfDepth;

  maybeSnapAxis(xState.value, 0, threshold, xState);
  maybeSnapAxis(zState.value, 0, threshold, zState);
  maybeSnapAxis(xState.value, wallLeft, threshold, xState);
  maybeSnapAxis(xState.value, wallRight, threshold, xState);
  maybeSnapAxis(zState.value, wallBack, threshold, zState);
  maybeSnapAxis(zState.value, wallFront, threshold, zState);

  others.forEach((other) => {
    if (!other || other.id === model.id) return;
    const otherBounds = getModelBounds(other);
    const lanePaddingX = Math.max(bounds.halfDepth, otherBounds.halfDepth) + 0.4;
    const lanePaddingZ = Math.max(bounds.halfWidth, otherBounds.halfWidth) + 0.4;
    const currentX = Number(model.position.x) || 0;
    const currentZ = Number(model.position.z) || 0;
    const otherX = Number(other.position?.x) || 0;
    const otherZ = Number(other.position?.z) || 0;

    if (Math.abs(currentZ - otherZ) <= lanePaddingX) {
      maybeSnapAxis(currentX, otherX, threshold, xState);
      maybeSnapAxis(currentX, otherBounds.left - bounds.halfWidth, threshold, xState);
      maybeSnapAxis(currentX, otherBounds.right + bounds.halfWidth, threshold, xState);
    }

    if (Math.abs(currentX - otherX) <= lanePaddingZ) {
      maybeSnapAxis(currentZ, otherZ, threshold, zState);
      maybeSnapAxis(currentZ, otherBounds.back - bounds.halfDepth, threshold, zState);
      maybeSnapAxis(currentZ, otherBounds.front + bounds.halfDepth, threshold, zState);
    }
  });

  if (Number.isFinite(xState.delta)) model.position.x = xState.value;
  if (Number.isFinite(zState.delta)) model.position.z = zState.value;
}

function resolveFurnitureCollision(model, dims, others = [], options = {}) {
  const padding = Math.max(0.02, Number(options.padding) || 0.05);
  let collided = false;
  for (let pass = 0; pass < 8; pass += 1) {
    let adjusted = false;
    const bounds = getModelBounds(model);
    for (const other of others) {
      if (!other || other.id === model.id) continue;
      if (
        isWallMountedModel(model)
        && isWallMountedModel(other)
        && model.wallId
        && model.wallId === other.wallId
        && Math.abs((Number(model.position?.y) || 0) - (Number(other.position?.y) || 0)) >= 0.45
      ) {
        continue;
      }
      const otherBounds = getModelBounds(other);
      const overlapX = Math.min(bounds.right, otherBounds.right) - Math.max(bounds.left, otherBounds.left);
      const overlapZ = Math.min(bounds.front, otherBounds.front) - Math.max(bounds.back, otherBounds.back);
      if (overlapX <= 0 || overlapZ <= 0) continue;
      collided = true;
      adjusted = true;
      if (overlapX <= overlapZ) {
        const direction = (Number(model.position.x) || 0) >= (Number(other.position?.x) || 0) ? 1 : -1;
        model.position.x += direction * (overlapX + padding);
      } else {
        const direction = (Number(model.position.z) || 0) >= (Number(other.position?.z) || 0) ? 1 : -1;
        model.position.z += direction * (overlapZ + padding);
      }
      clampModelToBooth(model, dims);
      break;
    }
    if (!adjusted) break;
  }
  return collided;
}

function stabilizeFurniturePlacement(ctx, model, options = {}) {
  if (!model?.position) model.position = { x: 0, y: 0, z: 0 };
  if (!model?.rotation) model.rotation = { x: 0, y: 0, z: 0 };
  const dims = ctx.sceneState?.dims || { width: 6, depth: 3, height: 2.48 };
  const others = (ctx.sceneState?.models || []).filter((entry) => entry && entry.id !== model.id);
  const wallMounted = isWallMountedModel(model);
  clampModelToBooth(model, dims);
  if (wallMounted) {
    model.wallMounted = true;
    snapWallMountedModelToWalls(model, ctx.sceneState);
    clampModelToBooth(model, dims);
  } else if (options.snap !== false) {
    applyFurnitureSnapping(model, dims, others, options);
    clampModelToBooth(model, dims);
  }
  if (!wallMounted) {
    resolveFurnitureCollision(model, dims, others, options);
  }
  clampModelToBooth(model, dims);
}

function draftModelFromMesh(sourceModel, mesh) {
  return {
    ...sourceModel,
    size: sourceModel?.size ? { ...sourceModel.size } : undefined,
    position: {
      x: Number(mesh?.position?.x) || 0,
      y: Math.max(0, Number(mesh?.position?.y) || 0),
      z: Number(mesh?.position?.z) || 0,
    },
    rotation: {
      x: Number(mesh?.rotation?.x) || 0,
      y: Number(mesh?.rotation?.y) || 0,
      z: Number(mesh?.rotation?.z) || 0,
    },
    scale: Number(mesh?.scale?.x) || Number(sourceModel?.scale) || 1,
    wallMounted: Boolean(sourceModel?.wallMounted || mesh?.userData?.wallMounted),
    wallId: sourceModel?.wallId || mesh?.userData?.wallId || null,
  };
}

function applyPlacementRulesToMesh(ctx, mesh, options = {}) {
  const model = ctx.sceneState.models.find((entry) => entry.id === mesh?.userData?.id);
  if (!model || !mesh) return null;
  const draft = draftModelFromMesh(model, mesh);
  if (isRailLightModel(model)) {
    draft.railPosition = getRailLightRailPositionFromWorldX(ctx.sceneState, draft.position.x);
    stabilizeRailLightPlacement(ctx, draft, options);
    mesh.position.set(draft.position.x, draft.position.y, draft.position.z);
    mesh.rotation.set(draft.rotation.x, 0, 0);
    mesh.userData.type = 'light';
    mesh.userData.railPosition = draft.railPosition;
    return draft;
  }
  stabilizeFurniturePlacement(ctx, draft, options);
  mesh.position.set(draft.position.x, draft.position.y, draft.position.z);
  if (isWallMountedModel(draft)) {
    mesh.rotation.set(0, Number(draft.rotation?.y) || 0, 0);
    mesh.userData.wallMounted = true;
    mesh.userData.wallId = draft.wallId || null;
  }
  return draft;
}

function configureTransformControlsForSelection(ctx) {
  const controls = ctx.runtime?.transformControls;
  if (!controls) return;
  controls.enabled = canEditWorkspace(ctx);
  if (!controls.enabled) {
    controls.showX = false;
    controls.showY = false;
    controls.showZ = false;
    return;
  }
  const mode = controls.getMode?.() || 'translate';
  const selectedIsLight = ctx.selectedObjectType === 'light' || controls.object?.userData?.type === 'light';
  if (selectedIsLight) {
    controls.showX = true;
    controls.showY = false;
    controls.showZ = false;
    if (controls.object) {
      const lightModel = getSelectedLight(ctx);
      if (lightModel) {
        const lockedPosition = getRailLightWorldPosition(ctx.sceneState, lightModel.railPosition ?? 0.5);
        const lockedRotation = normalizeRailLightRotation(controls.object.rotation || {}, getDefaultRailLightTilt(lightModel));
        controls.object.position.set(lockedPosition.x, lockedPosition.y, lockedPosition.z);
        controls.object.rotation.set(lockedRotation.x, 0, 0);
      }
    }
    return;
  }
  controls.showX = true;
  controls.showY = true;
  controls.showZ = true;
  if (mode === 'rotate' && ctx.selectedObjectType === 'furniture') {
    controls.showX = false;
    controls.showY = true;
    controls.showZ = false;
  }
  if (mode === 'translate' && controls.object && ctx.selectedObjectType === 'furniture') {
    const wallMounted = Boolean(controls.object.userData?.wallMounted);
    controls.object.position.y = Math.max(wallMounted ? 0.5 : 0, Number(controls.object.position.y) || 0);
  }
}

function clampSiteObjectToBooth(item, dims) {
  const width = Number(item.width) || 1.8;
  const halfWidth = Math.max(0.4, (Number(dims.width) || 6) / 2 - width / 2);
  const halfDepth = Math.max(0.2, (Number(dims.depth) || 3) / 2 - 0.18);
  item.position.x = clamp(Number(item.position.x) || 0, -halfWidth, halfWidth);
  item.position.y = clamp(Number(item.position.y) || 1.45, 0.3, Math.max(0.3, (Number(dims.height) || 2.48) - 0.15));
  item.position.z = clamp(Number(item.position.z) || 0, -halfDepth, halfDepth);
}

function nextSpawnPosition(scene, size, index) {
  const cols = Math.max(1, Math.floor((scene.dims.width || 6) / 1.5));
  const row = Math.floor(index / cols);
  const col = index % cols;
  const baseX = -scene.dims.width / 2 + 0.8 + col * 1.4;
  const baseZ = -scene.dims.depth / 2 + 0.8 + row * 1.4;
  return {
    x: clamp(baseX, -scene.dims.width / 2 + ((size.width || 1) / 2), scene.dims.width / 2 - ((size.width || 1) / 2)),
    y: 0,
    z: clamp(baseZ, -scene.dims.depth / 2 + ((size.depth || 1) / 2), scene.dims.depth / 2 - ((size.depth || 1) / 2)),
  };
}

function getLogoAsset(ctx) {
  const assetId = Number(ctx.sceneState.branding?.logoAssetId);
  if (!Number.isFinite(assetId) || assetId <= 0) return null;
  return ctx.workspaceAssets.find((asset) => Number(asset.id) === assetId) || null;
}

function attachSelection(ctx, mesh) {
  ctx.selectedObjectId = mesh?.userData?.id || null;
  ctx.selectedObjectType = mesh?.userData?.type || null;
  if (ctx.runtime.transformControls) {
    if (mesh) ctx.runtime.transformControls.attach(mesh);
    else ctx.runtime.transformControls.detach();
  }
  configureTransformControlsForSelection(ctx);
  updateSelectionActions(ctx);
}

function findRenderedObjectById(ctx, id) {
  return (ctx.renderedObjects || []).find((mesh) => mesh.userData?.id === id) || null;
}

function getSelectedSceneModel(ctx) {
  if (!['furniture', 'light'].includes(ctx.selectedObjectType) || !ctx.selectedObjectId) return null;
  return (ctx.sceneState.models || []).find((model) => model.id === ctx.selectedObjectId) || null;
}

function getSelectedTextObject(ctx) {
  if (ctx.selectedObjectType !== 'text' || !ctx.selectedObjectId) return null;
  return (ctx.sceneState.siteObjects || []).find((item) => item.id === ctx.selectedObjectId) || null;
}

function getSelectedFurniture(ctx) {
  const model = getSelectedSceneModel(ctx);
  return model && !isRailLightModel(model) ? model : null;
}

function getSelectedLight(ctx) {
  const model = getSelectedSceneModel(ctx);
  return isRailLightModel(model) ? model : null;
}

function droppedPosition(scene, size, point, index = 0, quantity = 1) {
  const safePoint = point || { x: 0, y: 0, z: 0 };
  if (quantity <= 1) {
    return {
      x: Number(safePoint.x) || 0,
      y: 0,
      z: Number(safePoint.z) || 0,
    };
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(quantity)));
  const row = Math.floor(index / cols);
  const col = index % cols;
  const spacingX = Math.max(0.75, Number(size?.width) || 1);
  const spacingZ = Math.max(0.75, Number(size?.depth) || 1);
  return {
    x: (Number(safePoint.x) || 0) + ((col - ((cols - 1) / 2)) * spacingX),
    y: 0,
    z: (Number(safePoint.z) || 0) + ((row - ((Math.ceil(quantity / cols) - 1) / 2)) * spacingZ),
  };
}

function createSceneModelFromAsset(ctx, asset, position, options = {}) {
  const code = String(asset.code || asset.id || asset.asset_id || '').trim();
  const isLight = isRailLightAsset(asset);
  const wallMounted = isWallMountedAsset(asset);
  const railPosition = isLight
    ? clampRailPosition(
      options.railPosition
        ?? asset.railPosition
        ?? (position ? getRailLightRailPositionFromWorldX(ctx.sceneState, position.x) : 0.5)
    )
    : null;
  const nextPosition = isLight
    ? getRailLightWorldPosition(ctx.sceneState, railPosition)
    : (position || nextSpawnPosition(ctx.sceneState, asset.size || {}, ctx.sceneState.models.length));
  if (wallMounted) {
    nextPosition.y = Math.max(0.5, Number(options.mountHeight ?? nextPosition.y) || 1.5);
  }
  return {
    id: `${asset.asset_id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    asset_id: asset.asset_id,
    code,
    name: asset.name,
    category: asset.category,
    type: asset.type || (isLight ? 'light' : 'asset'),
    shape: asset.shape || null,
    objectKind: asset.objectKind || (isLight ? 'light' : 'furniture'),
    lightType: asset.lightType || asset.light_type || null,
    railPosition,
    wallMounted,
    wallId: asset.wallId || asset.wall_id || null,
    dimensions: asset.dimensions ? cloneValue(asset.dimensions) : null,
    reference_image: asset.reference_image || asset.referenceImage || null,
    price: Number(asset.price || 0),
    color: asset.color || '#cbd5e1',
    glb_url: asset.glb_url || null,
    size: {
      width: Number(asset.size?.width) || 1,
      depth: Number(asset.size?.depth) || 1,
      height: Number(asset.size?.height) || 1,
    },
    position: nextPosition,
    rotation: isLight
      ? { x: Number(options.defaultTilt ?? asset.defaultTilt ?? getDefaultRailLightTilt(asset)) || 0.28, y: 0, z: 0 }
      : { x: 0, y: 0, z: 0 },
    scale: 1,
  };
}

function addModel(ctx, asset, options = {}) {
  if (!canEditWorkspace(ctx, { notify: true })) return null;
  const quantity = Math.max(1, Number(options.quantity) || 1);
  addAssetToScene(ctx, asset, quantity, options.placementPoint || null, options);
  return asset;
}

function addFurnitureById(ctx, code, options = {}) {
  const asset = getFurnitureCatalogItemByCode(code, ctx.catalog);
  if (!asset) return null;
  return addModel(ctx, asset, options);
}

function addLightByCode(ctx, code, options = {}) {
  if (ctx.sceneState?.booth?.fascia === false || ctx.sceneState?.booth?.openSides?.front === false) {
    showWorkspaceToast('Enable the front fascia to mount rail lights.');
    return null;
  }
  if (countRailLights(ctx) >= RAIL_LIGHT_LIMIT) {
    showWorkspaceToast(`Rail light limit reached (${RAIL_LIGHT_LIMIT})`);
    return null;
  }
  const asset = getLightCatalogItemByCode(code, ctx.catalog);
  if (!asset) return null;
  const railPosition = options.railPosition != null
    ? options.railPosition
    : (options.placementPoint ? getRailLightRailPositionFromWorldX(ctx.sceneState, options.placementPoint.x) : 0.5);
  return addModel(ctx, asset, {
    quantity: 1,
    placementPoint: options.placementPoint || null,
    railPosition,
    defaultTilt: options.defaultTilt ?? asset.defaultTilt,
  });
}

function addLightToRail(ctx, type = 'spot', options = {}) {
  const asset = getLightCatalogItemByType(type, ctx.catalog) || buildRailLightAsset(type);
  return asset ? addLightByCode(ctx, asset.code, options) : null;
}

function rotateSelectedFurniture(ctx) {
  if (!canEditWorkspace(ctx, { notify: true })) return;
  const selectedLight = getSelectedLight(ctx);
  if (selectedLight) {
    selectedLight.rotation = normalizeRailLightRotation(
      { ...(selectedLight.rotation || {}), x: getRailLightTilt(selectedLight) + (Math.PI / 18) },
      getDefaultRailLightTilt(selectedLight)
    );
    stabilizeRailLightPlacement(ctx, selectedLight);
    renderShellScene(ctx);
    renderRightPanel(ctx);
    setDirty(ctx, true);
    return;
  }
  const selected = getSelectedFurniture(ctx);
  if (!selected) return;
  selected.rotation = selected.rotation || { x: 0, y: 0, z: 0 };
  selected.rotation.y = (Number(selected.rotation.y) || 0) + (Math.PI / 2);
  stabilizeFurniturePlacement(ctx, selected, { snap: false, padding: 0.05 });
  renderShellScene(ctx);
  renderRightPanel(ctx);
  setDirty(ctx, true);
}

function renderShellScene(ctx) {
  ctx.runtime?.clearBoothPanelHighlight?.();
  if (ctx.runtime?.transformControls?.object?.userData?.isBoothPanel) {
    ctx.runtime.transformControls.detach();
  }
  const bpi = document.getElementById('boothPanelInspector');
  if (bpi) bpi.hidden = true;
  ctx._selectedBoothPanel = null;
  ensureStructure(ctx.sceneState);
  ctx.sceneState.booth.boothStyle = normalizeBoothStyle(ctx.sceneState.booth.boothStyle);
  ctx.sceneState.booth.buildMode = normalizeBuildMode(ctx.sceneState.booth.buildMode || ctx.sceneState.booth.mode);
  ctx.sceneState.booth.mode = ctx.sceneState.booth.buildMode;
  ctx.sceneState.booth.openSides = normalizeOpenSides(ctx.sceneState.booth.openSides);
  ctx.sceneState.booth.fasciaOption = normalizeFasciaOption(ctx.sceneState.booth.fasciaOption);
  ctx.sceneState.branding = normalizeBranding(ctx.sceneState.branding);
  ctx.sceneState.permissions = normalizePermissions(ctx.sceneState.permissions);
  ctx.sceneState.quote = normalizeQuote(ctx.sceneState.quote, ctx.sceneState.booth);
  ctx.sceneState.lightingPreset = normalizeLightingPreset(ctx.sceneState.lightingPreset);

  const logoAsset = getLogoAsset(ctx);
  mountBooth(ctx.runtime, {
    ...ctx.sceneState,
    signage: {
      enabled: ctx.sceneState.booth.fascia !== false,
      option: ctx.sceneState.booth.fasciaOption,
      text: ctx.sceneState.booth.fasciaText || 'Company Name',
    },
    branding: {
      ...ctx.sceneState.branding,
      text: ctx.sceneState.booth.fasciaText || 'Company Name',
      logoUrl: logoAsset?.url || null,
    },
  });
  ctx.roomObjects = renderRooms(ctx.runtime, {
    rooms: ctx.sceneState.rooms || [],
    boothStyle: ctx.sceneState.booth?.boothStyle,
    dims: ctx.sceneState.dims,
  });
  renderFurniture(ctx.runtime, {
    models: ctx.sceneState.models,
    dims: ctx.sceneState.dims,
  }).then((meshes) => {
    const textMeshes = renderSiteObjects(ctx.runtime, {
      siteObjects: ctx.sceneState.siteObjects,
    });
    ctx.renderedObjects = [...meshes, ...textMeshes];
    if (ctx.selectedObjectId) {
      const selected = findRenderedObjectById(ctx, ctx.selectedObjectId);
      attachSelection(ctx, selected);
    }
  });
  ctx.runtime.setLightingPreset?.(ctx.sceneState.lightingPreset);
  ctx.runtime.setGridVisible(ctx.sceneState.grid);
  ctx.runtime.setTransformSnap?.(ctx.sceneState.snap, ctx.sceneState.snapStep, ctx.sceneState.rotationSnap);
  ctx.runtime.focusOnBooth(ctx.sceneState.dims, ctx.sceneState.preview);
  if (ctx.sceneState.measure) ctx.runtime.setMeasurement?.(ctx.measurePoints || []);
  else ctx.runtime.clearMeasurement?.();
  document.body.dataset.boothStyle = ctx.sceneState.booth.boothStyle;
  updateHelperUi(ctx);
}

function syncModelFromMesh(ctx, mesh) {
  const model = (ctx.sceneState.models || []).find((entry) => entry.id === mesh?.userData?.id);
  if (!model || !mesh) return;
  if (isRailLightModel(model)) {
    model.railPosition = getRailLightRailPositionFromWorldX(ctx.sceneState, mesh.position.x);
    model.position = getRailLightWorldPosition(ctx.sceneState, model.railPosition);
    model.rotation = normalizeRailLightRotation(mesh.rotation || {}, getDefaultRailLightTilt(model));
    return;
  }
  model.position = {
    x: Number(mesh.position.x) || 0,
    y: Math.max(0, Number(mesh.position.y) || 0),
    z: Number(mesh.position.z) || 0,
  };
  model.rotation = {
    x: Number(mesh.rotation.x) || 0,
    y: Number(mesh.rotation.y) || 0,
    z: Number(mesh.rotation.z) || 0,
  };
  if (isWallMountedModel(model)) {
    snapWallMountedModelToWalls(model, ctx.sceneState);
  }
  clampModelToBooth(model, ctx.sceneState.dims);
}

function syncSiteObjectFromMesh(ctx, mesh) {
  const item = (ctx.sceneState.siteObjects || []).find((entry) => entry.id === mesh?.userData?.id);
  if (!item || !mesh) return;
  item.position = {
    x: Number(mesh.position.x) || 0,
    y: Number(mesh.position.y) || 1.45,
    z: Number(mesh.position.z) || 0,
  };
  item.rotation = {
    x: Number(mesh.rotation.x) || 0,
    y: Number(mesh.rotation.y) || 0,
    z: Number(mesh.rotation.z) || 0,
  };
  item.scale = Number(mesh.scale.x) || 1;
  clampSiteObjectToBooth(item, ctx.sceneState.dims);
}

function syncSelectedObjectFromMesh(ctx, mesh) {
  if (!mesh?.userData?.type) return;
  if (mesh.userData.type === 'text') {
    syncSiteObjectFromMesh(ctx, mesh);
    return;
  }
  syncModelFromMesh(ctx, mesh);
}

function setDirty(ctx, dirty = true) {
  ctx.dirty = dirty;
  updateDirtyUi(ctx);
  updateVersionUi(ctx);
}

function addAssetToScene(ctx, asset, quantity = 1, placementPoint = null, options = {}) {
  if (!canEditWorkspace(ctx, { notify: true })) return;
  const isLightAsset = isRailLightAsset(asset);
  const remainingLightSlots = isLightAsset ? Math.max(0, RAIL_LIGHT_LIMIT - countRailLights(ctx)) : 0;
  if (isLightAsset && remainingLightSlots <= 0) {
    showWorkspaceToast(`Rail light limit reached (${RAIL_LIGHT_LIMIT})`);
    return;
  }
  const insertCount = isLightAsset ? 1 : Math.max(1, Number(quantity) || 1);
  let lastInsertedId = null;
  for (let i = 0; i < insertCount; i += 1) {
    const position = isLightAsset
      ? placementPoint
      : (placementPoint
        ? droppedPosition(ctx.sceneState, asset.size || {}, placementPoint, i, insertCount)
        : nextSpawnPosition(ctx.sceneState, asset.size || {}, ctx.sceneState.models.length));
    const model = createSceneModelFromAsset(ctx, asset, position, options);
    stabilizeSceneModelPlacement(ctx, model, { snap: true, threshold: 0.22, padding: 0.06, railPosition: options.railPosition });
    ctx.sceneState.models.push(model);
    lastInsertedId = model.id;
  }
  ctx.selectedObjectId = lastInsertedId;
  const selectedModel = lastInsertedId ? ctx.sceneState.models.find((entry) => entry.id === lastInsertedId) : null;
  ctx.selectedObjectType = selectedModel ? (isRailLightModel(selectedModel) ? 'light' : 'furniture') : null;
  renderShellScene(ctx);
  renderRightPanel(ctx);
  setDirty(ctx, true);
}

function applyBoothStyle(ctx, style) {
  const next = normalizeBoothStyle(style);
  if (ctx.sceneState.booth.boothStyle === next) return next;
  ctx.sceneState.booth.boothStyle = next;
  renderShellScene(ctx);
  setDirty(ctx, true);
  return next;
}

function applyBuildMode(ctx, mode) {
  const next = normalizeBuildMode(mode);
  if (ctx.sceneState.booth.buildMode === next) return next;
  ctx.sceneState.booth.buildMode = next;
  ctx.sceneState.booth.mode = next;
  renderShellScene(ctx);
  setDirty(ctx, true);
  return next;
}

function applyLightingPreset(ctx, preset) {
  const next = normalizeLightingPreset(preset);
  if (ctx.sceneState.lightingPreset === next) return next;
  ctx.sceneState.lightingPreset = next;
  ctx.runtime.setLightingPreset?.(next);
  setDirty(ctx, true);
  return next;
}

function applyDims(ctx, patch = {}) {
  ctx.sceneState.dims = normalizeDims({ ...ctx.sceneState.dims, ...patch });
  rebuildStructure(ctx.sceneState);
  (ctx.sceneState.rooms || []).forEach((room) => clampRoomToBooth(ctx, room));
  ctx.sceneState.models.forEach((model) => stabilizeSceneModelPlacement(ctx, model, { snap: false }));
  renderShellScene(ctx);
  setDirty(ctx, true);
}

function applyOpenSides(ctx, nextOpenSides = {}) {
  ctx.sceneState.booth.openSides = normalizeOpenSides({ ...ctx.sceneState.booth.openSides, ...nextOpenSides });
  renderShellScene(ctx);
  setDirty(ctx, true);
}

function applyFasciaState(ctx, nextState = {}, options = {}) {
  ctx.sceneState.booth = {
    ...ctx.sceneState.booth,
    ...nextState,
    fasciaOption: normalizeFasciaOption(nextState.fasciaOption ?? ctx.sceneState.booth.fasciaOption),
  };
  if (!options.skipRender) renderShellScene(ctx);
  setDirty(ctx, true);
}

function applyBrandingState(ctx, nextState = {}, options = {}) {
  ctx.sceneState.branding = normalizeBranding({ ...ctx.sceneState.branding, ...nextState });
  if (!options.skipRender) renderShellScene(ctx);
  setDirty(ctx, true);
}

function applyPermissionState(ctx, nextState = {}) {
  ctx.sceneState.permissions = normalizePermissions({ ...ctx.sceneState.permissions, ...nextState });
  setDirty(ctx, true);
}

function applyQuoteState(ctx, nextState = {}) {
  ctx.sceneState.quote = normalizeQuote({ ...ctx.sceneState.quote, ...nextState }, ctx.sceneState.booth);
  setDirty(ctx, true);
}

function applyWorkspaceControls(ctx, nextState = {}, options = {}) {
  if (Object.prototype.hasOwnProperty.call(nextState, 'snap')) {
    ctx.sceneState.snap = Boolean(nextState.snap);
  }
  if (Object.prototype.hasOwnProperty.call(nextState, 'snapStep')) {
    ctx.sceneState.snapStep = normalizeSnapStep(nextState.snapStep);
  }
  if (Object.prototype.hasOwnProperty.call(nextState, 'rotationSnap')) {
    ctx.sceneState.rotationSnap = normalizeRotationSnap(nextState.rotationSnap);
  }
  if (Object.prototype.hasOwnProperty.call(nextState, 'measure')) {
    ctx.sceneState.measure = Boolean(nextState.measure);
    if (!ctx.sceneState.measure) {
      ctx.measurePoints = [];
      ctx.runtime.clearMeasurement?.();
    } else {
      attachSelection(ctx, null);
      ctx.runtime.setMeasurement?.(ctx.measurePoints || []);
    }
  }
  ctx.runtime.setTransformSnap?.(ctx.sceneState.snap, ctx.sceneState.snapStep, ctx.sceneState.rotationSnap);
  if (!options.skipRender) renderShellScene(ctx);
  setDirty(ctx, true);
}

function addTextObject(ctx, patch = {}) {
  const baseText = String(patch.text || patch.content || 'New Text').trim() || 'New Text';
  const item = {
    id: `text-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type: 'text',
    text: baseText,
    color: String(patch.color || '#4b5563'),
    fontSize: Math.max(18, Math.min(120, Math.round(Number(patch.fontSize) || 40))),
    width: Math.min(3.4, Math.max(1.2, (baseText.length || 1) * 0.12)),
    height: 0.48,
    position: patch.position || {
      x: 0,
      y: 1.45,
      z: -((Number(ctx.sceneState.dims.depth) || 3) / 2) + 0.12,
    },
    rotation: patch.rotation || { x: 0, y: 0, z: 0 },
    scale: Number(patch.scale) || 1,
  };
  clampSiteObjectToBooth(item, ctx.sceneState.dims);
  ctx.sceneState.siteObjects.push(item);
  ctx.selectedObjectId = item.id;
  ctx.selectedObjectType = 'text';
  renderShellScene(ctx);
  renderRightPanel(ctx);
  setDirty(ctx, true);
}

function getRoomDraft(ctx, patch = {}) {
  const source = {
    ...(ctx.roomDraft || {}),
    ...patch,
  };
  return {
    width: Math.max(1, Math.min(30, Math.round(Number(source.width) || 3))),
    depth: Math.max(1, Math.min(30, Math.round(Number(source.depth) || 3))),
    height: Math.max(1.8, Math.min(10, Number(Number(source.height) || 2.4))),
    hasDoor: source.hasDoor !== false,
    hasCeiling: Boolean(source.hasCeiling),
    doorPosition: normalizeDoorPosition(source.doorPosition),
  };
}

function clampRoomToBooth(ctx, room) {
  const normalized = normalizeRoom(room, 0, ctx.sceneState?.dims || {});
  room.width = normalized.width;
  room.depth = normalized.depth;
  room.height = normalized.height;
  room.position = { ...normalized.position };
  room.hasDoor = normalized.hasDoor;
  room.hasCeiling = normalized.hasCeiling;
  room.doorPosition = normalized.doorPosition;
}

function addRoomAtPoint(ctx, point = null, options = {}) {
  if (!canEditWorkspace(ctx, { notify: true })) return null;
  const draft = getRoomDraft(ctx, options);
  ctx.roomDraft = draft;
  const safePoint = point || { x: 0, z: 0 };
  const room = normalizeRoom({
    ...draft,
    id: `room-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    position: {
      x: Number(safePoint.x) || 0,
      y: 0,
      z: Number(safePoint.z) || 0,
    },
  }, (ctx.sceneState.rooms || []).length, ctx.sceneState?.dims || {});
  clampRoomToBooth(ctx, room);
  ctx.sceneState.rooms = Array.isArray(ctx.sceneState.rooms) ? ctx.sceneState.rooms : [];
  ctx.sceneState.rooms.push(room);
  attachSelection(ctx, null);
  renderShellScene(ctx);
  renderRightPanel(ctx);
  setDirty(ctx, true);
  return room;
}

function updateRoom(ctx, roomId, patch = {}) {
  if (!canEditWorkspace(ctx, { notify: true })) return null;
  const rooms = Array.isArray(ctx.sceneState.rooms) ? ctx.sceneState.rooms : [];
  const roomIndex = rooms.findIndex((entry) => entry.id === roomId);
  if (roomIndex < 0) return null;
  const existing = rooms[roomIndex];
  const merged = {
    ...existing,
    ...patch,
    position: {
      ...(existing.position || {}),
      ...(patch.position || {}),
    },
  };
  rooms[roomIndex] = normalizeRoom(merged, roomIndex, ctx.sceneState?.dims || {});
  renderShellScene(ctx);
  renderRightPanel(ctx);
  setDirty(ctx, true);
  return rooms[roomIndex];
}

function removeLastRoom(ctx) {
  if (!canEditWorkspace(ctx, { notify: true })) return null;
  if (!Array.isArray(ctx.sceneState.rooms) || !ctx.sceneState.rooms.length) return null;
  const removed = ctx.sceneState.rooms.pop();
  renderShellScene(ctx);
  renderRightPanel(ctx);
  setDirty(ctx, true);
  return removed;
}

function downloadSceneSnapshot(ctx) {
  const payload = JSON.stringify(ctx.sceneState, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const baseName = String(ctx.meta?.workspace?.name || 'workspace-draft')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'workspace-draft';
  anchor.href = url;
  anchor.download = `${baseName}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

const formatMoney = (amount = 0, currency = 'USD') => {
  const safeCurrency = String(currency || 'USD').toUpperCase();
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `${safeCurrency} ${value.toFixed(Number.isInteger(value) ? 0 : 2)}`;
};

const formatDateTime = (value) => {
  if (!value) return '';
  const stamp = new Date(value);
  return Number.isNaN(stamp.getTime()) ? '' : stamp.toLocaleString();
};

const getFasciaConstraints = (ctx, meta) => {
  const notes = [];
  if (ctx.sceneState.booth.fascia === false) {
    notes.push('Fascia disabled');
    return notes;
  }
  const width = Number(ctx.sceneState.dims?.width);
  if (meta?.minWidth && Number.isFinite(width) && width < meta.minWidth) {
    notes.push(`Requires width >= ${meta.minWidth}m`);
  }
  if (meta?.requiresText && !(ctx.sceneState.booth?.fasciaText || '').trim()) {
    notes.push('Requires company name');
  }
  return notes;
};

const buildQuoteSummary = (ctx) => {
  const currency = ctx.sceneState.quote.currency || 'USD';
  const grouped = new Map();
  (ctx.sceneState.models || []).forEach((model) => {
    const key = String(model.code || model.asset_id || model.id || model.name || 'Furniture');
    const existing = grouped.get(key) || {
      key,
      label: model.code ? `${model.code} - ${model.name || 'Furniture'}` : (model.name || 'Furniture'),
      qty: 0,
      unit_price: Number.isFinite(Number(model.price)) ? Number(model.price) : 0,
      currency,
      category: model.category || 'Furniture',
    };
    existing.qty += 1;
    grouped.set(key, existing);
  });
  const lines = Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label));
  const fasciaMeta = getFasciaOptionMeta(ctx.sceneState.booth.fasciaOption);
  if (ctx.sceneState.booth.fascia !== false) {
    lines.push({
      key: `fascia-${fasciaMeta.value}`,
      label: `Fascia: ${fasciaMeta.label}`,
      qty: 1,
      unit_price: Number(fasciaMeta.price) || 0,
      currency,
      isFascia: true,
    });
  }
  const subtotal = lines.reduce((sum, line) => sum + ((Number(line.unit_price) || 0) * (Number(line.qty) || 0)), 0);
  const vatRate = Number(ctx.sceneState.quote.vatRate) || 0;
  const vatAmount = ctx.sceneState.quote.includeVat ? subtotal * vatRate : 0;
  return { lines, subtotal, vatAmount, grandTotal: subtotal + vatAmount, currency };
};

const workspaceVersionController = createWorkspaceVersionController({
  cloneValue,
  ensureStructure,
  normalizeScene,
  renderShellScene,
  setDirty,
  defaultLocalStoragePrefix: DEFAULT_LOCAL_STORAGE_PREFIX,
});

const {
  ensureWorkspaceOverlays,
  setCanvasDropState,
  updateSelectionActions,
} = createWorkspaceOverlayController({
  canEditWorkspace,
  getSelectedSceneModel,
  isRailLightModel,
  rotateSelectedFurniture,
  deleteSelection,
});

let renderRightPanel = () => {};

const workspacePanelRenderers = createWorkspacePanelRenderers({
  escapeHtml,
  formatMoney,
  formatDateTime,
  getFurnitureCatalogLabel,
  cloneLightsCatalog,
  getLightCatalogLabel,
  LIGHTING_PRESETS,
  FASCIA_OPTIONS,
  RAIL_LIGHT_LIMIT,
  canEditWorkspace,
  setCanvasDropState,
  addModel,
  addRoomAtPoint,
  updateRoom,
  removeLastRoom,
  addLightByCode,
  deleteSelection,
  applyLightingPreset,
  renderRightPanel: (ctx) => renderRightPanel(ctx),
  clampRailPosition,
  stabilizeRailLightPlacement,
  renderShellScene,
  setDirty,
  getSelectedLight,
  getRailLightTilt,
  getDefaultRailLightTilt,
  normalizeRailLightRotation,
  countRailLights,
  addTextObject,
  getSelectedTextObject,
  normalizeOpenSides,
  normalizePermissions,
  normalizeBoothStyle,
  normalizeBuildMode,
  normalizeSnapStep,
  normalizeRotationSnap,
  applyBoothStyle,
  applyBuildMode,
  applyDims,
  applyOpenSides,
  applyPermissionState,
  applyQuoteState,
  applyWorkspaceControls,
  normalizeBranding,
  normalizeFasciaOption,
  getFasciaOptionMeta,
  getLogoAsset,
  getFasciaConstraints,
  applyFasciaState,
  applyBrandingState,
  buildQuoteSummary,
  refreshVersionsAndActivity: (ctx) => workspaceVersionController.refreshVersionsAndActivity(ctx),
  showWorkspaceToast,
  updateContextUi,
  saveVersionSnapshot: (ctx, label) => workspaceVersionController.saveVersionSnapshot(ctx, label),
  clearVersionSnapshots: (ctx) => workspaceVersionController.clearVersionSnapshots(ctx),
  restoreVersionSnapshot: (ctx, versionId) => workspaceVersionController.restoreVersionSnapshot(ctx, versionId),
});

const {
  updateHelperUi,
  setPanelOpen,
  renderRightPanel: renderWorkspacePanel,
  setActiveTool,
} = createWorkspacePanelController({
  downloadSceneSnapshot,
  renderAssetsPanel: workspacePanelRenderers.renderAssetsPanel,
  renderBillPanel: workspacePanelRenderers.renderBillPanel,
  renderRoomPanel: workspacePanelRenderers.renderRoomPanel,
  renderLightingPanel: workspacePanelRenderers.renderLightingPanel,
  renderTextPanel: workspacePanelRenderers.renderTextPanel,
  renderSystemPanel: workspacePanelRenderers.renderSystemPanel,
  renderFasciaPanel: workspacePanelRenderers.renderFasciaPanel,
  renderVersionsPanel: workspacePanelRenderers.renderVersionsPanel,
});

renderRightPanel = renderWorkspacePanel;

const persistWorkspaceSceneBridge = (ctx) => persistWorkspaceScene(ctx, {
  cloneValue,
  setDirty,
  defaultLocalStoragePrefix: DEFAULT_LOCAL_STORAGE_PREFIX,
});

const loadWorkspaceDataBridge = (ctx) => loadWorkspaceData(ctx, {
  createDefaultSceneState,
  cloneValue,
  ensureStructure,
  normalizeScene,
  refreshVersionsAndActivity: (workspaceCtx) => workspaceVersionController.refreshVersionsAndActivity(workspaceCtx),
  localSceneStorageKey,
  defaultLocalStoragePrefix: DEFAULT_LOCAL_STORAGE_PREFIX,
});

const loadCatalogBridge = (ctx) => loadCatalog(ctx, {
  defaultFurnitureCatalog: DEFAULT_FURNITURE_CATALOG,
  cloneValue,
  renderAssetsPanel: workspacePanelRenderers.renderAssetsPanel,
});

const { wireDomEvents } = createWorkspaceEventBindings({
  getActiveWorkspace: () => activeWorkspace,
  setActiveTool,
  setPanelOpen,
  canEditWorkspace,
  updateDirtyUi,
  persistWorkspaceScene: persistWorkspaceSceneBridge,
  getSendState,
  showWorkspaceToast,
  updateSendButtonUi,
  updateContextUi,
  updateSelectionActions,
  configureTransformControlsForSelection,
  updateVersionUi,
  renderRightPanel,
  refreshVersionsAndActivity: (ctx) => workspaceVersionController.refreshVersionsAndActivity(ctx),
  ensureStructure,
  normalizeScene,
  createDefaultSceneState,
  renderShellScene,
  setDirty,
  updateHelperUi,
  applyWorkspaceControls,
  deleteSelection,
});

const workspaceRuntimeBindings = createWorkspaceRuntimeBindings({
  canEditWorkspace,
  setCanvasDropState,
  addModel,
  attachSelection,
  renderRightPanel,
  setDirty,
  applyPlacementRulesToMesh,
  getRailLightRailPositionFromWorldX,
  syncSelectedObjectFromMesh,
  renderShellScene,
  addRoomAtPoint,
});

// Kept local because the extracted overlay, panel, and DOM binding controllers still share this hook.
function deleteSelection(ctx) {
  if (!canEditWorkspace(ctx, { notify: true })) return;
  if (!ctx.selectedObjectId) return;
  const modelBefore = ctx.sceneState.models.length;
  const textBefore = ctx.sceneState.siteObjects.length;
  ctx.sceneState.models = ctx.sceneState.models.filter((model) => model.id !== ctx.selectedObjectId);
  ctx.sceneState.siteObjects = ctx.sceneState.siteObjects.filter((item) => item.id !== ctx.selectedObjectId);
  attachSelection(ctx, null);
  if (ctx.sceneState.models.length !== modelBefore || ctx.sceneState.siteObjects.length !== textBefore) {
    renderShellScene(ctx);
    renderRightPanel(ctx);
    setDirty(ctx, true);
  }
}

export async function mountWorkspaceEditor({
  containerId = 'three-container',
  workspaceId = null,
  role = 'admin',
  initialScene = null,
  api,
  sendIdleLabel = 'Send to client',
  sendBusyLabel = 'Sending...',
  resolveSendState = defaultAdminSendState,
  sendWorkspace = defaultAdminSendWorkspace,
  handleSendSuccess = defaultAdminHandleSendSuccess,
  onEditBlocked = null,
  onContextUpdated = null,
  localStoragePrefix = DEFAULT_LOCAL_STORAGE_PREFIX,
} = {}) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  if (activeWorkspace && activeWorkspace.container === container) {
    activeWorkspace.runtime?.resize();
    renderRightPanel(activeWorkspace);
    return activeWorkspace.publicApi;
  }

  const runtime = createSceneRuntime(container);
  if (!runtime) return null;

  const ctx = createWorkspaceContext({
    container,
    role,
    api,
    workspaceId,
    initialScene,
    localStoragePrefix,
    sendIdleLabel,
    sendBusyLabel,
    resolveSendState,
    sendWorkspace,
    handleSendSuccess,
    onEditBlocked,
    onContextUpdated,
    runtime,
  }, {
    findWorkspaceUi,
    createDefaultSceneState,
    ensureStructure,
    normalizeScene,
  });

  activeWorkspace = ctx;
  try {
    await initializeWorkspace(ctx, {
      ensureWorkspaceOverlays,
      wireDomEvents,
      bindTransformLifecycle: workspaceRuntimeBindings.bindTransformLifecycle,
      bindCanvasDragDrop: workspaceRuntimeBindings.bindCanvasDragDrop,
      bindPanelInspector: workspaceRuntimeBindings.bindPanelInspector,
      handleCanvasPointer: workspaceRuntimeBindings.handleCanvasPointer,
      loadWorkspaceDataFn: loadWorkspaceDataBridge,
      updateContextUi,
      renderShellScene,
      updateSelectionActions,
      updateDirtyUi,
      updateVersionUi,
      updateHelperUi,
      setPanelOpen,
      setActiveTool,
      loadCatalogFn: loadCatalogBridge,
    });
  } catch (error) {
    runtime.destroy?.();
    if (activeWorkspace === ctx) activeWorkspace = null;
    throw error;
  }

  const publicApi = createWorkspacePublicApi(ctx, {
    onDestroy(destroyedCtx) {
      if (activeWorkspace === destroyedCtx) activeWorkspace = null;
    },
    loadWorkspaceDataFn: loadWorkspaceDataBridge,
    updateContextUi,
    renderShellScene,
    renderRightPanel,
    setDirty,
    addFurnitureById,
    addLightByCode,
    addLightToRail,
  });

  ctx.publicApi = publicApi;
  installWorkspaceGlobals(ctx, publicApi, {
    isActiveWorkspace(candidate) {
      return activeWorkspace === candidate;
    },
  });
  return publicApi;
}

export async function mountAdminWorkspace(options = {}) {
  const { baseUrl = '', api = createAdminWorkspaceApi(baseUrl), ...rest } = options;
  return mountWorkspaceEditor({
    api,
    sendIdleLabel: 'Send to client',
    sendBusyLabel: 'Sending...',
    resolveSendState: defaultAdminSendState,
    sendWorkspace: defaultAdminSendWorkspace,
    handleSendSuccess: defaultAdminHandleSendSuccess,
    localStoragePrefix: DEFAULT_LOCAL_STORAGE_PREFIX,
    ...rest,
  });
}
