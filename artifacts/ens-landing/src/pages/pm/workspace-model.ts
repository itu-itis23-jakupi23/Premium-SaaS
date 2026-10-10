import type { ElementType } from "react";
import type { BoothSystem } from "@/components/workspace/BoothCanvas";

// ── Types ──────────────────────────────────────────────────────────
// Pure data-model for the PM booth workspace, split out of PMWorkspace.tsx so
// the component file carries behaviour, not static catalog data and shapes.
export type FasciaOption = 'classic' | 'full' | 'custom';
export type LightingPreset = 'neutral' | 'exhibition' | 'accent' | 'spotlight' | 'ambient';
export type DoorPosition = 'left' | 'center' | 'right';
export type DoorSide = 'front' | 'back' | 'left' | 'right';
export type DoorSwing = 'left-in' | 'right-in' | 'left-out' | 'right-out';
export type RoomWallFinish = 'white' | 'frosted' | 'glass' | 'dark';
export type RoomGraphicFit = 'cover' | 'contain' | 'stretch';
export type RoomTemplateKey = 'storage' | 'meeting' | 'utility';

export const ROOM_SIDE_OPTIONS: { value: DoorSide; label: string }[] = [
  {value:'front',label:'Front wall'},
  {value:'back',label:'Back wall'},
  {value:'left',label:'Left wall'},
  {value:'right',label:'Right wall'},
];

export interface BoothState { width:number; depth:number; height:number; system:BoothSystem; companyName:string; openFront:boolean; openBack:boolean; openLeft:boolean; openRight:boolean; fasciaEnabled:boolean; fasciaOption:FasciaOption; }
export interface WorkspacePlacedItem { id:string; catalogId:string; name:string; sku:string; qty:number; w:number; d:number; h:number; color:string; weight:number; x:number; y?:number; z:number; rotation:number; rotationX?:number; rotationY?:number; rotationZ?:number; locked?:boolean; kind:'furniture'|'light'|'structure'|'fascia'|'asset'; shape?:CatItem['shape']; modelUrl?:string; source?:string; }
export interface WorkspaceRoom { id:string; name:string; width:number; depth:number; height:number; x:number; z:number; hasDoor:boolean; hasCeiling:boolean; doorSide:DoorSide; doorWidth:number; doorPosition:DoorPosition; doorSwing:DoorSwing; doorOpen:boolean; wallFinish:RoomWallFinish; floorColor:string; locked:boolean; designImageUrl?:string; designImageName?:string; designOpacity?:number; designWall:DoorSide; designFit:RoomGraphicFit; }
export interface PanelOverride { color?:string; brandText?:string; brandColor?:string; brandScale?:number; designImageUrl?:string; designImageName?:string; designOpacity?:number; }
export interface Note { id:string; text:string; color:string; createdAt:string; }
export interface Snapshot { id:string; name:string; data:WSData; createdAt:string; }
export interface WSData { booth:BoothState; themeIdx:number; wallFinishIdx:number; frameFinishIdx:number; fasciaFinishIdx:number; carpetIdx:number; lightingPreset:LightingPreset; placedItems:WorkspacePlacedItem[]; rooms:WorkspaceRoom[]; notes:Note[]; panelOverrides:Record<string,PanelOverride>; frontSupportPositions:number[]; suppressedDefaultPositions:number[]; }
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
export type FeedbackFilter = 'open' | 'all' | 'resolved';

// ── Catalog ────────────────────────────────────────────────────────
// The item data itself is shared with the client portal; see lib/furniture-catalog.
import { ENS_FURNITURE_ITEMS as CATALOG_ITEMS } from "@/lib/furniture-catalog";
export { catalogFurnitureProps } from "@/lib/furniture-catalog";
export interface CatItem { id:string; name:string; sku:string; dim:string; inStand:number; icon:ElementType; family?:string; price?:number; stock?:number; lowStockAt?:number; shape?:'round_table'|'rect_table'|'counter'|'shelf'|'wall_shelf'|'cabinet'|'cube'|'chair'|'bar_stool'|'light'|'rail_light'|'box'; modelUrl?:string; previewUrl?:string; furnitureCategory?:FurnitureCategory; }
export type FurnitureCategory = 'all' | 'chairs' | 'stools' | 'seating' | 'tables' | 'counters' | 'displays' | 'storage' | 'shelves' | 'appliances' | 'lighting' | 'decor' | 'parts';

export const ENS_FURNITURE_ITEMS: Omit<CatItem,'icon'>[] = CATALOG_ITEMS;

/** Kept as an alias so existing imports and saved workspaces keep resolving. */
export const SEDEF_FURNITURE_ITEMS = ENS_FURNITURE_ITEMS;
