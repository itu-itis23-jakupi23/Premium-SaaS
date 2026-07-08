/**
 * booth/config.js
 * Single source of truth for all booth generator defaults.
 * Every numeric value maps to a real-world millimetre spec.
 */

export const BOOTH_DEFAULTS = Object.freeze({
  // Footprint
  width:  6,      // metres
  depth:  3,      // metres
  height: 2.5,    // metres

  // System
  boothStyle: 'octanorm',   // 'octanorm' | 'maxima'

  // Panels
  panelColor:    0xf3f0ec,  // warm off-white
  panelRoughness: 0.42,
  accentWall:    'back',    // 'back' | 'left' | 'right' | null
  accentColor:   0x1b2d4f,  // deep navy
  accentRoughness: 0.36,

  // Fascia (top banner band)
  fasciaColor:   0x1b2d4f,
  fasciaHeight:  0.30,      // metres
  fasciaLogoUrl: null,      // URL string or null

  // Floor
  floorType:  'carpet',     // 'carpet' | 'wood' | 'concrete'
  floorColor: 0x2a3240,     // dark charcoal carpet
  floorElevation: 0.02,     // slight raise above world floor

  // LED screen (on accent wall)
  hasScreen:      false,
  screenWidth:    1.8,
  screenHeight:   1.0,
  screenContent:  null,     // texture URL or null → emissive placeholder

  // Spotlights on top rail
  hasLighting:        true,
  spotlightColor:     0xfff0cc,  // warm ~3500 K
  spotlightIntensity: 2.4,
  spotlightAngle:     0.38,      // radians
  spotlightPenumbra:  0.45,
  spotlightCount:     4,         // per long wall

  // Branding on back wall
  brandingLogoUrl: null,    // URL string or null
  brandingText:    'COMPANY NAME',

  // Furniture
  hasFurniture:     true,
  hasReceptionDesk: true,
  hasCenterTable:   false,
  hasShelfUnit:     false,
});

/**
 * Merges user config over defaults and clamps dimensions to safe ranges.
 */
export function resolveConfig(userConfig = {}) {
  const cfg = { ...BOOTH_DEFAULTS, ...userConfig };
  cfg.width  = Math.max(2, Math.min(20, Number(cfg.width)  || BOOTH_DEFAULTS.width));
  cfg.depth  = Math.max(2, Math.min(15, Number(cfg.depth)  || BOOTH_DEFAULTS.depth));
  cfg.height = Math.max(2.2, Math.min(5, Number(cfg.height) || BOOTH_DEFAULTS.height));
  return cfg;
}

/**
 * Per-style structural dimensions (millimetre-accurate Octanorm / Maxima spec).
 */
export function getStructureProfile(boothStyle = 'octanorm') {
  if (boothStyle === 'maxima') {
    return {
      uprightW:    0.080,
      uprightD:    0.080,
      uprightShape: 'box',
      beamH:       0.094,
      beamD:       0.055,
      panelW:      0.900,
      panelT:      0.012,
      cornerRadius: 0,
    };
  }
  // Octanorm default
  return {
    uprightW:    0.045,
    uprightD:    0.045,
    uprightShape: 'octagon',
    beamH:       0.070,
    beamD:       0.020,
    panelW:      0.945,
    panelT:      0.006,
    cornerRadius: 0,
  };
}
