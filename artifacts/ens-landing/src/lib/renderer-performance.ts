/** Limit GPU fill cost for large canvases and high-density displays. */
export const MAX_RENDER_PIXELS = 4_000_000;

export function rendererPixelRatio(width: number, height: number, deviceRatio: number): number {
  const area = Math.max(1, width) * Math.max(1, height);
  const ratio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  return Math.min(2, ratio, Math.sqrt(MAX_RENDER_PIXELS / area));
}
