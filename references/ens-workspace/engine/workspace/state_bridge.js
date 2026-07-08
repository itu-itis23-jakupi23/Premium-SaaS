/* Migration note: moved workspace edit/send gating, local storage keys, version history helpers, and UI state bridge helpers from admin_workspace_bootstrap.js. */

import { showWorkspaceToast } from '/static/workspace/engine/ui/toasts.js?v=20260404-admin-workspace-bootstrap-modules';

export function getEditDisabledReason(ctx) {
  return ctx.permissions?.edit_disabled_reason || 'Workspace editing is not available.';
}

export function canEditWorkspace(ctx, { notify = false } = {}) {
  const editable = ctx.permissions?.can_edit !== false;
  if (!editable && notify) {
    if (typeof ctx.onEditBlocked === 'function') {
      const handled = ctx.onEditBlocked(ctx, getEditDisabledReason(ctx));
      if (handled) {
        return editable;
      }
    }
    showWorkspaceToast(getEditDisabledReason(ctx));
  }
  return editable;
}

export function getSendState(ctx) {
  if (typeof ctx.resolveSendState === 'function') {
    return ctx.resolveSendState(ctx) || { allowed: false };
  }
  return { allowed: Boolean(ctx.workspaceId) };
}

export function updateDirtyUi(ctx) {
  if (ctx.unsavedBadge) {
    ctx.unsavedBadge.textContent = ctx.dirty ? 'Unsaved changes' : 'Saved';
    ctx.unsavedBadge.className = ctx.dirty ? 'unsaved-tag' : 'saved-tag';
  }
  if (ctx.saveButton) {
    const canSave = ctx.permissions?.can_save !== false;
    ctx.saveButton.disabled = ctx.saving || !canSave;
    ctx.saveButton.textContent = ctx.saving ? 'Saving...' : 'Save';
  }
  if (ctx.discardButton) {
    ctx.discardButton.disabled = !canEditWorkspace(ctx);
  }
}

export function updateSendButtonUi(ctx) {
  if (!ctx.sendButton) return;
  const state = getSendState(ctx);
  ctx.sendButton.disabled = ctx.sendingToClient || !state.allowed;
  ctx.sendButton.title = state.title || '';
  ctx.sendButton.setAttribute(
    'aria-label',
    state.ariaLabel || ctx.sendIdleLabel || 'Send workspace'
  );
  if (ctx.sendButtonLabelEl) {
    ctx.sendButtonLabelEl.textContent = ctx.sendingToClient
      ? (ctx.sendBusyLabel || 'Sending...')
      : (ctx.sendIdleLabel || 'Send');
  }
}

export function localSceneStorageKey(ctx, defaultLocalStoragePrefix) {
  return `${ctx.localStoragePrefix || defaultLocalStoragePrefix}_local_scene`;
}

export function localVersionStorageKey(ctx, defaultLocalStoragePrefix) {
  return `${ctx.localStoragePrefix || defaultLocalStoragePrefix}_local_versions`;
}

export async function persistWorkspaceScene(ctx, {
  cloneValue,
  setDirty,
  defaultLocalStoragePrefix,
}) {
  if (ctx.workspaceId) {
    const result = await ctx.api.saveWorkspaceScene(
      ctx.workspaceId,
      ctx.sceneState,
      ctx.meta?.workspace?.version
    );
    ctx.meta = {
      ...(ctx.meta || {}),
      workspace: {
        ...(ctx.meta?.workspace || {}),
        version: result.version,
        updated_at: result.updated_at,
      },
      review: result.review || ctx.meta?.review || null,
      subscription_request: result.subscription_request || ctx.meta?.subscription_request || null,
    };
    if (Array.isArray(result.assets)) ctx.workspaceAssets = result.assets;
    if (result.permissions) ctx.permissions = result.permissions;
  } else {
    localStorage.setItem(
      localSceneStorageKey(ctx, defaultLocalStoragePrefix),
      JSON.stringify(ctx.sceneState)
    );
  }
  ctx.savedScene = cloneValue(ctx.sceneState);
  setDirty(ctx, false);
}

export function updateContextUi(ctx) {
  if (ctx.clientNameEl && ctx.meta?.client?.full_name) ctx.clientNameEl.textContent = ctx.meta.client.full_name;
  if (ctx.workspaceNameEls.length && ctx.meta?.workspace?.name) {
    ctx.workspaceNameEls.forEach((el) => { el.textContent = ctx.meta.workspace.name; });
  }
  if (ctx.exhibitionNameEl && ctx.meta?.exhibition?.name) {
    ctx.exhibitionNameEl.textContent = `Exhibition: ${ctx.meta.exhibition.name}`;
  }
  if (ctx.arrangementStatusEls.length) {
    const limit = Number(ctx.permissions?.arrangement_round_limit) || 2;
    const used = Number(ctx.permissions?.arrangement_rounds_used) || 0;
    const remainingRaw = Number(ctx.permissions?.arrangement_rounds_remaining);
    const subscriptionActive = Boolean(ctx.permissions?.subscription_active);
    const label = ctx.meta?.review?.arrangement_label || (subscriptionActive
      ? 'Subscription active - unlimited arrangement rounds'
      : `${Math.max(0, Number.isFinite(remainingRaw) ? remainingRaw : (limit - used))} of ${limit} arrangement rounds remaining`);
    ctx.arrangementStatusEls.forEach((el) => { el.textContent = label; });
  }
  if (ctx.sendNoteEls.length) {
    const state = getSendState(ctx);
    const note = ctx.meta?.review?.notifications?.[0]?.detail
      || ctx.permissions?.send_disabled_reason
      || state.note
      || state.title
      || '';
    ctx.sendNoteEls.forEach((el) => { el.textContent = note; });
  }
  if (typeof ctx.onContextUpdated === 'function') {
    ctx.onContextUpdated(ctx);
  }
  updateSendButtonUi(ctx);
}

export function updateVersionUi(ctx) {
  const version = ctx.meta?.workspace?.version || 1;
  const label = ctx.workspaceId
    ? `Version ${version}${ctx.dirty ? ' - unsaved changes' : ''}`
    : `Local draft${ctx.dirty ? ' - unsaved changes' : ''}`;
  if (ctx.versionsButton) ctx.versionsButton.title = label;
}

export function createWorkspaceVersionController({
  cloneValue,
  ensureStructure,
  normalizeScene,
  renderShellScene,
  setDirty,
  defaultLocalStoragePrefix,
}) {
  async function refreshVersionsAndActivity(ctx) {
    if (!ctx.workspaceId) {
      try {
        ctx.versions = JSON.parse(localStorage.getItem(localVersionStorageKey(ctx, defaultLocalStoragePrefix)) || '[]');
      } catch (_) {
        ctx.versions = [];
      }
      ctx.activities = [];
      return;
    }
    try {
      ctx.versions = await ctx.api.listWorkspaceVersions(ctx.workspaceId);
    } catch (_) {
      ctx.versions = [];
    }
    try {
      ctx.activities = await ctx.api.listWorkspaceActivity(ctx.workspaceId);
    } catch (_) {
      ctx.activities = [];
    }
  }

  async function saveVersionSnapshot(ctx, label = 'Manual save') {
    if (!ctx.workspaceId) {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        label,
        created_at: new Date().toISOString(),
        snapshot: cloneValue(ctx.sceneState),
      };
      ctx.versions = [entry, ...(ctx.versions || [])].slice(0, 10);
      localStorage.setItem(
        localVersionStorageKey(ctx, defaultLocalStoragePrefix),
        JSON.stringify(ctx.versions)
      );
      return entry;
    }
    const result = await ctx.api.createWorkspaceVersion(ctx.workspaceId, label, ctx.sceneState);
    ctx.versions = Array.isArray(result.items) ? result.items : ctx.versions;
    return result.version;
  }

  async function clearVersionSnapshots(ctx) {
    if (!ctx.workspaceId) {
      ctx.versions = [];
      localStorage.removeItem(localVersionStorageKey(ctx, defaultLocalStoragePrefix));
      return;
    }
    const result = await ctx.api.clearWorkspaceVersions(ctx.workspaceId);
    ctx.versions = Array.isArray(result.items) ? result.items : [];
  }

  async function restoreVersionSnapshot(ctx, versionId) {
    if (!ctx.workspaceId) {
      const entry = (ctx.versions || []).find((version) => String(version.id) === String(versionId));
      if (!entry?.snapshot) throw new Error('Version not found');
      ctx.sceneState = ensureStructure(normalizeScene(entry.snapshot));
      ctx.savedScene = cloneValue(ctx.sceneState);
      renderShellScene(ctx);
      setDirty(ctx, false);
      return;
    }
    const result = await ctx.api.restoreWorkspaceVersion(ctx.workspaceId, versionId);
    ctx.sceneState = ensureStructure(normalizeScene(result.scene));
    ctx.savedScene = cloneValue(ctx.sceneState);
    ctx.meta = {
      ...(ctx.meta || {}),
      workspace: {
        ...(ctx.meta?.workspace || {}),
        version: result.version,
        updated_at: result.updated_at,
      },
    };
    renderShellScene(ctx);
    setDirty(ctx, false);
  }

  return {
    refreshVersionsAndActivity,
    saveVersionSnapshot,
    clearVersionSnapshots,
    restoreVersionSnapshot,
  };
}
