/* Migration note: moved selection overlay and canvas drop-hint UI wiring from admin_workspace_bootstrap.js. */

export function createWorkspaceOverlayController({
  canEditWorkspace,
  getSelectedSceneModel,
  isRailLightModel,
  rotateSelectedFurniture,
  deleteSelection,
}) {
  function ensureWorkspaceOverlays(ctx) {
    if (ctx.selectionActionsEl && ctx.dropHintEl) return;

    const selection = document.createElement('div');
    selection.style.cssText = [
      'position:absolute',
      'top:14px',
      'left:50%',
      'transform:translateX(-50%)',
      'display:none',
      'align-items:center',
      'gap:8px',
      'padding:8px 10px',
      'border:0.5px solid var(--border)',
      'border-radius:999px',
      'background:rgba(255,255,255,0.96)',
      'box-shadow:var(--shadow)',
      'backdrop-filter:blur(10px)',
      'z-index:6',
      'pointer-events:auto',
    ].join(';');
    selection.innerHTML = `
      <span data-role="label" style="font-size:12px;font-weight:600;color:var(--text1);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></span>
      <button type="button" data-action="rotate" style="border:none;border-radius:999px;background:var(--accent-light);color:var(--accent);padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;">Rotate</button>
      <button type="button" data-action="delete" style="border:none;border-radius:999px;background:rgba(255,59,48,0.12);color:var(--danger);padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;">Delete</button>
    `;
    selection.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      if (button.dataset.action === 'rotate') {
        rotateSelectedFurniture(ctx);
        return;
      }
      if (button.dataset.action === 'delete') {
        deleteSelection(ctx);
      }
    });

    const dropHint = document.createElement('div');
    dropHint.style.cssText = [
      'position:absolute',
      'inset:16px',
      'display:none',
      'align-items:center',
      'justify-content:center',
      'border:1.5px dashed rgba(0,113,227,0.45)',
      'border-radius:18px',
      'background:rgba(0,113,227,0.07)',
      'color:var(--accent)',
      'font-size:13px',
      'font-weight:600',
      'letter-spacing:0.01em',
      'pointer-events:none',
      'z-index:5',
    ].join(';');
    dropHint.textContent = 'Drop furniture into the booth';

    ctx.container.appendChild(dropHint);
    ctx.container.appendChild(selection);

    ctx.selectionActionsEl = selection;
    ctx.selectionActionsLabelEl = selection.querySelector('[data-role="label"]');
    ctx.selectionActionsRotateEl = selection.querySelector('[data-action="rotate"]');
    ctx.selectionActionsDeleteEl = selection.querySelector('[data-action="delete"]');
    ctx.dropHintEl = dropHint;
  }

  function setCanvasDropState(ctx, active) {
    if (!ctx.dropHintEl) return;
    ctx.dropHintEl.style.display = active ? 'flex' : 'none';
  }

  function updateSelectionActions(ctx) {
    if (!ctx.selectionActionsEl || !ctx.selectionActionsLabelEl) return;
    const selected = getSelectedSceneModel(ctx);
    if (!selected) {
      ctx.selectionActionsEl.style.display = 'none';
      return;
    }
    ctx.selectionActionsLabelEl.textContent = selected.name || 'Selected furniture';
    const editable = canEditWorkspace(ctx);
    if (ctx.selectionActionsRotateEl) {
      ctx.selectionActionsRotateEl.textContent = isRailLightModel(selected) ? 'Tilt' : 'Rotate';
      ctx.selectionActionsRotateEl.disabled = !editable;
      ctx.selectionActionsRotateEl.style.opacity = editable ? '1' : '0.45';
      ctx.selectionActionsRotateEl.style.cursor = editable ? 'pointer' : 'default';
    }
    if (ctx.selectionActionsDeleteEl) {
      ctx.selectionActionsDeleteEl.disabled = !editable;
      ctx.selectionActionsDeleteEl.style.opacity = editable ? '1' : '0.45';
      ctx.selectionActionsDeleteEl.style.cursor = editable ? 'pointer' : 'default';
    }
    ctx.selectionActionsEl.style.display = 'flex';
  }

  return {
    ensureWorkspaceOverlays,
    setCanvasDropState,
    updateSelectionActions,
  };
}
