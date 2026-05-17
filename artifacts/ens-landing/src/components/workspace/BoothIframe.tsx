import { useRef, useEffect, useState, useCallback } from 'react';
import type { BoothConfig } from './BoothCanvas';

const DEFAULTS: Required<BoothConfig> = {
  width: 6,
  depth: 3,
  height: 2.5,
  system: 'octanorm',
  companyName: 'Company Name',
  primaryColor: '#1a3a7a',
  carpetColor: '#3b3e44',
  openFront: true,
  openLeft: false,
  openRight: false,
  openBack: false,
};

function buildOpenParam(cfg: Required<BoothConfig>): string {
  const open = [
    cfg.openFront  && 'front',
    cfg.openBack   && 'back',
    cfg.openLeft   && 'left',
    cfg.openRight  && 'right',
  ].filter(Boolean) as string[];
  return open.length ? open.join(',') : 'none';
}

function buildSrc(cfg: Required<BoothConfig>): string {
  const bh = Math.max(0.8, cfg.height - 0.30).toFixed(2);
  const params = new URLSearchParams({
    w:      cfg.width.toString(),
    d:      cfg.depth.toString(),
    h:      bh,
    name:   encodeURIComponent(cfg.companyName),
    style:  cfg.system === 'maxima' ? 'maxima' : 'octa',
    open:   buildOpenParam(cfg),
    carpet: cfg.carpetColor ?? '#3b3e44',
  });
  return `/booth-render.html?${params.toString()}`;
}

export function BoothIframe({ config }: { config?: Partial<BoothConfig> }) {
  const cfg: Required<BoothConfig> = { ...DEFAULTS, ...config };
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  const [src] = useState(() => buildSrc(cfg));

  const sendUpdate = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const bh = Math.max(0.8, cfg.height - 0.30).toFixed(2);
    win.postMessage({
      type:   'boothUpdate',
      w:      cfg.width,
      d:      cfg.depth,
      h:      parseFloat(bh),
      name:   cfg.companyName,
      style:  cfg.system === 'maxima' ? 'maxima' : 'octa',
      open:   buildOpenParam(cfg),
      carpet: cfg.carpetColor ?? '#3b3e44',
    }, '*');
  }, [
    cfg.width, cfg.depth, cfg.height,
    cfg.system, cfg.companyName, cfg.carpetColor,
    cfg.openFront, cfg.openBack, cfg.openLeft, cfg.openRight,
  ]);

  useEffect(() => {
    if (ready) sendUpdate();
  }, [ready, sendUpdate]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="Booth Renderer"
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      onLoad={() => { setReady(true); setTimeout(sendUpdate, 50); }}
    />
  );
}
