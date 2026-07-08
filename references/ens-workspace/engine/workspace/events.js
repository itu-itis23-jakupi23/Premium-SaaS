/* Migration note: moved workspace DOM event registration plus canvas drag-drop, pointer, and transform lifecycle bindings from admin_workspace_bootstrap.js. */

import { bindOnce } from '/static/workspace/engine/ui/bindings.js?v=20260404-workspace-dom-layer';
import { createWorkspaceFormHandlers } from '/static/workspace/engine/ui/forms.js?v=20260404-admin-workspace-bootstrap-modules';
import { toggleDoorFromObject } from '/static/js/room_render_core.js?v=20260413-room-grid-fix-5';

export function createWorkspaceEventBindings({
  getActiveWorkspace,
  setActiveTool,
  setPanelOpen,
  canEditWorkspace,
  updateDirtyUi,
  persistWorkspaceScene,
  getSendState,
  showWorkspaceToast,
  updateSendButtonUi,
  updateContextUi,
  updateSelectionActions,
  configureTransformControlsForSelection,
  updateVersionUi,
  renderRightPanel,
  refreshVersionsAndActivity,
  ensureStructure,
  normalizeScene,
  createDefaultSceneState,
  renderShellScene,
  setDirty,
  updateHelperUi,
  applyWorkspaceControls,
  deleteSelection,
}) {
  const handlers = createWorkspaceFormHandlers({
    getActiveWorkspace,
    canEditWorkspace,
    updateDirtyUi,
    persistWorkspaceScene,
    getSendState,
    showWorkspaceToast,
    updateSendButtonUi,
    updateContextUi,
    updateSelectionActions,
    configureTransformControlsForSelection,
    updateVersionUi,
    renderRightPanel,
    refreshVersionsAndActivity,
    ensureStructure,
    normalizeScene,
    createDefaultSceneState,
    renderShellScene,
    setDirty,
    updateHelperUi,
    applyWorkspaceControls,
    deleteSelection,
    setActiveTool,
  });

  function getActiveCtx() {
    return getActiveWorkspace();
  }

  function wireDomEvents(ctx) {
    if (ctx.eventsBound) return;
    ctx.eventsBound = true;

    ctx.toolButtons.forEach((button) => {
      // Deduplicated listener: persistent tool buttons can be rebound when the workspace editor remounts.
      bindOnce(button, 'click', `workspace-tool:${button.dataset.workspaceTool}`, () => {
        const activeCtx = getActiveCtx();
        if (!activeCtx) return;
        setActiveTool(activeCtx, button.dataset.workspaceTool);
      });
    });

    // Deduplicated listener: the shared panel close button persists across workspace remounts.
    bindOnce(ctx.panelCloseButton, 'click', 'workspace-panel-close', () => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      setPanelOpen(activeCtx, false);
    });

    // Deduplicated listener: the shared save button persists across workspace remounts.
    bindOnce(ctx.saveButton, 'click', 'workspace-save', async () => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      await handlers.onSaveClick(activeCtx);
    });

    // Deduplicated listener: the shared send button persists across workspace remounts.
    bindOnce(ctx.sendButton, 'click', 'workspace-send', async () => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      await handlers.onSendClick(activeCtx);
    });

    // Deduplicated listener: the shared discard button persists across workspace remounts.
    bindOnce(ctx.discardButton, 'click', 'workspace-discard', () => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      handlers.onDiscardClick(activeCtx);
    });

    // Deduplicated listener: the shared grid toggle persists across workspace remounts.
    bindOnce(ctx.gridButton, 'click', 'workspace-grid', () => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      handlers.onGridClick(activeCtx);
    });

    bindOnce(ctx.camPerspectiveButton, 'click', 'workspace-cam-perspective', () => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      activeCtx.runtime?.setCameraView?.('perspective', activeCtx.sceneState?.dims);
    });
    bindOnce(ctx.camTopButton, 'click', 'workspace-cam-top', () => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      activeCtx.runtime?.setCameraView?.('top', activeCtx.sceneState?.dims);
    });
    bindOnce(ctx.camFrontButton, 'click', 'workspace-cam-front', () => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      activeCtx.runtime?.setCameraView?.('front', activeCtx.sceneState?.dims);
    });

    // Deduplicated listener: the shared preview toggle persists across workspace remounts.
    bindOnce(ctx.previewButton, 'click', 'workspace-preview', () => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      handlers.onPreviewClick(activeCtx);
    });

    // Deduplicated listener: the shared versions button persists across workspace remounts.
    bindOnce(ctx.versionsButton, 'click', 'workspace-versions', async () => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      await handlers.onVersionsClick(activeCtx);
    });

    // Deduplicated listener: the document-level keyboard handler must stay single-instance across remounts.
    bindOnce(document, 'keydown', 'workspace-document-keydown', (event) => {
      const activeCtx = getActiveCtx();
      if (!activeCtx) return;
      handlers.onDocumentKeydown(activeCtx, event);
    });
  }

  return { wireDomEvents };
}

function fmtDim(meters) {
  if (meters >= 1) return `${meters.toFixed(2)} m`;
  if (meters >= 0.01) return `${(meters * 100).toFixed(0)} cm`;
  return `${Math.round(meters * 1000)} mm`;
}

function hexFromColor(color) {
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function showPanelInspector(ctx, mesh) {
  const ud = mesh?.userData;
  if (!ud?.isBoothPanel) { hidePanelInspector(ctx); return; }
  const el = document.getElementById('boothPanelInspector');
  if (!el) return;
  const typeLabels = { slab: 'Wall Panel', rail: 'H-Rail', upright: 'Upright' };
  const wallLabels = { back: 'Back', front: 'Front', left: 'Left', right: 'Right' };
  const titleEl = el.querySelector('#bpiTitle');
  if (titleEl) titleEl.textContent = typeLabels[ud.panelType] || 'Panel';
  const tbody = el.querySelector('#bpiTableBody');
  if (tbody) {
    const rows = [
      ['Wall', wallLabels[ud.wallSide] || '—'],
      ud.sectionIndex !== undefined ? ['Section', `#${ud.sectionIndex + 1}`] : null,
      ud.railPos ? ['Rail', ud.railPos === 'top' ? 'Top' : 'Bottom'] : null,
      ud.dims?.width  ? ['W', fmtDim(ud.dims.width)]  : null,
      ud.dims?.height ? ['H', fmtDim(ud.dims.height)] : null,
      ud.dims?.depth  ? ['D', fmtDim(ud.dims.depth)]  : null,
    ].filter(Boolean);
    tbody.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  }
  const colorInput = el.querySelector('#bpiColorInput');
  if (colorInput && mesh.material?.color) {
    colorInput.value = hexFromColor(mesh.material.color);
  }
  const hideBtn = el.querySelector('#bpiHideBtn');
  if (hideBtn) hideBtn.textContent = mesh.visible ? 'Hide' : 'Show';
  el.hidden = false;
  ctx._selectedBoothPanel = mesh;
  if (ctx.runtime?.transformControls) {
    ctx.runtime.transformControls.attach(mesh);
    ctx.runtime.transformControls.setMode?.('translate');
  }
  const moveBtn = el.querySelector('#bpiMoveBtn');
  const rotBtn = el.querySelector('#bpiRotateBtn');
  if (moveBtn) moveBtn.classList.add('active');
  if (rotBtn) rotBtn.classList.remove('active');
}

function hidePanelInspector(ctx) {
  const el = document.getElementById('boothPanelInspector');
  if (el) el.hidden = true;
  ctx.runtime?.clearBoothPanelHighlight?.();
  if (ctx._selectedBoothPanel && ctx.runtime?.transformControls?.object === ctx._selectedBoothPanel) {
    ctx.runtime.transformControls.detach();
  }
  ctx._selectedBoothPanel = null;
}

export function createWorkspaceRuntimeBindings({
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
}) {
  function bindCanvasDragDrop(ctx) {
    const dropTarget = ctx.runtime?.renderer?.domElement;
    if (!dropTarget || ctx.dragDropBound) return;
    ctx.dragDropBound = true;
    ctx.dragDepth = 0;

    const readDraggedAsset = (event) => {
      const assetId = event.dataTransfer?.getData('application/x-bdp-asset')
        || event.dataTransfer?.getData('text/plain')
        || '';
      if (!assetId) return null;
      const asset = ctx.catalog.find((entry) => entry.asset_id === assetId);
      if (!asset) return null;
      const quantity = Math.max(1, Number(event.dataTransfer?.getData('application/x-bdp-qty')) || 1);
      return { asset, quantity };
    };

    dropTarget.addEventListener('dragenter', (event) => {
      if (!readDraggedAsset(event)) return;
      event.preventDefault();
      ctx.dragDepth += 1;
      setCanvasDropState(ctx, true);
    });

    dropTarget.addEventListener('dragover', (event) => {
      if (!readDraggedAsset(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setCanvasDropState(ctx, true);
    });

    dropTarget.addEventListener('dragleave', (event) => {
      if (!readDraggedAsset(event)) return;
      event.preventDefault();
      ctx.dragDepth = Math.max(0, (ctx.dragDepth || 1) - 1);
      if (!ctx.dragDepth) setCanvasDropState(ctx, false);
    });

    dropTarget.addEventListener('drop', (event) => {
      const dragged = readDraggedAsset(event);
      if (!dragged) return;
      if (!canEditWorkspace(ctx, { notify: true })) return;
      event.preventDefault();
      ctx.dragDepth = 0;
      setCanvasDropState(ctx, false);
      const point = ctx.runtime.pickGroundPoint?.(event.clientX, event.clientY);
      if (!point) return;
      addModel(ctx, dragged.asset, { quantity: dragged.quantity, placementPoint: point });
    });
  }

  function handleCanvasPointer(ctx, event) {
    if (!ctx.runtime || ctx.runtime.transformControls?.dragging) return;
    if (ctx.sceneState.measure) {
      const point = ctx.runtime.pickGroundPoint?.(event.clientX, event.clientY);
      if (!point) return;
      const points = Array.isArray(ctx.measurePoints) ? [...ctx.measurePoints] : [];
      if (points.length >= 2) points.length = 0;
      points.push(point);
      ctx.measurePoints = points;
      ctx.runtime.setMeasurement?.(ctx.measurePoints);
      setDirty(ctx, true);
      return;
    }
    if (ctx.activeTool === 'room') {
      const point = ctx.runtime.pickGroundPoint?.(event.clientX, event.clientY);
      if (!point) return;
      addRoomAtPoint(ctx, point);
      return;
    }
    const interactiveObjects = [
      ...(ctx.renderedObjects || []),
      ...(ctx.roomObjects || []),
    ];
    if (!interactiveObjects.length) return;
    const canvas = ctx.runtime.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const mouse = new window.THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new window.THREE.Raycaster();
    raycaster.setFromCamera(mouse, ctx.runtime.camera);
    const hits = raycaster.intersectObjects(interactiveObjects, true);
    if (!hits.length) {
      attachSelection(ctx, null);
      const panelMesh = ctx.runtime?.pickBoothPanel?.(event.clientX, event.clientY);
      if (panelMesh) {
        ctx.runtime.highlightBoothPanel(panelMesh);
        showPanelInspector(ctx, panelMesh);
      } else {
        hidePanelInspector(ctx);
      }
      if (ctx.activeTool === 'text' || ctx.activeTool === 'lighting') renderRightPanel(ctx);
      return;
    }
    hidePanelInspector(ctx);
    if (toggleDoorFromObject(hits[0].object)) {
      return;
    }
    let picked = hits[0].object;
    while (picked && !ctx.renderedObjects.includes(picked) && picked.parent) picked = picked.parent;
    attachSelection(ctx, ctx.renderedObjects.includes(picked) ? picked : null);
    if (ctx.activeTool === 'text' && picked?.userData?.type === 'text') renderRightPanel(ctx);
    if (ctx.activeTool === 'lighting') renderRightPanel(ctx);
  }

  function bindTransformLifecycle(ctx) {
    if (!ctx.runtime?.transformControls) return;
    ctx.runtime.transformControls.addEventListener('objectChange', () => {
      if (!canEditWorkspace(ctx)) return;
      const object = ctx.runtime.transformControls.object;
      if (object?.userData?.isBoothPanel) return;
      const objectType = object?.userData?.type || ctx.selectedObjectType;
      if (!object || !['furniture', 'light'].includes(objectType)) return;
      const mode = ctx.runtime.transformControls.getMode?.() || 'translate';
      if (objectType === 'light') {
        applyPlacementRulesToMesh(ctx, object, { railPosition: getRailLightRailPositionFromWorldX(ctx.sceneState, object.position.x) });
        return;
      }
      if (mode === 'translate') {
        applyPlacementRulesToMesh(ctx, object, { snap: true, threshold: 0.18, padding: 0.05 });
      }
    });
    ctx.runtime.transformControls.addEventListener('dragging-changed', (event) => {
      if (ctx.runtime.controls) ctx.runtime.controls.enabled = !event.value;
      if (!canEditWorkspace(ctx)) return;
      if (!event.value && ctx.runtime.transformControls.object) {
        const object = ctx.runtime.transformControls.object;
        if (object?.userData?.isBoothPanel) {
          setDirty(ctx, true);
          return;
        }
        const objectType = object?.userData?.type || ctx.selectedObjectType;
        if (objectType === 'light') {
          applyPlacementRulesToMesh(ctx, object, {
            railPosition: getRailLightRailPositionFromWorldX(ctx.sceneState, object.position.x),
          });
        } else if (objectType === 'furniture') {
          applyPlacementRulesToMesh(ctx, object, { snap: true, threshold: 0.18, padding: 0.05 });
        }
        syncSelectedObjectFromMesh(ctx, object);
        renderShellScene(ctx);
        renderRightPanel(ctx);
        setDirty(ctx, true);
      }
    });
  }

  function bindPanelInspector(ctx) {
    const el = document.getElementById('boothPanelInspector');
    if (!el || el._bpibound) return;
    el._bpibound = true;

    el.querySelector('#bpiClose')?.addEventListener('click', () => hidePanelInspector(ctx));

    el.querySelector('#bpiMoveBtn')?.addEventListener('click', () => {
      if (!ctx._selectedBoothPanel || !ctx.runtime?.transformControls) return;
      ctx.runtime.transformControls.setMode('translate');
      el.querySelector('#bpiMoveBtn')?.classList.add('active');
      el.querySelector('#bpiRotateBtn')?.classList.remove('active');
    });

    el.querySelector('#bpiRotateBtn')?.addEventListener('click', () => {
      if (!ctx._selectedBoothPanel || !ctx.runtime?.transformControls) return;
      ctx.runtime.transformControls.setMode('rotate');
      el.querySelector('#bpiRotateBtn')?.classList.add('active');
      el.querySelector('#bpiMoveBtn')?.classList.remove('active');
    });

    el.querySelector('#bpiColorInput')?.addEventListener('input', (e) => {
      const mesh = ctx._selectedBoothPanel;
      if (!mesh?.material?.color) return;
      mesh.material.color.set(e.target.value);
    });

    el.querySelector('#bpiHideBtn')?.addEventListener('click', () => {
      const mesh = ctx._selectedBoothPanel;
      if (!mesh) return;
      mesh.visible = !mesh.visible;
      const btn = el.querySelector('#bpiHideBtn');
      if (btn) btn.textContent = mesh.visible ? 'Hide' : 'Show';
    });

    el.querySelector('#bpiResetBtn')?.addEventListener('click', () => {
      const mesh = ctx._selectedBoothPanel;
      if (!mesh?.userData?.baseColor || !mesh.material?.color) return;
      mesh.material.color.set(mesh.userData.baseColor);
      mesh.visible = true;
      const colorInput = el.querySelector('#bpiColorInput');
      if (colorInput) colorInput.value = hexFromColor(mesh.material.color);
      const hideBtn = el.querySelector('#bpiHideBtn');
      if (hideBtn) hideBtn.textContent = 'Hide';
    });
  }

  return {
    bindCanvasDragDrop,
    handleCanvasPointer,
    bindTransformLifecycle,
    bindPanelInspector,
    showPanelInspector,
    hidePanelInspector,
  };
}
