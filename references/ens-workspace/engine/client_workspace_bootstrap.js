import { createSceneRuntime } from '/static/workspace/engine/scene_runtime.js?v=20260428-dark-scene';
import {
  createStructureLayout,
  mountBooth,
  renderFurniture,
  renderSiteObjects,
} from '/static/workspace/engine/booth_render_core.js?v=20260428-dark-scene';
import { renderRooms } from '/static/js/room_render_core.js?v=20260413-room-grid-fix-5';
import {
  createDefaultSceneState,
  normalizeScene,
} from '/static/workspace/engine/workspace_state.js?v=20260413-room-grid-fix-5';
import { mountWorkspaceEditor } from '/static/workspace/engine/admin_workspace_bootstrap.js?v=20260413-door-position-fix';
import { createClientWorkspaceApi } from '/static/workspace/engine/workspace_api.js?v=20260402-workspace-api-security';

function ensureStructure(scene) {
  const safe = normalizeScene(scene || createDefaultSceneState());
  if (!Array.isArray(safe.panels) || !safe.panels.length || !Array.isArray(safe.columns) || !safe.columns.length) {
    const structure = createStructureLayout(safe.dims);
    safe.panels = structure.panels;
    safe.columns = structure.columns;
  }
  return safe;
}

function withClientBranding(scene, companyName = '') {
  const next = ensureStructure(scene);
  const fallbackName = String(companyName || '').trim() || next.booth?.fasciaText || 'Company Name';
  next.booth = {
    ...(next.booth || {}),
    fasciaText: next.booth?.fasciaText && next.booth.fasciaText !== 'Company Name'
      ? next.booth.fasciaText
      : fallbackName,
  };
  next.branding = {
    ...(next.branding || {}),
    text: fallbackName,
    logoUrl: null,
  };
  return next;
}

function getTargetVector(runtime, sceneState) {
  const THREE = window.THREE;
  if (!THREE || !runtime?.camera) return null;
  if (runtime.controls?.target) return runtime.controls.target.clone();
  return new THREE.Vector3(0, (Number(sceneState?.dims?.height) || 2.48) * 0.45, 0);
}

function zoomRuntime(runtime, sceneState, factor) {
  const target = getTargetVector(runtime, sceneState);
  if (!target || !runtime?.camera) return;
  const offset = runtime.camera.position.clone().sub(target).multiplyScalar(factor);
  runtime.camera.position.copy(target.clone().add(offset));
  runtime.controls?.update?.();
}

export async function mountClientWorkspace({
  containerId = 'three-container',
  initialScene = null,
  companyName = '',
} = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Workspace container "${containerId}" was not found.`);
  }

  const runtime = createSceneRuntime(container);
  if (!runtime) {
    throw new Error('Three.js viewer could not be initialized.');
  }

  const ctx = {
    runtime,
    sceneState: withClientBranding(initialScene, companyName),
  };

  async function render(nextScene = null, nextCompanyName = companyName) {
    ctx.sceneState = withClientBranding(nextScene || ctx.sceneState, nextCompanyName);
    mountBooth(runtime, {
      ...ctx.sceneState,
      signage: {
        enabled: ctx.sceneState.booth?.fascia !== false,
        option: ctx.sceneState.booth?.fasciaOption || 'classic',
        text: ctx.sceneState.booth?.fasciaText || nextCompanyName || 'Company Name',
      },
      branding: {
        ...(ctx.sceneState.branding || {}),
        text: ctx.sceneState.booth?.fasciaText || nextCompanyName || 'Company Name',
        logoUrl: null,
      },
    });
    renderRooms(runtime, {
      rooms: ctx.sceneState.rooms || [],
      boothStyle: ctx.sceneState.booth?.boothStyle,
      dims: ctx.sceneState.dims,
    });
    await renderFurniture(runtime, {
      models: ctx.sceneState.models || [],
      dims: ctx.sceneState.dims || {},
    });
    renderSiteObjects(runtime, {
      siteObjects: ctx.sceneState.siteObjects || [],
    });
    runtime.setLightingPreset?.(ctx.sceneState.lightingPreset || 'exhibition');
    runtime.setGridVisible(ctx.sceneState.grid !== false);
    runtime.focusOnBooth(ctx.sceneState.dims || {}, Boolean(ctx.sceneState.preview));
    return ctx.sceneState;
  }

  await render(initialScene, companyName);

  return {
    render,
    zoomIn() {
      zoomRuntime(runtime, ctx.sceneState, 0.86);
    },
    zoomOut() {
      zoomRuntime(runtime, ctx.sceneState, 1.16);
    },
    resetView() {
      runtime.focusOnBooth(ctx.sceneState.dims || {}, Boolean(ctx.sceneState.preview));
    },
    destroy() {
      runtime.destroy?.();
    },
  };
}

function clientArrangementNote(ctx) {
  const permissions = ctx.permissions || {};
  const includedLimit = Number(permissions.included_round_limit) || 2;
  const includedUsed = Number(permissions.included_rounds_used) || 0;
  const includedRemaining = Number.isFinite(Number(permissions.included_rounds_remaining))
    ? Number(permissions.included_rounds_remaining)
    : Math.max(0, includedLimit - includedUsed);
  const totalRemaining = Number.isFinite(Number(permissions.arrangement_rounds_remaining))
    ? Number(permissions.arrangement_rounds_remaining)
    : null;
  const planLabel = permissions.subscription_plan_label || '';
  const paidRemaining = Number.isFinite(Number(permissions.purchased_rounds_remaining))
    ? Number(permissions.purchased_rounds_remaining)
    : 0;
  if (permissions.subscription_unlimited) {
    return 'Unlimited plan active. You can keep arranging and resubmitting this workspace.';
  }
  if (permissions.subscription_required) {
    return planLabel
      ? `The ${planLabel} plan is fully used. Open the subscription window to add more revision rounds.`
      : `The ${includedLimit} included client revision rounds are finished. Open the subscription window to continue with more changes.`;
  }
  if (planLabel && paidRemaining > 0) {
    return `${planLabel} plan active. ${Math.max(0, totalRemaining || 0)} total revision rounds remain.`;
  }
  return `${includedRemaining} of ${includedLimit} included client revision rounds remaining before a paid plan is required.`;
}

function resolveClientSendState(ctx) {
  const permissions = ctx.permissions || {};
  const projectManagerName =
    ctx.meta?.project_manager?.full_name
    || ctx.meta?.client?.pm_name
    || 'project manager';

  if (!ctx.workspaceId) {
    return {
      allowed: false,
      title: 'Workspace unavailable.',
      ariaLabel: 'Send arrangement to project manager',
      note: 'This client workspace is not linked to a saved project yet.',
    };
  }

  if (permissions.can_send_arrangement === false) {
    return {
      allowed: false,
      title: permissions.send_disabled_reason || 'Arrangement sending is unavailable.',
      ariaLabel: 'Send arrangement to project manager',
      note: permissions.send_disabled_reason || clientArrangementNote(ctx),
    };
  }

  return {
    allowed: true,
    title: `Send your furniture arrangement to ${projectManagerName}.`,
    ariaLabel: `Send arrangement to ${projectManagerName}`,
    note: clientArrangementNote(ctx),
  };
}

async function sendClientWorkspace(ctx) {
  return ctx.api.sendWorkspaceToAdmin(ctx.workspaceId, {
    source: 'client_workspace',
  });
}

async function handleClientSendSuccess(ctx, result) {
  ctx.meta = {
    ...(ctx.meta || {}),
    workspace: {
      ...(ctx.meta?.workspace || {}),
      ...(result.workspace || {}),
    },
    client: result.client || ctx.meta?.client || null,
    exhibition: result.exhibition || ctx.meta?.exhibition || null,
    project_manager: result.project_manager || ctx.meta?.project_manager || null,
    review: result.review || ctx.meta?.review || null,
    subscription_request: result.subscription_request || ctx.meta?.subscription_request || null,
    subscription_checkout: result.subscription_checkout || ctx.meta?.subscription_checkout || null,
  };
  if (result.permissions) {
    ctx.permissions = result.permissions;
  }
  if (typeof window.showPortalToast === 'function') {
    window.showPortalToast(result.message || 'Arrangement sent to project manager.');
  }
}

export async function mountClientWorkspaceEditor({
  containerId = 'three-container',
  workspaceId = null,
  initialScene = null,
  baseUrl = '',
  onEditBlocked = null,
  onContextUpdated = null,
} = {}) {
  return mountWorkspaceEditor({
    containerId,
    workspaceId,
    role: 'client',
    initialScene,
    api: createClientWorkspaceApi(baseUrl),
    sendIdleLabel: 'Send to project manager',
    sendBusyLabel: 'Sending...',
    resolveSendState: resolveClientSendState,
    sendWorkspace: sendClientWorkspace,
    handleSendSuccess: handleClientSendSuccess,
    onEditBlocked,
    localStoragePrefix: 'bdp_client_workspace',
    onContextUpdated,
  });
}
