/* Migration note: moved panel metadata, panel open/tool orchestration, and right-panel UI rendering from admin_workspace_bootstrap.js. */

import {
  queryWorkspacePanel,
  queryWorkspacePanelAll,
} from '/static/workspace/engine/ui/selectors.js?v=20260404-workspace-dom-layer';

export const PANEL_META = {
  assets: { title: 'Assets Library', subtitle: 'Insert furniture and manage the asset catalog' },
  bill: { title: 'Booth Bill', subtitle: 'Review the full booth summary and invoice-ready totals' },
  room: { title: 'Room Mode', subtitle: 'Click the canvas to place rooms with animated doors and wall snap targets' },
  lighting: { title: 'Lighting', subtitle: 'Match the scene lighting presets from the reference workspace' },
  text: { title: 'Text', subtitle: 'Update booth text content and signage copy' },
  system: { title: 'System', subtitle: 'Switch booth style, build mode, dimensions, open sides, and permissions' },
  fascia: { title: 'Fascia Sign', subtitle: 'Control fascia option, branding mode, and uploaded logos' },
  versions: { title: 'Versions', subtitle: 'Save, restore, and review workspace history and activity' },
};

export function createWorkspacePanelController({
  downloadSceneSnapshot,
  renderAssetsPanel,
  renderBillPanel,
  renderRoomPanel,
  renderLightingPanel,
  renderTextPanel,
  renderSystemPanel,
  renderFasciaPanel,
  renderVersionsPanel,
}) {
  function updateHelperUi(ctx) {
    ctx.gridButton?.classList.toggle('active', !!ctx.sceneState.grid);
    ctx.previewButton?.classList.toggle('active', !!ctx.sceneState.preview);
    ctx.versionsButton?.classList.toggle('active', ctx.panelOpen && ctx.activeTool === 'versions');
  }

  function updateToolUi(ctx) {
    ctx.toolButtons.forEach((button) => {
      const isActive = ctx.panelOpen && button.dataset.workspaceTool === ctx.activeTool;
      button.classList.toggle('active', isActive);
    });
  }

  function setPanelOpen(ctx, open) {
    ctx.panelOpen = Boolean(open);
    if (ctx.panelEl) ctx.panelEl.dataset.open = ctx.panelOpen ? 'true' : 'false';
    updateToolUi(ctx);
    updateHelperUi(ctx);
  }

  function renderRightPanel(ctx) {
    if (!ctx.panelOpen) return;
    ctx.panelTitleEl.textContent = PANEL_META[ctx.activeTool]?.title || 'Panel';
    ctx.panelSubtitleEl.textContent = PANEL_META[ctx.activeTool]?.subtitle || '';
    if (ctx.activeTool === 'assets') return renderAssetsPanel(ctx);
    if (ctx.activeTool === 'bill') return renderBillPanel(ctx);
    if (ctx.activeTool === 'room') return renderRoomPanel(ctx);
    if (ctx.activeTool === 'lighting') return renderLightingPanel(ctx);
    if (ctx.activeTool === 'text') return renderTextPanel(ctx);
    if (ctx.activeTool === 'system') return renderSystemPanel(ctx);
    if (ctx.activeTool === 'fascia') return renderFasciaPanel(ctx);
    if (ctx.activeTool === 'versions') return renderVersionsPanel(ctx);
  }

  function setActiveTool(ctx, tool, options = {}) {
    const next = String(tool || 'assets').trim().toLowerCase();
    if (next === 'export') {
      downloadSceneSnapshot(ctx);
      return;
    }
    ctx.activeTool = PANEL_META[next] ? next : 'assets';
    setPanelOpen(ctx, options.open !== false);
    updateToolUi(ctx);
    updateHelperUi(ctx);
    renderRightPanel(ctx);
  }

  return {
    updateHelperUi,
    updateToolUi,
    setPanelOpen,
    renderRightPanel,
    setActiveTool,
  };
}

export function createWorkspacePanelRenderers({
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
  renderRightPanel,
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
  refreshVersionsAndActivity,
  showWorkspaceToast,
  updateContextUi,
  saveVersionSnapshot,
  clearVersionSnapshots,
  restoreVersionSnapshot,
}) {
  function buildAssetCard(asset) {
    const wrapper = document.createElement('div');
    wrapper.className = 'asset-item';
    wrapper.dataset.assetId = asset.asset_id;
    wrapper.draggable = true;
    wrapper.title = 'Drag into the booth or use Add';
    wrapper.innerHTML = `
      <div class="asset-thumb"></div>
      <div class="asset-info">
        <div class="asset-name"></div>
        <div class="asset-cat"></div>
        <div class="asset-price"></div>
        <div style="margin-top:6px;font-size:10px;color:var(--text3);">Drag into booth or use Add</div>
        <div class="qty-row">
          <button class="qty-btn" type="button" data-action="decrease">-</button>
          <span class="qty-val">1</span>
          <button class="qty-btn" type="button" data-action="increase">+</button>
          <button class="btn-primary" type="button" data-action="add" style="font-size:11px;padding:5px 10px;border-radius:6px;margin-left:auto;">Add</button>
        </div>
      </div>
    `;
    const thumb = wrapper.querySelector('.asset-thumb');
    thumb.textContent = '';
    if (asset.reference_image || asset.referenceImage) {
      const preview = document.createElement('img');
      preview.src = asset.reference_image || asset.referenceImage;
      preview.alt = getFurnitureCatalogLabel(asset);
      preview.loading = 'lazy';
      preview.decoding = 'async';
      thumb.appendChild(preview);
    } else {
      const fallback = document.createElement('div');
      fallback.style.width = '48px';
      fallback.style.height = '48px';
      fallback.style.borderRadius = '12px';
      fallback.style.background = asset.color || '#e2e8f0';
      fallback.style.opacity = '0.85';
      thumb.appendChild(fallback);
    }
    wrapper.querySelector('.asset-name').textContent = getFurnitureCatalogLabel(asset);
    wrapper.querySelector('.asset-cat').textContent = asset.category;
    const assetKind = ['parametric', 'light'].includes(String(asset.type || '').trim().toLowerCase())
      ? 'Parametric'
      : `Stock: ${asset.stock ?? 'inf'}`;
    wrapper.querySelector('.asset-price').textContent = `${formatMoney(asset.price || 0)} - ${assetKind}`;
    return wrapper;
  }

  function renderAssetLibrary(ctx) {
    if (!ctx.assetLibraryEl) return;
    const editable = canEditWorkspace(ctx);
    const term = (ctx.assetSearchTerm || '').trim().toLowerCase();
    ctx.assetLibraryEl.innerHTML = '';
    const groups = new Map();
    ctx.catalog.filter((asset) => {
      if (!term) return true;
      const code = String(asset.code || asset.id || asset.asset_id || '').toLowerCase();
      return asset.name.toLowerCase().includes(term) || asset.category.toLowerCase().includes(term) || code.includes(term);
    }).forEach((asset) => {
      const key = asset.category || 'Furniture';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(asset);
    });

    if (!groups.size) {
      const empty = document.createElement('div');
      empty.className = 'workspace-empty';
      empty.textContent = 'No assets match this search.';
      ctx.assetLibraryEl.appendChild(empty);
      return;
    }

    groups.forEach((items, category) => {
      const title = document.createElement('div');
      title.style.fontSize = '11px';
      title.style.fontWeight = '600';
      title.style.color = 'var(--text3)';
      title.style.margin = '10px 0 6px';
      title.style.textTransform = 'uppercase';
      title.style.letterSpacing = '0.5px';
      title.textContent = category;
      ctx.assetLibraryEl.appendChild(title);
      items.forEach((asset) => {
        const card = buildAssetCard(asset);
        if (!editable) {
          card.draggable = false;
          card.style.opacity = '0.68';
          Array.from(card.querySelectorAll('button')).forEach((button) => {
            button.disabled = true;
            button.style.cursor = 'default';
          });
        }
        ctx.assetLibraryEl.appendChild(card);
      });
    });
  }

  function formatOpenSides(openSides) {
    const labels = [
      openSides.front ? 'Front' : null,
      openSides.left ? 'Left' : null,
      openSides.right ? 'Right' : null,
      openSides.back ? 'Back' : null,
    ].filter(Boolean);
    return labels.length ? labels.join(', ') : 'None';
  }

  function renderQuoteBlock(ctx, summary, { heading = 'Bill summary', showNote = true } = {}) {
    return `
      <div class="workspace-section">
        <div class="workspace-panel-heading">${escapeHtml(heading)}</div>
        <div class="workspace-field-grid" style="grid-template-columns:1fr 1fr;">
          <div class="workspace-field">
            <label for="workspaceCurrencySelect">Currency</label>
            <select id="workspaceCurrencySelect" class="workspace-select">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="TRY">TRY</option>
            </select>
          </div>
          <div class="workspace-field">
            <label for="workspaceBillingSelect">Billing status</label>
            <select id="workspaceBillingSelect" class="workspace-select">
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
        <label class="workspace-check"><input id="workspaceVatToggle" type="checkbox" ${ctx.sceneState.quote.includeVat ? 'checked' : ''} /> Include VAT</label>
        <div id="workspaceQuoteRows" style="display:flex;flex-direction:column;gap:8px;"></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);"><span>Subtotal</span><strong id="workspaceQuoteSubtotal"></strong></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);"><span>VAT</span><strong id="workspaceQuoteVat"></strong></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text1);"><span>Grand total</span><strong id="workspaceQuoteGrand"></strong></div>
        ${showNote ? '<div class="workspace-note">Furniture and fascia pricing follow the same right-panel quote model used in the reference workspace.</div>' : ''}
      </div>
    `;
  }

  function wireQuoteControls(ctx, summary) {
    const currencySelect = queryWorkspacePanel(ctx, 'currencySelect');
    const billingSelect = queryWorkspacePanel(ctx, 'billingSelect');
    const vatToggle = queryWorkspacePanel(ctx, 'vatToggle');
    const editable = canEditWorkspace(ctx);
    if (currencySelect) currencySelect.value = ctx.sceneState.quote.currency;
    if (billingSelect) billingSelect.value = ctx.sceneState.quote.billingStatus;
    if (currencySelect) currencySelect.disabled = !editable;
    if (billingSelect) billingSelect.disabled = !editable;
    if (vatToggle) vatToggle.disabled = !editable;
    currencySelect?.addEventListener('change', () => { applyQuoteState(ctx, { currency: currencySelect.value }); renderRightPanel(ctx); });
    billingSelect?.addEventListener('change', () => { applyQuoteState(ctx, { billingStatus: billingSelect.value }); renderRightPanel(ctx); });
    vatToggle?.addEventListener('change', () => { applyQuoteState(ctx, { includeVat: vatToggle.checked }); renderRightPanel(ctx); });

    const rowsEl = queryWorkspacePanel(ctx, 'quoteRowsEl');
    rowsEl.innerHTML = summary.lines.length
      ? summary.lines.map((line) => `
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px 10px;border:0.5px solid var(--border);border-radius:12px;background:var(--surface2);font-size:12px;">
          <div><div style="font-weight:600;color:var(--text1);">${escapeHtml(line.label)}</div><div style="color:var(--text3);">${line.qty} x ${formatMoney(line.unit_price, line.currency)}</div></div>
          <div style="color:var(--text2);">Qty ${line.qty}</div>
          <strong style="color:var(--text1);">${formatMoney((Number(line.unit_price) || 0) * (Number(line.qty) || 0), line.currency)}</strong>
        </div>
      `).join('')
      : '<div class="workspace-empty">No furniture placed yet.</div>';
    queryWorkspacePanel(ctx, 'quoteSubtotalEl').textContent = formatMoney(summary.subtotal, summary.currency);
    queryWorkspacePanel(ctx, 'quoteVatEl').textContent = formatMoney(summary.vatAmount, summary.currency);
    queryWorkspacePanel(ctx, 'quoteGrandEl').textContent = formatMoney(summary.grandTotal, summary.currency);
  }

  function buildBillPayload(ctx, summary) {
    const booth = ctx.sceneState.booth || {};
    const dims = ctx.sceneState.dims || {};
    const fasciaMeta = getFasciaOptionMeta(booth.fasciaOption);
    return {
      type: 'bill',
      source: 'admin_portal',
      bill: {
        booth: {
          style: normalizeBoothStyle(booth.boothStyle),
          build_mode: normalizeBuildMode(booth.buildMode),
          dimensions: {
            width: Number(dims.width) || 0,
            depth: Number(dims.depth) || 0,
            height: Number(dims.height) || 0,
          },
          open_sides: normalizeOpenSides(booth.openSides),
          fascia: booth.fascia === false ? null : {
            label: fasciaMeta.label,
            price: Number(fasciaMeta.price) || 0,
          },
          rooms: Array.isArray(ctx.sceneState.rooms) ? ctx.sceneState.rooms.length : 0,
        },
        quote: {
          currency: summary.currency,
          subtotal: summary.subtotal,
          vat_amount: summary.vatAmount,
          grand_total: summary.grandTotal,
          lines: summary.lines.map((line) => ({
            key: line.key,
            label: line.label,
            qty: line.qty,
            unit_price: line.unit_price,
            currency: line.currency,
          })),
        },
        billing_status: ctx.sceneState.quote.billingStatus || 'draft',
      },
    };
  }

  async function sendBill(ctx, summary) {
    if (!ctx.workspaceId) {
      showWorkspaceToast('Save this workspace before sending the bill.');
      return;
    }
    const clientName = ctx.meta?.client?.full_name || 'client';
    try {
      await ctx.api.sendWorkspaceToClient(ctx.workspaceId, buildBillPayload(ctx, summary));
      applyQuoteState(ctx, { billingStatus: 'issued' });
      renderRightPanel(ctx);
      showWorkspaceToast(`Bill sent to ${clientName}.`);
    } catch (error) {
      window.alert(error.message || 'Unable to send bill.');
    }
  }

  function renderAssetsPanel(ctx) {
    const summary = buildQuoteSummary(ctx);
    ctx.panelTitleEl.textContent = PANEL_META.assets.title;
    ctx.panelSubtitleEl.textContent = PANEL_META.assets.subtitle;
    ctx.panelBodyEl.innerHTML = `
      <div class="workspace-section">
        <input id="workspaceAssetSearch" class="workspace-input" type="text" placeholder="Search assets..." />
        <div id="workspaceAssetLibrary"></div>
      </div>
      ${renderQuoteBlock(ctx, summary, { heading: 'Quote / BOM' })}
    `;

    ctx.assetSearchEl = queryWorkspacePanel(ctx, 'assetSearchEl');
    ctx.assetLibraryEl = queryWorkspacePanel(ctx, 'assetLibraryEl');
    if (ctx.assetSearchEl) {
      ctx.assetSearchEl.value = ctx.assetSearchTerm;
      ctx.assetSearchEl.addEventListener('input', () => {
        ctx.assetSearchTerm = ctx.assetSearchEl.value || '';
        renderAssetLibrary(ctx);
      });
    }
    ctx.assetLibraryEl?.addEventListener('click', (event) => {
      if (!canEditWorkspace(ctx, { notify: true })) return;
      const card = event.target.closest('.asset-item');
      if (!card) return;
      const asset = ctx.catalog.find((entry) => entry.asset_id === card.dataset.assetId);
      if (!asset) return;
      const qtyEl = card.querySelector('.qty-val');
      let qty = Number(qtyEl?.textContent || 1) || 1;
      if (event.target.matches('[data-action="increase"]')) {
        qtyEl.textContent = String(Math.min(99, qty + 1));
        return;
      }
      if (event.target.matches('[data-action="decrease"]')) {
        qtyEl.textContent = String(Math.max(1, qty - 1));
        return;
      }
      if (event.target.matches('[data-action="add"]')) {
        addModel(ctx, asset, { quantity: qty });
        qtyEl.textContent = '1';
      }
    });
    ctx.assetLibraryEl?.addEventListener('dragstart', (event) => {
      if (!canEditWorkspace(ctx, { notify: true })) return;
      const card = event.target.closest('.asset-item');
      if (!card || event.target.closest('[data-action]')) return;
      const asset = ctx.catalog.find((entry) => entry.asset_id === card.dataset.assetId);
      if (!asset || !event.dataTransfer) return;
      const qty = Math.max(1, Number(card.querySelector('.qty-val')?.textContent || 1) || 1);
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-bdp-asset', asset.asset_id);
      event.dataTransfer.setData('application/x-bdp-qty', String(qty));
      event.dataTransfer.setData('text/plain', asset.asset_id);
      setCanvasDropState(ctx, true);
    });
    ctx.assetLibraryEl?.addEventListener('dragend', () => {
      ctx.dragDepth = 0;
      setCanvasDropState(ctx, false);
    });

    wireQuoteControls(ctx, summary);
    renderAssetLibrary(ctx);
  }

  function renderBillPanel(ctx) {
    const summary = buildQuoteSummary(ctx);
    const booth = ctx.sceneState.booth || {};
    const dims = ctx.sceneState.dims || { width: 0, depth: 0, height: 0 };
    const boothStyle = normalizeBoothStyle(booth.boothStyle);
    const buildMode = normalizeBuildMode(booth.buildMode);
    const openSides = normalizeOpenSides(booth.openSides);
    const fasciaMeta = getFasciaOptionMeta(booth.fasciaOption);
    const rooms = Array.isArray(ctx.sceneState.rooms) ? ctx.sceneState.rooms : [];
    ctx.panelTitleEl.textContent = PANEL_META.bill.title;
    ctx.panelSubtitleEl.textContent = PANEL_META.bill.subtitle;
    ctx.panelBodyEl.innerHTML = `
      <div class="workspace-section">
        <div class="workspace-panel-heading">Booth summary</div>
        <div class="workspace-kv-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="workspace-kv"><div class="workspace-note">Booth style</div><div>${escapeHtml(boothStyle)}</div></div>
          <div class="workspace-kv"><div class="workspace-note">Build mode</div><div>${escapeHtml(buildMode)}</div></div>
          <div class="workspace-kv"><div class="workspace-note">Dimensions</div><div>${Number(dims.width).toFixed(1)}m x ${Number(dims.depth).toFixed(1)}m x ${Number(dims.height).toFixed(1)}m</div></div>
          <div class="workspace-kv"><div class="workspace-note">Open sides</div><div>${escapeHtml(formatOpenSides(openSides))}</div></div>
          <div class="workspace-kv"><div class="workspace-note">Fascia</div><div>${booth.fascia === false ? 'Disabled' : `Enabled - ${escapeHtml(fasciaMeta.label)}`}</div></div>
          <div class="workspace-kv"><div class="workspace-note">Rooms</div><div>${rooms.length}</div></div>
        </div>
      </div>
      <div class="workspace-section" style="display:flex;justify-content:flex-end;">
        <button class="btn-primary" id="workspaceSendBillBtn" type="button">Send bill</button>
      </div>
      ${renderQuoteBlock(ctx, summary, { heading: 'Bill details', showNote: false })}
    `;
    const sendBillBtn = queryWorkspacePanel(ctx, 'sendBillButton');
    sendBillBtn?.addEventListener('click', () => {
      sendBill(ctx, summary);
    });
    wireQuoteControls(ctx, summary);
  }

  function renderRoomPanel(ctx) {
    const draft = {
      width: Math.max(1, Math.round(Number(ctx.roomDraft?.width) || 3)),
      depth: Math.max(1, Math.round(Number(ctx.roomDraft?.depth) || 3)),
      height: Math.max(1.8, Number(ctx.roomDraft?.height) || 2.4),
      hasDoor: ctx.roomDraft?.hasDoor !== false,
      hasCeiling: Boolean(ctx.roomDraft?.hasCeiling),
      doorPosition: String(ctx.roomDraft?.doorPosition || 'center').toLowerCase(),
    };
    ctx.roomDraft = draft;
    const rooms = Array.isArray(ctx.sceneState.rooms) ? ctx.sceneState.rooms : [];
    const roomCount = rooms.length;
    const latestRoom = roomCount ? rooms[roomCount - 1] : null;
    const roomEditorMarkup = roomCount
      ? rooms.map((room, index) => `
        <div class="workspace-section" style="padding:12px;border:1px solid rgba(148,163,184,0.18);border-radius:14px;">
          <div class="workspace-panel-heading">Room ${index + 1}</div>
          <div class="workspace-note">Position ${Number(room.position?.x || 0).toFixed(1)}m x ${Number(room.position?.z || 0).toFixed(1)}m</div>
          <div class="workspace-check-grid" style="margin-top:10px;">
            <label class="workspace-check"><input data-room-door-toggle="${escapeHtml(room.id)}" type="checkbox" ${room.hasDoor !== false ? 'checked' : ''} /> Door</label>
            <label class="workspace-check"><input data-room-ceiling-toggle="${escapeHtml(room.id)}" type="checkbox" ${room.hasCeiling ? 'checked' : ''} /> Ceiling</label>
          </div>
          <div class="workspace-field-grid" style="grid-template-columns:1fr;margin-top:10px;">
            <div class="workspace-field">
              <label for="workspaceRoomDoorPosition-${index}">Door position</label>
              <select id="workspaceRoomDoorPosition-${index}" class="workspace-select" data-room-door-position="${escapeHtml(room.id)}" ${room.hasDoor === false ? 'disabled' : ''}>
                <option value="left" ${room.doorPosition === 'left' ? 'selected' : ''}>Left</option>
                <option value="center" ${room.doorPosition !== 'left' && room.doorPosition !== 'right' ? 'selected' : ''}>Center</option>
                <option value="right" ${room.doorPosition === 'right' ? 'selected' : ''}>Right</option>
              </select>
            </div>
          </div>
        </div>
      `).join('')
      : '<div class="workspace-note">No rooms placed yet.</div>';
    ctx.panelTitleEl.textContent = PANEL_META.room.title;
    ctx.panelSubtitleEl.textContent = PANEL_META.room.subtitle;
    ctx.panelBodyEl.innerHTML = `
      <div class="workspace-section">
        <div class="workspace-segmented">
          <button type="button" data-workspace-tool-jump="assets">Furniture</button>
          <button type="button" class="active" data-workspace-tool-jump="room">Room Mode</button>
        </div>
        <div class="workspace-note">Room Mode is active. Click the 1x1 grid to place a room. Drag resize is reserved for the next iteration.</div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Room size</div>
        <div class="workspace-field-grid">
          <div class="workspace-field"><label for="workspaceRoomWidth">Width (m)</label><input id="workspaceRoomWidth" class="workspace-input" type="number" min="1" max="30" step="1" value="${draft.width}" /></div>
          <div class="workspace-field"><label for="workspaceRoomDepth">Depth (m)</label><input id="workspaceRoomDepth" class="workspace-input" type="number" min="1" max="30" step="1" value="${draft.depth}" /></div>
          <div class="workspace-field"><label for="workspaceRoomHeight">Height (m)</label><input id="workspaceRoomHeight" class="workspace-input" type="number" min="1.8" max="10" step="0.1" value="${draft.height}" /></div>
        </div>
        <div class="workspace-check-grid">
          <label class="workspace-check"><input id="workspaceRoomDoor" type="checkbox" ${draft.hasDoor ? 'checked' : ''} /> Door</label>
          <label class="workspace-check"><input id="workspaceRoomCeiling" type="checkbox" ${draft.hasCeiling ? 'checked' : ''} /> Ceiling</label>
        </div>
        <div class="workspace-field-grid" style="grid-template-columns:1fr;">
          <div class="workspace-field">
            <label for="workspaceRoomDoorPosition">Door position</label>
            <select id="workspaceRoomDoorPosition" class="workspace-select" ${draft.hasDoor ? '' : 'disabled'}>
              <option value="left" ${draft.doorPosition === 'left' ? 'selected' : ''}>Left</option>
              <option value="center" ${draft.doorPosition !== 'left' && draft.doorPosition !== 'right' ? 'selected' : ''}>Center</option>
              <option value="right" ${draft.doorPosition === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </div>
        </div>
        <div class="workspace-note">${latestRoom ? 'This updates the latest room on the canvas and the next room you add.' : 'This sets the default door position for the next room you add.'}</div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Placement</div>
        <button id="workspaceAddRoomCenter" class="btn-primary" type="button" style="font-size:12px;padding:8px 12px;">Add room at center</button>
        <button id="workspaceRemoveLastRoom" class="btn-ghost" type="button" style="font-size:12px;padding:8px 12px;">Remove last room</button>
        <div class="workspace-note">Rooms placed: ${roomCount}. Door panels can be clicked in the scene to open or close.</div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Placed rooms</div>
        <div class="workspace-note">Update door placement after the room is added. Left, center, and right use the room wall grid instead of freehand offsets.</div>
        <div style="display:grid;gap:10px;margin-top:10px;">${roomEditorMarkup}</div>
      </div>
    `;

    const updateDraft = () => {
      ctx.roomDraft = {
        width: Math.max(1, Math.min(30, Math.round(Number(ctx.panelBodyEl.querySelector('#workspaceRoomWidth')?.value) || 3))),
        depth: Math.max(1, Math.min(30, Math.round(Number(ctx.panelBodyEl.querySelector('#workspaceRoomDepth')?.value) || 3))),
        height: Math.max(1.8, Math.min(10, Number(ctx.panelBodyEl.querySelector('#workspaceRoomHeight')?.value) || 2.4)),
        hasDoor: Boolean(ctx.panelBodyEl.querySelector('#workspaceRoomDoor')?.checked),
        hasCeiling: Boolean(ctx.panelBodyEl.querySelector('#workspaceRoomCeiling')?.checked),
        doorPosition: String(ctx.panelBodyEl.querySelector('#workspaceRoomDoorPosition')?.value || 'center').toLowerCase(),
      };
      const draftDoorPosition = ctx.panelBodyEl.querySelector('#workspaceRoomDoorPosition');
      if (draftDoorPosition) draftDoorPosition.disabled = !ctx.roomDraft.hasDoor;
    };
    ctx.panelBodyEl.querySelectorAll('#workspaceRoomWidth,#workspaceRoomDepth,#workspaceRoomHeight,#workspaceRoomDoor,#workspaceRoomCeiling,#workspaceRoomDoorPosition').forEach((input) => {
      input.addEventListener('change', updateDraft);
    });
    ctx.panelBodyEl.querySelector('#workspaceRoomDoorPosition')?.addEventListener('change', (event) => {
      if (!latestRoom) return;
      updateRoom(ctx, latestRoom.id, {
        doorPosition: event.currentTarget.value,
      });
    });
    ctx.panelBodyEl.querySelector('[data-workspace-tool-jump="assets"]')?.addEventListener('click', () => {
      ctx.activeTool = 'assets';
      ctx.toolButtons?.forEach((button) => {
        button.classList.toggle('active', button.dataset.workspaceTool === ctx.activeTool);
      });
      renderRightPanel(ctx);
    });
    ctx.panelBodyEl.querySelector('#workspaceAddRoomCenter')?.addEventListener('click', () => {
      updateDraft();
      addRoomAtPoint(ctx, { x: 0, z: 0 }, ctx.roomDraft);
    });
    ctx.panelBodyEl.querySelector('#workspaceRemoveLastRoom')?.addEventListener('click', () => {
      removeLastRoom(ctx);
    });
    ctx.panelBodyEl.querySelectorAll('[data-room-door-toggle]').forEach((input) => {
      input.addEventListener('change', (event) => {
        updateRoom(ctx, event.currentTarget.dataset.roomDoorToggle, {
          hasDoor: Boolean(event.currentTarget.checked),
        });
      });
    });
    ctx.panelBodyEl.querySelectorAll('[data-room-ceiling-toggle]').forEach((input) => {
      input.addEventListener('change', (event) => {
        updateRoom(ctx, event.currentTarget.dataset.roomCeilingToggle, {
          hasCeiling: Boolean(event.currentTarget.checked),
        });
      });
    });
    ctx.panelBodyEl.querySelectorAll('[data-room-door-position]').forEach((select) => {
      select.addEventListener('change', (event) => {
        updateRoom(ctx, event.currentTarget.dataset.roomDoorPosition, {
          doorPosition: event.currentTarget.value,
        });
      });
    });
  }

  function renderLightingPanel(ctx) {
    const selectedLight = getSelectedLight(ctx);
    const lightCatalog = cloneLightsCatalog();
    const selectedRailPosition = Number.isFinite(Number(selectedLight?.railPosition))
      ? Math.round(Number(selectedLight.railPosition) * 100)
      : 50;
    const selectedTilt = Math.round((getRailLightTilt(selectedLight) * 180) / Math.PI);
    ctx.panelTitleEl.textContent = PANEL_META.lighting.title;
    ctx.panelSubtitleEl.textContent = PANEL_META.lighting.subtitle;
    ctx.panelBodyEl.innerHTML = `
      <div class="workspace-section">
        <div class="workspace-panel-heading">Lighting preset</div>
        <div class="workspace-segmented" id="workspaceLightingPresetGroup">
          ${LIGHTING_PRESETS.map((preset) => `<button type="button" data-lighting-preset="${preset.value}">${preset.label}</button>`).join('')}
        </div>
        <div class="workspace-note">These presets come from the reference editor so booth contrast and atmosphere change without changing the shell layout.</div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Rail lights</div>
        <div class="workspace-segmented" id="workspaceRailLightGroup" style="grid-template-columns:repeat(3,minmax(0,1fr));">
          ${lightCatalog.map((light) => `<button type="button" data-light-code="${escapeHtml(light.code)}">${escapeHtml(getLightCatalogLabel(light))}</button>`).join('')}
        </div>
        <div class="workspace-note">Rail lights attach to the front fascia beam. Use \`T\` to slide on X and \`R\` to tilt on X.</div>
        <div class="workspace-note">Installed lights: ${countRailLights(ctx)} / ${RAIL_LIGHT_LIMIT}</div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Selected rail light</div>
        ${selectedLight ? `
          <div class="workspace-field">
            <label for="workspaceRailPosition">Rail position</label>
            <input id="workspaceRailPosition" class="workspace-input" type="range" min="0" max="100" step="1" value="${selectedRailPosition}" />
          </div>
          <div class="workspace-field">
            <label for="workspaceRailTilt">Tilt down</label>
            <input id="workspaceRailTilt" class="workspace-input" type="range" min="0" max="75" step="1" value="${selectedTilt}" />
          </div>
          <div class="workspace-note">${escapeHtml(selectedLight.name || 'Rail light')} at ${(selectedRailPosition / 100).toFixed(2)} rail position.</div>
        ` : '<div class="workspace-empty">Select a rail light to adjust its position or tilt.</div>'}
      </div>
    `;
    queryWorkspacePanelAll(ctx, 'lightingPresetButtons').forEach((button) => {
      button.classList.toggle('active', button.dataset.lightingPreset === ctx.sceneState.lightingPreset);
      button.addEventListener('click', () => {
        applyLightingPreset(ctx, button.dataset.lightingPreset);
        renderRightPanel(ctx);
      });
    });
    queryWorkspacePanelAll(ctx, 'railLightButtons').forEach((button) => {
      button.addEventListener('click', () => {
        addLightByCode(ctx, button.dataset.lightCode);
      });
    });
    queryWorkspacePanel(ctx, 'railPosition')?.addEventListener('input', (event) => {
      const target = getSelectedLight(ctx);
      if (!target) return;
      target.railPosition = clampRailPosition(Number(event.target.value) / 100);
      stabilizeRailLightPlacement(ctx, target);
      renderShellScene(ctx);
      renderRightPanel(ctx);
      setDirty(ctx, true);
    });
    queryWorkspacePanel(ctx, 'railTilt')?.addEventListener('input', (event) => {
      const target = getSelectedLight(ctx);
      if (!target) return;
      target.rotation = normalizeRailLightRotation({
        ...(target.rotation || {}),
        x: (Number(event.target.value) * Math.PI) / 180,
      }, getDefaultRailLightTilt(target));
      stabilizeRailLightPlacement(ctx, target);
      renderShellScene(ctx);
      renderRightPanel(ctx);
      setDirty(ctx, true);
    });
  }

  function renderTextPanel(ctx) {
    const selectedText = getSelectedTextObject(ctx);
    ctx.panelTitleEl.textContent = PANEL_META.text.title;
    ctx.panelSubtitleEl.textContent = PANEL_META.text.subtitle;
    ctx.panelBodyEl.innerHTML = `
      <div class="workspace-section">
        <div class="workspace-panel-heading">Company name</div>
        <input id="workspaceTextInput" class="workspace-input" type="text" maxlength="60" value="${escapeHtml(ctx.sceneState.booth?.fasciaText || 'Company Name')}" />
        <div class="workspace-note">This updates the shared booth sign string used by fascia and branding.</div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Add scene text</div>
        <input id="workspaceSceneTextInput" class="workspace-input" type="text" maxlength="50" placeholder="Welcome" value="Welcome" />
        <div class="workspace-field-grid">
          <div class="workspace-field"><label for="workspaceSceneTextColor">Color</label><input id="workspaceSceneTextColor" class="workspace-input" type="color" value="#4b5563" /></div>
          <div class="workspace-field"><label for="workspaceSceneTextSize">Font size</label><input id="workspaceSceneTextSize" class="workspace-input" type="number" min="18" max="120" step="1" value="40" /></div>
        </div>
        <button id="workspaceSceneTextAdd" class="btn-primary" type="button" style="font-size:12px;padding:8px 12px;">Add Text</button>
        <div class="workspace-note">New text is placed inside the booth and can be moved or rotated with the current transform controls.</div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Selected text</div>
        ${selectedText ? `
          <input id="workspaceSelectedTextValue" class="workspace-input" type="text" maxlength="50" value="${escapeHtml(selectedText.text || '')}" />
          <div class="workspace-field-grid">
            <div class="workspace-field"><label for="workspaceSelectedTextColor">Color</label><input id="workspaceSelectedTextColor" class="workspace-input" type="color" value="${escapeHtml(selectedText.color || '#4b5563')}" /></div>
            <div class="workspace-field"><label for="workspaceSelectedTextSize">Font size</label><input id="workspaceSelectedTextSize" class="workspace-input" type="number" min="18" max="120" step="1" value="${Number(selectedText.fontSize) || 40}" /></div>
          </div>
          <button id="workspaceSelectedTextDelete" class="btn-ghost" type="button" style="font-size:12px;padding:8px 12px;">Delete Text</button>
        ` : '<div class="workspace-empty">Select a text object in the scene to edit it.</div>'}
      </div>
    `;
    const input = queryWorkspacePanel(ctx, 'fasciaTextInput');
    input?.addEventListener('input', () => {
      ctx.sceneState.booth.fasciaText = input.value || 'Company Name';
      renderShellScene(ctx);
      if (ctx.activeTool === 'fascia') renderRightPanel(ctx);
      setDirty(ctx, true);
    });
    queryWorkspacePanel(ctx, 'sceneTextAddButton')?.addEventListener('click', () => {
      addTextObject(ctx, {
        text: queryWorkspacePanel(ctx, 'sceneTextInput')?.value || 'Welcome',
        color: queryWorkspacePanel(ctx, 'sceneTextColorInput')?.value || '#4b5563',
        fontSize: queryWorkspacePanel(ctx, 'sceneTextSizeInput')?.value || 40,
      });
    });
    queryWorkspacePanel(ctx, 'selectedTextValueInput')?.addEventListener('input', (event) => {
      const target = getSelectedTextObject(ctx);
      if (!target) return;
      target.text = event.target.value || 'Text';
      target.width = Math.min(3.4, Math.max(1.2, (target.text.length || 1) * 0.12));
      renderShellScene(ctx);
      renderRightPanel(ctx);
      setDirty(ctx, true);
    });
    queryWorkspacePanel(ctx, 'selectedTextColorInput')?.addEventListener('input', (event) => {
      const target = getSelectedTextObject(ctx);
      if (!target) return;
      target.color = event.target.value || '#4b5563';
      renderShellScene(ctx);
      setDirty(ctx, true);
    });
    queryWorkspacePanel(ctx, 'selectedTextSizeInput')?.addEventListener('change', (event) => {
      const target = getSelectedTextObject(ctx);
      if (!target) return;
      target.fontSize = Math.max(18, Math.min(120, Math.round(Number(event.target.value) || 40)));
      target.height = Math.max(0.28, Number((target.fontSize * 0.012).toFixed(3)));
      renderShellScene(ctx);
      renderRightPanel(ctx);
      setDirty(ctx, true);
    });
    queryWorkspacePanel(ctx, 'selectedTextDeleteButton')?.addEventListener('click', () => {
      deleteSelection(ctx);
    });
  }

  function renderSystemPanel(ctx) {
    const dims = ctx.sceneState.dims;
    const openSides = normalizeOpenSides(ctx.sceneState.booth?.openSides);
    const boothStyle = normalizeBoothStyle(ctx.sceneState.booth?.boothStyle);
    const buildMode = normalizeBuildMode(ctx.sceneState.booth?.buildMode);
    const permissions = normalizePermissions(ctx.sceneState.permissions);
    const snapEnabled = ctx.sceneState.snap !== false;
    const snapStep = normalizeSnapStep(ctx.sceneState.snapStep);
    const rotationSnap = normalizeRotationSnap(ctx.sceneState.rotationSnap);
    ctx.panelTitleEl.textContent = PANEL_META.system.title;
    ctx.panelSubtitleEl.textContent = PANEL_META.system.subtitle;
    ctx.panelBodyEl.innerHTML = `
      <div class="workspace-section">
        <div class="workspace-panel-heading">Booth style</div>
        <div class="workspace-segmented">
          <button type="button" data-booth-style="octanorm">Octanorm</button>
          <button type="button" data-booth-style="maxima">Maxima</button>
        </div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Build mode</div>
        <div class="workspace-segmented">
          <button type="button" data-build-mode="panel">Panel</button>
          <button type="button" data-build-mode="yekpare">Yekpare</button>
        </div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Dimensions</div>
        <div class="workspace-field-grid">
          <div class="workspace-field"><label for="workspaceDimWidth">Width (m)</label><input id="workspaceDimWidth" class="workspace-input" data-dim-input="width" type="number" min="2" max="30" step="1" value="${dims.width}" /></div>
          <div class="workspace-field"><label for="workspaceDimDepth">Depth (m)</label><input id="workspaceDimDepth" class="workspace-input" data-dim-input="depth" type="number" min="2" max="30" step="1" value="${dims.depth}" /></div>
          <div class="workspace-field"><label for="workspaceDimHeight">Height (m)</label><input id="workspaceDimHeight" class="workspace-input" data-dim-input="height" type="number" min="2.2" max="10" step="0.1" value="${dims.height}" /></div>
        </div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Open sides</div>
        <div class="workspace-check-grid">
          <label class="workspace-check"><input type="checkbox" data-open-side="front" ${openSides.front ? 'checked' : ''} /> Front</label>
          <label class="workspace-check"><input type="checkbox" data-open-side="left" ${openSides.left ? 'checked' : ''} /> Left</label>
          <label class="workspace-check"><input type="checkbox" data-open-side="right" ${openSides.right ? 'checked' : ''} /> Right</label>
          <label class="workspace-check"><input type="checkbox" data-open-side="back" ${openSides.back ? 'checked' : ''} /> Back</label>
        </div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Permissions</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label class="workspace-check"><input type="checkbox" data-permission="managerQuotes" ${permissions.managerQuotes ? 'checked' : ''} /> Manager can edit quotes</label>
          <label class="workspace-check"><input type="checkbox" data-permission="managerAssets" ${permissions.managerAssets ? 'checked' : ''} /> Manager can access assets</label>
          <label class="workspace-check"><input type="checkbox" data-permission="managerLogs" ${permissions.managerLogs ? 'checked' : ''} /> Manager can view activity logs</label>
        </div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Workspace helpers</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <label class="workspace-check"><input type="checkbox" id="workspaceSnapEnabled" ${snapEnabled ? 'checked' : ''} /> Enable snap</label>
          <label class="workspace-check"><input type="checkbox" id="workspaceMeasureEnabled" ${ctx.sceneState.measure ? 'checked' : ''} /> Measure mode</label>
          <div class="workspace-field-grid">
            <div class="workspace-field">
              <label for="workspaceSnapStep">Move snap (m)</label>
              <select id="workspaceSnapStep" class="workspace-select">
                <option value="0.1">0.1</option>
                <option value="0.25">0.25</option>
                <option value="0.5">0.5</option>
                <option value="1">1.0</option>
              </select>
            </div>
            <div class="workspace-field">
              <label for="workspaceRotationSnap">Rotation snap</label>
              <select id="workspaceRotationSnap" class="workspace-select">
                <option value="15">15deg</option>
                <option value="30">30deg</option>
                <option value="45">45deg</option>
                <option value="90">90deg</option>
              </select>
            </div>
          </div>
          <div class="workspace-note">When measure mode is on, click two points on the floor grid to measure distance.</div>
        </div>
      </div>
    `;

    queryWorkspacePanelAll(ctx, 'boothStyleButtons').forEach((button) => {
      button.classList.toggle('active', normalizeBoothStyle(button.dataset.boothStyle) === boothStyle);
      button.addEventListener('click', () => { applyBoothStyle(ctx, button.dataset.boothStyle); renderRightPanel(ctx); });
    });
    queryWorkspacePanelAll(ctx, 'buildModeButtons').forEach((button) => {
      button.classList.toggle('active', normalizeBuildMode(button.dataset.buildMode) === buildMode);
      button.addEventListener('click', () => { applyBuildMode(ctx, button.dataset.buildMode); renderRightPanel(ctx); });
    });
    queryWorkspacePanelAll(ctx, 'dimInputs').forEach((input) => {
      input.addEventListener('change', () => { applyDims(ctx, { [input.dataset.dimInput]: input.value }); renderRightPanel(ctx); });
    });
    queryWorkspacePanelAll(ctx, 'openSideInputs').forEach((input) => {
      input.addEventListener('change', () => { applyOpenSides(ctx, { [input.dataset.openSide]: input.checked }); renderRightPanel(ctx); });
    });
    queryWorkspacePanelAll(ctx, 'permissionInputs').forEach((input) => {
      input.addEventListener('change', () => { applyPermissionState(ctx, { [input.dataset.permission]: input.checked }); });
    });
    const snapToggle = queryWorkspacePanel(ctx, 'snapToggle');
    const measureToggle = queryWorkspacePanel(ctx, 'measureToggle');
    const snapStepInput = queryWorkspacePanel(ctx, 'snapStepInput');
    const rotationSnapInput = queryWorkspacePanel(ctx, 'rotationSnapInput');
    if (snapStepInput) snapStepInput.value = String(snapStep);
    if (rotationSnapInput) rotationSnapInput.value = String(rotationSnap);
    snapToggle?.addEventListener('change', () => { applyWorkspaceControls(ctx, { snap: snapToggle.checked }); renderRightPanel(ctx); });
    measureToggle?.addEventListener('change', () => { applyWorkspaceControls(ctx, { measure: measureToggle.checked }); renderRightPanel(ctx); });
    snapStepInput?.addEventListener('change', () => { applyWorkspaceControls(ctx, { snapStep: snapStepInput.value }, { skipRender: true }); renderRightPanel(ctx); });
    rotationSnapInput?.addEventListener('change', () => { applyWorkspaceControls(ctx, { rotationSnap: rotationSnapInput.value }, { skipRender: true }); renderRightPanel(ctx); });
  }

  function renderFasciaPanel(ctx) {
    const booth = ctx.sceneState.booth || {};
    const branding = normalizeBranding(ctx.sceneState.branding);
    const meta = getFasciaOptionMeta(booth.fasciaOption);
    const constraints = getFasciaConstraints(ctx, meta);
    const logoAssets = ctx.workspaceAssets.filter((asset) => asset.kind === 'fascia_logo');
    const selectedLogo = getLogoAsset(ctx);
    ctx.panelTitleEl.textContent = PANEL_META.fascia.title;
    ctx.panelSubtitleEl.textContent = PANEL_META.fascia.subtitle;
    ctx.panelBodyEl.innerHTML = `
      <div class="workspace-section">
        <div class="workspace-toggle-row">
          <div><div class="workspace-panel-heading">Enable fascia sign</div><div class="workspace-note">Toggle the fascia assembly and booth sign.</div></div>
          <input id="workspaceFasciaEnabled" type="checkbox" ${booth.fascia !== false ? 'checked' : ''} />
        </div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Fascia option</div>
        <select id="workspaceFasciaOption" class="workspace-select">${FASCIA_OPTIONS.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join('')}</select>
        <div class="workspace-note" id="workspaceFasciaMeta">Price impact: ${booth.fascia !== false ? formatMoney(meta.price, ctx.sceneState.quote.currency) : '-'}</div>
        <div class="workspace-note" id="workspaceFasciaConstraints">${escapeHtml(constraints.join(' - '))}</div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Company name</div>
        <input id="workspaceFasciaText" class="workspace-input" type="text" maxlength="60" value="${escapeHtml(booth.fasciaText || 'Company Name')}" />
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Branding mode</div>
        <select id="workspaceBrandingMode" class="workspace-select">
          <option value="text">Text only</option>
          <option value="logo">Logo only</option>
          <option value="logo_text">Logo + text</option>
        </select>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Branding scope</div>
        <select id="workspaceBrandingScope" class="workspace-select">
          <option value="front">Front only</option>
          <option value="all_visible">All visible fascia</option>
        </select>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Uploaded logos</div>
        <select id="workspaceLogoAsset" class="workspace-select">
          <option value="">No uploaded logo</option>
          ${logoAssets.map((asset) => `<option value="${asset.id}">${escapeHtml(asset.original_name || asset.file_name || `Logo ${asset.id}`)}</option>`).join('')}
        </select>
        <input id="workspaceLogoUpload" class="workspace-input" type="file" accept="image/png,image/jpeg,image/webp" />
        <div class="workspace-note">PNG, JPG, or WEBP up to 2MB. Transparent PNG works best.</div>
        <div id="workspaceLogoPreview" style="display:${selectedLogo ? 'block' : 'none'};padding:10px;border:0.5px solid var(--border);border-radius:12px;background:var(--surface2);">${selectedLogo ? `<img src="${selectedLogo.url}" alt="Logo preview" style="max-width:100%;max-height:120px;object-fit:contain;display:block;margin:0 auto;" />` : ''}</div>
        <button id="workspaceLogoRemove" class="btn-ghost" type="button" style="font-size:12px;padding:6px 12px;">Remove logo</button>
      </div>
    `;

    const enabled = queryWorkspacePanel(ctx, 'fasciaEnabledToggle');
    const option = queryWorkspacePanel(ctx, 'fasciaOptionSelect');
    const text = queryWorkspacePanel(ctx, 'fasciaTextField');
    const brandingMode = queryWorkspacePanel(ctx, 'brandingModeSelect');
    const brandingScope = queryWorkspacePanel(ctx, 'brandingScopeSelect');
    const logoAsset = queryWorkspacePanel(ctx, 'logoAssetSelect');
    const logoUpload = queryWorkspacePanel(ctx, 'logoUploadInput');
    const logoRemove = queryWorkspacePanel(ctx, 'logoRemoveButton');

    if (option) option.value = normalizeFasciaOption(booth.fasciaOption);
    if (brandingMode) brandingMode.value = branding.mode;
    if (brandingScope) brandingScope.value = branding.scope;
    if (logoAsset) logoAsset.value = branding.logoAssetId ? String(branding.logoAssetId) : '';

    enabled?.addEventListener('change', () => { applyFasciaState(ctx, { fascia: enabled.checked }); renderRightPanel(ctx); });
    option?.addEventListener('change', () => { applyFasciaState(ctx, { fasciaOption: option.value }); renderRightPanel(ctx); });
    text?.addEventListener('input', () => { applyFasciaState(ctx, { fasciaText: text.value || 'Company Name' }); renderRightPanel(ctx); });
    brandingMode?.addEventListener('change', () => { applyBrandingState(ctx, { mode: brandingMode.value }); renderRightPanel(ctx); });
    brandingScope?.addEventListener('change', () => { applyBrandingState(ctx, { scope: brandingScope.value }); renderRightPanel(ctx); });
    logoAsset?.addEventListener('change', () => {
      const nextAssetId = Number(logoAsset.value) || null;
      const nextMode = nextAssetId
        ? (ctx.sceneState.branding.mode === 'text' ? 'logo_text' : ctx.sceneState.branding.mode)
        : ((ctx.sceneState.branding.mode === 'logo' || ctx.sceneState.branding.mode === 'logo_text') ? 'text' : ctx.sceneState.branding.mode);
      applyBrandingState(ctx, { logoAssetId: nextAssetId, mode: nextMode });
      renderRightPanel(ctx);
    });
    logoUpload?.addEventListener('change', async () => {
      const file = logoUpload.files && logoUpload.files[0];
      if (!file) return;
      if (!ctx.workspaceId) {
        window.alert('Save this workspace first so uploaded logos can be linked to it.');
        logoUpload.value = '';
        return;
      }
      try {
        const result = await ctx.api.uploadWorkspaceAsset(ctx.workspaceId, file, 'fascia_logo');
        ctx.workspaceAssets = Array.isArray(result.assets) ? result.assets : ctx.workspaceAssets;
        if (result.asset?.id) {
          const nextMode = ctx.sceneState.branding.mode === 'text' ? 'logo_text' : ctx.sceneState.branding.mode;
          applyBrandingState(ctx, { logoAssetId: Number(result.asset.id), mode: nextMode });
        }
        renderRightPanel(ctx);
      } catch (error) {
        window.alert(error.message || 'Logo upload failed');
      } finally {
        logoUpload.value = '';
      }
    });
    logoRemove?.addEventListener('click', () => {
      const nextMode = ['logo', 'logo_text'].includes(ctx.sceneState.branding.mode) ? 'text' : ctx.sceneState.branding.mode;
      applyBrandingState(ctx, { logoAssetId: null, mode: nextMode });
      renderRightPanel(ctx);
    });
  }

  function renderActivitySection(ctx) {
    if (!ctx.activities.length) return '<div class="workspace-empty">No activity yet.</div>';
    return ctx.activities.map((entry) => `
      <div style="padding:10px;border:0.5px solid var(--border);border-radius:12px;background:var(--surface2);display:flex;flex-direction:column;gap:4px;">
        <div style="font-size:12px;color:var(--text1);"><strong>${escapeHtml(entry.actor || 'System')}</strong> ${escapeHtml(entry.event || entry.action || 'updated workspace')}</div>
        <div style="font-size:11px;color:var(--text3);">${escapeHtml(formatDateTime(entry.created_at))}</div>
      </div>
    `).join('');
  }

  function compareOptionMarkup(ctx, selectedValue) {
    const selected = String(selectedValue || '');
    const currentLabel = ctx.meta?.review?.draft_state?.active_review_label || 'Current workspace';
    const options = [
      `<option value="current"${selected === 'current' ? ' selected' : ''}>${escapeHtml(currentLabel)}</option>`,
    ];
    ctx.versions.forEach((entry) => {
      options.push(
        `<option value="${entry.id}"${selected === String(entry.id) ? ' selected' : ''}>${escapeHtml(entry.label || `Version ${entry.id}`)}</option>`
      );
    });
    return options.join('');
  }

  function renderComparisonResult(ctx) {
    const comparison = ctx.versionComparison;
    if (!comparison) {
      return '<div class="workspace-empty">Choose two snapshots to compare the review copy, dimensions, and furniture counts.</div>';
    }
    const left = comparison.left || {};
    const right = comparison.right || {};
    const leftSummary = left.summary || {};
    const rightSummary = right.summary || {};
    return `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
        <div style="padding:10px;border:0.5px solid var(--border);border-radius:12px;background:var(--surface2);display:flex;flex-direction:column;gap:4px;">
          <div style="font-size:11px;color:var(--text3);">Left snapshot</div>
          <div style="font-size:12px;font-weight:600;color:var(--text1);">${escapeHtml(left.label || 'Snapshot')}</div>
          <div style="font-size:11px;color:var(--text3);">${escapeHtml(leftSummary.dims_label || 'Dimensions unavailable')}</div>
          <div style="font-size:11px;color:var(--text3);">${escapeHtml(String(leftSummary.furniture_count || 0))} furniture · ${escapeHtml(String(leftSummary.light_count || 0))} lights</div>
        </div>
        <div style="padding:10px;border:0.5px solid var(--border);border-radius:12px;background:var(--surface2);display:flex;flex-direction:column;gap:4px;">
          <div style="font-size:11px;color:var(--text3);">Right snapshot</div>
          <div style="font-size:12px;font-weight:600;color:var(--text1);">${escapeHtml(right.label || 'Snapshot')}</div>
          <div style="font-size:11px;color:var(--text3);">${escapeHtml(rightSummary.dims_label || 'Dimensions unavailable')}</div>
          <div style="font-size:11px;color:var(--text3);">${escapeHtml(String(rightSummary.furniture_count || 0))} furniture · ${escapeHtml(String(rightSummary.light_count || 0))} lights</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${(comparison.changes || []).map((item) => `
          <div style="padding:10px;border:0.5px solid var(--border);border-radius:12px;background:var(--surface2);font-size:12px;color:var(--text2);">
            ${escapeHtml(item)}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderFeedbackList(ctx) {
    const feedbackItems = ctx.meta?.review?.feedback_requests || [];
    if (!feedbackItems.length) {
      return '<div class="workspace-empty">No structured PM checklist has been sent yet.</div>';
    }
    return feedbackItems.map((entry) => `
      <div style="padding:10px;border:0.5px solid var(--border);border-radius:12px;background:var(--surface2);display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="font-size:12px;font-weight:600;color:var(--text1);">${escapeHtml(entry.summary || 'Checklist')}</div>
          <span style="font-size:11px;color:${entry.is_open ? 'var(--amber)' : 'var(--text3)'};">${escapeHtml(entry.is_open ? 'Open' : 'Resolved')}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);">${escapeHtml(entry.created_by_label || 'Project Manager')} · ${escapeHtml(formatDateTime(entry.created_at))}${entry.target_version_label ? ` · ${escapeHtml(entry.target_version_label)}` : ''}</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${(entry.items || []).map((item) => `
            <div style="font-size:12px;color:var(--text2);display:flex;gap:6px;align-items:flex-start;">
              <span style="color:var(--accent);font-weight:700;">•</span>
              <span>${escapeHtml(item)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderVersionsPanel(ctx) {
    const latestSubmission = ctx.meta?.review?.draft_state?.last_client_submission || null;
    if (!ctx.versionCompareSelection) {
      ctx.versionCompareSelection = {
        left: latestSubmission?.id ? String(latestSubmission.id) : 'current',
        right: 'current',
      };
    }
    ctx.panelTitleEl.textContent = PANEL_META.versions.title;
    ctx.panelSubtitleEl.textContent = PANEL_META.versions.subtitle;
    ctx.panelBodyEl.innerHTML = `
      <div class="workspace-section">
        <div class="workspace-panel-heading">Compare snapshots</div>
        <div class="workspace-note">Review the latest client submission against the current workspace before sending the next update.</div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
          <div class="workspace-field">
            <label for="workspaceCompareLeft">Left</label>
            <select class="workspace-select" id="workspaceCompareLeft">${compareOptionMarkup(ctx, ctx.versionCompareSelection.left)}</select>
          </div>
          <div class="workspace-field">
            <label for="workspaceCompareRight">Right</label>
            <select class="workspace-select" id="workspaceCompareRight">${compareOptionMarkup(ctx, ctx.versionCompareSelection.right)}</select>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="workspaceRunCompare" class="btn-primary" type="button" style="font-size:12px;padding:6px 12px;">Compare</button>
          <button id="workspaceResetCompare" class="btn-ghost" type="button" style="font-size:12px;padding:6px 12px;">Reset</button>
        </div>
        <div id="workspaceCompareResult" style="display:flex;flex-direction:column;gap:8px;">${renderComparisonResult(ctx)}</div>
      </div>
      <div class="workspace-section">
        <div class="workspace-panel-heading">Client change checklist</div>
        <div class="workspace-note">Send a structured checklist to the client. The next client submission automatically resolves the current open checklist.</div>
        <input id="workspaceFeedbackSummary" class="workspace-input" type="text" maxlength="255" placeholder="Summary, for example: Final polish before approval">
        <textarea id="workspaceFeedbackItems" class="workspace-input" style="min-height:108px;resize:vertical;" placeholder="One line per requested change&#10;Move the reception desk to the front-left corner&#10;Replace the rear graphic with the final brand artwork"></textarea>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div style="font-size:11px;color:var(--text3);">${escapeHtml(latestSubmission?.label || 'Checklist will target the latest submitted review copy automatically.')}</div>
          <button id="workspaceSendFeedback" class="btn-primary" type="button" style="font-size:12px;padding:6px 12px;">Send checklist</button>
        </div>
        <div id="workspaceFeedbackList" style="display:flex;flex-direction:column;gap:8px;">${renderFeedbackList(ctx)}</div>
      </div>
      <div class="workspace-section">
        <div style="display:flex;gap:8px;">
          <button id="workspaceSaveVersion" class="btn-primary" type="button" style="font-size:12px;padding:6px 12px;">Save version</button>
          <button id="workspaceClearVersions" class="btn-ghost" type="button" style="font-size:12px;padding:6px 12px;">Clear</button>
        </div>
        <div id="workspaceVersionList" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>
      <div class="workspace-section">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div class="workspace-panel-heading">Recent activity</div>
          <button id="workspaceRefreshActivity" class="btn-ghost" type="button" style="font-size:12px;padding:6px 10px;">Refresh</button>
        </div>
        <div id="workspaceActivityList" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>
    `;

    const listEl = queryWorkspacePanel(ctx, 'versionListEl');
    listEl.innerHTML = ctx.versions.length
      ? ctx.versions.map((entry) => `
        <div style="padding:10px;border:0.5px solid var(--border);border-radius:12px;background:var(--surface2);display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div><div style="font-size:12px;font-weight:600;color:var(--text1);">${escapeHtml(entry.label || entry.name || 'Version')}</div><div style="font-size:11px;color:var(--text3);">${escapeHtml(formatDateTime(entry.created_at || entry.timestamp))}</div></div>
          <button type="button" class="btn-ghost" data-restore-version="${entry.id}" style="font-size:12px;padding:6px 10px;">Restore</button>
        </div>
      `).join('')
      : '<div class="workspace-empty">No versions saved yet.</div>';

    queryWorkspacePanel(ctx, 'activityListEl').innerHTML = renderActivitySection(ctx);
    queryWorkspacePanel(ctx, 'runCompareButton')?.addEventListener('click', async () => {
      const left = queryWorkspacePanel(ctx, 'compareLeftSelect')?.value || 'current';
      const right = queryWorkspacePanel(ctx, 'compareRightSelect')?.value || '';
      ctx.versionCompareSelection = { left, right };
      try {
        ctx.versionComparison = await ctx.api.compareWorkspaceVersions(ctx.workspaceId, left, right);
        renderRightPanel(ctx);
      } catch (error) {
        window.alert(error.message || 'Compare failed');
      }
    });
    queryWorkspacePanel(ctx, 'resetCompareButton')?.addEventListener('click', () => {
      ctx.versionComparison = null;
      ctx.versionCompareSelection = {
        left: latestSubmission?.id ? String(latestSubmission.id) : 'current',
        right: 'current',
      };
      renderRightPanel(ctx);
    });
    queryWorkspacePanel(ctx, 'sendFeedbackButton')?.addEventListener('click', async () => {
      const summary = queryWorkspacePanel(ctx, 'feedbackSummaryInput')?.value?.trim() || '';
      const items = (queryWorkspacePanel(ctx, 'feedbackItemsInput')?.value || '')
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (!summary) {
        window.alert('Add a summary for the checklist.');
        return;
      }
      if (!items.length) {
        window.alert('Add at least one checklist item.');
        return;
      }
      try {
        const result = await ctx.api.createWorkspaceFeedback(ctx.workspaceId, {
          summary,
          items,
          target_version_id: latestSubmission?.id || null,
        });
        if (result.review) {
          ctx.meta = {
            ...(ctx.meta || {}),
            review: result.review,
            workspace: {
              ...(ctx.meta?.workspace || {}),
              status: 'needs_changes',
            },
          };
        }
        await refreshVersionsAndActivity(ctx);
        updateContextUi(ctx);
        showWorkspaceToast(result.message || 'Structured feedback sent to the client.');
        renderRightPanel(ctx);
      } catch (error) {
        window.alert(error.message || 'Unable to send checklist');
      }
    });
    queryWorkspacePanel(ctx, 'saveVersionButton')?.addEventListener('click', async () => {
      try {
        await saveVersionSnapshot(ctx, 'Manual save');
        await refreshVersionsAndActivity(ctx);
        renderRightPanel(ctx);
      } catch (error) {
        window.alert(error.message || 'Version save failed');
      }
    });
    queryWorkspacePanel(ctx, 'clearVersionsButton')?.addEventListener('click', async () => {
      if (!window.confirm('Clear version history?')) return;
      try {
        await clearVersionSnapshots(ctx);
        await refreshVersionsAndActivity(ctx);
        renderRightPanel(ctx);
      } catch (error) {
        window.alert(error.message || 'Clear failed');
      }
    });
    queryWorkspacePanel(ctx, 'refreshActivityButton')?.addEventListener('click', async () => {
      await refreshVersionsAndActivity(ctx);
      renderRightPanel(ctx);
    });
    queryWorkspacePanelAll(ctx, 'restoreVersionButtons').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!window.confirm('Restore this version? Current workspace state will be replaced.')) return;
        try {
          await restoreVersionSnapshot(ctx, Number(button.dataset.restoreVersion));
          await refreshVersionsAndActivity(ctx);
          renderRightPanel(ctx);
        } catch (error) {
          window.alert(error.message || 'Restore failed');
        }
      });
    });
  }

  return {
    renderAssetsPanel,
    renderBillPanel,
    renderRoomPanel,
    renderLightingPanel,
    renderTextPanel,
    renderSystemPanel,
    renderFasciaPanel,
    renderVersionsPanel,
  };
}
