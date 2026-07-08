/* Migration note: moved workspace context creation, initial data loading, and public bootstrap helpers from admin_workspace_bootstrap.js. */

export async function loadWorkspaceData(ctx, {
  createDefaultSceneState,
  cloneValue,
  ensureStructure,
  normalizeScene,
  refreshVersionsAndActivity,
  localSceneStorageKey,
  defaultLocalStoragePrefix,
}) {
  if (!ctx.workspaceId) {
    const localScene = localStorage.getItem(localSceneStorageKey(ctx, defaultLocalStoragePrefix));
    let source = ctx.initialScene || createDefaultSceneState();
    if (localScene) {
      try {
        source = JSON.parse(localScene);
      } catch (_) {
        source = ctx.initialScene || createDefaultSceneState();
      }
    }
    ctx.sceneState = ensureStructure(normalizeScene(source));
    ctx.measurePoints = [];
    ctx.runtime.clearMeasurement?.();
    ctx.savedScene = cloneValue(ctx.sceneState);
    ctx.meta = { workspace: { id: null, name: 'Workspace Draft', status: 'draft', version: 1 }, client: null, exhibition: null };
    ctx.workspaceAssets = [];
    ctx.permissions = { can_edit: true, can_save: true };
    await refreshVersionsAndActivity(ctx);
    return;
  }

  const result = await ctx.api.loadWorkspace(ctx.workspaceId);
  ctx.meta = {
    workspace: result.workspace,
    client: result.client,
    exhibition: result.exhibition,
    review: result.review || null,
    subscription_request: result.subscription_request || null,
    subscription_checkout: result.subscription_checkout || null,
    bill: result.bill || null,
    bill_sent_at: result.bill_sent_at || null,
  };
  if (result.project_manager) ctx.meta.project_manager = result.project_manager;
  ctx.sceneState = ensureStructure(normalizeScene(result.scene));
  ctx.measurePoints = [];
  ctx.runtime.clearMeasurement?.();
  ctx.savedScene = cloneValue(ctx.sceneState);
  ctx.workspaceAssets = Array.isArray(result.assets) ? result.assets : [];
  ctx.versions = Array.isArray(result.versions) ? result.versions : [];
  ctx.permissions = result.permissions || { can_edit: true, can_save: true };
  await refreshVersionsAndActivity(ctx);
}

export async function loadCatalog(ctx, {
  defaultFurnitureCatalog,
  cloneValue,
  renderAssetsPanel,
}) {
  ctx.catalog = cloneValue(defaultFurnitureCatalog);
  if (ctx.activeTool === 'assets' && ctx.panelOpen) renderAssetsPanel(ctx);
}

export function createWorkspaceContext({
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
}) {
  return {
    ...findWorkspaceUi(),
    container,
    role,
    api,
    workspaceId: workspaceId ? Number(workspaceId) : null,
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
    catalog: [],
    workspaceAssets: [],
    versions: [],
    activities: [],
    versionComparison: null,
    versionCompareSelection: null,
    assetSearchTerm: '',
    renderedObjects: [],
    roomObjects: [],
    roomDraft: { width: 3, depth: 3, height: 2.4, hasDoor: true, hasCeiling: false, doorPosition: 'center' },
    sceneState: ensureStructure(normalizeScene(initialScene || createDefaultSceneState())),
    savedScene: null,
    dirty: false,
    saving: false,
    sendingToClient: false,
    eventsBound: false,
    selectedObjectId: null,
    selectedObjectType: null,
    measurePoints: [],
    meta: null,
    activeTool: 'assets',
    panelOpen: true,
    assetSearchEl: null,
    assetLibraryEl: null,
    selectionActionsEl: null,
    selectionActionsLabelEl: null,
    selectionActionsRotateEl: null,
    selectionActionsDeleteEl: null,
    dropHintEl: null,
    dragDropBound: false,
    dragDepth: 0,
    permissions: { can_edit: true, can_save: true },
  };
}

export async function initializeWorkspace(ctx, {
  ensureWorkspaceOverlays,
  wireDomEvents,
  bindTransformLifecycle,
  bindCanvasDragDrop,
  bindPanelInspector,
  handleCanvasPointer,
  loadWorkspaceDataFn,
  updateContextUi,
  renderShellScene,
  updateSelectionActions,
  updateDirtyUi,
  updateVersionUi,
  updateHelperUi,
  setPanelOpen,
  setActiveTool,
  loadCatalogFn,
}) {
  ensureWorkspaceOverlays(ctx);
  wireDomEvents(ctx);
  bindTransformLifecycle(ctx);
  bindCanvasDragDrop(ctx);
  bindPanelInspector?.(ctx);
  ctx.runtime.renderer.domElement.addEventListener('pointerdown', (event) => handleCanvasPointer(ctx, event));

  await loadWorkspaceDataFn(ctx);
  updateContextUi(ctx);
  renderShellScene(ctx);
  updateSelectionActions(ctx);
  updateDirtyUi(ctx);
  updateVersionUi(ctx);
  updateHelperUi(ctx);
  setPanelOpen(ctx, true);
  setActiveTool(ctx, 'assets', { open: true });
  await loadCatalogFn(ctx);
}

export function createWorkspacePublicApi(ctx, {
  onDestroy,
  loadWorkspaceDataFn,
  updateContextUi,
  renderShellScene,
  renderRightPanel,
  setDirty,
  addFurnitureById,
  addLightByCode,
  addLightToRail,
}) {
  return {
    destroy() {
      ctx.runtime.destroy();
      if (typeof onDestroy === 'function') onDestroy(ctx);
    },
    resize() {
      ctx.runtime.resize();
      ctx.runtime.focusOnBooth(ctx.sceneState.dims, ctx.sceneState.preview);
    },
    async save() {
      ctx.saveButton?.click();
    },
    async reload() {
      await loadWorkspaceDataFn(ctx);
      updateContextUi(ctx);
      renderShellScene(ctx);
      renderRightPanel(ctx);
      setDirty(ctx, false);
    },
    addFurnitureById(code, options = {}) {
      return addFurnitureById(ctx, code, options);
    },
    addLightByCode(code, options = {}) {
      return addLightByCode(ctx, code, options);
    },
    addLightToRail(type, options = {}) {
      return addLightToRail(ctx, type, options);
    },
  };
}

export function installWorkspaceGlobals(ctx, publicApi, { isActiveWorkspace }) {
  window.addFurnitureById = (code, options = {}) => {
    if (!isActiveWorkspace(ctx)) return null;
    return publicApi.addFurnitureById(code, options);
  };
  window.addLightByCode = (code, options = {}) => {
    if (!isActiveWorkspace(ctx)) return null;
    return publicApi.addLightByCode(code, options);
  };
  window.addLightToRail = (type, options = {}) => {
    if (!isActiveWorkspace(ctx)) return null;
    return publicApi.addLightToRail(type, options);
  };
}
