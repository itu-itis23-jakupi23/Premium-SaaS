import { useRef, useEffect, useState, useCallback } from 'react';
import type { BoothSystem } from './BoothCanvas';

export interface CatalogDragItem {
  catalogId: string;
  name: string;
  w: number;
  d: number;
  h: number;
  color?: string;
  rotationY?: number;
  /** Drives the renderer's mounting rules - a shelf lands on a panel and a
   *  light on the top beam, rather than on the floor under the pointer. Passed
   *  explicitly because inferring it from the name is guesswork. */
  shape?: string;
}

interface CatalogDropState {
  valid: boolean;
  reason: string;
}

// ── Minimal config interface — only what the iframe renderer needs ──
interface IframeBoothConfig {
  width?: number;
  depth?: number;
  height?: number;
  system?: BoothSystem;
  companyName?: string;
  primaryColor?: string;
  wallColor?: string;
  frameColor?: string;
  fasciaColor?: string;
  carpetColor?: string;
  openFront?: boolean;
  openLeft?: boolean;
  openRight?: boolean;
  openBack?: boolean;
  placedItems?: any[];
  rooms?: any[];
  panelOverrides?: Record<string, any>;
  frontSupportPositions?: number[];
  suppressedDefaultPositions?: number[];
  fasciaEnabled?: boolean;
  fasciaOption?: string;
  lightingPreset?: string;
  pins?: any[];
  pinMode?: boolean;
  invalidItemIds?: string[];
  catalogDragItem?: CatalogDragItem | null;
  onItemMove?: (id: string, patch: { x: number; z: number }) => void;
  onItemSelect?: (id: string | null, partId?: string, detail?: any) => void;
  onItemDelete?: (id: string) => void;
  onItemRotate?: (id: string, patch: { rotationY: number }) => void;
  onRoomMove?: (id: string, patch: any) => void;
  onFrontSupportMove?: (positions: number[], suppressedDefaultPositions: number[]) => void;
  onPinRequest?: (partId: string, detail: any) => void;
  onCatalogItemDrop?: (catalogId: string, position: { x: number; z: number }) => void;
  onCatalogItemDropRejected?: (catalogId: string, reason: string) => void;
}

type OptionalIframeConfigKey =
  | 'placedItems' | 'rooms' | 'panelOverrides' | 'frontSupportPositions' | 'suppressedDefaultPositions'
  | 'fasciaOption' | 'lightingPreset' | 'pins' | 'pinMode' | 'invalidItemIds'
  | 'catalogDragItem'
  | 'onItemMove' | 'onItemSelect' | 'onItemDelete' | 'onItemRotate' | 'onRoomMove'
  | 'onFrontSupportMove' | 'onPinRequest' | 'onCatalogItemDrop' | 'onCatalogItemDropRejected';

type RequiredIframeConfig = Required<Omit<IframeBoothConfig, OptionalIframeConfigKey>> & Pick<IframeBoothConfig, OptionalIframeConfigKey>;

const DEFAULTS: Required<Omit<IframeBoothConfig, OptionalIframeConfigKey>> = {
  width:        6,
  depth:        3,
  height:       2.5,
  system:       'octanorm',
  companyName:  'Company Name',
  primaryColor: '#1a3a7a',
  wallColor:    '#f8fafc',
  frameColor:   '#b8bdc3',
  fasciaColor:  '#ffffff',
  carpetColor:  '#3b3e44',
  openFront:    true,
  openLeft:     false,
  openRight:    false,
  openBack:     false,
  fasciaEnabled: true,
};

const RENDERER_ASSET_VERSION = 'stable-glb-alignment-v2';

function buildOpenParam(cfg: RequiredIframeConfig): string {
  const open = [
    cfg.openFront  && 'front',
    cfg.openBack   && 'back',
    cfg.openLeft   && 'left',
    cfg.openRight  && 'right',
  ].filter(Boolean) as string[];
  return open.length ? open.join(',') : 'none';
}

function buildSrc(cfg: RequiredIframeConfig): string {
  const bh = Math.max(0.8, cfg.height - 0.30).toFixed(2);
  const params = new URLSearchParams({
    w:      cfg.width.toString(),
    d:      cfg.depth.toString(),
    h:      bh,
    name:   encodeURIComponent(cfg.companyName),
    style:  cfg.system === 'maxima' ? 'maxima' : 'octa',
    wall:   cfg.wallColor ?? '#f8fafc',
    frame:  cfg.frameColor ?? '#b8bdc3',
    fasciaColor: cfg.fasciaColor ?? '#ffffff',
    open:   buildOpenParam(cfg),
    carpet: cfg.carpetColor ?? '#3b3e44',
    fascia: cfg.fasciaEnabled === false ? '0' : '1',
    renderer: 'glb-real-v5',
    assetVersion: RENDERER_ASSET_VERSION,
  });
  return `/booth-render.html?${params.toString()}`;
}

const RENDERER_TIMEOUT_MS = 12_000;

export function BoothIframe({ config }: { config?: IframeBoothConfig }) {
  const cfg: RequiredIframeConfig = { ...DEFAULTS, ...config };
  const openSides = buildOpenParam(cfg);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [catalogDropState, setCatalogDropState] = useState<CatalogDropState | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const configRef = useRef<IframeBoothConfig | undefined>(config);
  const latestPayloadRef = useRef<Record<string, unknown> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep one renderer instance alive for the lifetime of the workspace. All
  // design changes are synchronized through boothUpdate; rebuilding the iframe
  // here would discard loaded GLBs and allow stale async model loads to reappear.
  const [src] = useState(() => buildSrc(cfg));

  useEffect(() => {
    setReady(false);
    setRendererError(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!ready) setRendererError("Renderer did not respond in time. Try refreshing the page.");
    }, RENDERER_TIMEOUT_MS);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, reloadNonce]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const buildPayload = useCallback(() => {
    const bh = Math.max(0.8, cfg.height - 0.30).toFixed(2);
    return {
      type:   'boothUpdate',
      w:      cfg.width,
      d:      cfg.depth,
      h:      parseFloat(bh),
      name:   cfg.companyName,
      style:  cfg.system === 'maxima' ? 'maxima' : 'octa',
      wall:   cfg.wallColor ?? '#f8fafc',
      frame:  cfg.frameColor ?? '#b8bdc3',
      fasciaColor: cfg.fasciaColor ?? '#ffffff',
      open:   openSides,
      carpet: cfg.carpetColor ?? '#3b3e44',
      placedItems: cfg.placedItems ?? [],
      rooms: cfg.rooms ?? [],
      panelOverrides: cfg.panelOverrides ?? {},
      frontSupportPositions: cfg.frontSupportPositions ?? [],
      suppressedDefaultPositions: cfg.suppressedDefaultPositions ?? [],
      fasciaEnabled: cfg.fasciaEnabled !== false,
      fasciaOption: cfg.fasciaOption ?? 'full',
      lightingPreset: cfg.lightingPreset ?? 'exhibition',
      pins:   cfg.pins ?? [],
      pinMode: cfg.pinMode ?? false,
      invalidItemIds: cfg.invalidItemIds ?? [],
    };
  }, [
    cfg.width, cfg.depth, cfg.height,
    cfg.system, cfg.companyName, cfg.wallColor, cfg.frameColor, cfg.fasciaColor, cfg.carpetColor,
    openSides,
    cfg.placedItems, cfg.rooms, cfg.panelOverrides, cfg.frontSupportPositions, cfg.suppressedDefaultPositions, cfg.fasciaEnabled, cfg.fasciaOption, cfg.lightingPreset, cfg.pins, cfg.pinMode, cfg.invalidItemIds,
  ]);

  const sendUpdate = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const payload = buildPayload();
    latestPayloadRef.current = payload;
    win.postMessage(payload, location.origin);
  }, [
    buildPayload,
  ]);

  const sendCatalogDrag = useCallback((type: 'catalogDragPreview' | 'catalogDragCommit' | 'catalogDragCancel', clientX?: number, clientY?: number) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    if (type === 'catalogDragCancel') {
      win.postMessage({ type }, location.origin);
      return;
    }
    const item = configRef.current?.catalogDragItem;
    const host = iframeRef.current?.parentElement;
    if (!item || !host || clientX == null || clientY == null) return;
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    win.postMessage({
      type,
      xPct: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      yPct: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
      item,
    }, location.origin);
  }, []);

  const markRendererReady = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setReady(true);
    setRendererError(null);
  }, []);

  const reloadRenderer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setRendererError(null);
    setReady(false);
    setReloadNonce(value => value + 1);
  }, []);

  useEffect(() => {
    if (ready) sendUpdate();
  }, [ready, sendUpdate]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data) return;
      const bridgeConfig = configRef.current;
      if (event.data.type === 'boothRendererReady') {
        markRendererReady();
        setTimeout(sendUpdate, 0);
        return;
      }
      if (event.data.type === 'boothRendererError') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setRendererError(typeof event.data.message === 'string' ? event.data.message : 'The 3D renderer encountered an error.');
        return;
      }
      if (event.data.type === 'boothUpdateAck') {
        markRendererReady();
        return;
      }
      if (event.data.type === 'catalogDropPreview') {
        setCatalogDropState({
          valid: Boolean(event.data.valid),
          reason: typeof event.data.reason === 'string' ? event.data.reason : '',
        });
        return;
      }
      if (event.data.type === 'catalogDropCommitted') {
        const catalogId = String(event.data.catalogId || '');
        if (!catalogId) return;
        if (event.data.valid) {
          bridgeConfig?.onCatalogItemDrop?.(catalogId, {
            x: Number(event.data.x),
            z: Number(event.data.z),
          });
        } else {
          bridgeConfig?.onCatalogItemDropRejected?.(
            catalogId,
            typeof event.data.reason === 'string' ? event.data.reason : 'This position is blocked.',
          );
        }
        setCatalogDropState(null);
        return;
      }
      if (event.data.type === 'workspaceItemSelected') {
        bridgeConfig?.onItemSelect?.(event.data.id == null ? null : String(event.data.id), event.data.partId == null ? undefined : String(event.data.partId), event.data);
        return;
      }
      if (event.data.type === 'workspaceItemMoved') {
        bridgeConfig?.onItemMove?.(String(event.data.id), {
          x: Number(event.data.x),
          z: Number(event.data.z),
        });
        return;
      }
      if (event.data.type === 'workspaceRoomMoved') {
        bridgeConfig?.onRoomMove?.(String(event.data.id), {
        x: Number(event.data.x),
        z: Number(event.data.z),
      });
        return;
      }
      if (event.data.type === 'workspaceRoomPatched') {
        const patch: Record<string, unknown> = {};
        if (event.data.doorOpen != null) patch.doorOpen = Boolean(event.data.doorOpen);
        if (typeof event.data.doorSwing === 'string') patch.doorSwing = event.data.doorSwing;
        if (Object.keys(patch).length) bridgeConfig?.onRoomMove?.(String(event.data.id), patch);
        return;
      }
      if (event.data.type === 'workspaceFrontSupportsMoved') {
        const positions = Array.isArray(event.data.positions) ? event.data.positions.map(Number).filter(Number.isFinite) : [];
        const suppressed = Array.isArray(event.data.suppressedDefaultPositions) ? event.data.suppressedDefaultPositions.map(Number).filter(Number.isFinite) : [];
        bridgeConfig?.onFrontSupportMove?.(positions, suppressed);
        return;
      }
      if (event.data.type === 'workspaceItemDeleteRequested') {
        if (event.data.id != null) {
          const id = String(event.data.id);
          // Remove the model in the renderer immediately. React state remains
          // authoritative and the following config update confirms deletion.
          iframeRef.current?.contentWindow?.postMessage({ type: 'workspaceItemRemove', id }, location.origin);
          bridgeConfig?.onItemDelete?.(id);
        }
        return;
      }
      if (event.data.type === 'workspaceItemRotated') {
        if (event.data.id != null) bridgeConfig?.onItemRotate?.(String(event.data.id), { rotationY: Number(event.data.rotationY) });
        return;
      }
      if (event.data.type === 'pinRequested') {
        if (event.data.partId != null) bridgeConfig?.onPinRequest?.(String(event.data.partId), event.data);
        return;
      }
    };
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
    };
  }, [markRendererReady, sendUpdate]);

  useEffect(() => {
    if (cfg.catalogDragItem) return;
    setCatalogDropState(null);
    sendCatalogDrag('catalogDragCancel');
  }, [cfg.catalogDragItem, sendCatalogDrag]);

  if (rendererError) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '12px',
        background: 'var(--workspace-bg, #f3f1ec)', color: 'var(--workspace-muted, #6b6560)',
        fontSize: '14px', textAlign: 'center', padding: '24px',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <span>{rendererError}</span>
        <button
          onClick={reloadRenderer}
          style={{
            padding: '6px 16px', borderRadius: '6px', border: '1px solid currentColor',
            background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '13px',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <style>{`@keyframes __booth_spin{to{transform:rotate(360deg)}}`}</style>
      {!ready && (
        <div
          aria-label="Loading 3D renderer"
          style={{
            position: 'absolute', inset: 0, zIndex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
            background: 'var(--workspace-bg, #f3f1ec)',
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2.5px solid var(--workspace-hair, #d8d3c9)',
            borderTopColor: 'var(--workspace-blue, #1d4ed8)',
            animation: '__booth_spin 0.75s linear infinite',
          }} />
          <span style={{
            fontSize: 11.5,
            fontFamily: 'var(--app-font-samsung)',
            color: 'var(--workspace-muted, #6b6560)',
            letterSpacing: '0.04em',
          }}>
            Loading 3D renderer…
          </span>
        </div>
      )}
      <iframe
        key={`${src}:${reloadNonce}`}
        ref={iframeRef}
        src={`${src}&reload=${reloadNonce}`}
        title="Booth Renderer"
        data-renderer-ready={ready ? "true" : "false"}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        onLoad={() => { setTimeout(sendUpdate, 50); }}
        onError={() => setRendererError('Failed to load the booth renderer. Check your network connection.')}
      />
      {ready && cfg.catalogDragItem && (
        <div
          data-catalog-drop-zone="true"
          aria-label={`Place ${cfg.catalogDragItem.name} in booth`}
          onDragEnter={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            sendCatalogDrag('catalogDragPreview', event.clientX, event.clientY);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setCatalogDropState(null);
            sendCatalogDrag('catalogDragCancel');
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            sendCatalogDrag('catalogDragCommit', event.clientX, event.clientY);
          }}
          style={{
            position: 'absolute', inset: 0, zIndex: 3,
            cursor: catalogDropState?.valid === false ? 'not-allowed' : 'copy',
          }}
        >
          <div style={{
            position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 8, maxWidth: 'calc(100% - 32px)',
            padding: '7px 11px', borderRadius: 6,
            border: `1px solid ${catalogDropState?.valid === false ? '#c2410c' : catalogDropState?.valid ? '#2f7d3a' : 'var(--workspace-hair, #d8d3c9)'}`,
            background: 'rgba(255,255,255,0.94)',
            boxShadow: '0 6px 20px rgba(20,22,26,0.12)',
            color: catalogDropState?.valid === false ? '#9a3412' : catalogDropState?.valid ? '#166534' : 'var(--workspace-ink, #181613)',
            pointerEvents: 'none', fontSize: 11.5, fontWeight: 650,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: 'currentColor' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {catalogDropState?.reason || `Place ${cfg.catalogDragItem.name} on the booth floor`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
