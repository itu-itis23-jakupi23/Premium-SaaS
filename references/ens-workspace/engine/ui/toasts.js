/* Migration note: moved workspace toast fallback behavior from admin_workspace_bootstrap.js. */

export function createWorkspaceToastNode(message) {
  const toast = document.createElement('div');
  toast.className = 'workspace-toast';
  toast.textContent = String(message);
  return toast;
}

export function showWorkspaceToast(message) {
  if (typeof window.showPortalToast === 'function') {
    window.showPortalToast(message);
    return;
  }
  window.alert(message);
}
