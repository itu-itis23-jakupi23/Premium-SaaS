/**
 * booth/materials.js
 * Centralised material factory.  All MeshStandardMaterial values come from here
 * so the whole booth has a consistent shading language.
 */

const THREE = () => window.THREE;

// ─── Helpers ────────────────────────────────────────────────────────────────

function std(params) {
  return new (THREE()).MeshStandardMaterial(params);
}

/**
 * Generates a canvas-based carpet texture with random fibre strokes.
 */
function buildCarpetTexture(hexColor) {
  const T = THREE();
  if (!T) return null;
  try {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const r = (hexColor >> 16) & 0xff;
    const g = (hexColor >>  8) & 0xff;
    const b =  hexColor        & 0xff;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 5000; i++) {
      const x   = Math.random() * size;
      const y   = Math.random() * size;
      const len = 1.5 + Math.random() * 3.5;
      const ang = Math.random() * Math.PI;
      const v   = (Math.random() - 0.5) * 30;
      ctx.strokeStyle = `rgba(${Math.max(0,Math.min(255,r+v))},${Math.max(0,Math.min(255,g+v))},${Math.max(0,Math.min(255,b+v))},0.55)`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    const tex = new T.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  } catch (_) { return null; }
}

/**
 * Generates a canvas-based wood plank texture (horizontal grain).
 */
function buildWoodTexture() {
  const T = THREE();
  if (!T) return null;
  try {
    const w = 1024, h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#b07848';
    ctx.fillRect(0, 0, w, h);
    // grain lines
    for (let y = 0; y < h; y += 2 + Math.random() * 4) {
      const bright = (Math.random() - 0.5) * 22;
      ctx.strokeStyle = `rgba(${Math.max(0,Math.min(255,Math.round(168+bright)))},${Math.max(0,Math.min(255,Math.round(110+bright)))},${Math.max(0,Math.min(255,Math.round(68+bright)))},0.55)`;
      ctx.lineWidth = 0.8 + Math.random();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + (Math.random() - 0.5) * 6);
      ctx.stroke();
    }
    // knot hints
    for (let i = 0; i < 6; i++) {
      const kx = Math.random() * w, ky = Math.random() * h;
      const rr = 8 + Math.random() * 18;
      ctx.strokeStyle = 'rgba(90,55,28,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(kx, ky, rr, rr * 0.55, Math.random(), 0, Math.PI * 2);
      ctx.stroke();
    }
    const tex = new T.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(4, 2);
    return tex;
  } catch (_) { return null; }
}

// ─── Public Material Factories ───────────────────────────────────────────────

/** Brushed-aluminum uprights & beams */
export function aluminumMat(color = 0x8a9aaa) {
  return std({ color, roughness: 0.26, metalness: 0.84 });
}

/** Standard white/cream wall panel */
export function defaultPanelMat(color = 0xf3f0ec, map = null) {
  return std({ color: map ? 0xffffff : color, map: map || null, roughness: 0.42, metalness: 0.02 });
}

/** Accent wall — deep color, slight sheen */
export function accentPanelMat(color = 0x1b2d4f) {
  return std({ color, roughness: 0.36, metalness: 0.04 });
}

/** Fascia band — matches accent, slightly more matte */
export function fasciaMat(color = 0x1b2d4f) {
  return std({ color, roughness: 0.44, metalness: 0.06 });
}

/** Booth interior floor */
export function floorMat(type = 'carpet', color = 0x2a3240) {
  if (type === 'wood') {
    const map = buildWoodTexture();
    return std({ color: map ? 0xffffff : 0xb07848, map, roughness: 0.55, metalness: 0.0 });
  }
  if (type === 'concrete') {
    return std({ color: 0xc8c0b4, roughness: 0.88, metalness: 0.0 });
  }
  // carpet (default)
  const map = buildCarpetTexture(color);
  return std({ color: map ? 0xffffff : color, map, roughness: 0.92, metalness: 0.0 });
}

/** Reception desk — dark wood veneer face */
export function deskMat() {
  return std({ color: 0x2a1f14, roughness: 0.48, metalness: 0.02 });
}

/** Desk top — light stone / corian */
export function deskTopMat() {
  return std({ color: 0xf0ede8, roughness: 0.38, metalness: 0.0 });
}

/** Generic furniture body */
export function furnitureMat(color = 0xd0cdc8) {
  return std({ color, roughness: 0.60, metalness: 0.04 });
}

/** LED screen — emissive black glass */
export function screenMat(map = null) {
  return std({
    color:     0x060810,
    emissive:  map ? 0xffffff : 0x1a3a8f,
    emissiveMap: map || null,
    emissiveIntensity: map ? 0.9 : 0.55,
    roughness: 0.08,
    metalness: 0.6,
  });
}

/** Screen bezel */
export function screenBezelMat() {
  return std({ color: 0x111316, roughness: 0.3, metalness: 0.8 });
}

/** Logo back-plate — matte white */
export function logoMat(map = null) {
  return std({ color: map ? 0xffffff : 0xf8f6f2, map, roughness: 0.55, metalness: 0.0, transparent: !map, opacity: map ? 1.0 : 0.0 });
}
