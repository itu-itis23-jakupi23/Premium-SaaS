/* Migration note: moved workspace DOM query helpers, selector registry, and shared UI element lookup from admin_workspace_bootstrap.js. */

export const WORKSPACE_UI_SELECTORS = Object.freeze({
  clientNameEl: '[data-workspace-client-name]',
  workspaceNameEls: '[data-workspace-name]',
  exhibitionNameEl: '[data-workspace-exhibition]',
  arrangementStatusEls: '[data-workspace-arrangement-status]',
  sendNoteEls: '[data-workspace-send-note]',
  unsavedBadge: '#workspaceDirtyBadge',
  saveButton: '#workspaceSaveButton',
  discardButton: '#workspaceDiscardButton',
  sendButton: '#workspaceSendButton',
  sendButtonLabelEl: '#workspaceSendButton span',
  gridButton: '#workspaceGridButton',
  camPerspectiveButton: '#workspaceCamPerspective',
  camTopButton: '#workspaceCamTop',
  camFrontButton: '#workspaceCamFront',
  previewButton: '#workspacePreviewButton',
  versionsButton: '#workspaceVersionsButton',
  toolButtons: '.ws-tool[data-workspace-tool]',
  panelEl: '#workspacePanel',
  panelTitleEl: '#workspacePanelTitle',
  panelSubtitleEl: '#workspacePanelSubtitle',
  panelBodyEl: '#workspacePanelBody',
  panelCloseButton: '#workspacePanelClose',
});

export const WORKSPACE_PANEL_SELECTORS = Object.freeze({
  assetSearchEl: '#workspaceAssetSearch',
  assetLibraryEl: '#workspaceAssetLibrary',
  currencySelect: '#workspaceCurrencySelect',
  billingSelect: '#workspaceBillingSelect',
  vatToggle: '#workspaceVatToggle',
  quoteRowsEl: '#workspaceQuoteRows',
  quoteSubtotalEl: '#workspaceQuoteSubtotal',
  quoteVatEl: '#workspaceQuoteVat',
  quoteGrandEl: '#workspaceQuoteGrand',
  sendBillButton: '#workspaceSendBillBtn',
  lightingPresetButtons: '[data-lighting-preset]',
  railLightButtons: '[data-light-code]',
  railPosition: '#workspaceRailPosition',
  railTilt: '#workspaceRailTilt',
  fasciaTextInput: '#workspaceTextInput',
  sceneTextAddButton: '#workspaceSceneTextAdd',
  sceneTextInput: '#workspaceSceneTextInput',
  sceneTextColorInput: '#workspaceSceneTextColor',
  sceneTextSizeInput: '#workspaceSceneTextSize',
  selectedTextValueInput: '#workspaceSelectedTextValue',
  selectedTextColorInput: '#workspaceSelectedTextColor',
  selectedTextSizeInput: '#workspaceSelectedTextSize',
  selectedTextDeleteButton: '#workspaceSelectedTextDelete',
  boothStyleButtons: '[data-booth-style]',
  buildModeButtons: '[data-build-mode]',
  dimInputs: '[data-dim-input]',
  openSideInputs: '[data-open-side]',
  permissionInputs: '[data-permission]',
  snapToggle: '#workspaceSnapEnabled',
  measureToggle: '#workspaceMeasureEnabled',
  snapStepInput: '#workspaceSnapStep',
  rotationSnapInput: '#workspaceRotationSnap',
  fasciaEnabledToggle: '#workspaceFasciaEnabled',
  fasciaOptionSelect: '#workspaceFasciaOption',
  fasciaTextField: '#workspaceFasciaText',
  brandingModeSelect: '#workspaceBrandingMode',
  brandingScopeSelect: '#workspaceBrandingScope',
  logoAssetSelect: '#workspaceLogoAsset',
  logoUploadInput: '#workspaceLogoUpload',
  logoRemoveButton: '#workspaceLogoRemove',
  versionListEl: '#workspaceVersionList',
  activityListEl: '#workspaceActivityList',
  runCompareButton: '#workspaceRunCompare',
  compareLeftSelect: '#workspaceCompareLeft',
  compareRightSelect: '#workspaceCompareRight',
  resetCompareButton: '#workspaceResetCompare',
  sendFeedbackButton: '#workspaceSendFeedback',
  feedbackSummaryInput: '#workspaceFeedbackSummary',
  feedbackItemsInput: '#workspaceFeedbackItems',
  saveVersionButton: '#workspaceSaveVersion',
  clearVersionsButton: '#workspaceClearVersions',
  refreshActivityButton: '#workspaceRefreshActivity',
  restoreVersionButtons: '[data-restore-version]',
});

export function queryElement(selector, root = document) {
  return root?.querySelector?.(selector) ?? null;
}

export function queryElements(selector, root = document) {
  return root?.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];
}

export function queryWorkspaceUi(name, root = document) {
  return queryElement(WORKSPACE_UI_SELECTORS[name], root);
}

export function queryWorkspaceUiAll(name, root = document) {
  return queryElements(WORKSPACE_UI_SELECTORS[name], root);
}

export function queryWorkspacePanel(ctx, name) {
  return queryElement(WORKSPACE_PANEL_SELECTORS[name], ctx?.panelBodyEl || document);
}

export function queryWorkspacePanelAll(ctx, name) {
  return queryElements(WORKSPACE_PANEL_SELECTORS[name], ctx?.panelBodyEl || document);
}

export function findWorkspaceUi() {
  return {
    clientNameEl: queryWorkspaceUi('clientNameEl'),
    workspaceNameEls: queryWorkspaceUiAll('workspaceNameEls'),
    exhibitionNameEl: queryWorkspaceUi('exhibitionNameEl'),
    arrangementStatusEls: queryWorkspaceUiAll('arrangementStatusEls'),
    sendNoteEls: queryWorkspaceUiAll('sendNoteEls'),
    unsavedBadge: queryWorkspaceUi('unsavedBadge'),
    saveButton: queryWorkspaceUi('saveButton'),
    discardButton: queryWorkspaceUi('discardButton'),
    sendButton: queryWorkspaceUi('sendButton'),
    sendButtonLabelEl: queryWorkspaceUi('sendButtonLabelEl'),
    gridButton: queryWorkspaceUi('gridButton'),
    camPerspectiveButton: queryWorkspaceUi('camPerspectiveButton'),
    camTopButton: queryWorkspaceUi('camTopButton'),
    camFrontButton: queryWorkspaceUi('camFrontButton'),
    previewButton: queryWorkspaceUi('previewButton'),
    versionsButton: queryWorkspaceUi('versionsButton'),
    toolButtons: queryWorkspaceUiAll('toolButtons'),
    panelEl: queryWorkspaceUi('panelEl'),
    panelTitleEl: queryWorkspaceUi('panelTitleEl'),
    panelSubtitleEl: queryWorkspaceUi('panelSubtitleEl'),
    panelBodyEl: queryWorkspaceUi('panelBodyEl'),
    panelCloseButton: queryWorkspaceUi('panelCloseButton'),
  };
}
