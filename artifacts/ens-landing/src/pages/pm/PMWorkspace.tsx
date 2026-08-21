import { useState, useCallback, useRef, useEffect, useMemo, useId } from "react";
import { CurrencySwitcher, useCurrency } from "@/lib/currency";
import { Link } from "wouter";
import { Booth3D } from "@/components/workspace/Booth3D";
import type { BoothSystem } from "@/components/workspace/BoothCanvas";
import {
  createProjectWorkspaceVersion,
  getCurrentWorkspace,
  getProjectWorkspace,
  getWorkspaceComments,
  getPlatformProjects,
  saveProjectWorkspace,
  uploadWorkspaceAsset,
  updateWorkspaceCommentStatus,
  workspaceApprovalStage,
  workspaceApprovalStageLabel,
  type ProjectWorkspace,
  type PlatformProject,
  type WorkspaceComment,
} from "@/lib/platform-api";
import {
  ChevronLeft, Undo2, Redo2, Save, Camera, History, Send,
  Maximize2, Plus, Trash2,
  Square, Layers, Map, X,
  CheckCircle2, Package, StickyNote, Settings2, Copy, MessageSquare, ImagePlus, Lock, Unlock,
} from "lucide-react";
import {
  clampNumber,
  snapNumber,
  snapItemCoordinate,
  ROOM_SNAP_M,
  ROOM_DIMENSION_SNAP_M,
  DUPLICATE_OFFSET_M,
} from "@/lib/workspace-transform";
// Data model (types + static Sedef furniture catalog) lives in a dedicated
// module so this file carries workspace behaviour, not static data.
import {
  ROOM_SIDE_OPTIONS,
  type FasciaOption,
  type LightingPreset,
  type DoorPosition,
  type DoorSide,
  type DoorSwing,
  type RoomWallFinish,
  type RoomGraphicFit,
  type RoomTemplateKey,
  type BoothState,
  type WorkspacePlacedItem,
  type WorkspaceRoom,
  type PanelOverride,
  type Note,
  type Snapshot,
  type WSData,
  type SaveStatus,
  type FeedbackFilter,
  type CatItem,
  type FurnitureCategory,
} from "./workspace-model";
// Static config (palette, finishes, pricing, catalog) lives in a data module.
import {
  C, MONO, UI, furnitureCategoryFor, CATALOG, ITEM_PROPS,
  catalogItemProps, ENS_MODEL_URLS, KNOWN_CATALOG_IDS, THEMES, WALL_FINISHES, FRAME_FINISHES,
  FASCIA_FINISHES, CARPETS, NOTE_COLORS, FASCIA_OPTIONS, LIGHTING_PRESETS,
  ROOM_TEMPLATES,
} from "./workspace-constants";
// Leaf presentational components live in a dedicated UI module.
import {
  Hairline, MonoLabel, PropBlock, formatUsd, DimInput, Swatch, OpenSidesPlan, Toast,
} from "./workspace-ui";
import { WorkspaceProjectPicker } from "./WorkspaceProjectPicker";
import { WorkspaceSnapshotDialog } from "./WorkspaceSnapshotDialog";
import { WorkspaceCatalogPanel } from "./WorkspaceCatalogPanel";


// ── Initial state ──────────────────────────────────────────────────
const INITIAL_BOOTH: BoothState = {width:6,depth:3,height:2.5,system:'octanorm',companyName:'TECHCORP INDUSTRIES',openFront:true,openBack:false,openLeft:false,openRight:false,fasciaEnabled:true,fasciaOption:'full'};
const INITIAL_WS: WSData = {booth:INITIAL_BOOTH,themeIdx:0,wallFinishIdx:0,frameFinishIdx:0,fasciaFinishIdx:0,carpetIdx:0,lightingPreset:'exhibition',placedItems:[],rooms:[],notes:[],panelOverrides:{},frontSupportPositions:[],suppressedDefaultPositions:[]};

// Placement/collision geometry lives in ./workspace-geometry (pure, testable).
import {
  itemPositionBounds,
  rotatedItemFootprint,
  positionBoundsForItem,
  roomPlacementIssue,
  findAvailableRoomPlacement,
  placementIssuesFor,
  availableRoomWallSides,
  type PlacementIssue,
} from "./workspace-geometry";
import { structuralBom, roomBom, catalogItemFor, quoteTotals } from "./workspace-bom";
import { WorkspaceBomPanel } from "./WorkspaceBomPanel";

function normalizeDoorPosition(value:unknown): DoorPosition {
  return value === 'left' || value === 'right' ? value : 'center';
}

function normalizeDoorSide(value:unknown): DoorSide {
  return value === 'back' || value === 'left' || value === 'right' ? value : 'front';
}

function normalizeDoorSwing(value:unknown): DoorSwing {
  return value === 'right-in' || value === 'left-out' || value === 'right-out' ? value : 'left-in';
}

function normalizeRoomWallFinish(value:unknown): RoomWallFinish {
  return value === 'frosted' || value === 'glass' || value === 'dark' ? value : 'white';
}

function normalizeRoomGraphicFit(value:unknown): RoomGraphicFit {
  return value === 'contain' || value === 'stretch' ? value : 'cover';
}

function roomGraphicWall(value:unknown, hasDoor:boolean, doorSide:DoorSide): DoorSide {
  const requested = value === 'front' || value === 'left' || value === 'right' ? value : 'back';
  if (!hasDoor || requested !== doorSide) return requested;
  return (['back','front','left','right'] as DoorSide[]).find(side=>side!==doorSide) || 'back';
}

function normalizeHexColor(value:unknown, fallback:string) {
  const raw = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
}

function roomDoorMaxWidth(room:WorkspaceRoom) {
  const span = room.doorSide === 'left' || room.doorSide === 'right' ? room.depth : room.width;
  return Math.max(0.55, Math.min(1.4, span - 0.16));
}

type RoomSnapTarget = 'front'|'back'|'left'|'right'|'center'|'back-left'|'back-right'|'front-left'|'front-right';

function snapRoomToTarget(room:WorkspaceRoom, booth:BoothState, target:RoomSnapTarget) {
  const centered = {
    x: clampNumber(snapNumber(room.x), room.width/2, Math.max(room.width/2, booth.width-room.width/2)),
    z: clampNumber(snapNumber(room.z), room.depth/2, Math.max(room.depth/2, booth.depth-room.depth/2)),
  };
  if(target === 'back-left') return {x: room.width/2, z: room.depth/2};
  if(target === 'back-right') return {x: booth.width - room.width/2, z: room.depth/2};
  if(target === 'front-left') return {x: room.width/2, z: booth.depth - room.depth/2};
  if(target === 'front-right') return {x: booth.width - room.width/2, z: booth.depth - room.depth/2};
  if(target === 'front') return {...centered, z: booth.depth - room.depth/2};
  if(target === 'back') return {...centered, z: room.depth/2};
  if(target === 'left') return {...centered, x: room.width/2};
  if(target === 'right') return {...centered, x: booth.width - room.width/2};
  return {x: booth.width/2, z: booth.depth/2};
}

function normalizePanelOverrides(raw:unknown): Record<string,PanelOverride> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string,PanelOverride> = {};
  Object.entries(raw as Record<string,unknown>).forEach(([id,value]) => {
    if (!/^(panel-(front|back|left|right)-\d+|fascia-(front|back|left|right))$/.test(id) || !value || typeof value !== 'object') return;
    const entry = value as Partial<PanelOverride>;
    const next: PanelOverride = {};
    if (typeof entry.color === 'string' && /^#[0-9a-f]{6}$/i.test(entry.color)) next.color = entry.color;
    if (typeof entry.brandText === 'string') next.brandText = entry.brandText.slice(0, 40);
    if (typeof entry.brandColor === 'string' && /^#[0-9a-f]{6}$/i.test(entry.brandColor)) next.brandColor = entry.brandColor;
    if (entry.brandScale != null) next.brandScale = clampNumber(Number(entry.brandScale) || 0.15, 0.08, 0.45);
    if (typeof entry.designImageUrl === 'string' && isWorkspaceImageUrl(entry.designImageUrl)) next.designImageUrl = entry.designImageUrl;
    if (typeof entry.designImageName === 'string') next.designImageName = entry.designImageName.slice(0, 80);
    if (entry.designOpacity != null) next.designOpacity = clampNumber(Number(entry.designOpacity) || 1, 0.15, 1);
    if (Object.keys(next).length) out[id] = next;
  });
  return out;
}

function isWorkspaceImageUrl(value:string) {
  return (
    (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(value) && value.length < 512_000)
    || (/^\/workspace-assets\/[a-z0-9%._/-]+$/i.test(value) && value.length < 1000)
  );
}

function panelDetails(partId:string, booth:BoothState) {
  const match = /^panel-(front|back|left|right)-(\d+)$/.exec(partId);
  if (!match) return null;
  const side = match[1] as 'front'|'back'|'left'|'right';
  const index = Number(match[2]);
  const bays = side === 'front' || side === 'back' ? Math.max(1, Math.round(booth.width)) : Math.max(1, Math.round(booth.depth));
  const width = (side === 'front' || side === 'back' ? booth.width : booth.depth) / bays;
  const height = Math.max(0.8, booth.height - 0.3);
  return {
    id: partId,
    side,
    index,
    label: `${side.toUpperCase()} panel ${index + 1}`,
    width,
    height,
    diagonal: Math.sqrt(width * width + height * height),
    area: width * height,
    bayCount: bays,
  };
}

function shellPartDetails(partId:string, booth:BoothState) {
  const panel = panelDetails(partId, booth);
  if (panel) return { type:'panel' as const, label:panel.label, rows:[
    ['Side', panel.side],
    ['Bay', `${panel.index + 1} / ${panel.bayCount}`],
    ['Width', `${panel.width.toFixed(2)} m`],
    ['Height', `${panel.height.toFixed(2)} m`],
    ['Diagonal', `${panel.diagonal.toFixed(2)} m`],
    ['Area', `${panel.area.toFixed(2)} m2`],
  ]};
  if (partId === 'carpet') return { type:'carpet' as const, label:'Carpet / workplane', rows:[
    ['Width', `${booth.width.toFixed(2)} m`],
    ['Depth', `${booth.depth.toFixed(2)} m`],
    ['Area', `${(booth.width * booth.depth).toFixed(2)} m2`],
  ]};
  if (partId.startsWith('post-')) return { type:'frame' as const, label:'Structural column', rows:[
    ['Profile', booth.system === 'maxima' ? '40 x 40 mm Maxima' : '40 mm Octanorm'],
    ['Height', `${booth.height.toFixed(2)} m`],
    ['Material', 'Anodized aluminum'],
  ]};
  if (partId.startsWith('rail-') || partId.includes('-rail') || partId.includes('-bracket')) return { type:'frame' as const, label:'Frame rail / bracket', rows:[
    ['Profile', booth.system === 'maxima' ? 'Maxima rail' : 'Octanorm rail'],
    ['Material', 'Anodized aluminum'],
    ['System', booth.system],
  ]};
  if (partId.startsWith('fascia-')) return { type:'fascia' as const, label:'Fascia shell part', rows:[
    ['Width', `${booth.width.toFixed(2)} m`],
    ['Board', '300 mm shell band'],
    ['Text', booth.companyName || 'None'],
  ]};
  return null;
}

function canonicalShellPartId(partId?:string|null) {
  if (!partId) return '';
  return (
    partId.match(/panel-(front|back|left|right)-\d+/)?.[0] ||
    partId.match(/post-front-support-\d+/)?.[0] ||
    partId.match(/post-(front|back|left|right)-\d+/)?.[0] ||
    partId.match(/fascia-(front|back|left|right)/)?.[0] ||
    partId.match(/rail-(front|back|left|right|front-ceiling|back-ceiling|left-ceiling|right-ceiling)/)?.[0] ||
    (partId.includes('carpet') ? 'carpet' : partId)
  );
}

function anchorFromSelection(detail?:{xPct?:number|null;yPct?:number|null;label?:string|null;partType?:string|null}, label = 'Selection', partType = 'shell') {
  return {
    x: detail?.xPct != null ? detail.xPct : 50,
    y: detail?.yPct != null ? detail.yPct : 38,
    label: detail?.label || label,
    partType: detail?.partType || partType,
  };
}

function defaultFrontSupportPositionsFor(width:number) {
  const positions:number[] = [];
  if (width >= 5) for (let value = 3; value < width - 0.001; value += 3) positions.push(value);
  return positions;
}

function activeFrontSupportPositionsFor(width:number, positions:number[], suppressed:number[]=[]) {
  const merged = [...positions];
  defaultFrontSupportPositionsFor(width).forEach(value => {
    if (suppressed.some(s => Math.abs(s - value) < 0.12)) return;
    if (!merged.some(existing => Math.abs(Number(existing) - value) < 0.12)) merged.push(value);
  });
  return merged
    .map(value => clampNumber(Number(value) || 0, 0.45, Math.max(0.45, width - 0.45)))
    .filter((value, index, list) => value > 0.45 && value < width - 0.45 && list.findIndex(other => Math.abs(other - value) < 0.12) === index)
    .sort((a,b) => a - b);
}

function normalizeWorkspaceData(raw: unknown): WSData {
  const source = raw && typeof raw === 'object' ? raw as Partial<WSData> : {};
  const boothSource = source.booth && typeof source.booth === 'object' ? source.booth as Partial<BoothState> : {};
  const booth: BoothState = {
    ...INITIAL_BOOTH,
    ...boothSource,
    width: clampNumber(Number(boothSource.width ?? INITIAL_BOOTH.width) || INITIAL_BOOTH.width, 1, 40),
    depth: clampNumber(Number(boothSource.depth ?? INITIAL_BOOTH.depth) || INITIAL_BOOTH.depth, 1, 40),
    height: clampNumber(Number(boothSource.height ?? INITIAL_BOOTH.height) || INITIAL_BOOTH.height, 1.5, 6),
    system: boothSource.system === 'maxima' ? 'maxima' : 'octanorm',
    companyName: String(boothSource.companyName || INITIAL_BOOTH.companyName).slice(0, 60),
    fasciaEnabled: boothSource.fasciaEnabled !== false,
    fasciaOption: FASCIA_OPTIONS.some(option => option.value === boothSource.fasciaOption) ? boothSource.fasciaOption as FasciaOption : 'full',
  };
  return {
    booth,
    themeIdx: clampNumber(Number(source.themeIdx ?? 0) || 0, 0, THEMES.length - 1),
    wallFinishIdx: clampNumber(Number(source.wallFinishIdx ?? 0) || 0, 0, WALL_FINISHES.length - 1),
    frameFinishIdx: clampNumber(Number(source.frameFinishIdx ?? 0) || 0, 0, FRAME_FINISHES.length - 1),
    fasciaFinishIdx: clampNumber(Number(source.fasciaFinishIdx ?? 0) || 0, 0, FASCIA_FINISHES.length - 1),
    carpetIdx: clampNumber(Number(source.carpetIdx ?? 0) || 0, 0, CARPETS.length - 1),
    lightingPreset: LIGHTING_PRESETS.some(option => option.value === source.lightingPreset) ? source.lightingPreset as LightingPreset : 'exhibition',
    placedItems: Array.isArray(source.placedItems)
      ? source.placedItems
        .map((item, index) => normalizePlacedItem(item, index, booth))
        .filter(item => item.kind !== 'asset' && (item.kind !== 'furniture' || KNOWN_CATALOG_IDS.has(item.catalogId)))
      : [],
    rooms: Array.isArray(source.rooms) ? source.rooms.map((room, index) => normalizeRoom(room, index, booth)) : [],
    notes: Array.isArray(source.notes) ? source.notes as Note[] : [],
    panelOverrides: normalizePanelOverrides(source.panelOverrides),
    frontSupportPositions: Array.isArray(source.frontSupportPositions)
      ? source.frontSupportPositions.map(Number).filter(Number.isFinite).map(value => clampNumber(value, 0.45, Math.max(0.45, booth.width - 0.45)))
      : [],
    suppressedDefaultPositions: Array.isArray(source.suppressedDefaultPositions)
      ? source.suppressedDefaultPositions.map(Number).filter(Number.isFinite)
      : [],
  };
}

function normalizePlacedItem(raw: unknown, index: number, booth: BoothState): WorkspacePlacedItem {
  const item = raw && typeof raw === 'object' ? raw as Partial<WorkspacePlacedItem> : {};
  const props = ITEM_PROPS[String(item.catalogId || item.id || '')] ?? {w:Number(item.w) || 0.6,d:Number(item.d) || 0.6,h:Number(item.h) || 0.8,color:String(item.color || '#888'),weight:Number(item.weight) || 10};
  const kind = item.kind || (String(item.name || '').toLowerCase().includes('light') || String(item.catalogId || '').startsWith('4') ? 'light' : 'furniture');
  const w = Number(item.w ?? props.w) || props.w;
  const d = Number(item.d ?? props.d) || props.d;
  const rotation = Number(item.rotation) || 0;
  const rotationY = Number(item.rotationY ?? item.rotation) || 0;
  const footprint = rotatedItemFootprint({w,d,rotation,rotationY} as WorkspacePlacedItem);
  const bounds = itemPositionBounds(footprint.width, footprint.depth, booth);
  return {
    id: String(item.id || `item-${index + 1}`),
    catalogId: String(item.catalogId || item.id || `custom-${index + 1}`),
    name: String(item.name || 'Furniture'),
    sku: String(item.sku || item.catalogId || ''),
    qty: Math.max(1, Number(item.qty) || 1),
    w, d,
    h: Number(item.h ?? props.h) || props.h,
    color: String(item.color || props.color),
    weight: Number(item.weight ?? props.weight) || props.weight,
    x: clampNumber(Number(item.x) || booth.width / 2, bounds.minX, bounds.maxX),
    z: clampNumber(Number(item.z) || booth.depth / 2, bounds.minZ, bounds.maxZ),
    rotation,
    rotationX: Number(item.rotationX) || 0,
    rotationY,
    rotationZ: Number(item.rotationZ) || 0,
    locked: Boolean(item.locked),
    kind: kind === 'light' || kind === 'structure' || kind === 'fascia' || kind === 'asset' ? kind : 'furniture',
    shape: item.shape,
    modelUrl: typeof item.modelUrl === 'string' ? item.modelUrl : undefined,
    source: typeof item.source === 'string' ? item.source : undefined,
  };
}

function normalizeRoom(raw: unknown, index: number, booth: BoothState): WorkspaceRoom {
  const room = raw && typeof raw === 'object' ? raw as Partial<WorkspaceRoom> : {};
  const width = clampNumber(snapNumber(Number(room.width) || 3, ROOM_DIMENSION_SNAP_M), 1, Math.max(1, booth.width));
  const depth = clampNumber(snapNumber(Number(room.depth) || 3, ROOM_DIMENSION_SNAP_M), 1, Math.max(1, booth.depth));
  const wallHeight = Math.max(1.8, booth.height);
  const hasDoor = room.hasDoor !== false;
  const x = clampNumber(snapNumber(Number(room.x) || booth.width / 2, ROOM_SNAP_M), width / 2, Math.max(width / 2, booth.width - width / 2));
  const z = clampNumber(snapNumber(Number(room.z) || booth.depth / 2, ROOM_SNAP_M), depth / 2, Math.max(depth / 2, booth.depth - depth / 2));
  const requestedDoorSide = normalizeDoorSide(room.doorSide);
  const availableDoorSides = availableRoomWallSides(width,depth,x,z,booth);
  const doorSide = availableDoorSides.includes(requestedDoorSide) ? requestedDoorSide : availableDoorSides[0] || requestedDoorSide;
  const doorSpan = doorSide === 'left' || doorSide === 'right' ? depth : width;
  const maxDoorWidth = Math.max(0.55, Math.min(1.4, doorSpan - 0.16));
  return {
    id: String(room.id || `room-${index + 1}`),
    name: String(room.name || `Room ${index + 1}`),
    width,
    depth,
    height: room.height != null ? clampNumber(Number(room.height) || wallHeight, 1.8, booth.height) : wallHeight,
    x,
    z,
    hasDoor,
    hasCeiling: Boolean(room.hasCeiling),
    doorSide,
    doorWidth: clampNumber(Number(room.doorWidth) || 0.85, 0.55, maxDoorWidth),
    doorPosition: normalizeDoorPosition(room.doorPosition),
    doorSwing: normalizeDoorSwing(room.doorSwing),
    doorOpen: Boolean(room.doorOpen),
    wallFinish: normalizeRoomWallFinish(room.wallFinish),
    floorColor: normalizeHexColor(room.floorColor, '#1f2937'),
    locked: Boolean(room.locked),
    designImageUrl: typeof room.designImageUrl === 'string' && isWorkspaceImageUrl(room.designImageUrl) ? room.designImageUrl : undefined,
    designImageName: typeof room.designImageName === 'string' ? room.designImageName.slice(0, 80) : undefined,
    designOpacity: room.designOpacity != null ? clampNumber(Number(room.designOpacity) || 1, 0.15, 1) : undefined,
    designWall: roomGraphicWall(room.designWall,hasDoor,doorSide),
    designFit: normalizeRoomGraphicFit(room.designFit),
  };
}

function workspaceSnapshots(record: ProjectWorkspace): Snapshot[] {
  return record.versions.map(version => ({
    id: version.id,
    name: `v${version.versionNumber} - ${version.title}`,
    data: version.workspace as WSData,
    createdAt: new Date(version.createdAt).toLocaleDateString(),
  }));
}

// ── Main ──────────────────────────────────────────────────────────
export default function PMWorkspace() {
  useCurrency(); // subscribe so money renders update when display currency changes
  // Base for the ids that tie each control to its <label>, following the
  // DimInput pattern in workspace-ui.tsx. These panels captioned their inputs
  // with floating <label> elements that pointed at nothing, so a screen reader
  // announced "slider" with no indication of what it adjusted.
  const uid = useId();
  const [ws,    setWS]    = useState<WSData>(INITIAL_WS);
  const histStackRef      = useRef<WSData[]>([INITIAL_WS]);
  const histIdxRef        = useRef(0);
  const workspaceRevisionRef = useRef(0);
  const saveInFlightRef = useRef(false);
  // Mirrors the render-scope BOM quote so persistWorkspace (defined earlier
  // in the component) can attach it to every save payload.
  const quoteTotalCentsRef = useRef(0);
  const activeProjectIdRef = useRef<string | null>(null);
  const [histIdx, setHistIdx] = useState(0);
  const [histLen, setHistLen] = useState(1);

  const [search,     setSearch]     = useState('');
  const [openCats,   setOpenCats]   = useState(new Set(['Furniture','Lighting']));
  const [activeFurnitureCategory, setActiveFurnitureCategory] = useState<FurnitureCategory>('all');
  const [activeTab,  setActiveTab]  = useState<'props'|'panel'|'bom'|'notes'|'feedback'>('props');
  const [activeShellPartId,setActiveShellPartId] = useState('');
  const [selectionAnchor,setSelectionAnchor] = useState<{x:number;y:number;label:string;partType:string}|null>(null);
  const [activeId,   setActiveId]   = useState('');
  const [activePlacedId,setActivePlacedId] = useState('');
  const [activeRoomId,setActiveRoomId] = useState('');
  const [roomTemplate,setRoomTemplate] = useState<RoomTemplateKey>('storage');
  const [draggedCatalogItem, setDraggedCatalogItem] = useState<CatItem | null>(null);
  const catalogDragWasActiveRef = useRef(false);

  const [showSendDlg,   setShowSendDlg]   = useState(false);
  const [showSnapDlg,   setShowSnapDlg]   = useState(false);
  const [showHistPanel, setShowHistPanel] = useState(false);
  const [showGrid,      setShowGrid]      = useState(true);
  const [previewMode,   setPreviewMode]   = useState(false);
  const [snapName,      setSnapName]      = useState('');
  const [snapshots,     setSnapshots]     = useState<Snapshot[]>([]);
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const [isSending,     setIsSending]     = useState(false);
  const [toast,         setToast]         = useState('');
  const [lastSaved,     setLastSaved]     = useState('Not saved');
  const [saveStatus,    setSaveStatus]    = useState<SaveStatus>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [newNote,       setNewNote]       = useState('');
  const [noteColor,     setNoteColor]     = useState(NOTE_COLORS[0]);
  const [workspaceRecord, setWorkspaceRecord] = useState<ProjectWorkspace | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState('');
  const [feedbackItems, setFeedbackItems] = useState<WorkspaceComment[]>([]);
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>('open');
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  const markWorkspaceDirty = useCallback(()=>{
    workspaceRevisionRef.current += 1;
    setHasUnsavedChanges(true);
    setSaveStatus('dirty');
  },[]);

  // ── Project picker ────────────────────────────────────────────
  const urlProjectId = useMemo(() => new URLSearchParams(window.location.search).get("projectId"), []);
  const [showProjectPicker, setShowProjectPicker] = useState(!urlProjectId);
  const [pickerProjects, setPickerProjects] = useState<PlatformProject[]>([]);
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // ── History helpers ───────────────────────────────────────────
  const resetWorkspace = useCallback((data:WSData)=>{
    const normalized = normalizeWorkspaceData(data);
    workspaceRevisionRef.current += 1;
    setWS(normalized);
    histStackRef.current = [normalized];
    histIdxRef.current = 0;
    setHistIdx(0);
    setHistLen(1);
    setHasUnsavedChanges(false);
    setSaveStatus('saved');
  },[]);

  const commit = useCallback((updater:(prev:WSData)=>WSData)=>{
    markWorkspaceDirty();
    setWS(prev=>{
      const next = updater(prev);
      const stack = histStackRef.current.slice(0, histIdxRef.current+1);
      stack.push(next);
      if(stack.length>60) stack.shift();
      histStackRef.current = stack;
      histIdxRef.current = stack.length-1;
      setHistIdx(histIdxRef.current);
      setHistLen(stack.length);
      return next;
    });
  },[markWorkspaceDirty]);

  const undo = () => {
    if(histIdxRef.current<=0) return;
    histIdxRef.current--;
    setHistIdx(histIdxRef.current);
    setWS(histStackRef.current[histIdxRef.current]);
    markWorkspaceDirty();
  };
  const redo = () => {
    if(histIdxRef.current>=histStackRef.current.length-1) return;
    histIdxRef.current++;
    setHistIdx(histIdxRef.current);
    setWS(histStackRef.current[histIdxRef.current]);
    markWorkspaceDirty();
  };
  const canUndo = histIdx>0;
  const canRedo = histIdx<histLen-1;

  const set = (k:keyof BoothState, v:BoothState[keyof BoothState]) =>
    commit(prev=>normalizeWorkspaceData({...prev,booth:{...prev.booth,[k]:v}}));
  const setOpenSidePreset = (preset:'inline'|'corner'|'peninsula'|'island'|'closed') => {
    const next = {
      inline: {openFront:true, openBack:false, openLeft:false, openRight:false},
      corner: {openFront:true, openBack:false, openLeft:false, openRight:true},
      peninsula: {openFront:true, openBack:false, openLeft:true, openRight:true},
      island: {openFront:true, openBack:true, openLeft:true, openRight:true},
      closed: {openFront:false, openBack:false, openLeft:false, openRight:false},
    }[preset];
    commit(prev=>normalizeWorkspaceData({...prev,booth:{...prev.booth,...next}}));
    setToast(`${preset.charAt(0).toUpperCase() + preset.slice(1)} side preset applied`);
  };

  const persistWorkspace = useCallback(async (
    projectId:string,
    workspace:WSData,
    revision:number,
    title:string,
  ) => {
    if(saveInFlightRef.current) return false;
    saveInFlightRef.current = true;
    setLastSaved('Saving...');
    setSaveStatus('saving');
    try {
      const payload = { ...workspace, quoteTotalCents: quoteTotalCentsRef.current || undefined };
      const saved = await saveProjectWorkspace(projectId, payload, title);
      if(activeProjectIdRef.current !== projectId) return false;
      setWorkspaceRecord(saved);
      setSnapshots(workspaceSnapshots(saved));
      setWorkspaceError('');
      if(workspaceRevisionRef.current === revision) {
        setLastSaved('Just now');
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
      } else {
        setLastSaved('New changes waiting');
        setHasUnsavedChanges(true);
        setSaveStatus('dirty');
      }
      return true;
    } catch (err) {
      if(activeProjectIdRef.current !== projectId) return false;
      setLastSaved('Save failed');
      setSaveStatus('error');
      setWorkspaceError(err instanceof Error ? err.message : 'Could not save workspace');
      return false;
    } finally {
      saveInFlightRef.current = false;
    }
  },[]);

  const save = async () => {
    if(!workspaceRecord) {
      setToast('Workspace is still loading');
      return;
    }
    if(saveInFlightRef.current) return;
    const saved = await persistWorkspace(
      workspaceRecord.project.id,
      ws,
      workspaceRevisionRef.current,
      'Manual save',
    );
    setToast(saved ? 'Design saved' : 'Save failed');
  };

  useEffect(()=>{
    activeProjectIdRef.current = workspaceRecord?.project.id ?? null;
  },[workspaceRecord?.project.id]);

  // Load project list for picker when picker is visible
  useEffect(()=>{
    if(!showProjectPicker) return;
    setIsPickerLoading(true);
    getPlatformProjects({ limit: 50 })
      .then(({ projects }) => setPickerProjects(projects))
      .catch(() => setPickerProjects([]))
      .finally(() => setIsPickerLoading(false));
  },[showProjectPicker]);

  // Load workspace from PostgreSQL — skips when picker is open
  useEffect(()=>{
    if(showProjectPicker) {
      setIsWorkspaceLoading(false);
      return;
    }

    let isMounted = true;
    setIsWorkspaceLoading(true);

    const loadPromise = urlProjectId
      ? getProjectWorkspace(urlProjectId)
      : getCurrentWorkspace();

    loadPromise
      .then(record => {
        if(!isMounted) return;
        setWorkspaceRecord(record);
        resetWorkspace(record.workspace as WSData);
        setSnapshots(workspaceSnapshots(record));
        setLastSaved(record.currentVersion ? `v${record.currentVersion.versionNumber}` : 'Loaded');
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
        setWorkspaceError('');
      })
      .catch(err => {
        if(!isMounted) return;
        setWorkspaceError(err instanceof Error ? err.message : 'Could not load workspace');
        setLastSaved('Load failed');
        setSaveStatus('error');
      })
      .finally(() => {
        if(isMounted) setIsWorkspaceLoading(false);
      });

    return () => { isMounted = false; };
  },[resetWorkspace, urlProjectId, showProjectPicker]);

  // Select a project from the picker
  const selectProject = useCallback((project: PlatformProject) => {
    history.replaceState(null, '', `${window.location.pathname}?projectId=${encodeURIComponent(project.id)}`);
    setShowProjectPicker(false);
    setIsWorkspaceLoading(true);
    getProjectWorkspace(project.id)
      .then(record => {
        setWorkspaceRecord(record);
        resetWorkspace(record.workspace as WSData);
        setSnapshots(workspaceSnapshots(record));
        setLastSaved(record.currentVersion ? `v${record.currentVersion.versionNumber}` : 'Loaded');
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
        setWorkspaceError('');
      })
      .catch(err => {
        setWorkspaceError(err instanceof Error ? err.message : 'Could not load workspace');
        setLastSaved('Load failed');
        setSaveStatus('error');
      })
      .finally(() => setIsWorkspaceLoading(false));
  },[resetWorkspace]);

  useEffect(()=>{
    if(!workspaceRecord?.project.id) {
      setFeedbackItems([]);
      return;
    }

    let isMounted = true;
    setIsFeedbackLoading(true);
    getWorkspaceComments(workspaceRecord.project.id)
      .then(({ comments }) => {
        if(isMounted) setFeedbackItems(comments);
      })
      .catch(() => {
        if(isMounted) setFeedbackItems([]);
      })
      .finally(() => {
        if(isMounted) setIsFeedbackLoading(false);
      });

    return () => { isMounted = false; };
  },[workspaceRecord?.project.id]);

  const setFeedbackStatus = (feedbackId:string, status:'open'|'resolved') => {
    if(!workspaceRecord?.project.id) return;
    const previous = feedbackItems;
    setFeedbackItems(current => current.map(item => item.id === feedbackId ? {...item, status} : item));
    updateWorkspaceCommentStatus(workspaceRecord.project.id, feedbackId, status)
      .catch(() => {
        setFeedbackItems(previous);
        setToast('Feedback status failed to save');
      });
  };

  // Save shortly after editing stops. Revision checks prevent an older request
  // from marking newer local changes as saved.
  useEffect(()=>{
    if(!workspaceRecord || isWorkspaceLoading || !hasUnsavedChanges) return;
    if(saveStatus === 'saving' || saveStatus === 'error') return;
    const projectId = workspaceRecord.project.id;
    const revision = workspaceRevisionRef.current;
    const workspace = ws;
    const timer = window.setTimeout(()=>{
      void persistWorkspace(projectId, workspace, revision, 'Autosave');
    },3000);
    return()=>window.clearTimeout(timer);
  },[hasUnsavedChanges, isWorkspaceLoading, persistWorkspace, saveStatus, workspaceRecord, ws]);

  useEffect(()=>{
    if(!hasUnsavedChanges) return;
    const warnBeforeUnload = (event:BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return()=>window.removeEventListener('beforeunload', warnBeforeUnload);
  },[hasUnsavedChanges]);

  const createSnapshot = async () => {
    if(!snapName.trim() || !workspaceRecord) return;
    const name = snapName.trim();
    try {
      const saved = await createProjectWorkspaceVersion(workspaceRecord.project.id, ws, name);
      setWorkspaceRecord(saved);
      setSnapshots(workspaceSnapshots(saved));
      setSnapName('');
      setShowSnapDlg(false);
      setLastSaved(`v${saved.currentVersion?.versionNumber ?? saved.design.currentVersionNumber}`);
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setWorkspaceError('');
      setToast(`Snapshot "${name}" saved`);
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Could not save snapshot');
      setSaveStatus('error');
      setToast('Snapshot failed');
    }
  };
  const restoreSnapshot = (snap:Snapshot) => {
    resetWorkspace(snap.data);
    markWorkspaceDirty();
    setShowHistPanel(false);
    setToast(`Restored locally: ${snap.name}`);
  };

  const sendToClient = async () => {
    if(!workspaceRecord || isSending) return;
    if(!workspaceRecord.permissions?.can_send_arrangement) {
      setWorkspaceError('This workspace has already been sent or cannot be sent in its current state.');
      return;
    }
    setIsSending(true);
    try {
      const title = `Client review - ${new Date().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}`;
      const saved = await createProjectWorkspaceVersion(workspaceRecord.project.id, ws, title, 'submitted');
      setWorkspaceRecord(saved);
      setSnapshots(workspaceSnapshots(saved));
      setLastSaved(`v${saved.currentVersion?.versionNumber ?? saved.design.currentVersionNumber}`);
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      setWorkspaceError('');
      setSendConfirmed(true);
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Could not send workspace');
      setSaveStatus('error');
      setToast('Send failed');
    } finally {
      setIsSending(false);
    }
  };

  // ── Item placement ────────────────────────────────────────────
  const nextItemPosition = (prev:WSData, props:{w:number;d:number}) => {
    const count = prev.placedItems.length;
    const columns = Math.max(1, Math.floor(prev.booth.width / Math.max(1, props.w + 0.4)));
    const col = count % columns;
    const row = Math.floor(count / columns);
    return {
      x: clampNumber(props.w / 2 + 0.35 + col * Math.max(1, props.w + 0.55), props.w / 2, Math.max(props.w / 2, prev.booth.width - props.w / 2)),
      z: clampNumber(props.d / 2 + 0.45 + row * Math.max(1, props.d + 0.55), props.d / 2, Math.max(props.d / 2, prev.booth.depth - props.d / 2)),
    };
  };

  const addItem = (item:CatItem, requestedPosition?:{x:number;z:number}) => {
    const placedCount = ws.placedItems.filter(p=>p.catalogId===item.id).reduce((sum,p)=>sum+p.qty,0);
    if(item.stock != null && placedCount >= item.stock) {
      setActiveId(item.id);
      setToast(`${item.name} is out of stock`);
      return;
    }
    const props = catalogItemProps(item);
    const bounds = itemPositionBounds(props.w, props.d, ws.booth);
    const position = requestedPosition
      ? {
          x: snapItemCoordinate(requestedPosition.x, bounds.minX, bounds.maxX),
          z: snapItemCoordinate(requestedPosition.z, bounds.minZ, bounds.maxZ),
        }
      : nextItemPosition(ws, props);
    const modelUrl = item.modelUrl ?? ENS_MODEL_URLS[item.id];
    const newItem:WorkspacePlacedItem = {
      id:`${item.id}-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,
      catalogId:item.id,
      name:item.name,
      sku:item.sku,
      qty:1,
      ...props,
      ...position,
      rotation:0,
      rotationX:0,
      rotationY:0,
      rotationZ:0,
      kind:Object.values(CATALOG.Lighting).some(light => light.id === item.id) ? 'light' : (Object.values(CATALOG.Fascia).some(fascia => fascia.id === item.id) ? 'fascia' : (Object.values(CATALOG.Structure).some(struct => struct.id === item.id) ? 'structure' : 'furniture')),
      shape:item.shape,
      modelUrl,
      source:modelUrl ? 'ENS asset library' : undefined,
    };

    if(requestedPosition) {
      const candidate = normalizeWorkspaceData({...ws,placedItems:[...ws.placedItems,newItem]});
      const supports = activeFrontSupportPositionsFor(
        candidate.booth.width,
        candidate.frontSupportPositions,
        candidate.suppressedDefaultPositions,
      );
      const issue = placementIssuesFor(candidate.placedItems, candidate.rooms, candidate.booth, supports)
        .find(entry => entry.itemId === newItem.id);
      if(issue) {
        setActiveId(item.id);
        setToast(`Placement blocked: ${issue.message}`);
        return;
      }
    }

    commit(prev=>({...prev,placedItems:[...prev.placedItems,newItem]}));
    setActiveId(item.id);
    setActivePlacedId(newItem.id);
    setActiveRoomId('');
    setToast(`${item.name} ${requestedPosition ? 'placed in' : 'added to'} workspace`);
  };
  const beginCatalogDrag = (event:React.DragEvent<HTMLDivElement>, item:CatItem) => {
    catalogDragWasActiveRef.current = true;
    setDraggedCatalogItem(item);
    setActiveId(item.id);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-ens-catalog-item', item.id);
    event.dataTransfer.setData('text/plain', item.name);
  };
  const endCatalogDrag = () => {
    setDraggedCatalogItem(null);
    window.setTimeout(() => { catalogDragWasActiveRef.current = false; }, 0);
  };
  const placeCatalogItemAt = (catalogId:string, position:{x:number;z:number}) => {
    const item = Object.values(CATALOG).flat().find(entry => entry.id === catalogId);
    setDraggedCatalogItem(null);
    if(!item) {
      setToast('This catalogue item is no longer available');
      return;
    }
    addItem(item, position);
  };
  const removeCatalogItem = (catalogId:string) => {
    const latest = [...placedItems].reverse().find(item => item.catalogId === catalogId);
    if(!latest) return;
    removeItem(latest.id);
  };
  const removeItem = (id:string) => {
    if(activePlacedId===id) {
      setActivePlacedId('');
      setSelectionAnchor(null);
    }
    commit(prev=>({...prev,placedItems:prev.placedItems.filter(p=>p.id!==id)}));
  };
  const updateItem = (id:string, patch:Partial<WorkspacePlacedItem>) => commit(prev=>normalizeWorkspaceData({
    ...prev,
    placedItems: prev.placedItems.map(item => item.id === id ? {...item, ...patch} : item),
  }));
  const updateItemTransform = (id:string, patch:Partial<WorkspacePlacedItem>) => {
    const current = ws.placedItems.find(item => item.id === id);
    if(!current) return;
    if(current.locked) {
      setToast('Unlock this item before moving or rotating it');
      return;
    }
    const candidate = normalizeWorkspaceData({
      ...ws,
      placedItems: ws.placedItems.map(item => item.id === id ? {...item, ...patch} : item),
    });
    const supports = activeFrontSupportPositionsFor(
      candidate.booth.width,
      candidate.frontSupportPositions,
      candidate.suppressedDefaultPositions,
    );
    const issue = placementIssuesFor(candidate.placedItems, candidate.rooms, candidate.booth, supports)
      .find(entry => entry.itemId === id);
    if(issue) {
      setToast(`Placement blocked: ${issue.message}`);
      return;
    }
    updateItem(id, patch);
  };
  const updatePanelOverride = (id:string, patch:PanelOverride) => commit(prev=>{
    const current = prev.panelOverrides[id] || {};
    const next: PanelOverride = {...current, ...patch};
    Object.keys(next).forEach(key => {
      const value = next[key as keyof PanelOverride];
      if (value === '' || value == null) delete next[key as keyof PanelOverride];
    });
    const panelOverrides = {...prev.panelOverrides};
    if (Object.keys(next).length) panelOverrides[id] = next;
    else delete panelOverrides[id];
    return {...prev, panelOverrides};
  });
  const uploadPanelDesign = (id:string, file?:File|null) => {
    if(!file) return;
    if(!workspaceRecord?.project.id) {
      setToast('Open a project before uploading images');
      return;
    }
    if(!file.type.startsWith('image/')) {
      setToast('Please choose an image file');
      return;
    }
    if(file.size > 384_000) {
      setToast('Image must be under 375 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if(!result.startsWith('data:image/')) {
        setToast('Image could not be loaded');
        return;
      }
      try {
        const uploaded = await uploadWorkspaceAsset(workspaceRecord.project.id, {
          dataUrl: result,
          name: file.name,
          purpose: id.includes('fascia') ? 'fascia' : 'panel',
        });
        updatePanelOverride(id,{designImageUrl:uploaded.asset.url,designImageName:file.name,designOpacity:1});
        setToast('Panel design uploaded');
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Image could not be uploaded');
      }
    };
    reader.onerror = () => setToast('Image could not be loaded');
    reader.readAsDataURL(file);
  };
  const resetPanelOverride = (id:string) => commit(prev=>{
    const panelOverrides = {...prev.panelOverrides};
    delete panelOverrides[id];
    return {...prev, panelOverrides};
  });
  const rotateItem = (id:string, delta:number) => {
    const item = placedItems.find(entry => entry.id === id);
    if(!item) return;
    const next = ((Number(item.rotationY ?? item.rotation) + delta) % 360 + 360) % 360;
    updateItemTransform(id,{rotation:next, rotationY:next});
  };
  const duplicateItem = (id:string) => {
    let nextId = '';
    commit(prev=>{
      const source = prev.placedItems.find(item => item.id === id);
      if(!source) return prev;
      const bounds = positionBoundsForItem(source, prev.booth);
      const next:WorkspacePlacedItem = {
        ...source,
        id:`${source.catalogId}-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,
        locked:false,
        x:snapItemCoordinate(source.x + DUPLICATE_OFFSET_M, bounds.minX, bounds.maxX),
        z:snapItemCoordinate(source.z + DUPLICATE_OFFSET_M, bounds.minZ, bounds.maxZ),
      };
      nextId = next.id;
      return {...prev,placedItems:[...prev.placedItems,next]};
    });
    if(nextId) {
      setActivePlacedId(nextId);
      setActiveRoomId('');
      setToast('Furniture duplicated');
    }
  };
  const moveItemLive = useCallback((id:string, patch:{x:number;z:number}) => {
    markWorkspaceDirty();
    setWS(prev=>normalizeWorkspaceData({
      ...prev,
      placedItems: prev.placedItems.map(item => item.id === id && !item.locked ? {...item, ...patch} : item),
    }));
  },[markWorkspaceDirty]);

  const addRoom = (templateKey:RoomTemplateKey) => commit(prev=>{
    const template = ROOM_TEMPLATES.find(option=>option.value===templateKey) || ROOM_TEMPLATES[0];
    const width = Math.min(template.width, Math.max(1, prev.booth.width - 0.5));
    const depth = Math.min(template.depth, Math.max(1, prev.booth.depth - 0.5));
    const wallHeight = Math.max(1.8, prev.booth.height);
    const room: WorkspaceRoom = normalizeRoom({
      id:`room-${Date.now()}`,
      name:`${template.name} ${prev.rooms.length + 1}`,
      width,
      depth,
      height:wallHeight,
      x:prev.booth.width / 2,
      z:prev.booth.depth / 2,
      hasDoor:true,
      hasCeiling:template.hasCeiling,
      doorSide:'front',
      doorWidth:0.85,
      doorPosition:'center',
      doorSwing:'left-in',
      doorOpen:false,
      wallFinish:'white',
      floorColor:'#1f2937',
      locked:false,
    }, prev.rooms.length, prev.booth);
    const placedRoom = findAvailableRoomPlacement(room, prev.rooms, prev.placedItems, prev.booth);
    if(!placedRoom) {
      setToast('No clear floor area is available for this room');
      return prev;
    }
    setToast(`${placedRoom.name} created from ${template.label}`);
    setActiveRoomId(placedRoom.id);
    setActivePlacedId('');
    return {...prev,rooms:[...prev.rooms,placedRoom]};
  });
  const updateRoom = (id:string, patch:Partial<WorkspaceRoom>) => {
    const placementFields:(keyof WorkspaceRoom)[] = ['x','z','width','depth','hasDoor','doorSide','doorWidth','doorPosition','doorSwing','doorOpen'];
    const validatesPlacement = placementFields.some(field=>Object.prototype.hasOwnProperty.call(patch,field));
    if(validatesPlacement) {
      const candidateData = normalizeWorkspaceData({
        ...ws,
        rooms: ws.rooms.map(room => room.id === id ? {...room,...patch} : room),
      });
      const candidate = candidateData.rooms.find(room=>room.id===id);
      const issue = candidate ? roomPlacementIssue(candidate,candidateData.rooms,candidateData.placedItems) : '';
      if(issue) {
        setToast(`Room change blocked: ${issue}`);
        return;
      }
    }
    commit(prev=>normalizeWorkspaceData({
      ...prev,
      rooms: prev.rooms.map(room => room.id === id ? {...room, ...patch} : room),
    }));
  };
  const uploadRoomDesign = (id:string, file?:File|null) => {
    if(!file) return;
    if(!workspaceRecord?.project.id) {
      setToast('Open a project before uploading images');
      return;
    }
    if(!file.type.startsWith('image/')) {
      setToast('Please choose an image file');
      return;
    }
    if(file.size > 384_000) {
      setToast('Image must be under 375 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if(!result.startsWith('data:image/')) {
        setToast('Image could not be loaded');
        return;
      }
      try {
        const uploaded = await uploadWorkspaceAsset(workspaceRecord.project.id, {
          dataUrl: result,
          name: file.name,
          purpose: 'room',
        });
        updateRoom(id,{designImageUrl:uploaded.asset.url,designImageName:file.name,designOpacity:1});
        setToast('Room wall image uploaded');
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Image could not be uploaded');
      }
    };
    reader.onerror = () => setToast('Image could not be loaded');
    reader.readAsDataURL(file);
  };
  const moveRoomLive = useCallback((id:string, patch:Partial<WorkspaceRoom>) => {
    markWorkspaceDirty();
    setWS(prev=>{
      const next = normalizeWorkspaceData({
        ...prev,
        rooms: prev.rooms.map(room => room.id === id ? {...room, ...patch} : room),
      });
      const candidate = next.rooms.find(room=>room.id===id);
      return candidate && roomPlacementIssue(candidate,next.rooms,next.placedItems) ? prev : next;
    });
  },[markWorkspaceDirty]);
  const moveFrontSupportsLive = useCallback((positions:number[], suppressed:number[]=[]) => {
    markWorkspaceDirty();
    setWS(prev=>normalizeWorkspaceData({
      ...prev,
      frontSupportPositions: positions,
      suppressedDefaultPositions: suppressed,
    }));
  },[markWorkspaceDirty]);
  const updateFrontSupportPosition = (index:number, value:number) => commit(prev=>{
    const suppressed = Array.isArray(prev.suppressedDefaultPositions) ? prev.suppressedDefaultPositions : [];
    const active = activeFrontSupportPositionsFor(prev.booth.width, prev.frontSupportPositions, suppressed);
    const oldX = active[index];
    const defaults = defaultFrontSupportPositionsFor(prev.booth.width);
    const wasDefault = oldX != null && defaults.some(p => Math.abs(p - oldX) < 0.12);
    const newSuppressed = wasDefault && oldX != null && !suppressed.some(p => Math.abs(p - oldX) < 0.12)
      ? [...suppressed, oldX] : suppressed;
    const custom = Array.isArray(prev.frontSupportPositions) ? prev.frontSupportPositions : [];
    const withoutOld = oldX != null ? custom.filter(p => Math.abs(p - oldX) >= 0.12) : custom;
    withoutOld.push(value);
    return normalizeWorkspaceData({
      ...prev,
      frontSupportPositions: withoutOld,
      suppressedDefaultPositions: newSuppressed,
    });
  });
  const removeFrontSupport = (index:number) => {
    commit(prev=>{
      const suppressed = Array.isArray(prev.suppressedDefaultPositions) ? prev.suppressedDefaultPositions : [];
      const active = activeFrontSupportPositionsFor(prev.booth.width, prev.frontSupportPositions, suppressed);
      const posToRemove = active[index];
      if (posToRemove == null) return prev;
      const defaults = defaultFrontSupportPositionsFor(prev.booth.width);
      const isDefault = defaults.some(p => Math.abs(p - posToRemove) < 0.12);
      const custom = Array.isArray(prev.frontSupportPositions) ? prev.frontSupportPositions : [];
      return normalizeWorkspaceData({
        ...prev,
        frontSupportPositions: custom.filter(p => Math.abs(p - posToRemove) >= 0.12),
        suppressedDefaultPositions: isDefault && !suppressed.some(p => Math.abs(p - posToRemove) < 0.12)
          ? [...suppressed, posToRemove] : suppressed,
      });
    });
    setActiveShellPartId('');
  };
  const removeRoom = (id:string) => {
    if(activeRoomId===id) {
      setActiveRoomId('');
      setSelectionAnchor(null);
    }
    commit(prev=>({...prev,rooms:prev.rooms.filter(room=>room.id!==id)}));
  };

  const addNote = () => {
    if(!newNote.trim()) return;
    const note:Note = {id:Date.now().toString(),text:newNote.trim(),color:noteColor,createdAt:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
    commit(prev=>({...prev,notes:[...prev.notes,note]}));
    setNewNote('');
  };
  const removeNote = (id:string) => commit(prev=>({...prev,notes:prev.notes.filter(n=>n.id!==id)}));

  const { booth, themeIdx, wallFinishIdx, frameFinishIdx, fasciaFinishIdx, carpetIdx, lightingPreset, placedItems, rooms, notes, panelOverrides, frontSupportPositions, suppressedDefaultPositions } = ws;
  const activePlacedItem = placedItems.find(item => item.id === activePlacedId) || null;
  const activeRoom = rooms.find(room => room.id === activeRoomId) || null;
  const activePanel = activeShellPartId ? panelDetails(activeShellPartId, booth) : null;
  const activeShellPart = activeShellPartId ? shellPartDetails(activeShellPartId, booth) : null;
  const activePanelOverride = activePanel ? (panelOverrides[activePanel.id] || {}) : {};
  const activeFasciaId = activeShellPart?.type === 'fascia' ? canonicalShellPartId(activeShellPartId) : '';
  const activeFasciaOverride = activeFasciaId ? (panelOverrides[activeFasciaId] || {}) : {};
  const activeFrontSupportIndex = Number(activeShellPartId.match(/^post-front-support-(\d+)$/)?.[1] ?? -1);
  const activeFrontSupportPositions = useMemo(
    () => activeFrontSupportPositionsFor(booth.width, frontSupportPositions, suppressedDefaultPositions ?? []),
    [booth.width, frontSupportPositions, suppressedDefaultPositions],
  );
  const projectLabel = workspaceRecord?.project.name ?? 'Workspace';
  const clientLabel = workspaceRecord?.project.client ?? booth.companyName;
  const exhibitionLabel = workspaceRecord?.project.exhibition ?? 'Client review';
  const feedbackMatchesFilter = (status:'open'|'resolved'|undefined) => feedbackFilter === 'all' || (status ?? 'open') === feedbackFilter;
  const visibleFeedbackItems = feedbackItems.filter(item => feedbackMatchesFilter(item.status));
  const openFeedbackCount = feedbackItems.filter(item => (item.status ?? 'open') === 'open').length;
  const approvalStage = workspaceApprovalStage(workspaceRecord);
  const approvalStageLabel = workspaceApprovalStageLabel(approvalStage);
  const canSendToClient = Boolean(workspaceRecord?.permissions?.can_send_arrangement);
  const sendDisabledReason = !workspaceRecord
    ? 'Workspace is still loading'
    : !canSendToClient
      ? approvalStage === 'sent' || approvalStage === 'viewed'
        ? 'Already sent to client'
        : approvalStage === 'approved' || approvalStage === 'locked'
          ? 'Approved workspaces are locked'
          : 'Workspace cannot be sent in this state'
      : '';
  const approvalStageColor = approvalStage === 'approved' || approvalStage === 'locked'
    ? C.green
    : approvalStage === 'revision_requested'
      ? C.orange
      : approvalStage === 'sent' || approvalStage === 'viewed'
        ? C.blue
        : C.muted;
  const floorArea    = (booth.width*booth.depth).toFixed(1);
  const openCount    = [booth.openFront,booth.openBack,booth.openLeft,booth.openRight].filter(Boolean).length;
  const boothType = openCount >= 4 ? 'Island' : openCount === 3 ? 'Peninsula' : openCount === 2 ? 'Corner' : openCount === 1 ? 'Inline' : 'Enclosed';
  const totalWeight  = placedItems.reduce((a,p)=>a+p.weight*p.qty,0);
  const totalParts   = placedItems.reduce((a,p)=>a+p.qty,0);
  const placementIssues = useMemo(
    () => placementIssuesFor(placedItems, rooms, booth, activeFrontSupportPositions),
    [placedItems, rooms, booth, activeFrontSupportPositions],
  );
  const invalidItemIds = useMemo(() => Array.from(new Set(placementIssues.map(issue => issue.itemId))), [placementIssues]);
  const placementIssueByItem = useMemo(() => {
    const map = new globalThis.Map<string, PlacementIssue[]>();
    placementIssues.forEach(issue => map.set(issue.itemId, [...(map.get(issue.itemId) || []), issue]));
    return map;
  }, [placementIssues]);
  const wallFinish = WALL_FINISHES[wallFinishIdx] || WALL_FINISHES[0];
  const frameFinish = FRAME_FINISHES[frameFinishIdx] || FRAME_FINISHES[0];
  const fasciaFinish = FASCIA_FINISHES[fasciaFinishIdx] || FASCIA_FINISHES[0];
  const carpetColor  = CARPETS[carpetIdx].color;
  const fasciaMeta = FASCIA_OPTIONS.find(option => option.value === booth.fasciaOption) || FASCIA_OPTIONS[0];
  const fasciaValid = !booth.fasciaEnabled || booth.width >= fasciaMeta.minWidth;

  const visibleCatalog = Object.fromEntries(Object.entries(CATALOG).filter(([cat,items])=>cat !== 'Structure' && cat !== 'Fascia' && items.length > 0));
  const furnitureCategoryCounts = useMemo(() => {
    const counts = new globalThis.Map<FurnitureCategory, number>();
    CATALOG.Furniture.forEach(item => {
      const category = item.furnitureCategory || furnitureCategoryFor(item);
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    counts.set('all', CATALOG.Furniture.length);
    return counts;
  }, []);
  const filteredCatalog = Object.fromEntries(
    Object.entries(visibleCatalog).map(([cat,items])=>[cat,
      (search?items.filter(i=>`${i.name} ${i.sku}`.toLowerCase().includes(search.toLowerCase())):items)
        .filter(item => cat !== 'Furniture' || activeFurnitureCategory === 'all' || (item.furnitureCategory || furnitureCategoryFor(item)) === activeFurnitureCategory)
    ])
  );

  // ── BOM + quote totals (pure math in ./workspace-bom) ────────────
  const structItems = useMemo(() => structuralBom(booth), [booth]);
  const roomItems = useMemo(() => roomBom(rooms, booth), [rooms, booth]);
  const totals = useMemo(
    () => quoteTotals({ structItems, roomItems, placedItems, fasciaSubtotal: booth.fasciaEnabled ? fasciaMeta.price : 0 }),
    [structItems, roomItems, placedItems, booth.fasciaEnabled, fasciaMeta.price],
  );
  // Only the values the shell itself still needs — the BOM panel reads `totals`.
  const { structWeight, roomWeight, fasciaSubtotal, quoteAllowance, quoteTotal } = totals;
  quoteTotalCentsRef.current = totals.quoteTotalCents;
  const csvCell = (value:string|number) => `"${String(value).replace(/"/g,'""')}"`;
  const exportBomCsv = () => {
    const rows = [
      ['Section','Name','SKU','Qty','Unit','Unit Weight Kg','Total Weight Kg','Unit Price USD','Total USD','Notes'],
      ...structItems.map(item => [
        'Structure',
        item.name,
        item.sku,
        item.qty,
        item.unit,
        item.weight,
        (item.qty * item.weight).toFixed(2),
        item.unitPrice,
        item.qty * item.unitPrice,
        '',
      ]),
      ...roomItems.map(item => [
        'Room Material',
        `${item.roomName} - ${item.name}`,
        item.sku,
        item.qty,
        item.unit,
        item.weight,
        (item.qty * item.weight).toFixed(2),
        item.unitPrice,
        Math.round(item.qty * item.unitPrice),
        item.notes,
      ]),
      ...placedItems.map(item => {
        const catalogItem = catalogItemFor(item.catalogId);
        const unitPrice = catalogItem?.price ?? 0;
        return [
          'Placed Item',
          item.name,
          item.sku,
          item.qty,
          'ea',
          item.weight,
          (item.qty * item.weight).toFixed(2),
          unitPrice || 'TBD',
          unitPrice ? unitPrice * item.qty : 'TBD',
          `${item.kind} / ${item.w}x${item.d}x${item.h}m / X ${item.x} Z ${item.z} Rot ${item.rotation}`,
        ];
      }),
      ['Summary','Fascia Option',booth.fasciaEnabled ? fasciaMeta.label : 'Disabled',1,'lot','','',fasciaSubtotal,fasciaSubtotal,booth.fasciaEnabled ? booth.fasciaOption : 'off'],
      ['Summary','Quote Allowance','CONTINGENCY',1,'lot','','',quoteAllowance,quoteAllowance,'10 percent allowance'],
      ['Summary','Quote Total','TOTAL',1,'lot','','',quoteTotal,quoteTotal,`${booth.width}x${booth.depth}x${booth.height}m / ${boothType}`],
      ['Summary','Total Weight','WEIGHT',1,'lot','',(structWeight + roomWeight + totalWeight).toFixed(2),'','','kg'],
    ];
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = projectLabel.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'workspace';
    link.href = url;
    link.download = `${safeName}-bom.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setToast('BOM CSV exported');
  };
  const downloadTextFile = (filename:string, content:string, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const safeProjectFileName = () => projectLabel.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'workspace';
  const exportProductionChecklist = () => {
    const lines = [
      `Production checklist - ${projectLabel}`,
      `Client: ${clientLabel}`,
      `Exhibition: ${exhibitionLabel}`,
      `Status: ${approvalStageLabel}`,
      '',
      'Stand',
      `- System: ${booth.system === 'maxima' ? 'Maxima' : 'Octanorm'}`,
      `- Dimensions: ${booth.width} x ${booth.depth} x ${booth.height} m`,
      `- Type: ${boothType}`,
      `- Open sides: ${[
        booth.openFront ? 'front' : '',
        booth.openBack ? 'back' : '',
        booth.openLeft ? 'left' : '',
        booth.openRight ? 'right' : '',
      ].filter(Boolean).join(', ') || 'none'}`,
      `- Wall finish: ${wallFinish.label}`,
      `- Frame finish: ${frameFinish.label}`,
      `- Fascia: ${booth.fasciaEnabled ? fasciaMeta.label : 'disabled'}`,
      `- Lighting: ${lightingPreset}`,
      `- Carpet: ${CARPETS[carpetIdx].label}`,
      '',
      'Rooms',
      ...(rooms.length ? rooms.map(room => `- ${room.name}: ${room.width} x ${room.depth} x ${room.height} m, door ${room.hasDoor ? `${room.doorSide} ${room.doorPosition} (${room.doorWidth.toFixed(2)} m)` : 'none'}, ceiling ${room.hasCeiling ? 'yes' : 'no'}`) : ['- None']),
      '',
      'BOM',
      `- Structural parts: ${structItems.reduce((a,s)=>a+s.qty,0)}`,
      `- Room material lines: ${roomItems.length}`,
      `- Placed items: ${totalParts}`,
      `- Total weight: ${(structWeight + roomWeight + totalWeight).toFixed(0)} kg`,
      `- Quote estimate: ${formatUsd(quoteTotal)}`,
      '',
      'Open Feedback',
      ...(feedbackItems.filter(item => (item.status ?? 'open') === 'open').length
        ? feedbackItems.filter(item => (item.status ?? 'open') === 'open').map(item => `- [${item.type}] ${item.text}`)
        : ['- None']),
      '',
      'Production checks',
      '- Confirm floor plan dimensions with venue.',
      '- Confirm wall/open-side configuration before ordering profiles.',
      '- Confirm client logo/fascia artwork dimensions.',
      '- Confirm furniture stock and replacements for unpriced/TBD items.',
      '- Confirm electrical load and lighting placement.',
      '- Confirm transport, installation crew, and dismantle schedule.',
    ].join('\r\n');
    downloadTextFile(`${safeProjectFileName()}-production-checklist.txt`, lines);
    setToast('Production checklist exported');
  };

  const iconBtn = (Icon:React.ComponentType<{size?:number}>,tooltip:string,onClick?:()=>void,disabled?:boolean,style?:React.CSSProperties) => {
    const IconComponent = Icon;
    return (
      <button title={tooltip} onClick={onClick} disabled={disabled}
        style={{background:'none',border:'none',cursor:disabled?'not-allowed':'pointer',padding:'5px 7px',color:disabled?C.hair:C.muted,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:3,opacity:disabled?0.4:1,...style}}>
        <IconComponent size={13}/>
      </button>
    );
  };

  // ── Project picker ────────────────────────────────────────────
  const saveStatusMeta = workspaceError || saveStatus === 'error'
    ? {label:'SAVE ISSUE', detail:lastSaved, color:C.orange}
    : isWorkspaceLoading
      ? {label:'LOADING WORKSPACE', detail:'Loading...', color:C.muted}
      : saveStatus === 'saving'
        ? {label:'SAVING...', detail:'Saving...', color:C.blue}
        : hasUnsavedChanges || saveStatus === 'dirty'
          ? {label:'UNSAVED CHANGES', detail:'Unsaved', color:C.orange}
          : {label:'SAVED', detail:lastSaved, color:C.green};

  const filteredPickerProjects = useMemo(()=>{
    const q = pickerSearch.trim().toLowerCase();
    if(!q) return pickerProjects;
    return pickerProjects.filter(p=>`${p.name} ${p.client} ${p.status}`.toLowerCase().includes(q));
  },[pickerProjects, pickerSearch]);

  if(showProjectPicker) {
    return (
      <WorkspaceProjectPicker
        search={pickerSearch}
        onSearch={setPickerSearch}
        isLoading={isPickerLoading}
        projects={filteredPickerProjects}
        onSelect={selectProject}
      />
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:C.bg,color:C.ink,fontFamily:UI,overflow:'hidden',userSelect:'none'}}>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header style={{height:46,borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',background:C.panel,flexShrink:0,gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
          <Link href="/pm">
            <button style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4,color:C.muted,padding:'4px 6px',borderRadius:4,flexShrink:0}}>
              <ChevronLeft size={13}/><span style={{fontFamily:MONO,fontSize:10}}>Back</span>
            </button>
          </Link>
          <div style={{width:1,height:18,background:C.hair,flexShrink:0}}/>
          <div style={{display:'flex',flexDirection:'column',lineHeight:1.2,minWidth:0}}>
            <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase'}}>Project</span>
            <span style={{fontSize:12.5,fontWeight:700,letterSpacing:'-0.01em',whiteSpace:'nowrap'}}>{workspaceRecord?.project.name ?? 'Loading workspace'}</span>
          </div>
          <span style={{fontFamily:MONO,fontSize:9.5,background:`${C.blue}12`,color:C.blue,border:`1px solid ${C.blue}28`,borderRadius:4,padding:'2px 7px',flexShrink:0}}>
            v{workspaceRecord?.currentVersion?.versionNumber ?? workspaceRecord?.design.currentVersionNumber ?? 1}
          </span>
          <span style={{fontFamily:MONO,fontSize:9.5,background:`${approvalStageColor}12`,color:approvalStageColor,border:`1px solid ${approvalStageColor}28`,borderRadius:4,padding:'2px 7px',flexShrink:0,textTransform:'uppercase'}}>
            {approvalStageLabel}
          </span>
          <div style={{width:1,height:18,background:C.hair,flexShrink:0}}/>
          <span style={{fontFamily:MONO,fontSize:9.5,display:'flex',alignItems:'center',gap:5,color:saveStatusMeta.color,flexShrink:0}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:saveStatusMeta.color,display:'inline-block',flexShrink:0}}/>{saveStatusMeta.label}
          </span>
          <button
            onClick={()=>{ setPickerSearch(''); setShowProjectPicker(true); }}
            title="Switch project"
            style={{background:'none',border:`1px solid ${C.hair}`,borderRadius:4,padding:'4px 9px',cursor:'pointer',fontFamily:MONO,fontSize:9,color:C.muted,display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
            <Layers size={10}/> Switch
          </button>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
          <div style={{display:'flex',border:`1px solid ${C.hair}`,borderRadius:4,overflow:'hidden'}}>
            {iconBtn(Undo2,'Undo (Ctrl+Z)',undo,!canUndo,{borderRight:`1px solid ${C.hair}`})}
            {iconBtn(Redo2,'Redo (Ctrl+Y)',redo,!canRedo)}
          </div>
          <div style={{width:1,height:18,background:C.hair}}/>
          <button onClick={save} disabled={saveStatus === 'saving'} title="Save" style={{background:'none',border:`1px solid ${hasUnsavedChanges || saveStatus === 'dirty' ? C.orange : C.hair}`,borderRadius:4,padding:'5px 10px',cursor:saveStatus === 'saving'?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:hasUnsavedChanges || saveStatus === 'dirty' ? C.orange : C.ink,opacity:saveStatus === 'saving'?0.7:1}}>
            <Save size={12}/> {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </button>
          <button onClick={()=>setShowSnapDlg(true)} title="Save snapshot" style={{background:'none',border:`1px solid ${C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:C.ink}}>
            <Camera size={12}/> Snapshot
          </button>
          <button onClick={()=>setShowHistPanel(h=>!h)} style={{background:showHistPanel?C.bg:'none',border:`1px solid ${showHistPanel?C.ink:C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:C.ink}}>
            <History size={12}/> History
            <span style={{fontFamily:MONO,fontSize:9,background:`${C.blue}15`,color:C.blue,borderRadius:3,padding:'1px 5px'}}>{snapshots.length}</span>
          </button>
          <button onClick={()=>setShowGrid(value=>!value)} title="Toggle grid" style={{background:showGrid?`${C.blue}10`:'none',border:`1px solid ${showGrid?C.blue:C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:showGrid?C.blue:C.ink}}>
            <Map size={12}/> Grid
          </button>
          <CurrencySwitcher variant="toolbar" />
          <button onClick={()=>setPreviewMode(value=>!value)} title="Preview workspace" style={{background:previewMode?`${C.orange}12`:'none',border:`1px solid ${previewMode?C.orange:C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:previewMode?C.orange:C.ink}}>
            <Maximize2 size={12}/> Preview
          </button>
          <button
            onClick={()=>canSendToClient && setShowSendDlg(true)}
            disabled={!canSendToClient}
            title={sendDisabledReason || 'Send workspace to client'}
            style={{background:canSendToClient?C.blue:`${C.muted}22`,border:'none',color:canSendToClient?'#fff':C.muted,borderRadius:4,padding:'6px 14px',cursor:canSendToClient?'pointer':'not-allowed',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,fontFamily:UI}}
          >
            <Send size={12}/> {approvalStage === 'sent' || approvalStage === 'viewed' ? 'Sent to Client' : 'Send to Client'}
          </button>
        </div>
      </header>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ── Left — Component Catalog ────────────────────────── */}
        {!previewMode&&(
          <WorkspaceCatalogPanel
            visibleCatalog={visibleCatalog}
            filteredCatalog={filteredCatalog}
            search={search}
            onSearch={setSearch}
            openCats={openCats}
            onToggleCat={(cat)=>setOpenCats(prev=>{const s=new Set(prev);if(s.has(cat)){s.delete(cat);}else{s.add(cat);}return s;})}
            activeFurnitureCategory={activeFurnitureCategory}
            onFurnitureCategory={setActiveFurnitureCategory}
            furnitureCategoryCounts={furnitureCategoryCounts}
            activeId={activeId}
            draggedCatalogItem={draggedCatalogItem}
            placedItems={placedItems}
            placementIssueByItem={placementIssueByItem}
            onBeginDrag={beginCatalogDrag}
            onEndDrag={endCatalogDrag}
            onAddItem={addItem}
            onRemoveCatalogItem={removeCatalogItem}
            onRemoveItem={removeItem}
            catalogDragWasActiveRef={catalogDragWasActiveRef}
          />
        )}

        {/* ── Center — Canvas (Booth3D iframe renderer) ────────── */}
        <main style={{flex:1,position:'relative',overflow:'hidden',backgroundColor:C.bg,
          backgroundImage:showGrid?'repeating-linear-gradient(0deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px)':'none'}}>

          {/* Booth3D fills canvas — iframe handles orbit/zoom internally */}
          <div style={{position:'absolute',inset:0}}>
            <Booth3D config={{
              width:booth.width, depth:booth.depth, height:booth.height,
              system:booth.system, companyName:booth.companyName,
              primaryColor:THEMES[themeIdx].color,
              wallColor: wallFinish.color,
              frameColor: frameFinish.color,
              fasciaColor: fasciaFinish.color,
              carpetColor,
              openFront:booth.openFront, openBack:booth.openBack,
              openLeft:booth.openLeft, openRight:booth.openRight,
              placedItems: placedItems,
              rooms,
              panelOverrides,
              frontSupportPositions,
              suppressedDefaultPositions: suppressedDefaultPositions ?? [],
              fasciaEnabled: booth.fasciaEnabled,
              fasciaOption: booth.fasciaOption,
              lightingPreset,
              invalidItemIds,
              catalogDragItem: draggedCatalogItem ? {
                catalogId: draggedCatalogItem.id,
                name: draggedCatalogItem.name,
                ...catalogItemProps(draggedCatalogItem),
                rotationY: 0,
              } : null,
              onItemMove: moveItemLive,
              onItemSelect: (id:string|null, partId?:string|null, detail?:{xPct?:number|null;yPct?:number|null;label?:string|null;partType?:string|null;roomId?:string|null})=>{
                const roomId = detail?.roomId ? String(detail.roomId) : '';
                if (roomId && rooms.some(room => room.id === roomId)) {
                  setActiveRoomId(roomId);
                  setSelectionAnchor(anchorFromSelection(detail, 'Room', 'room'));
                  setActivePlacedId('');
                  setActiveShellPartId('');
                  setActiveTab('props');
                  return;
                }
                const shellId = canonicalShellPartId(partId);
                const panelId = shellId.match(/panel-(front|back|left|right)-\d+/)?.[0];
                if (panelId) {
                  setActiveShellPartId(panelId);
                  setSelectionAnchor(anchorFromSelection(detail, 'Panel', 'panel'));
                  setActivePlacedId('');
                  setActiveRoomId('');
                  setActiveTab('panel');
                  return;
                }
                if (shellId && shellPartDetails(shellId, booth)) {
                  setActiveShellPartId(shellId);
                  setSelectionAnchor(anchorFromSelection(detail, 'Selection', 'shell'));
                  setActivePlacedId('');
                  setActiveRoomId('');
                  setActiveTab('panel');
                  return;
                }
                setActiveShellPartId('');
                setActiveRoomId('');
                setSelectionAnchor(null);
                if (id) {
                  setActivePlacedId(id);
                  setActiveRoomId('');
                  setSelectionAnchor(anchorFromSelection(detail, 'Furniture', 'furniture'));
                  setActiveTab('bom');
                }
              },
              onRoomMove: moveRoomLive,
              onFrontSupportMove: moveFrontSupportsLive,
              onItemDelete: (id: string) => removeItem(id),
              onItemRotate: (id: string, patch: { rotationY: number }) => updateItemTransform(id, { rotation: patch.rotationY, rotationY: patch.rotationY }),
              onCatalogItemDrop: placeCatalogItemAt,
              onCatalogItemDropRejected: (_catalogId: string, reason: string) => {
                setDraggedCatalogItem(null);
                setToast(`Placement blocked: ${reason}`);
              },
            }}/>
          </div>

          {/* Top-left floating badges */}
          <div style={{position:'absolute',top:12,left:12,display:'flex',gap:6,zIndex:10,pointerEvents:'none'}}>
            {[
              {text:'● LIVE WORKSPACE', color:C.green},
              {text:`${booth.system==='maxima'?'◈ MAXIMA':'⬡ OCTANORM'} · ${booth.width}×${booth.depth}M`, color:C.muted},
              ...(placementIssues.length ? [{text:`${placementIssues.length} PLACEMENT ISSUE${placementIssues.length>1?'S':''}`, color:C.orange}] : []),
            ].map(b=>(
              <span key={b.text} style={{fontFamily:MONO,fontSize:9.5,display:'flex',alignItems:'center',gap:5,background:C.panel,border:`1px solid ${C.hair}`,borderRadius:4,padding:'4px 9px',color:b.color,letterSpacing:'0.04em'}}>{b.text}</span>
            ))}
          </div>

          {selectionAnchor&&activePlacedItem&&(
            <div style={{
              position:'absolute',
              left:`clamp(16px, ${selectionAnchor.x}%, calc(100% - 286px))`,
              top:`clamp(16px, calc(${selectionAnchor.y}% - 92px), calc(100% - 108px))`,
              width:270,
              zIndex:22,
              background:C.panel,
              border:`1px solid ${C.hair}`,
              borderRadius:6,
              boxShadow:'0 14px 42px rgba(0,0,0,0.18)',
              padding:9,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <div style={{width:9,height:9,borderRadius:2,background:activePlacedItem.color,flexShrink:0}}/>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontFamily:MONO,fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Furniture selection</div>
                  <div style={{fontSize:12,fontWeight:800,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activePlacedItem.name}</div>
                </div>
                <button onClick={()=>{setSelectionAnchor(null);setActivePlacedId('');}} title="Close" style={{width:24,height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.muted,cursor:'pointer',display:'grid',placeItems:'center'}}>
                  <X size={12}/>
                </button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6, 1fr)',gap:5}}>
                <button disabled={activePlacedItem.locked} title="Rotate left" onClick={()=>rotateItem(activePlacedItem.id,-15)} style={{height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:activePlacedItem.locked?'not-allowed':'pointer',opacity:activePlacedItem.locked?0.45:1,fontFamily:MONO,fontSize:10,fontWeight:800}}>Y-</button>
                <button disabled={activePlacedItem.locked} title="Rotate right" onClick={()=>rotateItem(activePlacedItem.id,15)} style={{height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:activePlacedItem.locked?'not-allowed':'pointer',opacity:activePlacedItem.locked?0.45:1,fontFamily:MONO,fontSize:10,fontWeight:800}}>Y+</button>
                <button disabled={activePlacedItem.locked} title="Tilt X" onClick={()=>updateItemTransform(activePlacedItem.id,{rotationX:((Number(activePlacedItem.rotationX)||0)+15)})} style={{height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:activePlacedItem.locked?'not-allowed':'pointer',opacity:activePlacedItem.locked?0.45:1,fontFamily:MONO,fontSize:10,fontWeight:800}}>X+</button>
                <button title={activePlacedItem.locked?'Unlock item':'Lock item'} onClick={()=>updateItem(activePlacedItem.id,{locked:!activePlacedItem.locked})} style={{height:30,border:`1px solid ${activePlacedItem.locked?C.blue:C.hair}`,borderRadius:4,background:activePlacedItem.locked?`${C.blue}12`:C.bg,color:activePlacedItem.locked?C.blue:C.muted,cursor:'pointer',display:'grid',placeItems:'center'}}>{activePlacedItem.locked?<Lock size={12}/>:<Unlock size={12}/>}</button>
                <button title="Duplicate" onClick={()=>duplicateItem(activePlacedItem.id)} style={{height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.muted,cursor:'pointer',display:'grid',placeItems:'center'}}><Copy size={12}/></button>
                <button title="Delete" onClick={()=>{removeItem(activePlacedItem.id);setSelectionAnchor(null);}} style={{height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:`${C.orange}12`,color:C.orange,cursor:'pointer',display:'grid',placeItems:'center'}}><Trash2 size={12}/></button>
              </div>
              {(()=>{
                const bounds = positionBoundsForItem(activePlacedItem, booth);
                return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginTop:7}}>
                  <DimInput label="X" value={activePlacedItem.x} min={bounds.minX} max={bounds.maxX} step={0.05} onChange={value=>updateItemTransform(activePlacedItem.id,{x:value})}/>
                  <DimInput label="Z" value={activePlacedItem.z} min={bounds.minZ} max={bounds.maxZ} step={0.05} onChange={value=>updateItemTransform(activePlacedItem.id,{z:value})}/>
                  <DimInput label="Yaw" value={Number(activePlacedItem.rotationY ?? activePlacedItem.rotation)} min={0} max={345} step={15} onChange={value=>updateItemTransform(activePlacedItem.id,{rotation:value,rotationY:value})}/>
                </div>;
              })()}
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontFamily:MONO,fontSize:8.5,color:C.muted}}>
                <span>{activePlacedItem.sku}</span>
                <span>{activePlacedItem.w.toFixed(2)} x {activePlacedItem.d.toFixed(2)} x {activePlacedItem.h.toFixed(2)} m</span>
              </div>
            </div>
          )}

          {selectionAnchor&&activeRoom&&(
            <div data-workspace-room-inspector={activeRoom.id} style={{
              position:'absolute',
              left:`clamp(16px, ${selectionAnchor.x}%, calc(100% - 292px))`,
              top:`clamp(16px, calc(${selectionAnchor.y}% - 174px), calc(100% - 250px))`,
              width:276,
              zIndex:22,
              background:C.panel,
              border:`1px solid ${C.hair}`,
              borderRadius:6,
              boxShadow:'0 14px 42px rgba(0,0,0,0.18)',
              padding:10,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <div style={{width:9,height:9,borderRadius:2,background:activeRoom.wallFinish==='dark'?'#343942':activeRoom.wallFinish==='glass'?'#c7dfeb':'#e9edf2',border:`1px solid ${C.hair}`,flexShrink:0}}/>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontFamily:MONO,fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Room selection</div>
                  <div style={{fontSize:12,fontWeight:800,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeRoom.name}</div>
                </div>
                <button type="button" onClick={()=>{setSelectionAnchor(null);setActiveRoomId('');}} title="Close room inspector" aria-label="Close room inspector" style={{width:24,height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.muted,cursor:'pointer',display:'grid',placeItems:'center'}}>
                  <X size={12}/>
                </button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                <DimInput label="W" value={activeRoom.width} min={1} max={booth.width} step={1} onChange={value=>updateRoom(activeRoom.id,{width:value})}/>
                <DimInput label="D" value={activeRoom.depth} min={1} max={booth.depth} step={1} onChange={value=>updateRoom(activeRoom.id,{depth:value})}/>
                <DimInput label="H" value={activeRoom.height} min={1.8} max={booth.height} step={0.1} onChange={value=>updateRoom(activeRoom.id,{height:value})}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:7}}>
                <DimInput label="X" value={activeRoom.x} min={activeRoom.width/2} max={Math.max(activeRoom.width/2,booth.width-activeRoom.width/2)} step={0.5} onChange={value=>updateRoom(activeRoom.id,{x:value})}/>
                <DimInput label="Z" value={activeRoom.z} min={activeRoom.depth/2} max={Math.max(activeRoom.depth/2,booth.depth-activeRoom.depth/2)} step={0.5} onChange={value=>updateRoom(activeRoom.id,{z:value})}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 36px',gap:6,marginTop:7}}>
                <select aria-label="Room wall finish" value={activeRoom.wallFinish} onChange={event=>updateRoom(activeRoom.id,{wallFinish:event.target.value as RoomWallFinish})}
                  style={{height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,fontFamily:UI,fontSize:10.5,fontWeight:700,paddingLeft:7,outline:'none'}}>
                  <option value="white">White panel</option>
                  <option value="frosted">Frosted glass</option>
                  <option value="glass">Clear glass</option>
                  <option value="dark">Dark wall</option>
                </select>
                <input aria-label="Room floor color" title="Room floor color" type="color" value={activeRoom.floorColor} onChange={event=>updateRoom(activeRoom.id,{floorColor:event.target.value})}
                  style={{width:36,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,padding:2,cursor:'pointer'}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 30px',gap:6,marginTop:7}}>
                <label style={{height:29,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontFamily:MONO,fontSize:8.5,fontWeight:800,padding:'0 7px',overflow:'hidden'}}>
                  <ImagePlus size={11}/>
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeRoom.designImageName || 'Add wall image'}</span>
                  <input aria-label="Upload selected room wall image" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={event=>{uploadRoomDesign(activeRoom.id,event.target.files?.[0]);event.currentTarget.value='';}} style={{display:'none'}}/>
                </label>
                <button type="button" disabled={!activeRoom.designImageUrl} onClick={()=>updateRoom(activeRoom.id,{designImageUrl:undefined,designImageName:undefined,designOpacity:undefined})} title="Remove room image" aria-label="Remove room image" style={{height:29,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.orange,cursor:activeRoom.designImageUrl?'pointer':'not-allowed',opacity:activeRoom.designImageUrl?1:0.35,display:'grid',placeItems:'center'}}><Trash2 size={11}/></button>
              </div>
              {activeRoom.designImageUrl&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:7}}>
                <select aria-label="Selected room graphic wall" value={activeRoom.designWall} onChange={event=>updateRoom(activeRoom.id,{designWall:event.target.value as DoorSide})}
                  style={{height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,fontFamily:UI,fontSize:10,fontWeight:700,paddingLeft:6,outline:'none'}}>
                  {ROOM_SIDE_OPTIONS.map(option=><option key={option.value} value={option.value} disabled={activeRoom.hasDoor&&activeRoom.doorSide===option.value}>{option.label}{activeRoom.hasDoor&&activeRoom.doorSide===option.value?' (door)':''}</option>)}
                </select>
                <select aria-label="Selected room graphic fit" value={activeRoom.designFit} onChange={event=>updateRoom(activeRoom.id,{designFit:event.target.value as RoomGraphicFit})}
                  style={{height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,fontFamily:UI,fontSize:10,fontWeight:700,paddingLeft:6,outline:'none'}}>
                  <option value="cover">Fill wall</option>
                  <option value="contain">Show full image</option>
                  <option value="stretch">Stretch</option>
                </select>
              </div>}
              {activeRoom.hasDoor&&<div style={{display:'grid',gridTemplateColumns:'1fr 82px',gap:6,marginTop:7}}>
                <select aria-label="Room door wall" value={activeRoom.doorSide} onChange={event=>updateRoom(activeRoom.id,{doorSide:event.target.value as DoorSide})}
                  style={{height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,fontFamily:UI,fontSize:10.5,fontWeight:700,paddingLeft:7,outline:'none'}}>
                  <option value="front">Front door</option>
                  <option value="back">Back door</option>
                  <option value="left">Left door</option>
                  <option value="right">Right door</option>
                </select>
                <div style={{position:'relative'}}>
                  <input aria-label="Room door width" name={`room-door-width-${activeRoom.id}`} type="number" min={0.55} max={roomDoorMaxWidth(activeRoom)} step={0.05} value={activeRoom.doorWidth}
                    onChange={event=>{const value=Number(event.target.value);if(Number.isFinite(value))updateRoom(activeRoom.id,{doorWidth:clampNumber(value,0.55,roomDoorMaxWidth(activeRoom))});}}
                    style={{width:'100%',height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,fontFamily:MONO,fontSize:10.5,fontWeight:700,padding:'0 20px 0 7px',boxSizing:'border-box',outline:'none'}}/>
                  <span style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontFamily:MONO,fontSize:8,color:C.muted}}>m</span>
                </div>
              </div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 34px 34px',gap:5,marginTop:7}}>
                <button type="button" onClick={()=>updateRoom(activeRoom.id,{hasDoor:!activeRoom.hasDoor})} style={{height:29,border:`1px solid ${activeRoom.hasDoor?C.blue:C.hair}`,borderRadius:4,background:activeRoom.hasDoor?`${C.blue}12`:C.bg,color:activeRoom.hasDoor?C.blue:C.muted,cursor:'pointer',fontFamily:MONO,fontSize:8.5,fontWeight:800}}>Door</button>
                <button type="button" onClick={()=>updateRoom(activeRoom.id,{hasCeiling:!activeRoom.hasCeiling})} style={{height:29,border:`1px solid ${activeRoom.hasCeiling?C.blue:C.hair}`,borderRadius:4,background:activeRoom.hasCeiling?`${C.blue}12`:C.bg,color:activeRoom.hasCeiling?C.blue:C.muted,cursor:'pointer',fontFamily:MONO,fontSize:8.5,fontWeight:800}}>Ceiling</button>
                <button type="button" onClick={()=>updateRoom(activeRoom.id,{locked:!activeRoom.locked})} title={activeRoom.locked?'Unlock room':'Lock room'} aria-label={activeRoom.locked?'Unlock room':'Lock room'} style={{height:29,border:`1px solid ${activeRoom.locked?C.blue:C.hair}`,borderRadius:4,background:activeRoom.locked?`${C.blue}12`:C.bg,color:activeRoom.locked?C.blue:C.muted,cursor:'pointer',display:'grid',placeItems:'center'}}>{activeRoom.locked?<Lock size={12}/>:<Unlock size={12}/>}</button>
                <button type="button" onClick={()=>removeRoom(activeRoom.id)} title="Delete room" aria-label="Delete room" style={{height:29,border:`1px solid ${C.hair}`,borderRadius:4,background:`${C.orange}12`,color:C.orange,cursor:'pointer',display:'grid',placeItems:'center'}}><Trash2 size={12}/></button>
              </div>
            </div>
          )}

          {selectionAnchor&&activePanel&&(
            <div style={{
              position:'absolute',
              left:`clamp(16px, ${selectionAnchor.x}%, calc(100% - 292px))`,
              top:`clamp(16px, calc(${selectionAnchor.y}% - 184px), calc(100% - 260px))`,
              width:276,
              zIndex:18,
              background:C.panel,
              border:`1px solid ${C.hair}`,
              borderRadius:6,
              boxShadow:'0 14px 42px rgba(0,0,0,0.18)',
              padding:10,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <div style={{width:9,height:9,borderRadius:2,background:activePanelOverride.color || wallFinish.color,flexShrink:0}}/>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Panel selection</div>
                  <div style={{fontSize:12,fontWeight:800,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activePanel.label}</div>
                </div>
                <button onClick={()=>{setSelectionAnchor(null);setActiveShellPartId('');}} style={{width:24,height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.muted,cursor:'pointer',display:'grid',placeItems:'center'}}>
                  <X size={12}/>
                </button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:9}}>
                {[
                  ['W', `${activePanel.width.toFixed(2)} m`],
                  ['H', `${activePanel.height.toFixed(2)} m`],
                  ['Diag', `${activePanel.diagonal.toFixed(2)} m`],
                ].map(([label,value])=>(
                  <div key={label} style={{border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,padding:'5px 6px'}}>
                    <div style={{fontFamily:MONO,fontSize:8,color:C.muted,textTransform:'uppercase'}}>{label}</div>
                    <div style={{fontFamily:MONO,fontSize:10.5,fontWeight:800,color:C.ink,marginTop:1}}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}>
                <input type="color" value={activePanelOverride.color || wallFinish.color} onChange={e=>updatePanelOverride(activePanel.id,{color:e.target.value})}
                  style={{width:34,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,cursor:'pointer',padding:2}}/>
                <input value={activePanelOverride.brandText || ''} onChange={e=>updatePanelOverride(activePanel.id,{brandText:e.target.value.slice(0,40)})}
                  placeholder="Brand / sticker text"
                  style={{flex:1,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:11.5,color:C.ink,paddingLeft:8,outline:'none'}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:7,alignItems:'center',marginBottom:8}}>
                <label style={{height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontFamily:MONO,fontSize:8.5,fontWeight:800,overflow:'hidden',padding:'0 8px'}}>
                  <ImagePlus size={11}/>
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activePanelOverride.designImageName || 'Upload image design'}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={e=>{uploadPanelDesign(activePanel.id,e.target.files?.[0]); e.currentTarget.value='';}} style={{display:'none'}}/>
                </label>
                {activePanelOverride.designImageUrl&&(
                  <button onClick={()=>updatePanelOverride(activePanel.id,{designImageUrl:'',designImageName:'',designOpacity:undefined})}
                    style={{height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.muted,cursor:'pointer',fontFamily:MONO,fontSize:8.5,fontWeight:800,padding:'0 8px'}}>
                    Clear
                  </button>
                )}
              </div>
              {activePanelOverride.designImageUrl&&(
                <div style={{display:'grid',gridTemplateColumns:'54px 1fr',gap:7,alignItems:'center',marginBottom:8}}>
                  <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted,textTransform:'uppercase'}}>Image</span>
                  <input type="range" min={0.15} max={1} step={0.05} value={activePanelOverride.designOpacity ?? 1} onChange={e=>updatePanelOverride(activePanel.id,{designOpacity:Number(e.target.value)})}
                    style={{width:'100%',accentColor:C.blue}}/>
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'34px 1fr 54px',gap:7,alignItems:'center'}}>
                <input type="color" value={activePanelOverride.brandColor || '#111827'} onChange={e=>updatePanelOverride(activePanel.id,{brandColor:e.target.value})}
                  style={{width:34,height:26,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,cursor:'pointer',padding:2}}/>
                <input type="range" min={0.08} max={0.45} step={0.01} value={activePanelOverride.brandScale ?? 0.15} onChange={e=>updatePanelOverride(activePanel.id,{brandScale:Number(e.target.value)})}
                  style={{width:'100%',accentColor:C.blue}}/>
                <button onClick={()=>resetPanelOverride(activePanel.id)}
                  style={{height:26,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',fontFamily:MONO,fontSize:8.5,fontWeight:800}}>
                  Reset
                </button>
              </div>
            </div>
          )}

          {selectionAnchor&&activeShellPart&&!activePanel&&(
            <div style={{
              position:'absolute',
              left:`clamp(16px, ${selectionAnchor.x}%, calc(100% - 260px))`,
              top:`clamp(16px, calc(${selectionAnchor.y}% - 130px), calc(100% - 214px))`,
              width:244,
              zIndex:18,
              background:C.panel,
              border:`1px solid ${C.hair}`,
              borderRadius:6,
              boxShadow:'0 14px 42px rgba(0,0,0,0.18)',
              padding:10,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <div style={{width:9,height:9,borderRadius:2,background:activeShellPart.type==='carpet'?carpetColor:activeShellPart.type==='fascia'?fasciaFinish.color:frameFinish.color,flexShrink:0}}/>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>{activeShellPart.type} selection</div>
                  <div style={{fontSize:12,fontWeight:800,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeShellPart.label}</div>
                </div>
                <button onClick={()=>{setSelectionAnchor(null);setActiveShellPartId('');}} style={{width:24,height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.muted,cursor:'pointer',display:'grid',placeItems:'center'}}>
                  <X size={12}/>
                </button>
              </div>
              <div style={{border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,padding:'6px 8px',display:'grid',gap:4}}>
                {activeShellPart.rows.slice(0,4).map(([label,value])=>(
                  <div key={label} style={{display:'flex',justifyContent:'space-between',gap:8,fontFamily:MONO,fontSize:9.5}}>
                    <span style={{color:C.muted,textTransform:'uppercase'}}>{label}</span>
                    <span style={{color:C.ink,fontWeight:800,textAlign:'right'}}>{value}</span>
                  </div>
                ))}
              </div>
              {activeFrontSupportIndex>=0&&(
                <div style={{marginTop:8}}>
                  <label htmlFor={`${uid}-support-x`} style={{fontFamily:MONO,fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:4}}>Support X position</label>
                  <input id={`${uid}-support-x`} type="range" min={0.45} max={Math.max(0.45,booth.width-0.45)} step={0.05}
                    value={activeFrontSupportPositions[activeFrontSupportIndex] ?? 3}
                    onChange={e=>updateFrontSupportPosition(activeFrontSupportIndex, Number(e.target.value))}
                    style={{width:'100%',accentColor:C.blue}}/>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginTop:5}}>
                    <input type="number" min={0.45} max={Math.max(0.45,booth.width-0.45)} step={0.05}
                      value={Number(activeFrontSupportPositions[activeFrontSupportIndex] ?? 3).toFixed(2)}
                      onChange={e=>updateFrontSupportPosition(activeFrontSupportIndex, Number(e.target.value))}
                      style={{width:76,height:26,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:MONO,fontSize:10.5,color:C.ink,paddingLeft:7,outline:'none'}}/>
                    <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>meters from left front corner</span>
                  </div>
                  <button onClick={()=>removeFrontSupport(activeFrontSupportIndex)}
                    style={{marginTop:8,width:'100%',height:28,background:'transparent',border:`1px solid ${C.orange}`,borderRadius:4,color:C.orange,fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer'}}>
                    Remove Rail
                  </button>
                </div>
              )}
            </div>
          )}

        </main>

        {/* ── Right — Properties / BOM / Notes ─────────────────── */}
        {!previewMode&&<aside style={{width:282,borderLeft:`1px solid ${C.hair}`,background:C.panel,display:'flex',flexDirection:'column',flexShrink:0}}>
          {/* Tab bar */}
          <div style={{display:'flex',borderBottom:`1px solid ${C.hair}`,flexShrink:0}}>
            {([['props','Properties',Settings2],['panel','Selection',Square],['bom','BOM',Package],['notes','Notes',StickyNote],['feedback','Feedback',MessageSquare]] as const).map(([k,label,Icon])=>(
              <button key={k} onClick={()=>setActiveTab(k as typeof activeTab)}
                style={{flex:1,background:activeTab===k?C.panel:'transparent',border:'none',borderBottom:activeTab===k?`2px solid ${C.blue}`:'2px solid transparent',padding:'8px 4px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.08em',color:activeTab===k?C.blue:C.muted,textTransform:'uppercase'}}>
                <Icon size={10}/> {label}
                {k==='feedback'&&openFeedbackCount>0&&<span style={{background:C.orange,color:'#fff',borderRadius:8,padding:'1px 5px',fontSize:8,lineHeight:1}}>{openFeedbackCount}</span>}
              </button>
            ))}
          </div>

          {/* Properties Tab */}
          {activeTab==='props'&&(
            <div style={{flex:1,overflowY:'auto',padding:'0 16px'}}>
              <PropBlock label="Stand Configuration" right="metric">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <DimInput label="Width"  value={booth.width}  min={1} max={40} step={1} onChange={v=>set('width',v)}/>
                  <DimInput label="Depth"  value={booth.depth}  min={1} max={40} step={1} onChange={v=>set('depth',v)}/>
                </div>
                <DimInput label="Height" value={booth.height} min={1.5} max={6} step={1} onChange={v=>set('height',v)}/>
                <div style={{marginTop:8}}>
                  <label htmlFor={`${uid}-system`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:3}}>System</label>
                  <select id={`${uid}-system`} value={booth.system} onChange={e=>set('system',e.target.value as BoothSystem)}
                    style={{width:'100%',height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:12,color:C.ink,paddingLeft:8,boxSizing:'border-box',outline:'none',cursor:'pointer'}}>
                    <option value="octanorm">Octanorm (1 m module)</option>
                    <option value="maxima">Maxima (2 m module)</option>
                  </select>
                </div>
              </PropBlock>
              <Hairline/>
              <PropBlock label="Fascia Sign" right={booth.fasciaEnabled ? `${fasciaMeta.boardMm} mm` : 'Disabled'}>
                <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,border:`1px solid ${C.hair}`,borderRadius:5,background:C.bg,padding:'8px 10px',cursor:'pointer'}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.ink}}>Enable rail fascia</span>
                  <input type="checkbox" id="fascia-enabled" name="fascia-enabled" checked={booth.fasciaEnabled} onChange={e=>set('fasciaEnabled',e.target.checked)}
                    style={{width:16,height:16,accentColor:C.blue,cursor:'pointer'}}/>
                </label>
                <input id="company-name" name="company-name" value={booth.companyName} disabled={!booth.fasciaEnabled} onChange={e=>set('companyName',e.target.value.toUpperCase().slice(0,22))}
                  style={{width:'100%',height:34,marginTop:8,border:`1px solid ${C.hair}`,borderRadius:4,background:booth.fasciaEnabled?C.bg:'#f2f0eb',fontFamily:MONO,fontSize:12,fontWeight:700,color:C.ink,paddingLeft:10,boxSizing:'border-box',outline:'none',letterSpacing:'0.06em',opacity:booth.fasciaEnabled?1:0.55}}/>
                <select value={booth.fasciaOption} disabled={!booth.fasciaEnabled} onChange={e=>set('fasciaOption',e.target.value as FasciaOption)}
                  style={{width:'100%',height:30,marginTop:8,border:`1px solid ${fasciaValid?C.hair:C.orange}`,borderRadius:4,background:booth.fasciaEnabled?C.bg:'#f2f0eb',fontFamily:UI,fontSize:12,color:C.ink,paddingLeft:8,boxSizing:'border-box',outline:'none',cursor:booth.fasciaEnabled?'pointer':'not-allowed',opacity:booth.fasciaEnabled?1:0.55}}>
                  {FASCIA_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <div style={{marginTop:7,fontFamily:MONO,fontSize:8.7,color:fasciaValid?C.muted:C.orange,lineHeight:1.45}}>
                  {booth.fasciaEnabled ? `${fasciaMeta.note} Price impact: USD ${fasciaMeta.price.toLocaleString()}.` : 'Fascia board removed from rail and BOM.'}
                  {!fasciaValid && ` Minimum width for this fascia is ${fasciaMeta.minWidth.toFixed(1)} m.`}
                </div>
              </PropBlock>
              <Hairline/>
              <PropBlock label="Lighting" right={lightingPreset}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                  {LIGHTING_PRESETS.map(option=>(
                    <button key={option.value} onClick={()=>commit(prev=>({...prev,lightingPreset:option.value}))}
                      style={{height:28,border:`1px solid ${lightingPreset===option.value?C.blue:C.hair}`,borderRadius:4,background:lightingPreset===option.value?`${C.blue}12`:C.bg,color:lightingPreset===option.value?C.blue:C.ink,cursor:'pointer',fontFamily:MONO,fontSize:9.5,fontWeight:700}}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </PropBlock>
              <Hairline/>
              <PropBlock label="Rooms" right={`${rooms.length} placed`}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 34px',gap:6,marginBottom:8}}>
                  <select aria-label="Room template" value={roomTemplate} onChange={event=>setRoomTemplate(event.target.value as RoomTemplateKey)}
                    style={{height:32,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,fontFamily:UI,fontSize:11,fontWeight:700,paddingLeft:8,outline:'none'}}>
                    {ROOM_TEMPLATES.map(template=><option key={template.value} value={template.value}>{template.label}</option>)}
                  </select>
                  <button type="button" onClick={()=>addRoom(roomTemplate)} title="Create room from template" aria-label="Create room from template"
                    style={{height:32,border:`1px solid ${C.blue}`,borderRadius:4,background:`${C.blue}12`,color:C.blue,cursor:'pointer',display:'grid',placeItems:'center'}}>
                    <Plus size={13}/>
                  </button>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {rooms.map((room,index)=>(
                    <div key={room.id} data-workspace-room-editor={room.id} onClick={()=>setActiveRoomId(room.id)} onFocusCapture={()=>setActiveRoomId(room.id)} style={{border:`1px solid ${activeRoomId===room.id?C.blue:C.hair}`,borderRadius:5,background:activeRoomId===room.id?`${C.blue}08`:C.bg,padding:9}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
                        <input value={room.name} onChange={e=>updateRoom(room.id,{name:e.target.value})}
                          style={{flex:1,minWidth:0,height:26,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,fontFamily:UI,fontSize:12,fontWeight:700,color:C.ink,paddingLeft:7,outline:'none'}}/>
                        <button onClick={()=>removeRoom(room.id)} title="Remove room" style={{width:26,height:26,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,color:C.muted,cursor:'pointer',display:'grid',placeItems:'center',flexShrink:0}}>
                          <Trash2 size={11}/>
                        </button>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                        <DimInput label="W" value={room.width} min={1} max={booth.width} step={1} onChange={v=>updateRoom(room.id,{width:v})}/>
                        <DimInput label="D" value={room.depth} min={1} max={booth.depth} step={1} onChange={v=>updateRoom(room.id,{depth:v})}/>
                        <DimInput label="Wall H" value={room.height} min={1.8} max={booth.height} step={0.1} onChange={v=>updateRoom(room.id,{height:v})}/>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:6}}>
                        <DimInput label="X" value={room.x} min={room.width/2} max={Math.max(room.width/2,booth.width-room.width/2)} step={0.5} onChange={v=>updateRoom(room.id,{x:v})}/>
                        <DimInput label="Z" value={room.z} min={room.depth/2} max={Math.max(room.depth/2,booth.depth-room.depth/2)} step={0.5} onChange={v=>updateRoom(room.id,{z:v})}/>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 42px',gap:6,marginTop:7}}>
                        <label style={{display:'flex',flexDirection:'column',gap:4}}>
                          <span style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>Wall finish</span>
                          <select value={room.wallFinish} onChange={e=>updateRoom(room.id,{wallFinish:e.target.value as RoomWallFinish})}
                            style={{height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,color:C.ink,fontFamily:UI,fontSize:11,fontWeight:700,paddingLeft:7,outline:'none'}}>
                            <option value="white">White panel</option>
                            <option value="frosted">Frosted glass</option>
                            <option value="glass">Clear glass</option>
                            <option value="dark">Dark wall</option>
                          </select>
                        </label>
                        <label style={{display:'flex',flexDirection:'column',gap:4}}>
                          <span style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>Floor</span>
                          <input type="color" value={room.floorColor} onChange={e=>updateRoom(room.id,{floorColor:e.target.value})}
                            style={{width:42,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,padding:2,cursor:'pointer'}}/>
                        </label>
                      </div>
                      <div style={{marginTop:7}}>
                        <span style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Room wall image</span>
                        <label style={{height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,color:C.ink,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontFamily:MONO,fontSize:9,fontWeight:800,padding:'0 8px',overflow:'hidden'}}>
                          <ImagePlus size={12}/>
                          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{room.designImageName || 'Upload room wall image'}</span>
                          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={e=>{uploadRoomDesign(room.id,e.target.files?.[0]); e.currentTarget.value='';}} style={{display:'none'}}/>
                        </label>
                        {room.designImageUrl&&<>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:7}}>
                            <label style={{display:'flex',flexDirection:'column',gap:4}}>
                              <span style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Graphic wall</span>
                              <select aria-label={`${room.name} graphic wall`} value={room.designWall} onChange={e=>updateRoom(room.id,{designWall:e.target.value as DoorSide})}
                                style={{height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,color:C.ink,fontFamily:UI,fontSize:10.5,fontWeight:700,paddingLeft:7,outline:'none'}}>
                                {ROOM_SIDE_OPTIONS.map(option=><option key={option.value} value={option.value} disabled={room.hasDoor&&room.doorSide===option.value}>{option.label}{room.hasDoor&&room.doorSide===option.value?' (door)':''}</option>)}
                              </select>
                            </label>
                            <label style={{display:'flex',flexDirection:'column',gap:4}}>
                              <span style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Image fit</span>
                              <select aria-label={`${room.name} graphic fit`} value={room.designFit} onChange={e=>updateRoom(room.id,{designFit:e.target.value as RoomGraphicFit})}
                                style={{height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,color:C.ink,fontFamily:UI,fontSize:10.5,fontWeight:700,paddingLeft:7,outline:'none'}}>
                                <option value="cover">Fill wall</option>
                                <option value="contain">Show full image</option>
                                <option value="stretch">Stretch to wall</option>
                              </select>
                            </label>
                          </div>
                          <div style={{height:54,marginTop:7,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                            <img src={room.designImageUrl} alt={`${room.name || 'Room'} wall design`} style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'62px 1fr',gap:7,alignItems:'center',marginTop:7}}>
                            <label htmlFor={`${uid}-room-${room.id}-opacity`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Opacity</label>
                            <input id={`${uid}-room-${room.id}-opacity`} type="range" min={0.15} max={1} step={0.05} value={room.designOpacity ?? 1} onChange={e=>updateRoom(room.id,{designOpacity:Number(e.target.value)})}
                              style={{width:'100%',accentColor:C.blue}}/>
                          </div>
                          <button onClick={()=>updateRoom(room.id,{designImageUrl:undefined,designImageName:undefined,designOpacity:undefined})}
                            style={{width:'100%',height:28,marginTop:7,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',fontFamily:UI,fontSize:11,fontWeight:700}}>
                            Remove room image
                          </button>
                        </>}
                      </div>
                      <div style={{marginTop:7}}>
                        <span id={`${uid}-snap-target`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Snap target</span>
                        <div role="group" aria-labelledby={`${uid}-snap-target`} style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
                          {([
                            ['back-left','Back L'],
                            ['back','Back'],
                            ['back-right','Back R'],
                            ['left','Left'],
                            ['center','Center'],
                            ['right','Right'],
                            ['front-left','Front L'],
                            ['front','Front'],
                            ['front-right','Front R'],
                          ] as [RoomSnapTarget,string][]).map(([target,label])=>{
                            const next = snapRoomToTarget(room, booth, target);
                            return (
                              <button key={target} onClick={()=>updateRoom(room.id,next)}
                                style={{height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,color:C.ink,cursor:'pointer',fontFamily:MONO,fontSize:8,textTransform:'uppercase'}}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{marginTop:7}}>
                        <span id={`${uid}-door-wall`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Door wall & width</span>
                        <div role="group" aria-labelledby={`${uid}-door-wall`} style={{display:'grid',gridTemplateColumns:'repeat(4,1fr) 76px',gap:4}}>
                          {(['front','back','left','right'] as DoorSide[]).map(side=>(
                            <button key={side} onClick={()=>updateRoom(room.id,{doorSide:side,hasDoor:true})}
                              style={{height:26,border:`1px solid ${room.doorSide===side&&room.hasDoor?C.orange:C.hair}`,borderRadius:4,background:room.doorSide===side&&room.hasDoor?`${C.orange}12`:C.panel,color:room.doorSide===side&&room.hasDoor?C.orange:C.ink,cursor:'pointer',fontFamily:MONO,fontSize:7.5,textTransform:'uppercase'}}>
                              {side.slice(0,1)}
                            </button>
                          ))}
                          <div style={{position:'relative'}}>
                            <input aria-label={`${room.name} door width`} name={`room-door-width-editor-${room.id}`} type="number" min={0.55} max={roomDoorMaxWidth(room)} step={0.05} value={room.doorWidth}
                              onChange={event=>{const value=Number(event.target.value);if(Number.isFinite(value))updateRoom(room.id,{doorWidth:clampNumber(value,0.55,roomDoorMaxWidth(room)),hasDoor:true});}}
                              style={{width:'100%',height:26,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,fontFamily:MONO,fontSize:9,padding:'0 18px 0 5px',boxSizing:'border-box',outline:'none'}}/>
                            <span style={{position:'absolute',right:4,top:'50%',transform:'translateY(-50%)',fontFamily:MONO,fontSize:7.5,color:C.muted}}>m</span>
                          </div>
                        </div>
                      </div>
                      <div style={{marginTop:7}}>
                        <span id={`${uid}-door-position`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Door position</span>
                        <div role="group" aria-labelledby={`${uid}-door-position`} style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
                          {(['left','center','right'] as DoorPosition[]).map(position=>(
                            <button key={position} onClick={()=>updateRoom(room.id,{doorPosition:position,hasDoor:true})}
                              style={{height:24,border:`1px solid ${room.doorPosition===position&&room.hasDoor?C.orange:C.hair}`,borderRadius:4,background:room.doorPosition===position&&room.hasDoor?`${C.orange}12`:C.panel,color:room.doorPosition===position&&room.hasDoor?C.orange:C.ink,cursor:'pointer',fontFamily:MONO,fontSize:8.5,textTransform:'uppercase'}}>
                              {position === 'center' ? 'Ctr' : position === 'left' ? 'L' : 'R'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{marginTop:7}}>
                        <span id={`${uid}-door-swing`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Door swing</span>
                        <div role="group" aria-labelledby={`${uid}-door-swing`} style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                          {([
                            ['left-in','L in'],
                            ['right-in','R in'],
                            ['left-out','L out'],
                            ['right-out','R out'],
                          ] as [DoorSwing,string][]).map(([swing,label])=>(
                            <button key={swing} onClick={()=>updateRoom(room.id,{doorSwing:swing,hasDoor:true,doorOpen:true})}
                              style={{height:24,border:`1px solid ${room.doorSwing===swing&&room.hasDoor?C.orange:C.hair}`,borderRadius:4,background:room.doorSwing===swing&&room.hasDoor?`${C.orange}12`:C.panel,color:room.doorSwing===swing&&room.hasDoor?C.orange:C.ink,cursor:'pointer',fontFamily:MONO,fontSize:8,textTransform:'uppercase'}}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{display:'flex',gap:10,marginTop:7}}>
                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:C.ink,cursor:'pointer'}}>
                          <input type="checkbox" name={`room-door-${room.id}`} checked={room.hasDoor} onChange={e=>updateRoom(room.id,{hasDoor:e.target.checked})}/> Door
                        </label>
                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:C.ink,cursor:'pointer'}}>
                          <input type="checkbox" name={`room-door-open-${room.id}`} checked={room.doorOpen} onChange={e=>updateRoom(room.id,{doorOpen:e.target.checked,hasDoor:true})}/> Open
                        </label>
                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:C.ink,cursor:'pointer'}}>
                          <input type="checkbox" name={`room-ceiling-${room.id}`} checked={room.hasCeiling} onChange={e=>updateRoom(room.id,{hasCeiling:e.target.checked})}/> Ceiling
                        </label>
                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:C.ink,cursor:'pointer'}}>
                          <input type="checkbox" name={`room-lock-${room.id}`} checked={room.locked} onChange={e=>updateRoom(room.id,{locked:e.target.checked})}/> Lock
                        </label>
                        <span style={{marginLeft:'auto',fontFamily:MONO,fontSize:9,color:C.muted}}>#{index+1}</span>
                      </div>
                    </div>
                  ))}
                  {rooms.length===0&&<div style={{fontFamily:MONO,fontSize:9.5,color:C.muted,textAlign:'center',padding:'8px 0'}}>No rooms yet.</div>}
                </div>
              </PropBlock>
              <Hairline/>
              <PropBlock label="Open Sides" right={`${boothType} · ${openCount}/4`}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4,marginBottom:8}}>
                  {([
                    ['inline','Inline'],
                    ['corner','Corner'],
                    ['peninsula','Penin.'],
                    ['island','Island'],
                    ['closed','Closed'],
                  ] as const).map(([preset,label])=>(
                    <button key={preset} onClick={()=>setOpenSidePreset(preset)}
                      style={{height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',fontFamily:MONO,fontSize:8.2,fontWeight:700,textTransform:'uppercase'}}>
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2,marginBottom:10}}>
                  {([['openFront','Front'],['openBack','Back'],['openLeft','Left'],['openRight','Right']] as [keyof BoothState,string][]).map(([key,label])=>{
                    const on=!!booth[key];
                    return (<label key={key} style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',padding:'5px 4px'}}>
                      <input type="checkbox" checked={on} onChange={()=>set(key,!on)} aria-label={`Open ${label} side`}
                        style={{position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}}/>
                      <div aria-hidden="true" style={{width:14,height:14,borderRadius:3,flexShrink:0,border:`1px solid ${on?C.blue:C.hair}`,background:on?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                        {on&&<svg width="9" height="9" viewBox="0 0 9 9"><polyline points="1,4.5 3.5,7 8,2" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{fontSize:12,color:on?C.blue:C.ink}}>{label}</span>
                    </label>);
                  })}
                </div>
                <div style={{border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,display:'flex',justifyContent:'center',padding:'6px 0'}}>
                  <OpenSidesPlan openFront={booth.openFront} openBack={booth.openBack} openLeft={booth.openLeft} openRight={booth.openRight}/>
                </div>
              </PropBlock>
            </div>
          )}

          {/* Panel Tab */}
          {activeTab==='panel'&&(
            <div style={{flex:1,overflowY:'auto',padding:'0 16px'}}>
              {!activeShellPart&&(
                <div style={{padding:'24px 0',textAlign:'center',fontFamily:MONO,fontSize:9.5,color:C.muted,lineHeight:1.6}}>
                  Select a panel, column, rail, fascia, or carpet in the booth to edit its properties.
                </div>
              )}
              {activeShellPart&&(
                <>
                  <PropBlock label="Selected Shell Part" right={activeShellPart.label}>
                    <div style={{border:`1px solid ${C.hair}`,borderRadius:5,background:C.bg,padding:10}}>
                      {activeShellPart.rows.map(([label,value])=>(
                        <div key={label} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'3px 0',fontFamily:MONO,fontSize:9.5}}>
                          <span style={{color:C.muted,textTransform:'uppercase'}}>{label}</span>
                          <span style={{color:C.ink,fontWeight:700}}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </PropBlock>
                  {activePanel&&<>
                  <Hairline/>
                  <PropBlock label="Panel Finish" right={activePanelOverride.color ? 'Custom' : wallFinish.label}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="color" value={activePanelOverride.color || wallFinish.color} onChange={e=>updatePanelOverride(activePanel.id,{color:e.target.value})}
                        style={{width:38,height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,cursor:'pointer',padding:2}}/>
                      <input value={activePanelOverride.color || wallFinish.color} onChange={e=>updatePanelOverride(activePanel.id,{color:e.target.value})}
                        style={{flex:1,height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:MONO,fontSize:11,color:C.ink,paddingLeft:8,outline:'none'}}/>
                    </div>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}>
                      {WALL_FINISHES.map(finish=>(
                        <Swatch key={finish.label} color={finish.color} active={(activePanelOverride.color || wallFinish.color)===finish.color} onClick={()=>updatePanelOverride(activePanel.id,{color:finish.color})} size={24} title={finish.label}/>
                      ))}
                    </div>
                  </PropBlock>
                  <Hairline/>
                  <PropBlock label="Brand / Sticker" right={activePanelOverride.brandText ? 'Applied' : 'None'}>
                    <label htmlFor={`${uid}-panel-text`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Text</label>
                    <input id={`${uid}-panel-text`} value={activePanelOverride.brandText || ''} onChange={e=>updatePanelOverride(activePanel.id,{brandText:e.target.value.slice(0,40)})}
                      placeholder="Company logo, product name, sticker"
                      style={{width:'100%',height:32,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:12,color:C.ink,paddingLeft:9,boxSizing:'border-box',outline:'none'}}/>
                    <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:8,marginTop:9,alignItems:'center'}}>
                      <label htmlFor={`${uid}-panel-color`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Color</label>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <input id={`${uid}-panel-color`} type="color" value={activePanelOverride.brandColor || '#111827'} onChange={e=>updatePanelOverride(activePanel.id,{brandColor:e.target.value})}
                          style={{width:34,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,cursor:'pointer',padding:2}}/>
                        <input value={activePanelOverride.brandColor || '#111827'} onChange={e=>updatePanelOverride(activePanel.id,{brandColor:e.target.value})}
                          style={{flex:1,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:MONO,fontSize:10.5,color:C.ink,paddingLeft:8,outline:'none'}}/>
                      </div>
                      <label htmlFor={`${uid}-panel-scale`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Scale</label>
                      <input id={`${uid}-panel-scale`} type="range" min={0.08} max={0.45} step={0.01} value={activePanelOverride.brandScale ?? 0.15} onChange={e=>updatePanelOverride(activePanel.id,{brandScale:Number(e.target.value)})}
                        style={{width:'100%',accentColor:C.blue}}/>
                    </div>
                    <div style={{marginTop:8,fontFamily:MONO,fontSize:8.5,color:C.muted}}>
                      Text is projected directly onto this panel face.
                    </div>
                  </PropBlock>
                  <Hairline/>
                  <PropBlock label="Image Design" right={activePanelOverride.designImageUrl ? 'Uploaded' : 'None'}>
                    <label style={{height:34,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7,fontFamily:MONO,fontSize:9.5,fontWeight:800,padding:'0 10px',overflow:'hidden'}}>
                      <ImagePlus size={13}/>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activePanelOverride.designImageName || 'Choose logo or wall graphic'}</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={e=>{uploadPanelDesign(activePanel.id,e.target.files?.[0]); e.currentTarget.value='';}} style={{display:'none'}}/>
                    </label>
                    {activePanelOverride.designImageUrl&&<>
                      <div style={{height:62,marginTop:8,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                        <img src={activePanelOverride.designImageUrl} alt={activePanelOverride.designImageName ? `Panel graphic: ${activePanelOverride.designImageName}` : 'Panel graphic preview'} style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:8,alignItems:'center',marginTop:9}}>
                        <label htmlFor={`${uid}-panel-design-opacity`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Opacity</label>
                        <input id={`${uid}-panel-design-opacity`} type="range" min={0.15} max={1} step={0.05} value={activePanelOverride.designOpacity ?? 1} onChange={e=>updatePanelOverride(activePanel.id,{designOpacity:Number(e.target.value)})}
                          style={{width:'100%',accentColor:C.blue}}/>
                      </div>
                      <button onClick={()=>updatePanelOverride(activePanel.id,{designImageUrl:'',designImageName:'',designOpacity:undefined})}
                        style={{width:'100%',height:30,marginTop:8,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',fontFamily:UI,fontSize:12,fontWeight:700}}>
                        Remove image design
                      </button>
                    </>}
                  </PropBlock>
                  <Hairline/>
                  <button onClick={()=>resetPanelOverride(activePanel.id)}
                    style={{width:'100%',height:34,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',fontFamily:UI,fontSize:12,fontWeight:700}}>
                    Reset selected panel
                  </button>
                  </>}
                  {activeShellPart.type==='frame'&&<>
                    <Hairline/>
                    <PropBlock label="Frame Profile Finish" right={frameFinish.label}>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        {FRAME_FINISHES.map((finish,i)=><Swatch key={finish.label} color={finish.color} active={frameFinishIdx===i} onClick={()=>commit(p=>({...p,frameFinishIdx:i}))} size={24} title={finish.label}/>)}
                      </div>
                    </PropBlock>
                  </>}
                  {activeShellPart.type==='fascia'&&<>
                    <Hairline/>
                    <PropBlock label="Fascia Finish" right={activeFasciaOverride.color ? 'Custom' : fasciaFinish.label}>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        {FASCIA_FINISHES.map((finish,i)=><Swatch key={finish.label} color={finish.color} active={(activeFasciaOverride.color || fasciaFinish.color)===finish.color} onClick={()=>{
                          if (activeFasciaId) updatePanelOverride(activeFasciaId,{color:finish.color});
                          else commit(p=>({...p,fasciaFinishIdx:i}));
                        }} size={24} title={finish.label}/>)}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:9}}>
                        <input type="color" value={activeFasciaOverride.color || fasciaFinish.color} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{color:e.target.value})}
                          style={{width:38,height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,cursor:'pointer',padding:2}}/>
                        <input value={activeFasciaOverride.color || fasciaFinish.color} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{color:e.target.value})}
                          style={{flex:1,height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:MONO,fontSize:11,color:C.ink,paddingLeft:8,outline:'none'}}/>
                      </div>
                    </PropBlock>
                    <Hairline/>
                    <PropBlock label="Fascia Graphics" right={activeFasciaOverride.designImageUrl ? 'Image' : activeFasciaOverride.brandText ? 'Text' : 'None'}>
                      <label htmlFor={`${uid}-fascia-text`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Text / logo wordmark</label>
                      <input id={`${uid}-fascia-text`} value={activeFasciaOverride.brandText || ''} disabled={!activeFasciaId} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{brandText:e.target.value.slice(0,40)})}
                        placeholder={activeFasciaId === 'fascia-front' ? booth.companyName : 'Brand / fascia text'}
                        style={{width:'100%',height:32,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:12,color:C.ink,paddingLeft:9,boxSizing:'border-box',outline:'none'}}/>
                      <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:8,marginTop:9,alignItems:'center'}}>
                        <label htmlFor={`${uid}-fascia-color`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Color</label>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <input id={`${uid}-fascia-color`} type="color" value={activeFasciaOverride.brandColor || '#23262c'} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{brandColor:e.target.value})}
                            style={{width:34,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,cursor:'pointer',padding:2}}/>
                          <input value={activeFasciaOverride.brandColor || '#23262c'} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{brandColor:e.target.value})}
                            style={{flex:1,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:MONO,fontSize:10.5,color:C.ink,paddingLeft:8,outline:'none'}}/>
                        </div>
                        <label htmlFor={`${uid}-fascia-scale`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Scale</label>
                        <input id={`${uid}-fascia-scale`} type="range" min={0.08} max={0.45} step={0.01} value={activeFasciaOverride.brandScale ?? 0.2} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{brandScale:Number(e.target.value)})}
                          style={{width:'100%',accentColor:C.blue}}/>
                      </div>
                      <label style={{height:34,marginTop:10,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7,fontFamily:MONO,fontSize:9.5,fontWeight:800,padding:'0 10px',overflow:'hidden'}}>
                        <ImagePlus size={13}/>
                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeFasciaOverride.designImageName || 'Choose logo or fascia design'}</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" disabled={!activeFasciaId} onChange={e=>{if(activeFasciaId) uploadPanelDesign(activeFasciaId,e.target.files?.[0]); e.currentTarget.value='';}} style={{display:'none'}}/>
                      </label>
                      {activeFasciaOverride.designImageUrl&&<>
                        <div style={{height:62,marginTop:8,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                          <img src={activeFasciaOverride.designImageUrl} alt={activeFasciaOverride.designImageName ? `Fascia design: ${activeFasciaOverride.designImageName}` : 'Fascia design preview'} style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:8,alignItems:'center',marginTop:9}}>
                          <label htmlFor={`${uid}-fascia-design-opacity`} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Opacity</label>
                          <input id={`${uid}-fascia-design-opacity`} type="range" min={0.15} max={1} step={0.05} value={activeFasciaOverride.designOpacity ?? 1} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{designOpacity:Number(e.target.value)})}
                            style={{width:'100%',accentColor:C.blue}}/>
                        </div>
                        <button onClick={()=>activeFasciaId&&updatePanelOverride(activeFasciaId,{designImageUrl:'',designImageName:'',designOpacity:undefined})}
                          style={{width:'100%',height:30,marginTop:8,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',fontFamily:UI,fontSize:12,fontWeight:700}}>
                          Remove fascia design
                        </button>
                      </>}
                    </PropBlock>
                    <Hairline/>
                    <button onClick={()=>activeFasciaId&&resetPanelOverride(activeFasciaId)}
                      style={{width:'100%',height:34,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',fontFamily:UI,fontSize:12,fontWeight:700}}>
                      Reset selected fascia
                    </button>
                  </>}
                  {activeShellPart.type==='carpet'&&<>
                    <Hairline/>
                    <PropBlock label="Carpet Finish" right={CARPETS[carpetIdx].label}>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        {CARPETS.map((c,i)=><Swatch key={c.label} color={c.color} active={carpetIdx===i} onClick={()=>commit(p=>({...p,carpetIdx:i}))} size={24} title={c.label}/>)}
                      </div>
                    </PropBlock>
                  </>}
                </>
              )}
            </div>
          )}

          {/* BOM Tab */}
          {activeTab==='bom'&&(
            <WorkspaceBomPanel
              booth={booth} rooms={rooms} placedItems={placedItems}
              structItems={structItems} roomItems={roomItems} totals={totals}
              totalParts={totalParts} totalWeight={totalWeight} floorArea={floorArea}
              placementIssueByItem={placementIssueByItem} activePlacedId={activePlacedId}
              onExportCsv={exportBomCsv} onExportChecklist={exportProductionChecklist}
              onSelectRoom={roomId=>{setActiveRoomId(roomId);setActivePlacedId('');setActiveTab('props');}}
              onSelectPlaced={id=>{setActivePlacedId(id);setActiveRoomId('');}}
              onToggleLock={(id,locked)=>updateItem(id,{locked})}
              onDuplicate={duplicateItem} onRemove={removeItem}
              onTransform={updateItemTransform} onRotate={rotateItem}
            />
          )}

          {/* Notes Tab */}
          {activeTab==='notes'&&(
            <div style={{flex:1,display:'flex',flexDirection:'column'}}>
              <div style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                {notes.length===0&&(
                  <div style={{padding:'20px 0',textAlign:'center',color:C.muted,fontFamily:MONO,fontSize:9.5}}>
                    Add design notes and annotations<br/>visible to your team
                  </div>
                )}
                {notes.map(note=>(
                  <div key={note.id} style={{padding:'10px 12px',borderRadius:4,background:`${note.color}10`,border:`1px solid ${note.color}30`,position:'relative'}}>
                    <div style={{fontSize:12,color:C.ink,lineHeight:1.5,paddingRight:20}}>{note.text}</div>
                    <div style={{fontFamily:MONO,fontSize:8.5,color:C.muted,marginTop:4}}>{note.createdAt}</div>
                    <button onClick={()=>removeNote(note.id)} style={{position:'absolute',top:6,right:6,background:'none',border:'none',cursor:'pointer',color:C.muted,padding:2,display:'flex'}}>
                      <Trash2 size={10}/>
                    </button>
                    <div style={{position:'absolute',left:0,top:8,bottom:8,width:3,borderRadius:'0 2px 2px 0',background:note.color}}/>
                  </div>
                ))}
              </div>
              <div style={{padding:'10px 14px',borderTop:`1px solid ${C.hair}`,background:C.bg,flexShrink:0}}>
                <div style={{display:'flex',gap:4,marginBottom:6}}>
                  {NOTE_COLORS.map(c=>(
                    <button key={c} onClick={()=>setNoteColor(c)} style={{width:18,height:18,borderRadius:3,background:c,border:`2px solid ${noteColor===c?C.ink:'transparent'}`,cursor:'pointer',flexShrink:0}}/>
                  ))}
                </div>
                <div style={{display:'flex',gap:6}}>
                  <input id="new-note" name="new-note" value={newNote} onChange={e=>setNewNote(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addNote()}
                    placeholder="Add a note…"
                    style={{flex:1,height:32,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,fontFamily:UI,fontSize:12,color:C.ink,paddingLeft:8,outline:'none',boxSizing:'border-box'}}/>
                  <button onClick={addNote} style={{background:C.blue,border:'none',color:'#fff',borderRadius:4,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                    <Plus size={13}/>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Tab */}
          {activeTab==='feedback'&&(
            <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
              <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.hair}`,background:C.bg,flexShrink:0}}>
                <MonoLabel right={`${openFeedbackCount} open`}>§ Client Feedback</MonoLabel>
                <div style={{display:'flex',gap:5}}>
                  {(['open','all','resolved'] as FeedbackFilter[]).map(filter=>(
                    <button key={filter} onClick={()=>setFeedbackFilter(filter)}
                      style={{height:24,border:`1px solid ${feedbackFilter===filter?C.blue:C.hair}`,borderRadius:4,background:feedbackFilter===filter?`${C.blue}10`:C.panel,color:feedbackFilter===filter?C.blue:C.muted,cursor:'pointer',fontFamily:MONO,fontSize:8.5,fontWeight:700,textTransform:'uppercase',padding:'0 8px'}}>
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'10px 12px',display:'flex',flexDirection:'column',gap:8}}>
                {isFeedbackLoading&&(
                  <div style={{padding:'20px 0',textAlign:'center',color:C.muted,fontFamily:MONO,fontSize:9.5}}>
                    Loading feedback...
                  </div>
                )}
                {!isFeedbackLoading&&visibleFeedbackItems.length===0&&(
                  <div style={{padding:'20px 0',textAlign:'center',color:C.muted,fontFamily:MONO,fontSize:9.5}}>
                    No {feedbackFilter==='all'?'client':feedbackFilter}<br/>feedback items
                  </div>
                )}
                {!isFeedbackLoading&&visibleFeedbackItems.map(item=>{
                  const isResolved = (item.status ?? 'open') === 'resolved';
                  const isPin = item.type === 'pin' && item.pin;
                  return (
                    <div key={item.id} style={{border:`1px solid ${isResolved?C.green:C.hair}`,borderRadius:5,background:isResolved?`${C.green}06`:C.bg,padding:'10px 10px 9px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                        <span style={{fontFamily:MONO,fontSize:8,color:isResolved?C.green:C.orange,border:`1px solid ${isResolved?C.green:C.orange}30`,background:`${isResolved?C.green:C.orange}10`,borderRadius:3,padding:'1px 5px',textTransform:'uppercase'}}>
                          {isResolved?'Resolved':'Open'}
                        </span>
                        <span style={{fontFamily:MONO,fontSize:8,color:C.blue,border:`1px solid ${C.blue}25`,background:`${C.blue}08`,borderRadius:3,padding:'1px 5px',textTransform:'uppercase'}}>
                          {isPin?'Pin':item.type}
                        </span>
                        <span style={{fontFamily:MONO,fontSize:8,color:C.muted,marginLeft:'auto'}}>{item.time}</span>
                      </div>
                      <div style={{fontSize:12,color:C.ink,lineHeight:1.45,wordBreak:'break-word'}}>{item.text}</div>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8}}>
                        <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>
                          {item.user}{isPin&&item.pin ? ` / ${item.pin.x.toFixed(0)}% x ${item.pin.y.toFixed(0)}%` : ''}
                        </span>
                        <button onClick={()=>setFeedbackStatus(item.id, isResolved?'open':'resolved')}
                          style={{height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,color:C.ink,cursor:'pointer',fontFamily:MONO,fontSize:8.5,padding:'0 8px',whiteSpace:'nowrap'}}>
                          {isResolved?'Reopen':'Resolve'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>}

        {/* ── History Panel (slide-over) ────────────────────────── */}
        {showHistPanel&&(
          <div style={{position:'absolute',top:0,bottom:0,right:previewMode?0:282,width:240,background:C.panel,borderLeft:`1px solid ${C.hair}`,zIndex:20,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(0,0,0,0.08)'}}>
            <div style={{padding:'8px 14px',borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.1em',color:C.muted,textTransform:'uppercase'}}>§ Snapshots</span>
              <button onClick={()=>setShowHistPanel(false)} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:C.muted,display:'flex'}}><X size={12}/></button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'8px 12px'}}>
              {snapshots.length===0&&(
                <div style={{fontFamily:MONO,fontSize:9.5,color:C.muted,textAlign:'center',padding:'20px 0'}}>
                  No snapshots yet.<br/>Click "Snapshot" to save a version.
                </div>
              )}
              {[...snapshots].reverse().map(snap=>(
                <div key={snap.id} style={{padding:'10px',borderRadius:4,border:`1px solid ${C.hair}`,background:C.bg,marginBottom:6}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.ink,marginBottom:2}}>{snap.name}</div>
                  <div style={{fontFamily:MONO,fontSize:8.5,color:C.muted,marginBottom:8}}>{snap.createdAt}</div>
                  <button onClick={()=>restoreSnapshot(snap)}
                    style={{background:C.blue,border:'none',color:'#fff',borderRadius:3,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:UI,width:'100%'}}>
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────── */}
      <footer style={{height:26,background:'#1a1815',borderTop:'1px solid #111',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:3,overflow:'hidden'}}>
          <span style={{fontFamily:MONO,fontSize:9.5,color:'#4a8a5e',display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'#4a8a5e',display:'inline-block'}}/>Connected
          </span>
          {[projectLabel,approvalStageLabel,`${booth.system==='maxima'?'Maxima':'Octanorm'}`,`Floor ${floorArea} m²`,`${booth.width}×${booth.depth}×${booth.height}m`,`${totalParts} placed`,`${(structWeight+totalWeight).toFixed(0)} kg`].map((s,i)=>(
            <span key={i} style={{fontFamily:MONO,fontSize:9.5,color:'#6b6058',marginLeft:4,whiteSpace:'nowrap'}}>· {s}</span>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <span style={{fontFamily:MONO,fontSize:9.5,color:'#d8d3c9'}}>{formatUsd(quoteTotal)}</span>
          <span style={{fontFamily:MONO,fontSize:9.5,color:'#6b6058'}}>History: {histIdx+1}/{histLen}</span>
          <span style={{fontFamily:MONO,fontSize:9.5,color:saveStatusMeta.color}}>{saveStatusMeta.detail}</span>
        </div>
      </footer>

      {/* ── Send to Client Dialog ─────────────────────────────────── */}
      {showSendDlg&&(
        <>
          <div aria-hidden="true" style={{position:'fixed',inset:0,background:'rgba(24,22,19,0.5)',zIndex:200}} onClick={()=>{ setShowSendDlg(false); setSendConfirmed(false); }}/>
          <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:C.panel,border:`1px solid ${C.hair}`,borderRadius:8,padding:28,zIndex:201,width:420,boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
            {!sendConfirmed?(
              <>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:`${C.blue}14`,display:'flex',alignItems:'center',justifyContent:'center'}}><Send size={16} style={{color:C.blue}}/></div>
                  <div>
                    <h3 style={{fontSize:15,fontWeight:700,margin:0}}>Send Design to Client</h3>
                    <p style={{fontFamily:MONO,fontSize:9.5,color:C.muted,margin:'2px 0 0'}}>{clientLabel} · {exhibitionLabel}</p>
                  </div>
                </div>
                <div style={{background:C.bg,borderRadius:6,padding:'12px 14px',marginBottom:16}}>
                  {[
                    {label:'Stand Size',value:`${booth.width} × ${booth.depth} × ${booth.height} m`},
                    {label:'System',    value:booth.system==='maxima'?'Maxima':'Octanorm'},
                  {label:'Open Sides',value:`${boothType} · ${openCount>0?`${openCount} side${openCount>1?'s':''}`:'Closed'}`},
                    {label:'Fascia',value:booth.fasciaEnabled?fasciaMeta.label:'Disabled'},
                    {label:'BOM Items', value:`${structItems.reduce((a,s)=>a+s.qty,0) + totalParts} parts`},
                    {label:'Est. Weight',value:`${(structWeight+totalWeight).toFixed(0)} kg`},
                    {label:'Est. Quote',value:formatUsd(quoteTotal)},
                  ].map(row=>(
                    <div key={row.label} style={{display:'flex',justifyContent:'space-between',padding:'3px 0'}}>
                      <span style={{fontFamily:MONO,fontSize:9.5,color:C.muted}}>{row.label}</span>
                      <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,color:C.ink}}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{setShowSendDlg(false);setSendConfirmed(false);}} style={{flex:1,height:38,background:'none',border:`1px solid ${C.hair}`,borderRadius:5,cursor:'pointer',fontFamily:UI,fontSize:13,color:C.ink}}>Cancel</button>
                  <button onClick={sendToClient} disabled={isSending || !workspaceRecord || !canSendToClient} title={sendDisabledReason || 'Send for approval'} style={{flex:2,height:38,background:canSendToClient?C.blue:`${C.muted}30`,border:'none',color:'#fff',borderRadius:5,cursor:isSending || !workspaceRecord || !canSendToClient?'not-allowed':'pointer',fontFamily:UI,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:6,opacity:isSending || !workspaceRecord || !canSendToClient?0.65:1}}>
                    <Send size={13}/> {isSending ? 'Sending...' : 'Send for Approval'}
                  </button>
                </div>
              </>
            ):(
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:'#dcfce7',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
                  <CheckCircle2 size={24} style={{color:C.green}}/>
                </div>
                <h3 style={{fontSize:16,fontWeight:700,margin:'0 0 8px'}}>Sent to Client</h3>
                <p style={{fontFamily:MONO,fontSize:10,color:C.muted,margin:'0 0 20px',lineHeight:1.6}}>The booth design has been shared<br/>with {clientLabel} for approval.</p>
                <button onClick={()=>{setShowSendDlg(false);setSendConfirmed(false);setToast('Design sent to client');}}
                  style={{width:'100%',height:38,background:C.ink,border:'none',color:'#fff',borderRadius:5,cursor:'pointer',fontFamily:UI,fontSize:13,fontWeight:600}}>
                  Done
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Snapshot Dialog ───────────────────────────────────────── */}
      {showSnapDlg&&(
        <WorkspaceSnapshotDialog
          name={snapName}
          onName={setSnapName}
          onSave={createSnapshot}
          onClose={()=>setShowSnapDlg(false)}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast&&<Toast msg={toast} onClose={()=>setToast('')}/>}
    </div>
  );
}
