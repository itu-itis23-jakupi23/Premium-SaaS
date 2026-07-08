import {
  applyCsrfHeader as applyAdminCsrfHeader,
  buildApiUrl as buildAdminApiUrl,
  getApiBase as getAdminApiBase,
} from '/static/admin/js/auth.js?v=20260405-auth-fixed-first-party';
import {
  applyCsrfHeader as applyClientCsrfHeader,
  buildApiUrl as buildClientApiUrl,
  getApiBase as getClientApiBase,
} from '/static/client/js/auth.js?v=20260405-auth-fixed-first-party';

function createRequest({ baseUrl = '', buildApiUrl, getApiBase, applyCsrfHeader }) {
  return async function request(path, options = {}) {
    const apiBaseUrl = await getApiBase(baseUrl);
    const method = String(options.method || 'GET').toUpperCase();
    let headers = { ...(options.headers || {}) };
    const isFormData =
      typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (typeof applyCsrfHeader === 'function') {
      headers = applyCsrfHeader(headers, method);
    }
    let response;
    try {
      response = await fetch(buildApiUrl(path, apiBaseUrl), {
        credentials: 'include',
        headers,
        ...options,
      });
    } catch (_) {
      throw new Error(`Cannot reach the Flask backend at ${apiBaseUrl}.`);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Workspace request failed');
    }
    return data;
  };
}

export function createAdminWorkspaceApi(baseUrl = '') {
  const request = createRequest({
    baseUrl,
    applyCsrfHeader: applyAdminCsrfHeader,
    buildApiUrl: buildAdminApiUrl,
    getApiBase: getAdminApiBase,
  });

  return {
    async loadWorkspace(workspaceId) {
      return request(`/api/admin/workspaces/${workspaceId}`);
    },
    async saveWorkspaceScene(workspaceId, scene) {
      return request(`/api/admin/workspaces/${workspaceId}/scene`, {
        method: 'PUT',
        body: JSON.stringify({ scene, source: 'admin_portal' }),
      });
    },
    async sendWorkspaceToClient(workspaceId, payload = {}) {
      return request(`/api/admin/workspaces/${workspaceId}/send-to-client`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async listWorkspaceVersions(workspaceId) {
      const result = await request(`/api/admin/workspaces/${workspaceId}/versions`);
      return Array.isArray(result.items) ? result.items : [];
    },
    async createWorkspaceVersion(workspaceId, label, scene = null) {
      return request(`/api/admin/workspaces/${workspaceId}/versions`, {
        method: 'POST',
        body: JSON.stringify({ label, scene }),
      });
    },
    async restoreWorkspaceVersion(workspaceId, versionId) {
      return request(
        `/api/admin/workspaces/${workspaceId}/versions/${versionId}/restore`,
        {
          method: 'POST',
        }
      );
    },
    async clearWorkspaceVersions(workspaceId) {
      return request(`/api/admin/workspaces/${workspaceId}/versions`, {
        method: 'DELETE',
      });
    },
    async compareWorkspaceVersions(workspaceId, left, right) {
      const params = new URLSearchParams();
      if (left != null && left !== '') params.set('left', String(left));
      if (right != null && right !== '') params.set('right', String(right));
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`/api/admin/workspaces/${workspaceId}/versions/compare${suffix}`);
    },
    async createWorkspaceFeedback(workspaceId, payload = {}) {
      return request(`/api/admin/workspaces/${workspaceId}/feedback`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async listWorkspaceActivity(workspaceId) {
      const result = await request(`/api/admin/workspaces/${workspaceId}/activity`);
      return Array.isArray(result.items) ? result.items : [];
    },
    async listWorkspaceAssets(workspaceId, kind = '') {
      const suffix = kind ? `?kind=${encodeURIComponent(kind)}` : '';
      const result = await request(`/api/admin/workspaces/${workspaceId}/assets${suffix}`);
      return Array.isArray(result.items) ? result.items : [];
    },
    async uploadWorkspaceAsset(workspaceId, file, kind) {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);
      return request(`/api/admin/workspaces/${workspaceId}/assets`, {
        method: 'POST',
        body,
      });
    },
    async deleteWorkspaceAsset(workspaceId, assetId) {
      return request(`/api/admin/workspaces/${workspaceId}/assets/${assetId}`, {
        method: 'DELETE',
      });
    },
    async listFurnitureCatalog() {
      const result = await request('/api/admin/furniture-catalog');
      return Array.isArray(result.items) ? result.items : [];
    },
  };
}

export function createClientWorkspaceApi(baseUrl = '') {
  const request = createRequest({
    baseUrl,
    applyCsrfHeader: applyClientCsrfHeader,
    buildApiUrl: buildClientApiUrl,
    getApiBase: getClientApiBase,
  });

  return {
    async loadWorkspace(workspaceId) {
      return request(`/api/client/workspaces/${workspaceId}/editor`);
    },
    async saveWorkspaceScene(workspaceId, scene, expectedVersion = null) {
      return request(`/api/client/workspaces/${workspaceId}/scene`, {
        method: 'PUT',
        body: JSON.stringify({
          scene,
          expected_version: expectedVersion,
          source: 'client_portal',
        }),
      });
    },
    async sendWorkspaceToAdmin(workspaceId, payload = {}) {
      return request(`/api/client/workspaces/${workspaceId}/send-arrangement`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async requestWorkspaceSubscription(workspaceId, payload = {}) {
      return request(`/api/client/workspaces/${workspaceId}/subscription-request`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async listWorkspaceVersions() {
      return [];
    },
    async createWorkspaceVersion() {
      throw new Error('Version history is not available in the client workspace.');
    },
    async restoreWorkspaceVersion() {
      throw new Error('Version history is not available in the client workspace.');
    },
    async clearWorkspaceVersions() {
      throw new Error('Version history is not available in the client workspace.');
    },
    async listWorkspaceActivity(workspaceId) {
      const result = await request(`/api/client/workspaces/${workspaceId}/activity`);
      return Array.isArray(result.items) ? result.items : [];
    },
    async listWorkspaceAssets() {
      return [];
    },
    async uploadWorkspaceAsset() {
      throw new Error('Asset uploads are not available in the client workspace.');
    },
    async deleteWorkspaceAsset() {
      throw new Error('Asset uploads are not available in the client workspace.');
    },
    async listFurnitureCatalog() {
      return [];
    },
  };
}
