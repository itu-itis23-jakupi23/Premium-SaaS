function createLightCatalogItem({
  id,
  code,
  name,
  lightType,
  price,
  size,
  color,
  defaultTilt,
}) {
  const normalizedCode = String(code || id || '').trim();
  return Object.freeze({
    id: String(id || normalizedCode).trim(),
    asset_id: normalizedCode,
    code: normalizedCode,
    name: String(name || normalizedCode).trim(),
    category: 'Lighting',
    type: 'light',
    objectKind: 'light',
    shape: 'rail_light',
    lightType: String(lightType || 'spot').trim().toLowerCase(),
    price: Number.isFinite(Number(price)) ? Number(price) : 0,
    color: String(color || '#d9e0e7'),
    stock: 999,
    size: Object.freeze({
      width: Math.max(0.08, Number(size?.width) || 0.16),
      depth: Math.max(0.08, Number(size?.depth) || 0.14),
      height: Math.max(0.08, Number(size?.height) || 0.22),
    }),
    defaultTilt: Number.isFinite(Number(defaultTilt)) ? Number(defaultTilt) : 0.28,
    reference_image: '',
    referenceImage: '',
    reference_image_path: '',
  });
}

export const LIGHTS_CATALOG = Object.freeze([
  createLightCatalogItem({
    id: '417',
    code: '417',
    name: 'Spotlight',
    lightType: 'spot',
    price: 15,
    color: '#2b3037',
    size: { width: 0.18, depth: 0.18, height: 0.28 },
    defaultTilt: 0.34,
  }),
  createLightCatalogItem({
    id: '418',
    code: '418',
    name: 'Floodlight',
    lightType: 'flood',
    price: 18,
    color: '#313740',
    size: { width: 0.22, depth: 0.18, height: 0.26 },
    defaultTilt: 0.28,
  }),
  createLightCatalogItem({
    id: 'fascia_light',
    code: 'fascia_light',
    name: 'Fascia Light',
    lightType: 'fascia',
    price: 12,
    color: '#dce3ea',
    size: { width: 0.32, depth: 0.14, height: 0.14 },
    defaultTilt: 0.16,
  }),
]);

function cloneLightCatalogItem(item) {
  return {
    ...item,
    size: { ...(item.size || {}) },
  };
}

export function cloneLightsCatalog() {
  return LIGHTS_CATALOG.map(cloneLightCatalogItem);
}

export function getLightCatalogItemByCode(code, source = LIGHTS_CATALOG) {
  const normalizedCode = String(code || '').trim().toLowerCase();
  const items = Array.isArray(source) ? source : LIGHTS_CATALOG;
  const match = items.find((item) => String(item.code || item.id || '').trim().toLowerCase() === normalizedCode);
  return match ? cloneLightCatalogItem(match) : null;
}

export function getLightCatalogItemByType(lightType, source = LIGHTS_CATALOG) {
  const normalizedType = String(lightType || '').trim().toLowerCase();
  const items = Array.isArray(source) ? source : LIGHTS_CATALOG;
  const match = items.find((item) => String(item.lightType || '').trim().toLowerCase() === normalizedType);
  return match ? cloneLightCatalogItem(match) : null;
}

export function getLightCatalogLabel(item = {}) {
  const code = String(item.code || item.id || item.asset_id || '').trim();
  const name = String(item.name || 'Light').trim();
  return code ? `${code} - ${name}` : name;
}
