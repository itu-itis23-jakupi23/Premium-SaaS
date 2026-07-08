/* Migration note: moved primary workspace button handlers and keyboard shortcut logic from admin_workspace_bootstrap.js. */

export function createWorkspaceFormHandlers({
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
}) {
  async function onSaveClick(ctx) {
    if (!canEditWorkspace(ctx, { notify: true })) return;
    ctx.saving = true;
    updateDirtyUi(ctx);
    try {
      await persistWorkspaceScene(ctx);
    } catch (error) {
      window.alert(error.message || 'Save failed');
    } finally {
      ctx.saving = false;
      updateDirtyUi(ctx);
    }
  }

  async function onSendClick(ctx) {
    const sendState = getSendState(ctx);
    if (!sendState.allowed) {
      showWorkspaceToast(sendState.note || sendState.title || 'Sending is not available right now.');
      return;
    }

    ctx.sendingToClient = true;
    updateSendButtonUi(ctx);
    try {
      if (ctx.dirty) {
        ctx.saving = true;
        updateDirtyUi(ctx);
        try {
          await persistWorkspaceScene(ctx);
        } finally {
          ctx.saving = false;
          updateDirtyUi(ctx);
        }
      }

      const result = await ctx.sendWorkspace(ctx);
      await ctx.handleSendSuccess(ctx, result);
      updateContextUi(ctx);
      updateDirtyUi(ctx);
      updateSelectionActions(ctx);
      configureTransformControlsForSelection(ctx);
      updateVersionUi(ctx);
      renderRightPanel(ctx);
      refreshVersionsAndActivity(ctx).catch(() => {});
    } catch (error) {
      window.alert(error.message || 'Send failed');
    } finally {
      ctx.sendingToClient = false;
      updateSendButtonUi(ctx);
    }
  }

  function onDiscardClick(ctx) {
    if (!canEditWorkspace(ctx, { notify: true })) return;
    ctx.sceneState = ensureStructure(normalizeScene(ctx.savedScene || createDefaultSceneState()));
    ctx.measurePoints = [];
    ctx.runtime.clearMeasurement?.();
    renderShellScene(ctx);
    renderRightPanel(ctx);
    setDirty(ctx, false);
  }

  function onGridClick(ctx) {
    if (!canEditWorkspace(ctx, { notify: true })) return;
    ctx.sceneState.grid = !ctx.sceneState.grid;
    ctx.runtime.setGridVisible(ctx.sceneState.grid);
    updateHelperUi(ctx);
    setDirty(ctx, true);
  }

  function onPreviewClick(ctx) {
    if (!canEditWorkspace(ctx, { notify: true })) return;
    ctx.sceneState.preview = !ctx.sceneState.preview;
    ctx.runtime.focusOnBooth(ctx.sceneState.dims, ctx.sceneState.preview);
    updateHelperUi(ctx);
    setDirty(ctx, true);
  }

  async function onVersionsClick(ctx) {
    await refreshVersionsAndActivity(ctx);
    setActiveTool(ctx, 'versions', { open: true });
  }

  function onDocumentKeydown(ctx, event) {
    if (!getActiveWorkspace || getActiveWorkspace() !== ctx) return;
    const tag = String(event.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (!canEditWorkspace(ctx) && ['Delete', 'Backspace', 's', 'm', 'r', 't', 'S', 'M', 'R', 'T'].includes(event.key)) {
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      deleteSelection(ctx);
      return;
    }
    if (event.key.toLowerCase() === 's') {
      applyWorkspaceControls(ctx, { snap: !ctx.sceneState.snap }, { skipRender: true });
      if (ctx.activeTool === 'system') renderRightPanel(ctx);
      return;
    }
    if (event.key.toLowerCase() === 'm') {
      applyWorkspaceControls(ctx, { measure: !ctx.sceneState.measure }, { skipRender: false });
      if (ctx.activeTool === 'system') renderRightPanel(ctx);
      return;
    }
    if (!ctx.runtime?.transformControls) return;
    if (event.key.toLowerCase() === 'r') {
      ctx.runtime.transformControls.setMode('rotate');
      configureTransformControlsForSelection(ctx);
    }
    if (event.key.toLowerCase() === 't') {
      ctx.runtime.transformControls.setMode('translate');
      configureTransformControlsForSelection(ctx);
    }
  }

  return {
    onSaveClick,
    onSendClick,
    onDiscardClick,
    onGridClick,
    onPreviewClick,
    onVersionsClick,
    onDocumentKeydown,
  };
}
