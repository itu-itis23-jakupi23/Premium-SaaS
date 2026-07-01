const SHAPE_REFERENCE_IMAGES = Object.freeze({
  round_table: '/static/workspace/furniture/reference_round_table.svg',
  rect_table: '/static/workspace/furniture/reference_rect_table.svg',
  box: '/static/workspace/furniture/reference_box.svg',
  counter: '/static/workspace/furniture/reference_counter.svg',
  shelf: '/static/workspace/furniture/reference_shelf.svg',
  wall_shelf: '/static/workspace/furniture/reference_shelf.svg',
  chair: '/static/workspace/furniture/reference_chair.svg',
  bar_stool: '/static/workspace/furniture/reference_bar_stool.svg',
});

const SHAPE_COLOR_SWATCHES = Object.freeze({
  round_table: '#f4f1ec',
  rect_table: '#f3efe8',
  box: '#f1ece5',
  counter: '#efe9e1',
  shelf: '#f2ede6',
  wall_shelf: '#d1d5db',
  chair: '#f1ece6',
  bar_stool: '#e7e2dc',
});

const CATALOG_COLOR_SWATCHES = Object.freeze({
  '103': '#f5f3ef',
  '105': '#d9c9b8',
  '107': '#f4f2ee',
  '110': '#b2bac3',
  '111': '#ebe1d4',
  '112': '#f6f2ec',
  '113': '#f6f2ec',
  '149': '#ede4da',
  '201': '#f2ece4',
  '205': '#f4efe7',
  '206': '#f4efe7',
  '208': '#ddd5cb',
  '209': '#ddd5cb',
  '211': '#23262a',
  '212': '#f5f1ea',
  '213': '#f2ece4',
  '215': '#f0ebe4',
  '216': '#f0ebe4',
  '217': '#f2ede6',
  '218': '#f2ede6',
  '250-B': '#f3eee8',
  '255-B': '#f3efe9',
  '307': '#202327',
  '309': '#22252a',
  '458': '#f3eee8',
  '461': '#e3dbd1',
  '508': '#f4efe8',
  '513': '#22252a',
});

function getFurnitureColorSwatch(code, shape) {
  const normalizedCode = String(code || '').trim();
  const normalizedShape = String(shape || '').trim();
  return CATALOG_COLOR_SWATCHES[normalizedCode] || SHAPE_COLOR_SWATCHES[normalizedShape] || '#f8fafc';
}

function roundDimensions(diameter, height) {
  return {
    width: Number(diameter),
    depth: Number(diameter),
    height: Number(height),
    diameter: Number(diameter),
  };
}

function rectDimensions(width, depth, height) {
  return {
    width: Number(width),
    depth: Number(depth),
    height: Number(height),
  };
}

function toMeters(dimensions = {}) {
  const widthCm = Number(dimensions.width ?? dimensions.diameter) || 0;
  const depthCm = Number(dimensions.depth ?? dimensions.width ?? dimensions.diameter) || 0;
  const heightCm = Number(dimensions.height) || 0;
  return {
    width: Number((widthCm / 100).toFixed(3)),
    depth: Number((depthCm / 100).toFixed(3)),
    height: Number((heightCm / 100).toFixed(3)),
  };
}

function createFurnitureItem({
  code,
  name,
  category,
  shape,
  dimensions,
  price = 0,
  referenceImage = '',
  color = '',
  wallMounted = false,
}) {
  const normalizedCode = String(code).trim();
  const normalizedShape = String(shape).trim();
  const imagePath = referenceImage || SHAPE_REFERENCE_IMAGES[normalizedShape] || SHAPE_REFERENCE_IMAGES.box;
  return Object.freeze({
    id: normalizedCode,
    asset_id: normalizedCode,
    code: normalizedCode,
    name: String(name).trim(),
    category: String(category).trim(),
    type: 'parametric',
    shape: normalizedShape,
    dimensions: Object.freeze({ ...dimensions }),
    size: Object.freeze(toMeters(dimensions)),
    price: Number.isFinite(Number(price)) ? Number(price) : 0,
    stock: 999,
    color: String(color || getFurnitureColorSwatch(normalizedCode, normalizedShape)),
    wallMounted: Boolean(wallMounted),
    reference_image: imagePath,
    referenceImage: imagePath,
    reference_image_path: imagePath,
  });
}

export const FURNITURE_CATALOG = Object.freeze([
  createFurnitureItem({
    code: '103',
    name: 'Round Table',
    category: 'Tables',
    shape: 'round_table',
    dimensions: roundDimensions(70, 75),
    price: 1450,
  }),
  createFurnitureItem({
    code: '105',
    name: 'Square Table',
    category: 'Tables',
    shape: 'rect_table',
    dimensions: rectDimensions(70, 70, 75),
    price: 1480,
  }),
  createFurnitureItem({
    code: '107',
    name: 'Bar Table',
    category: 'Tables',
    shape: 'round_table',
    dimensions: roundDimensions(70, 105),
    price: 1650,
  }),
  createFurnitureItem({
    code: '110',
    name: 'Glass Table',
    category: 'Tables',
    shape: 'round_table',
    dimensions: roundDimensions(80, 75),
    price: 1725,
  }),
  createFurnitureItem({
    code: '111',
    name: 'Rectangle Table',
    category: 'Tables',
    shape: 'rect_table',
    dimensions: rectDimensions(110, 80, 75),
    price: 1850,
  }),
  createFurnitureItem({
    code: '112',
    name: 'Coffee Table 95',
    category: 'Tables',
    shape: 'rect_table',
    dimensions: rectDimensions(95, 55, 40),
    price: 980,
  }),
  createFurnitureItem({
    code: '113',
    name: 'Coffee Table 90',
    category: 'Tables',
    shape: 'rect_table',
    dimensions: rectDimensions(90, 55, 40),
    price: 960,
  }),
  createFurnitureItem({
    code: '201',
    name: 'Showcase',
    category: 'Displays',
    shape: 'box',
    dimensions: rectDimensions(102, 52, 99),
    price: 2800,
  }),
  createFurnitureItem({
    code: '205',
    name: 'Lighted Showcase',
    category: 'Displays',
    shape: 'box',
    dimensions: rectDimensions(102, 52, 195),
    price: 3450,
  }),
  createFurnitureItem({
    code: '206',
    name: 'Lighted Showcase Tall',
    category: 'Displays',
    shape: 'box',
    dimensions: rectDimensions(102, 52, 195),
    price: 3450,
  }),
  createFurnitureItem({
    code: '208',
    name: 'Counter',
    category: 'Counters',
    shape: 'counter',
    dimensions: rectDimensions(100, 55, 100),
    price: 3200,
  }),
  createFurnitureItem({
    code: '209',
    name: 'Information Desk',
    category: 'Counters',
    shape: 'counter',
    dimensions: rectDimensions(100, 55, 100),
    price: 3250,
  }),
  createFurnitureItem({
    code: '211',
    name: 'Black Meeting Table',
    category: 'Tables',
    shape: 'rect_table',
    dimensions: rectDimensions(140, 70, 75),
    price: 1980,
  }),
  createFurnitureItem({
    code: '212',
    name: 'White Table',
    category: 'Tables',
    shape: 'rect_table',
    dimensions: rectDimensions(140, 80, 75),
    price: 2050,
  }),
  createFurnitureItem({
    code: '213',
    name: 'Shelved Cabinet',
    category: 'Shelves',
    shape: 'shelf',
    dimensions: rectDimensions(102, 40, 195),
    price: 3100,
  }),
  createFurnitureItem({
    code: 'WS-001',
    name: 'Shelf',
    category: 'Wall Elements',
    shape: 'wall_shelf',
    dimensions: rectDimensions(100, 30, 5),
    price: 420,
    color: '#888888',
    wallMounted: true,
  }),
  createFurnitureItem({
    code: '215',
    name: 'Small Oval Desk',
    category: 'Counters',
    shape: 'counter',
    dimensions: rectDimensions(102, 40, 102),
    price: 2950,
  }),
  createFurnitureItem({
    code: '216',
    name: 'Cupboard',
    category: 'Storage',
    shape: 'box',
    dimensions: rectDimensions(105, 42, 82),
    price: 2550,
  }),
  createFurnitureItem({
    code: '217',
    name: 'Display Cube 50',
    category: 'Displays',
    shape: 'box',
    dimensions: rectDimensions(50, 50, 50),
    price: 740,
  }),
  createFurnitureItem({
    code: '218',
    name: 'Display Cube 75',
    category: 'Displays',
    shape: 'box',
    dimensions: rectDimensions(75, 75, 75),
    price: 940,
  }),
  createFurnitureItem({
    code: '458',
    name: 'Wooden Counter White',
    category: 'Counters',
    shape: 'counter',
    dimensions: rectDimensions(50, 100, 110),
    price: 3380,
  }),
  createFurnitureItem({
    code: '461',
    name: 'Lockable Counter',
    category: 'Counters',
    shape: 'counter',
    dimensions: rectDimensions(45, 95, 100),
    price: 3425,
  }),
  createFurnitureItem({
    code: '508',
    name: 'Wooden Bar Table',
    category: 'Tables',
    shape: 'rect_table',
    dimensions: rectDimensions(120, 60, 100),
    price: 1760,
  }),
  createFurnitureItem({
    code: '149',
    name: 'Plastic Chair',
    category: 'Chairs',
    shape: 'chair',
    dimensions: rectDimensions(46, 53, 82),
    price: 380,
  }),
  createFurnitureItem({
    code: '250-B',
    name: 'White Wood Chair',
    category: 'Chairs',
    shape: 'chair',
    dimensions: rectDimensions(45, 52, 80),
    price: 540,
  }),
  createFurnitureItem({
    code: '255-B',
    name: 'Leather Bar Chair',
    category: 'Chairs',
    shape: 'bar_stool',
    dimensions: rectDimensions(44, 50, 100),
    price: 690,
  }),
  createFurnitureItem({
    code: '307',
    name: 'ZZ Bar Stool',
    category: 'Chairs',
    shape: 'bar_stool',
    dimensions: rectDimensions(38, 38, 75),
    price: 420,
  }),
  createFurnitureItem({
    code: '309',
    name: 'Leather Chair',
    category: 'Chairs',
    shape: 'chair',
    dimensions: rectDimensions(46, 54, 80),
    price: 610,
  }),
  createFurnitureItem({
    code: '513',
    name: 'Wire Black Bar Chair',
    category: 'Chairs',
    shape: 'bar_stool',
    dimensions: rectDimensions(44, 48, 100),
    price: 640,
  }),
]);

function cloneFurnitureItem(item) {
  return {
    ...item,
    dimensions: { ...(item.dimensions || {}) },
    size: { ...(item.size || {}) },
    wallMounted: Boolean(item.wallMounted),
  };
}

export function cloneFurnitureCatalog() {
  return FURNITURE_CATALOG.map(cloneFurnitureItem);
}

export function normalizeFurnitureCatalogItem(raw = {}) {
  const code = String(raw.code || raw.id || raw.asset_id || raw.assetId || '').trim();
  const dimensions = raw.dimensions && typeof raw.dimensions === 'object' ? { ...raw.dimensions } : {};
  const shape = String(raw.shape || 'box').trim().toLowerCase();
  const size = raw.size && typeof raw.size === 'object' ? { ...raw.size } : toMeters(dimensions);
  const imagePath = String(
    raw.reference_image || raw.referenceImage || raw.reference_image_path || SHAPE_REFERENCE_IMAGES[shape] || SHAPE_REFERENCE_IMAGES.box
  ).trim();
  return {
    id: code,
    asset_id: code,
    code,
    name: String(raw.name || code).trim(),
    category: String(raw.category || 'Furniture').trim(),
    type: 'parametric',
    shape,
    dimensions,
    size,
    price: Number.isFinite(Number(raw.price)) ? Number(raw.price) : 0,
    stock: Number.isFinite(Number(raw.stock)) ? Number(raw.stock) : 999,
    color: String(raw.color || getFurnitureColorSwatch(code, shape)),
    wallMounted: Boolean(raw.wallMounted || raw.wall_mounted || shape === 'wall_shelf'),
    reference_image: imagePath,
    referenceImage: imagePath,
    reference_image_path: imagePath,
  };
}

export function getFurnitureCatalogItemByCode(code, source = FURNITURE_CATALOG) {
  const normalizedCode = String(code || '').trim();
  const items = Array.isArray(source) ? source : FURNITURE_CATALOG;
  const match = items.find((item) => String(item.code || item.id || item.asset_id || '').trim() === normalizedCode);
  return match ? cloneFurnitureItem(match) : null;
}

export function getFurnitureCatalogLabel(item = {}) {
  const code = String(item.code || item.id || item.asset_id || '').trim();
  const name = String(item.name || 'Furniture').trim();
  return code ? `${code} - ${name}` : name;
}
