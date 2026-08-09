import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { CurrencySwitcher, formatMoneyUSD, useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
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
  Maximize2, Search, Plus, ChevronDown, Trash2, Download,
  Square, LayoutTemplate, Lightbulb, Layers, Map, Box, X,
  CheckCircle2, Package, StickyNote, Settings2, Copy, MessageSquare, ImagePlus, Lock, Unlock,
} from "lucide-react";
import {
  clampNumber,
  snapNumber,
  snapItemCoordinate,
  ROOM_SNAP_M,
  ROOM_DIMENSION_SNAP_M,
  ITEM_WALL_CLEARANCE_M,
  DUPLICATE_OFFSET_M,
} from "@/lib/workspace-transform";

// ── Palette ────────────────────────────────────────────────────────
const C = {
  bg:    'var(--workspace-bg, #f3f1ec)',
  panel: 'var(--workspace-panel, #ffffff)',
  panel0:'var(--workspace-panel-e0, rgba(255,255,255,0.88))',
  ink:   'var(--workspace-ink, #181613)',
  hair:  'var(--workspace-hair, #d8d3c9)',
  blue:  'var(--workspace-blue, #1d4ed8)',
  orange:'var(--workspace-orange, #c2410c)',
  green: 'var(--workspace-green, #2f7d3a)',
  muted: 'var(--workspace-muted, #6b6560)',
  bgHover:'var(--workspace-bg-hover, #ece9e3)'
} as const;
const MONO = 'var(--app-font-mono)';
const UI   = 'var(--app-font-samsung)';

// ── Types ──────────────────────────────────────────────────────────
type FasciaOption = 'classic' | 'full' | 'custom';
type LightingPreset = 'neutral' | 'exhibition' | 'accent' | 'spotlight' | 'ambient';
type DoorPosition = 'left' | 'center' | 'right';
type DoorSide = 'front' | 'back' | 'left' | 'right';
type DoorSwing = 'left-in' | 'right-in' | 'left-out' | 'right-out';
type RoomWallFinish = 'white' | 'frosted' | 'glass' | 'dark';
type RoomGraphicFit = 'cover' | 'contain' | 'stretch';
type RoomTemplateKey = 'storage' | 'meeting' | 'utility';
const ROOM_SIDE_OPTIONS:{value:DoorSide;label:string}[] = [
  {value:'front',label:'Front wall'},
  {value:'back',label:'Back wall'},
  {value:'left',label:'Left wall'},
  {value:'right',label:'Right wall'},
];
interface BoothState { width:number; depth:number; height:number; system:BoothSystem; companyName:string; openFront:boolean; openBack:boolean; openLeft:boolean; openRight:boolean; fasciaEnabled:boolean; fasciaOption:FasciaOption; }
interface WorkspacePlacedItem { id:string; catalogId:string; name:string; sku:string; qty:number; w:number; d:number; h:number; color:string; weight:number; x:number; z:number; rotation:number; rotationX?:number; rotationY?:number; rotationZ?:number; locked?:boolean; kind:'furniture'|'light'|'structure'|'fascia'|'asset'; shape?:CatItem['shape']; modelUrl?:string; source?:string; }
interface WorkspaceRoom { id:string; name:string; width:number; depth:number; height:number; x:number; z:number; hasDoor:boolean; hasCeiling:boolean; doorSide:DoorSide; doorWidth:number; doorPosition:DoorPosition; doorSwing:DoorSwing; doorOpen:boolean; wallFinish:RoomWallFinish; floorColor:string; locked:boolean; designImageUrl?:string; designImageName?:string; designOpacity?:number; designWall:DoorSide; designFit:RoomGraphicFit; }
interface PanelOverride { color?:string; brandText?:string; brandColor?:string; brandScale?:number; designImageUrl?:string; designImageName?:string; designOpacity?:number; }
interface Note { id:string; text:string; color:string; createdAt:string; }
interface Snapshot { id:string; name:string; data:WSData; createdAt:string; }
interface WSData { booth:BoothState; themeIdx:number; wallFinishIdx:number; frameFinishIdx:number; fasciaFinishIdx:number; carpetIdx:number; lightingPreset:LightingPreset; placedItems:WorkspacePlacedItem[]; rooms:WorkspaceRoom[]; notes:Note[]; panelOverrides:Record<string,PanelOverride>; frontSupportPositions:number[]; suppressedDefaultPositions:number[]; }
type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type FeedbackFilter = 'open' | 'all' | 'resolved';

// ── Catalog ────────────────────────────────────────────────────────
interface CatItem { id:string; name:string; sku:string; dim:string; inStand:number; icon:React.ElementType; family?:string; price?:number; stock?:number; lowStockAt?:number; shape?:'round_table'|'rect_table'|'counter'|'shelf'|'wall_shelf'|'cabinet'|'cube'|'chair'|'bar_stool'|'light'|'rail_light'|'box'; modelUrl?:string; furnitureCategory?:FurnitureCategory; }
type FurnitureCategory = 'all' | 'chairs' | 'stools' | 'seating' | 'tables' | 'storage' | 'shelves' | 'appliances' | 'lighting' | 'decor' | 'parts';
const SEDEF_FURNITURE_ITEMS: Omit<CatItem,'icon'>[] = [
  {id:'sedef-149', name:'PLASTIK HARE SANDALYE - PLASTIC CHAIR', sku:'149', dim:'0.55 x 0.55 x 0.85', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'chair', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/149%20PLASTIK%20HARE%20SANDALYE%20-%20PLASTIC%20CHAIR.glb'},
  {id:'sedef-221', name:'PANEL - PANEL', sku:'221', dim:'1.00 x 0.08 x 2.50', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'box', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/221%20PANEL%20-%20PANEL.glb'},
  {id:'sedef-224', name:'RAF - SHELF', sku:'224', dim:'1.00 x 0.30 x 0.08', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'shelf', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/224%20RAF%20-%20SHELF.glb'},
  {id:'sedef-231', name:'AHSAP KAPI - WOODEN DOOR', sku:'231', dim:'0.90 x 0.08 x 2.10', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'box', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/231%20AHSAP%20KAPI%20-%20WOODEN%20DOOR.glb'},
  {id:'sedef-250-b', name:'AHSAP SANDALYE BEYAZ - WHITE WOOD CHAIR', sku:'250-B', dim:'0.55 x 0.55 x 0.85', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'chair', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/250-B%20AHSAP%20SANDALYE%20BEYAZ%20-%20WHITE%20WOOD%20CHAIR.glb'},
  {id:'sedef-255-b', name:'DERI BAR SANDALYESI - LEATHER BAR CHAIR', sku:'255-B', dim:'0.50 x 0.50 x 1.05', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'bar_stool', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/255-B%20DERI%20BAR%20SANDALYESI%20-%20LEATHER%20BAR%20CHAIR.glb'},
  {id:'sedef-255-s', name:'AVEA DERI BAR TABURESI SIYAH - BLACK LEATHER BAR STOOL', sku:'255-S', dim:'0.50 x 0.50 x 1.05', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'bar_stool', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/255-S%20AVEA%20DERI%20BAR%20TABURESI%20SIYAH%20-%20BLACK%20LEATHER%20BAR%20STOOL.glb'},
  {id:'sedef-307', name:'Z BAR TABURESI - Z BAR STOOL', sku:'307', dim:'0.45 x 0.45 x 1.00', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'bar_stool', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/307%20Z%20BAR%20TABURESI%20-%20Z%20BAR%20STOOL.glb'},
  {id:'sedef-309', name:'DERI SANDALYE - LEATHER CHAIR', sku:'309', dim:'0.55 x 0.55 x 0.85', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'chair', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/309%20DERI%20SANDALYE%20-%20LEATHER%20CHAIR.glb'},
  {id:'sedef-312-s', name:'TEK KISILIK KOLTUK SIYAH - ARMCHAIR BLACK', sku:'312-S', dim:'0.90 x 0.85 x 0.80', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'chair', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/312-S%20TEK%20KISILIK%20KOLTUK%20SIYAH%20-%20ARMCHAIR%20BLACK.glb'},
  {id:'sedef-313-s', name:'CIFT KISILIK KOLTUK SIYAH - DOUBLE SOFA BLACK', sku:'313-S', dim:'1.55 x 0.85 x 0.80', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'box', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/313-S%20CIFT%20KISILIK%20KOLTUK%20SIYAH%20-%20DOUBLE%20SOFA%20BLACK.glb'},
  {id:'sedef-315', name:'VESTIYER - CLOTHES RACK', sku:'315', dim:'0.75 x 0.45 x 1.75', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'box', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/315%20VESTIYER%20-%20CLOTHES%20RACK.glb'},
  {id:'sedef-316-k', name:'DERI PUF KIRMIZI - LEATHER POUFFE RED', sku:'316-K', dim:'0.45 x 0.45 x 0.45', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'cube', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/316-K%20DERI%20PUF%20KIRMIZI%20-%20LEATHER%20POUFFE%20RED.glb'},
  {id:'sedef-318', name:'COP KOVASI - WASTE BIN', sku:'318', dim:'0.32 x 0.32 x 0.70', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'box', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/318%20COP%20KOVASI%20-%20WASTE%20BIN.glb'},
  {id:'sedef-321', name:'BITKI - PLANT', sku:'321', dim:'0.55 x 0.55 x 1.30', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'box', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/321%20BITKI%20-%20PLANT.glb'},
  {id:'sedef-326-s', name:'OFIS SANDALYESI - OFFICE CHAIR', sku:'326-S', dim:'0.60 x 0.60 x 0.90', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'chair', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/326-S%20OFIS%20SANDALYESI%20-%20OFFICE%20CHAIR.glb'},
  {id:'sedef-401', name:'TV - TV', sku:'401', dim:'1.10 x 0.08 x 0.65', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'box', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/401%20TV%20-%20TV.glb'},
  {id:'sedef-406', name:'DIZUSTU BILGISAYAR - LAPTOP', sku:'406', dim:'0.36 x 0.25 x 0.04', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'box', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/406%20DIZUSTU%20BILGISAYAR%20-%20LAPTOP.glb'},
  {id:'sedef-411', name:'BUZDOLABI - REFRIGERATOR', sku:'411', dim:'0.65 x 0.65 x 1.45', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'cabinet', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/411%20BUZDOLABI%20-%20REFRIGERATOR.glb'},
  {id:'sedef-412', name:'SEBIL - WATER FOUNTAIN', sku:'412', dim:'0.38 x 0.38 x 1.15', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'box', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/412%20SEBIL%20-%20WATER%20FOUNTAIN.glb'},
  {id:'sedef-413', name:'BROSURLUK - BROCHURE RACK', sku:'413', dim:'0.45 x 0.38 x 1.45', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'shelf', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/413%20BROSURLUK%20-%20BROCHURE%20RACK.glb'},
  {id:'sedef-417', name:'100 W 3 RENKLI LAMBA - 100 W 3-COLORED LAMP', sku:'417', dim:'0.18 x 0.18 x 0.28', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'rail_light', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/417%20100%20W%203%20RENKLI%20LAMBA%20-%20100%20W%203-COLORED%20LAMP.glb'},
  {id:'sedef-418', name:'100 W GRI PROJEKTOR - 100 W SPOTLIGHT LAMP', sku:'418', dim:'0.22 x 0.18 x 0.26', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'rail_light', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/418%20100%20W%20GRI%20PROJEKTOR%20-%20100%20W%20SPOTLIGHT%20LAMP.glb'},
  {id:'sedef-419', name:'100 W LED KOLLU PROJEKTOR - 100 W SPOTLIGHT LAMP', sku:'419', dim:'0.22 x 0.18 x 0.26', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'rail_light', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/419%20100%20W%20LED%20KOLLU%20PROJEKTOR%20-%20100%20W%20SPOTLIGHT%20LAMP.glb'},
  {id:'sedef-422', name:'MESRUBAT DOLABI - DRINK REFRIGERATOR', sku:'422', dim:'0.70 x 0.65 x 1.60', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'cabinet', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/422%20MESRUBAT%20DOLABI%20-%20DRINK%20REFRIGERATOR.glb'},
  {id:'sedef-431', name:'AHSAP CICEKLIK - WOOD FLORAL', sku:'431', dim:'0.70 x 0.35 x 0.75', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'box', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/431%20AHSAP%20CICEKLIK%20-%20WOOD%20FLORAL.glb'},
  {id:'sedef-440', name:'EVYE DOLAPLI - SINK CABINET', sku:'440', dim:'0.85 x 0.60 x 0.90', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'cabinet', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/440%20EVYE%20DOLAPLI%20-%20SINK%20CABINET.glb'},
  {id:'sedef-447', name:'BUYUK BUZDOLABI - LARGE REFRIGERATOR', sku:'447', dim:'0.75 x 0.70 x 1.85', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'cabinet', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/447%20BUYUK%20BUZDOLABI%20-%20LARGE%20REFRIGERATOR.glb'},
  {id:'sedef-513', name:'TEL BAR SANDALYESI - WIRE BLACK BAR CHAIR', sku:'513', dim:'0.50 x 0.50 x 1.05', inStand:0, family:'Sedef Refined Furniture', price:0, stock:99, shape:'bar_stool', modelUrl:'/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/513%20TEL%20BAR%20SANDALYESI%20-%20WIRE%20BLACK%20BAR%20CHAIR.glb'},
];
const FURNITURE_CATEGORY_ORDER: FurnitureCategory[] = ['all','chairs','stools','seating','tables','storage','shelves','appliances','lighting','decor','parts'];
function furnitureCategoryFor(item: Pick<CatItem,'name'|'sku'|'shape'>): FurnitureCategory {
  const text = `${item.name} ${item.sku}`.toLowerCase();
  if (item.shape === 'bar_stool' || text.includes('tabure') || text.includes('bar stool') || text.includes('bar chair')) return 'stools';
  if (item.shape === 'chair' || text.includes('sandalye') || text.includes('chair')) {
    if (text.includes('koltuk') || text.includes('armchair') || text.includes('sofa')) return 'seating';
    return 'chairs';
  }
  if (text.includes('koltuk') || text.includes('sofa') || text.includes('puf') || text.includes('pouffe')) return 'seating';
  if (item.shape === 'round_table' || item.shape === 'rect_table' || text.includes('masa') || text.includes('table')) return 'tables';
  if (item.shape === 'shelf' || item.shape === 'wall_shelf' || text.includes('raf') || text.includes('shelf') || text.includes('brosurluk') || text.includes('brochure')) return 'shelves';
  if (text.includes('buzdolabi') || text.includes('refrigerator') || text.includes('sebil') || text.includes('water fountain') || text.includes('evye') || text.includes('sink')) return 'appliances';
  if (item.shape === 'cabinet' || text.includes('dolap') || text.includes('cabinet') || text.includes('rack')) return 'storage';
  if (item.shape === 'rail_light' || item.shape === 'light' || text.includes('lamba') || text.includes('lamp') || text.includes('spotlight')) return 'lighting';
  if (text.includes('bitki') || text.includes('plant') || text.includes('ciceklik') || text.includes('floral')) return 'decor';
  return 'parts';
}
const SEDEF_ITEM_PROPS: Record<string,{w:number;d:number;h:number;color:string;weight:number}> = Object.fromEntries(
  SEDEF_FURNITURE_ITEMS.map(item => {
    const [w,d,h] = item.dim.split(' x ').map(Number);
    return [item.id, {w:w || 0.8, d:d || 0.8, h:h || 0.8, color:'#d9d2c5', weight:12}];
  })
) as Record<string,{w:number;d:number;h:number;color:string;weight:number}>;
const CATALOG: Record<string,CatItem[]> = {
  Structure: [
    {id:'s1',name:'Solid Wall',sku:'OCT-SW-100',dim:'1.0 × 2.5',inStand:6,icon:Square},
    {id:'s2',name:'Glass Wall',sku:'OCT-GW-100',dim:'1.0 × 2.5',inStand:2,icon:Square},
    {id:'s3',name:'Curved Wall',sku:'OCT-CW-100',dim:'1.0 × 2.5',inStand:0,icon:Square},
    {id:'s4',name:'Header Beam',sku:'OCT-HB-200',dim:'2.0 × 0.85',inStand:0,icon:LayoutTemplate},
  ],
  Fascia: [
    {id:'f1',name:'Std Fascia',sku:'FAS-STD-01',dim:'1.0 × 0.3',inStand:6,icon:LayoutTemplate},
    {id:'f2',name:'Corner Fascia',sku:'FAS-COR-01',dim:'0.3 × 0.3',inStand:4,icon:LayoutTemplate},
  ],
  Furniture: SEDEF_FURNITURE_ITEMS.map(item => ({...item, icon:Box, furnitureCategory: furnitureCategoryFor(item)})),
  Lighting: [
    {id:'417',name:'Spotlight',sku:'417',dim:'0.18 x 0.18 x 0.28',inStand:4,icon:Lightbulb,family:'Rail Lights',price:15,stock:12,lowStockAt:4,shape:'rail_light'},
    {id:'418',name:'Floodlight',sku:'418',dim:'0.22 x 0.18 x 0.26',inStand:0,icon:Lightbulb,family:'Rail Lights',price:18,stock:6,lowStockAt:2,shape:'rail_light'},
    {id:'fascia_light',name:'Fascia Light',sku:'fascia_light',dim:'0.32 x 0.14 x 0.14',inStand:0,icon:Lightbulb,family:'Fascia Lights',price:12,stock:8,lowStockAt:2,shape:'rail_light'},
  ],
};

const ITEM_PROPS: Record<string,{w:number;d:number;h:number;color:string;weight:number}> = {
  s1:{w:1.0,d:0.08,h:2.5,color:'#4a90d9',weight:28}, s2:{w:1.0,d:0.05,h:2.5,color:'#7bb8f0',weight:22},
  s3:{w:1.0,d:0.08,h:2.5,color:'#6bb0e8',weight:26}, s4:{w:2.0,d:0.15,h:0.85,color:'#5580c0',weight:18},
  f1:{w:1.0,d:0.15,h:0.3,color:'#8868ee',weight:8},   f2:{w:0.3,d:0.3,h:0.3,color:'#9878f0',weight:5},
  l1:{w:0.15,d:0.15,h:0.3,color:'#d4af37',weight:2},  l2:{w:1.0,d:0.05,h:0.1,color:'#c8a020',weight:1},
  l3:{w:0.4,d:0.3,h:0.5,color:'#b89018',weight:3},
  '417':{w:0.18,d:0.18,h:0.28,color:'#2b3037',weight:2}, '418':{w:0.22,d:0.18,h:0.26,color:'#313740',weight:2.5},
  fascia_light:{w:0.32,d:0.14,h:0.14,color:'#dce3ea',weight:1.8},
  ...SEDEF_ITEM_PROPS,
};

function catalogItemProps(item:CatItem) {
  const registered = ITEM_PROPS[item.id];
  if (registered) return registered;
  const dimensions = (item.dim.match(/\d+(?:\.\d+)?/g) ?? [])
    .map(value => Number.parseFloat(value))
    .filter(Number.isFinite);
  return {
    w: Math.max(0.06, dimensions[0] || 0.5),
    d: Math.max(0.06, dimensions[1] || 0.5),
    h: Math.max(0.06, dimensions[2] || 0.8),
    color: '#888888',
    weight: 10,
  };
}

const ENS_MODEL_URLS: Record<string,string> = {};
const KNOWN_CATALOG_IDS = new Set(Object.values(CATALOG).flat().map(item => item.id));

const THEMES  = [{label:'Charcoal',color:'#3b3e44'},{label:'White',color:'#dde0e4'},{label:'Walnut',color:'#7a4a2a'},{label:'Navy',color:'#1a2640'}];
const WALL_FINISHES = [{label:'White Laminate',color:'#f8fafc'},{label:'Cool Grey',color:'#dfe4ea'},{label:'Warm Ivory',color:'#f3eadc'},{label:'Graphite',color:'#9aa1aa'}];
const FRAME_FINISHES = [{label:'Anodized',color:'#b8bdc3'},{label:'Black',color:'#3d4249'},{label:'Champagne',color:'#c7b99a'},{label:'White',color:'#e4e7eb'}];
const FASCIA_FINISHES = [{label:'White',color:'#ffffff'},{label:'Ice Grey',color:'#eef2f7'},{label:'Warm White',color:'#fff7ed'},{label:'Graphite',color:'#d2d7de'}];
const CARPETS = [{label:'Black',color:'#1a1a1a'},{label:'Bone',color:'#dde0e4'},{label:'Gray',color:'#7a7e84'},{label:'Navy',color:'#1a2640'},{label:'Forest',color:'#1e3a28'},{label:'Terracotta',color:'#5a2316'}];
const NOTE_COLORS = ['#1d4ed8','#c2410c','#2f7d3a','#7c3aed','#b45309'];
const CAT_TOTAL: Record<string,number> = { Structure:4, Fascia:2, Furniture:SEDEF_FURNITURE_ITEMS.length, Lighting:3 };
const FASCIA_OPTIONS: {value:FasciaOption; label:string; price:number; minWidth:number; note:string; boardMm:number}[] = [
  {value:'classic', label:'Standard rail sign', price:1200, minWidth:2, note:'Front and rear fascia integrated into the top rail.', boardMm:110},
  {value:'full', label:'Full length rail sign', price:1800, minWidth:2, note:'Longer rail-integrated fascia with continuous front/rear branding.', boardMm:110},
  {value:'custom', label:'Custom oval fascia', price:2500, minWidth:3, note:'Custom face board for wider stands; text is required.', boardMm:140},
];
const LIGHTING_PRESETS: {value:LightingPreset; label:string}[] = [
  {value:'neutral', label:'Neutral'},
  {value:'exhibition', label:'Exhibition'},
  {value:'accent', label:'Accent'},
  {value:'spotlight', label:'Spotlight'},
  {value:'ambient', label:'Ambient'},
];
const STRUCT_UNIT_PRICE: Record<string,number> = { post:95, rail:42, panel:85, fascia:120, foot:28 };
const ROOM_UNIT_PRICE = { profile:42, panel:85, door:240, floor:35, ceiling:55, graphic:45 } as const;
const ROOM_TEMPLATES:{value:RoomTemplateKey;label:string;name:string;width:number;depth:number;hasCeiling:boolean}[] = [
  {value:'storage',label:'Storage 2 x 1 m',name:'Storage room',width:2,depth:1,hasCeiling:false},
  {value:'meeting',label:'Meeting 3 x 2 m',name:'Meeting room',width:3,depth:2,hasCeiling:true},
  {value:'utility',label:'Utility 1 x 1 m',name:'Utility room',width:1,depth:1,hasCeiling:true},
];

// ── Sub-components ─────────────────────────────────────────────────
function Hairline({margin=16}:{margin?:number}) { return <div style={{height:1,background:C.hair,margin:`0 -${margin}px`}}/>; }
function MonoLabel({children,right}:{children:React.ReactNode;right?:React.ReactNode}) {
  return <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7}}><span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.1em',color:C.muted,textTransform:'uppercase'}}>{children}</span>{right&&<span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{right}</span>}</div>;
}
function PropBlock({label,right,children}:{label:string;right?:React.ReactNode;children:React.ReactNode}) {
  return <div style={{padding:'12px 0'}}><MonoLabel right={right}>{label}</MonoLabel>{children}</div>;
}
function formatUsd(value:number) {
  // Values are USD internally; rendering converts to the selected display
  // currency (components consuming useCurrency re-render on switch).
  return formatMoneyUSD(value);
}
function DimInput({label,value,min,max,step,onChange,disabled=false}:{label:string;value:number;min:number;max:number;step:number;onChange:(v:number)=>void;disabled?:boolean}) {
  return (<div>
    <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:3}}>{label}</label>
    <div style={{position:'relative'}}>
      <input type="number" id={`dim-${label.toLowerCase().replace(/\s+/g,'-')}`} name={`dim-${label.toLowerCase().replace(/\s+/g,'-')}`} min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={e=>{if(disabled)return;const n=parseFloat(e.target.value);if(!isNaN(n)&&n>=min&&n<=max)onChange(n);}}
        style={{width:'100%',height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:disabled?'#f2f0eb':C.bg,fontFamily:MONO,fontSize:12.5,fontWeight:600,color:disabled?C.muted:C.ink,paddingLeft:8,paddingRight:22,boxSizing:'border-box',outline:'none',cursor:disabled?'not-allowed':'text'}}/>
      <span style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontFamily:MONO,fontSize:9,color:C.muted}}>m</span>
    </div>
  </div>);
}
function Swatch({color,active,onClick,size=28,title}:{color:string;active:boolean;onClick:()=>void;size?:number;title?:string}) {
  const light=color==='#dde0e4';
  return (<button onClick={onClick} title={title??color} style={{width:size,height:size,borderRadius:4,background:color,cursor:'pointer',flexShrink:0,border:`${active?2:1}px solid ${active?C.ink:C.hair}`,position:'relative'}}>
    {active&&<span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke={light?C.ink:'#fff'} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
  </button>);
}
function catalogPreviewUrl(item: CatItem) {
  if (!item.modelUrl) return '';
  const filename = decodeURIComponent(item.modelUrl.split('/').pop() || '').replace(/\.glb$/i, ' - preview.png');
  return `/ens-workspace-assets/sedef_remaining_furniture_refined_v2/previews/${encodeURIComponent(filename)}`;
}
function CatalogImagePreview({item,active}:{item:CatItem;active:boolean}) {
  const previewUrl = catalogPreviewUrl(item);
  return (
    <div style={{width:'100%',height:62,border:`1px solid ${active?C.ink:'rgba(156,163,175,0.32)'}`,borderRadius:4,background:active?'#f8fafc':'#ffffff',overflow:'hidden',display:'grid',placeItems:'center'}}>
      {previewUrl ? (
        <img src={previewUrl} alt={`${item.name} preview`} loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center',display:'block',transform:'scale(1.18)'}}/>
      ) : (
        <Box size={18} color={C.muted}/>
      )}
    </div>
  );
}
function CatalogPreview({item,active}:{item:CatItem;active:boolean}) {
  const props = catalogItemProps(item);
  const color = props.color;
  const stroke = active ? C.ink : '#9ca3af';
  const shape = item.shape ?? 'box';
  if (item.modelUrl) return <CatalogImagePreview item={item} active={active}/>;
  return (
    <svg viewBox="0 0 72 46" width="100%" height="46" aria-hidden="true" style={{display:'block'}}>
      <rect x="1" y="1" width="70" height="44" rx="4" fill={active?'rgba(24,22,19,0.05)':'rgba(255,255,255,0.48)'} stroke="rgba(156,163,175,0.32)"/>
      {shape==='round_table'&&<>
        <ellipse cx="36" cy="19" rx="18" ry="10" fill={color} stroke={stroke} strokeWidth="1"/>
        <rect x="34" y="20" width="4" height="14" rx="1" fill="#565b63"/>
        <ellipse cx="36" cy="36" rx="12" ry="3" fill="#565b63" opacity="0.65"/>
      </>}
      {shape==='rect_table'&&<>
        <rect x="18" y="14" width="36" height="14" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>
        {[22,48].map(x=><rect key={x} x={x} y="27" width="4" height="12" rx="1" fill="#565b63"/>)}
      </>}
      {shape==='counter'&&<>
        <rect x="14" y="16" width="44" height="20" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>
        <rect x="18" y="13" width="36" height="6" rx="2" fill="#fff" stroke="rgba(80,80,80,0.2)"/>
      </>}
      {(shape==='shelf'||shape==='cabinet')&&<>
        <rect x="20" y="8" width="32" height="30" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>
        {[17,26,34].map(y=><line key={y} x1="22" y1={y} x2="50" y2={y} stroke="#fff" strokeWidth="2" opacity="0.85"/>)}
      </>}
      {shape==='cube'&&<>
        <rect x="24" y="14" width="24" height="24" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>
        <path d="M24 14 L31 9 H55 L48 14" fill="rgba(255,255,255,0.45)" stroke={stroke} strokeWidth="0.8"/>
        <path d="M48 14 L55 9 V33 L48 38" fill="rgba(0,0,0,0.08)" stroke={stroke} strokeWidth="0.8"/>
      </>}
      {shape==='chair'&&<>
        <path d="M21 29 L24 17 Q36 10 48 17 L51 29 Z" fill={color} stroke={stroke} strokeWidth="1"/>
        <rect x="24" y="28" width="24" height="8" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>
        {[27,45].map(x=><line key={x} x1={x} y1="36" x2={x-2} y2="41" stroke="#565b63" strokeWidth="2"/>)}
      </>}
      {shape==='bar_stool'&&<>
        <ellipse cx="36" cy="18" rx="14" ry="7" fill={color} stroke={stroke} strokeWidth="1"/>
        <rect x="34" y="19" width="4" height="16" rx="1" fill="#565b63"/>
        <ellipse cx="36" cy="37" rx="12" ry="3" fill="#565b63" opacity="0.75"/>
      </>}
      {(shape==='light'||shape==='rail_light')&&<>
        <rect x="28" y="10" width="16" height="10" rx="3" fill="#303741" stroke={stroke} strokeWidth="1"/>
        <path d="M26 21 H46 L40 36 H32 Z" fill={color} opacity="0.38"/>
        <ellipse cx="36" cy="21" rx="11" ry="5" fill={color} stroke={stroke} strokeWidth="1"/>
      </>}
      {shape==='wall_shelf'&&<>
        <rect x="16" y="20" width="40" height="6" rx="1" fill={color} stroke={stroke} strokeWidth="1"/>
        {[24,48].map(x=><path key={x} d={`M${x} 26 L${x-5} 36 H${x+5} Z`} fill="#9aa1aa" opacity="0.8"/>)}
      </>}
      {shape==='box'&&<rect x="22" y="12" width="28" height="24" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>}
    </svg>
  );
}
function OpenSidesPlan({openFront,openBack,openLeft,openRight}:{openFront:boolean;openBack:boolean;openLeft:boolean;openRight:boolean}) {
  const open=(on:boolean)=>({stroke:on?C.orange:C.ink,strokeDasharray:on?'5 3.5':undefined});
  return (<svg width="188" height="116" viewBox="0 0 188 116" style={{fontFamily:MONO}}>
    <line x1="30" y1="24" x2="158" y2="24" strokeWidth="2" {...open(openBack)}/>
    <line x1="30" y1="24" x2="30" y2="92" strokeWidth="2" {...open(openLeft)}/>
    <line x1="158" y1="24" x2="158" y2="92" strokeWidth="2" {...open(openRight)}/>
    <line x1="30" y1="92" x2="158" y2="92" strokeWidth="2" {...open(openFront)}/>
    <text x="94" y="62" textAnchor="middle" fontSize="18" fill={C.muted} opacity={0.18} fontWeight="700">T</text>
    <text x="94" y="15" textAnchor="middle" fontSize="7.5" fill={openBack?C.orange:C.muted}>BACK</text>
    <text x="94" y="110" textAnchor="middle" fontSize="7.5" fill={openFront?C.orange:C.muted}>FRONT{openFront?" · OPEN":""}</text>
    <text x="16" y="60" textAnchor="middle" fontSize="7.5" fill={openLeft?C.orange:C.muted} transform="rotate(-90,16,60)">LEFT</text>
    <text x="172" y="60" textAnchor="middle" fontSize="7.5" fill={openRight?C.orange:C.muted} transform="rotate(90,172,60)">RIGHT</text>
  </svg>);
}
// ── Toast ──────────────────────────────────────────────────────────
function Toast({msg,onClose}:{msg:string;onClose:()=>void}) {
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[onClose]);
  return (<div style={{position:'fixed',bottom:48,left:'50%',transform:'translateX(-50%)',background:C.ink,color:'#fff',fontFamily:UI,fontSize:12,fontWeight:600,padding:'10px 20px',borderRadius:6,zIndex:1000,display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 20px rgba(0,0,0,0.3)',whiteSpace:'nowrap'}}>
    <CheckCircle2 size={14} style={{color:'#6ee7b7'}}/>{msg}
  </div>);
}

// ── Initial state ──────────────────────────────────────────────────
const INITIAL_BOOTH: BoothState = {width:6,depth:3,height:2.5,system:'octanorm',companyName:'TECHCORP INDUSTRIES',openFront:true,openBack:false,openLeft:false,openRight:false,fasciaEnabled:true,fasciaOption:'full'};
const INITIAL_WS: WSData = {booth:INITIAL_BOOTH,themeIdx:0,wallFinishIdx:0,frameFinishIdx:0,fasciaFinishIdx:0,carpetIdx:0,lightingPreset:'exhibition',placedItems:[],rooms:[],notes:[],panelOverrides:{},frontSupportPositions:[],suppressedDefaultPositions:[]};

function itemPositionBounds(w:number, d:number, booth:BoothState) {
  const clearance = ITEM_WALL_CLEARANCE_M;
  const minX = Math.min(booth.width / 2, w / 2 + clearance);
  const maxX = Math.max(minX, booth.width - w / 2 - clearance);
  const minZ = Math.min(booth.depth / 2, d / 2 + clearance);
  const maxZ = Math.max(minZ, booth.depth - d / 2 - clearance);
  return { minX, maxX, minZ, maxZ };
}

type PlacementIssue = { itemId:string; message:string };
type Rect2D = { x0:number; x1:number; z0:number; z1:number };

function rotatedItemFootprint(item:WorkspacePlacedItem) {
  const radians = ((Number(item.rotationY ?? item.rotation) || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: item.w * cos + item.d * sin,
    depth: item.w * sin + item.d * cos,
  };
}

function positionBoundsForItem(item:WorkspacePlacedItem, booth:BoothState) {
  const footprint = rotatedItemFootprint(item);
  return itemPositionBounds(footprint.width, footprint.depth, booth);
}

function itemRect(item:WorkspacePlacedItem, pad = 0.03): Rect2D {
  const footprint = rotatedItemFootprint(item);
  return {
    x0: item.x - footprint.width / 2 - pad,
    x1: item.x + footprint.width / 2 + pad,
    z0: item.z - footprint.depth / 2 - pad,
    z1: item.z + footprint.depth / 2 + pad,
  };
}

function roomRect(room:WorkspaceRoom, pad = 0.03): Rect2D {
  return {
    x0: room.x - room.width / 2 - pad,
    x1: room.x + room.width / 2 + pad,
    z0: room.z - room.depth / 2 - pad,
    z1: room.z + room.depth / 2 + pad,
  };
}

function rectsOverlap(a:Rect2D, b:Rect2D) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

function rectInside(inner:Rect2D, outer:Rect2D, tolerance = 0.001) {
  return inner.x0 >= outer.x0 - tolerance
    && inner.x1 <= outer.x1 + tolerance
    && inner.z0 >= outer.z0 - tolerance
    && inner.z1 <= outer.z1 + tolerance;
}

function roomInteriorRect(room:WorkspaceRoom):Rect2D {
  const clearance = 0.12;
  const outer = roomRect(room, 0);
  return {
    x0: Math.min(room.x, outer.x0 + clearance),
    x1: Math.max(room.x, outer.x1 - clearance),
    z0: Math.min(room.z, outer.z0 + clearance),
    z1: Math.max(room.z, outer.z1 - clearance),
  };
}

function roomDoorAxisCenter(room:WorkspaceRoom) {
  const usesDepth = room.doorSide === 'left' || room.doorSide === 'right';
  const span = usesDepth ? room.depth : room.width;
  const start = usesDepth ? room.z - room.depth / 2 : room.x - room.width / 2;
  const sectionCount = Math.max(1, Math.floor(span));
  const sectionWidth = span / sectionCount;
  const index = room.doorPosition === 'left' ? 0 : room.doorPosition === 'right' ? sectionCount - 1 : Math.round((sectionCount - 1) / 2);
  return start + sectionWidth * (index + 0.5);
}

function roomDoorClearanceRect(room:WorkspaceRoom):Rect2D|null {
  if(!room.hasDoor) return null;
  const center = roomDoorAxisCenter(room);
  const halfOpening = room.doorWidth / 2 + 0.08;
  const swingDepth = Math.max(0.75, room.doorWidth + 0.12);
  const outer = roomRect(room, 0);
  if(room.doorSide === 'back') return {x0:center-halfOpening,x1:center+halfOpening,z0:outer.z0-0.06,z1:outer.z0+swingDepth};
  if(room.doorSide === 'left') return {x0:outer.x0-0.06,x1:outer.x0+swingDepth,z0:center-halfOpening,z1:center+halfOpening};
  if(room.doorSide === 'right') return {x0:outer.x1-swingDepth,x1:outer.x1+0.06,z0:center-halfOpening,z1:center+halfOpening};
  return {x0:center-halfOpening,x1:center+halfOpening,z0:outer.z1-swingDepth,z1:outer.z1+0.06};
}

function roomItemConflict(itemBounds:Rect2D, room:WorkspaceRoom):'wall'|'door'|null {
  if(!rectsOverlap(itemBounds, roomRect(room, 0))) return null;
  if(!rectInside(itemBounds, roomInteriorRect(room))) return 'wall';
  const doorClearance = roomDoorClearanceRect(room);
  return doorClearance && rectsOverlap(itemBounds, doorClearance) ? 'door' : null;
}

function roomPlacementIssue(candidate:WorkspaceRoom, allRooms:WorkspaceRoom[], items:WorkspacePlacedItem[]) {
  for(const other of allRooms) {
    if(other.id === candidate.id) continue;
    if(rectsOverlap(roomRect(candidate, 0.04), roomRect(other, 0.04))) return `Overlaps ${other.name}`;
  }
  for(const item of items.filter(isFloorPlacedItem)) {
    const conflict = roomItemConflict(itemRect(item), candidate);
    if(conflict === 'wall') return `${item.name} crosses a room wall`;
    if(conflict === 'door') return `${item.name} blocks the door clearance`;
  }
  return '';
}

function findAvailableRoomPlacement(room:WorkspaceRoom, rooms:WorkspaceRoom[], items:WorkspacePlacedItem[], booth:BoothState) {
  const minX = room.width / 2;
  const maxX = Math.max(minX, booth.width - room.width / 2);
  const minZ = room.depth / 2;
  const maxZ = Math.max(minZ, booth.depth - room.depth / 2);
  const candidates:{x:number;z:number}[] = [
    {x:minX,z:minZ}, {x:maxX,z:minZ}, {x:minX,z:maxZ}, {x:maxX,z:maxZ},
    {x:booth.width/2,z:booth.depth/2},
  ];
  for(let z=minZ;z<=maxZ+0.001;z+=0.5) {
    for(let x=minX;x<=maxX+0.001;x+=0.5) candidates.push({x:snapNumber(x),z:snapNumber(z)});
  }
  for(const position of candidates) {
    const candidate = {...room,...position};
    if(!roomPlacementIssue(candidate, rooms, items)) return candidate;
  }
  return null;
}

function isFloorPlacedItem(item:WorkspacePlacedItem) {
  return (item.kind === 'furniture' || item.kind === 'asset') && item.shape !== 'wall_shelf' && item.shape !== 'light' && item.shape !== 'rail_light';
}

function placementIssuesFor(items:WorkspacePlacedItem[], rooms:WorkspaceRoom[], booth:BoothState, frontSupports:number[]): PlacementIssue[] {
  const issues: PlacementIssue[] = [];
  const floorItems = items.filter(isFloorPlacedItem);
  const seen = new Set<string>();
  const addIssue = (itemId:string, message:string) => {
    const key = `${itemId}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ itemId, message });
  };

  for (let i = 0; i < floorItems.length; i += 1) {
    const a = floorItems[i];
    const aRect = itemRect(a);
    for (let j = i + 1; j < floorItems.length; j += 1) {
      const b = floorItems[j];
      if (!rectsOverlap(aRect, itemRect(b))) continue;
      addIssue(a.id, `Overlaps ${b.name}`);
      addIssue(b.id, `Overlaps ${a.name}`);
    }
    for (const room of rooms) {
      const conflict = roomItemConflict(aRect, room);
      if (conflict === 'wall') addIssue(a.id, `Crosses ${room.name} wall`);
      if (conflict === 'door') addIssue(a.id, `Blocks ${room.name} door clearance`);
    }
    const bounds = itemPositionBounds(rotatedItemFootprint(a).width, rotatedItemFootprint(a).depth, booth);
    if (a.x < bounds.minX || a.x > bounds.maxX || a.z < bounds.minZ || a.z > bounds.maxZ) {
      addIssue(a.id, 'Outside the usable booth floor');
    }
    for (const supportX of frontSupports) {
      const supportLane: Rect2D = {
        x0: supportX - 0.12,
        x1: supportX + 0.12,
        z0: 0,
        z1: booth.depth,
      };
      if (rectsOverlap(aRect, supportLane)) addIssue(a.id, 'Blocks a structural support rail');
    }
  }
  return issues;
}

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

function availableRoomWallSides(width:number,depth:number,x:number,z:number,booth:BoothState):DoorSide[] {
  const tolerance = 0.02;
  return ROOM_SIDE_OPTIONS.map(option=>option.value).filter(side=>{
    if(side==='back') return z-depth/2 > tolerance;
    if(side==='front') return z+depth/2 < booth.depth-tolerance;
    if(side==='left') return x-width/2 > tolerance;
    return x+width/2 < booth.width-tolerance;
  });
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
  const { t } = useTranslation();
  useCurrency(); // subscribe so money renders update when display currency changes
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

  // ── BOM structural auto-calc ─────────────────────────────────
  const isMax = booth.system==='maxima';
  const mod   = isMax?2:1;
  const cols  = Math.ceil(booth.width/mod)+1;
  const rows  = Math.ceil(booth.depth/mod)+1;
  const rl    = isMax?1:2;
  const wallPanelQty =
    (booth.openFront ? 0 : cols - 1) +
    (booth.openBack ? 0 : cols - 1) +
    (booth.openLeft ? 0 : rows - 1) +
    (booth.openRight ? 0 : rows - 1);
  const fasciaBoardQty = booth.fasciaEnabled ? (booth.fasciaOption === 'classic' ? (cols-1)*2 : (cols-1)*2 + Math.ceil(booth.depth/mod)*2) : 0;
  const structItems = [
    {name:'Upright Post',   sku:`${isMax?'MAX':'OCT'}-UP-01`, qty:cols*rows,                          unit:'ea',weight:4.5,unitPrice:STRUCT_UNIT_PRICE.post},
    {name:'Horizontal Rail',sku:`${isMax?'MAX':'OCT'}-HR-01`, qty:(cols-1)*rows*rl+(rows-1)*cols*rl, unit:'ea',weight:2.2,unitPrice:STRUCT_UNIT_PRICE.rail},
    {name:'Wall Panel',     sku:`${isMax?'MAX':'OCT'}-WP-01`, qty:Math.max(0,wallPanelQty),           unit:'ea',weight:3.8,unitPrice:STRUCT_UNIT_PRICE.panel},
    {name:'Fascia Board',   sku:`FAS-${booth.fasciaOption.toUpperCase()}-01`, qty:fasciaBoardQty,     unit:'ea',weight:1.4,unitPrice:STRUCT_UNIT_PRICE.fascia},
    {name:'Base Foot',      sku:`${isMax?'MAX':'OCT'}-BF-01`, qty:cols*rows,                          unit:'ea',weight:1.2,unitPrice:STRUCT_UNIT_PRICE.foot},
  ];
  const roomItems = rooms.flatMap(room=>{
    const wallSides = availableRoomWallSides(room.width,room.depth,room.x,room.z,booth);
    const wallLengths = wallSides.map(side=>({side,length:side==='front'||side==='back'?room.width:room.depth}));
    const doorIsBuilt = room.hasDoor && wallSides.includes(room.doorSide);
    const panelQty = wallLengths.reduce((total,wall)=>{
      const opening = doorIsBuilt&&wall.side===room.doorSide ? room.doorWidth : 0;
      return total + Math.ceil(Math.max(0,wall.length-opening));
    },0);
    const totalWallLength = wallLengths.reduce((total,wall)=>total+wall.length,0);
    const verticalCount = wallLengths.reduce((total,wall)=>total+Math.ceil(wall.length)+1,0);
    const doorHeight = Math.min(2.1,room.height*0.88);
    const profileLength = Math.round((totalWallLength*2 + verticalCount*room.height + (doorIsBuilt?doorHeight*2+room.doorWidth:0))*10)/10;
    const floorArea = Math.round(room.width*room.depth*10)/10;
    const graphicSpan = room.designWall==='front'||room.designWall==='back' ? room.width : room.depth;
    const graphicArea = Math.round(Math.max(0,graphicSpan-0.16)*Math.max(0,room.height-0.28)*10)/10;
    const finishMultiplier = room.wallFinish==='glass'?1.5:room.wallFinish==='frosted'?1.35:room.wallFinish==='dark'?1.1:1;
    return [
      {roomId:room.id,roomName:room.name,name:'Room Frame Profile',sku:'ROOM-PROFILE-01',qty:profileLength,unit:'lm',weight:0.95,unitPrice:ROOM_UNIT_PRICE.profile,notes:`${wallSides.join(', ')||'shared shell'} walls`},
      {roomId:room.id,roomName:room.name,name:`${room.wallFinish} Room Wall Panel`,sku:`ROOM-WALL-${room.wallFinish.toUpperCase()}`,qty:panelQty,unit:'ea',weight:3.8,unitPrice:Math.round(ROOM_UNIT_PRICE.panel*finishMultiplier),notes:`${room.height.toFixed(1)} m high`},
      ...(doorIsBuilt?[{roomId:room.id,roomName:room.name,name:'Room Door Kit',sku:'ROOM-DOOR-01',qty:1,unit:'kit',weight:18,unitPrice:ROOM_UNIT_PRICE.door,notes:`${room.doorSide} / ${room.doorWidth.toFixed(2)} m / ${room.doorSwing}`}]:[]),
      {roomId:room.id,roomName:room.name,name:'Room Floor Finish',sku:'ROOM-FLOOR-01',qty:floorArea,unit:'m2',weight:1.5,unitPrice:ROOM_UNIT_PRICE.floor,notes:room.floorColor},
      ...(room.hasCeiling?[{roomId:room.id,roomName:room.name,name:'Room Ceiling Panel',sku:'ROOM-CEILING-01',qty:floorArea,unit:'m2',weight:4.5,unitPrice:ROOM_UNIT_PRICE.ceiling,notes:`${room.width} x ${room.depth} m`}]:[]),
      ...(room.designImageUrl?[{roomId:room.id,roomName:room.name,name:'Printed Room Wall Graphic',sku:'ROOM-GRAPHIC-01',qty:graphicArea,unit:'m2',weight:0.2,unitPrice:ROOM_UNIT_PRICE.graphic,notes:`${room.designWall} wall / ${room.designFit}`}]:[]),
    ].filter(item=>item.qty>0);
  });
  const structWeight = structItems.reduce((a,s)=>a+s.qty*s.weight,0);
  const structSubtotal = structItems.reduce((a,s)=>a+s.qty*s.unitPrice,0);
  const roomWeight = roomItems.reduce((a,s)=>a+s.qty*s.weight,0);
  const roomSubtotal = roomItems.reduce((a,s)=>a+s.qty*s.unitPrice,0);
  const catalogItemFor = (catalogId:string) => Object.values(CATALOG).reduce<CatItem | undefined>((found, items) => found || items.find(item => item.id === catalogId), undefined);
  const placedSubtotal = placedItems.reduce((sum,item)=>sum+(catalogItemFor(item.catalogId)?.price || 0)*item.qty,0);
  const unpricedItems = placedItems.filter(item => !catalogItemFor(item.catalogId)?.price).length;
  const fasciaSubtotal = booth.fasciaEnabled ? fasciaMeta.price : 0;
  const quoteSubtotal = structSubtotal + roomSubtotal + placedSubtotal + fasciaSubtotal;
  const quoteAllowance = quoteSubtotal * 0.1;
  const quoteTotal = quoteSubtotal + quoteAllowance;
  quoteTotalCentsRef.current = Math.round(quoteTotal * 100);
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
    const STATUS_DOT: Record<string,string> = {'In Design':C.blue,'Under Review':'#c2410c','Approved':C.green,'Completed':'#6b6560','Pending':C.orange};
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100vh',background:C.bg,color:C.ink,fontFamily:UI,overflow:'hidden'}}>
        {/* Header */}
        <header style={{height:46,borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',gap:10,padding:'0 16px',background:C.panel,flexShrink:0}}>
          <Link href="/pm">
            <button style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4,color:C.muted,padding:'4px 6px',borderRadius:4}}>
              <ChevronLeft size={13}/><span style={{fontFamily:MONO,fontSize:10}}>Back</span>
            </button>
          </Link>
          <div style={{width:1,height:18,background:C.hair}}/>
          <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.muted}}>Select Project Workspace</span>
        </header>

        {/* Body */}
        <div style={{flex:1,overflow:'auto',padding:'32px 40px'}}>
          <div style={{maxWidth:900,margin:'0 auto'}}>
            {/* Title */}
            <div style={{marginBottom:28}}>
              <h1 style={{fontSize:22,fontWeight:800,letterSpacing:'-0.03em',margin:'0 0 6px',color:C.ink}}>Choose a Project</h1>
              <p style={{fontFamily:MONO,fontSize:10.5,color:C.muted,margin:0}}>Select a project to open its 3D booth workspace</p>
            </div>

            {/* Search */}
            <div style={{position:'relative',marginBottom:22}}>
              <Search size={13} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:C.muted,pointerEvents:'none'}}/>
              <input
                value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)}
                placeholder="Search projects, clients…"
                autoFocus
                style={{width:'100%',height:38,paddingLeft:34,paddingRight:12,border:`1px solid ${C.hair}`,borderRadius:5,background:C.panel,fontFamily:UI,fontSize:13,color:C.ink,outline:'none',boxSizing:'border-box'}}
              />
            </div>

            {/* Projects grid */}
            {isPickerLoading ? (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                {[1,2,3,4,5,6].map(i=>(
                  <div key={i} style={{height:120,borderRadius:6,background:`${C.hair}50`,animation:'pulse 1.5s ease-in-out infinite'}}/>
                ))}
              </div>
            ) : filteredPickerProjects.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px 0',color:C.muted,fontFamily:MONO,fontSize:10}}>
                {pickerSearch ? `No projects match "${pickerSearch}"` : 'No projects found'}
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                {filteredPickerProjects.map(project=>(
                  <button key={project.id} onClick={()=>selectProject(project)}
                    style={{background:C.panel,border:`1px solid ${C.hair}`,borderRadius:6,padding:'16px',cursor:'pointer',textAlign:'left',transition:'box-shadow 0.12s,border-color 0.12s',display:'flex',flexDirection:'column',gap:8}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.blue;(e.currentTarget as HTMLElement).style.boxShadow=`0 0 0 3px ${C.blue}18`;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.hair;(e.currentTarget as HTMLElement).style.boxShadow='none';}}>
                    {/* Row 1: name + status dot */}
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                      <span style={{fontSize:13,fontWeight:700,color:C.ink,lineHeight:1.3,flex:1,textAlign:'left'}}>{project.name}</span>
                      <span style={{width:8,height:8,borderRadius:'50%',background:STATUS_DOT[project.status]??C.muted,flexShrink:0,marginTop:4}}/>
                    </div>
                    {/* Row 2: client + system */}
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      <span style={{fontFamily:MONO,fontSize:9,color:C.muted,background:C.bg,borderRadius:3,padding:'2px 6px',border:`1px solid ${C.hair}`}}>{project.client}</span>
                      <span style={{fontFamily:MONO,fontSize:9,color:C.muted,background:C.bg,borderRadius:3,padding:'2px 6px',border:`1px solid ${C.hair}`}}>{project.system}</span>
                      <span style={{fontFamily:MONO,fontSize:9,color:C.muted,background:C.bg,borderRadius:3,padding:'2px 6px',border:`1px solid ${C.hair}`}}>{project.dimensions}</span>
                    </div>
                    {/* Row 3: progress bar */}
                    <div>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>{project.status}</span>
                        <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted}}>{project.progress}%</span>
                      </div>
                      <div style={{height:3,borderRadius:2,background:`${C.hair}80`,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${project.progress}%`,background:C.blue,borderRadius:2,transition:'width 0.3s'}}/>
                      </div>
                    </div>
                    {/* Row 4: open workspace label */}
                    <div style={{fontFamily:MONO,fontSize:9,color:C.blue,letterSpacing:'0.04em',textAlign:'right'}}>Open Workspace →</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
        {!previewMode&&<aside style={{width:240,borderRight:`1px solid ${C.hair}`,background:C.panel,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
          <div style={{padding:'8px 14px',borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.12em',color:C.muted,textTransform:'uppercase'}}>§ Components</span>
            <span style={{fontFamily:MONO,fontSize:9.5,color:C.muted}}>{Object.values(visibleCatalog).reduce((a,b)=>a+b.length,0)} items</span>
          </div>

          <div style={{padding:'8px 10px',borderBottom:`1px solid ${C.hair}`,flexShrink:0}}>
            <div style={{position:'relative'}}>
              <Search size={11} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:C.muted}}/>
              <input id="furniture-search" name="furniture-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items, SKUs…"
                style={{width:'100%',height:28,paddingLeft:26,paddingRight:32,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:11.5,color:C.ink,outline:'none',boxSizing:'border-box'}}/>
              <span style={{position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',fontFamily:MONO,fontSize:8.5,color:C.muted,border:`1px solid ${C.hair}`,borderRadius:3,padding:'1px 4px',lineHeight:1.2}}>⌘K</span>
            </div>
          </div>

          <div style={{flex:1,overflowY:'auto'}}>
            {Object.entries(filteredCatalog).map(([cat,items])=>{
              const isOpen = openCats.has(cat);
              return (
                <div key={cat} style={{borderBottom:`1px solid ${C.hair}`}}>
                  <button onClick={()=>setOpenCats(prev=>{const s=new Set(prev);if(s.has(cat)){s.delete(cat);}else{s.add(cat);}return s;})}
                    style={{width:'100%',background:'none',border:'none',cursor:'pointer',padding:'7px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',textAlign:'left'}}>
                    <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:C.ink}}>
                      {cat} · {String(CAT_TOTAL[cat]??items.length).padStart(2,'0')}
                    </span>
                    <ChevronDown size={11} style={{color:C.muted,transform:isOpen?'rotate(0deg)':'rotate(-90deg)',transition:'transform 0.15s',flexShrink:0}}/>
                  </button>

                  {isOpen&&(
                    <div style={{padding:'8px 10px 10px',display:'flex',flexDirection:'column',gap:7}}>
                      {cat === 'Furniture'&&(
                        <div style={{display:'flex',gap:5,overflowX:'auto',paddingBottom:2,marginBottom:1}}>
                          {FURNITURE_CATEGORY_ORDER.filter(category => (furnitureCategoryCounts.get(category) || 0) > 0).map(category=>{
                            const active = activeFurnitureCategory === category;
                            return (
                              <button key={category} type="button" onClick={()=>setActiveFurnitureCategory(category)}
                                style={{height:24,whiteSpace:'nowrap',border:`1px solid ${active?C.blue:C.hair}`,borderRadius:4,background:active?`${C.blue}12`:C.bg,color:active?C.blue:C.muted,cursor:'pointer',fontFamily:MONO,fontSize:8.5,fontWeight:active?700:600,padding:'0 7px',display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
                                <span>{t(`pm.workspace.furnitureCategory.${category}`)}</span>
                                <span style={{opacity:0.75}}>{furnitureCategoryCounts.get(category)}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {items.map(item=>{
                        const isActive = activeId===item.id;
                        const isDragging = draggedCatalogItem?.id===item.id;
                        const canDragToFloor = cat === 'Furniture';
                        const placedCount = placedItems.filter(p=>p.catalogId===item.id).reduce((sum,p)=>sum+p.qty,0);
                        const placed   = placedCount > 0;
                        const hasCount = item.inStand>0;
                        const stockLimit = item.stock;
                        const remaining = stockLimit == null ? null : Math.max(0, stockLimit - placedCount);
                        const isOut = remaining === 0;
                        const isLow = remaining != null && remaining > 0 && remaining <= (item.lowStockAt ?? 2);
                        const availability = remaining == null ? 'Available' : isOut ? 'Out of stock' : isLow ? `${remaining} left` : `${remaining} available`;
                        return (
                          <div key={item.id}
                            data-catalog-item-id={item.id}
                            data-catalog-draggable={canDragToFloor&&!isOut?'true':'false'}
                            draggable={canDragToFloor&&!isOut}
                            onDragStart={(event)=>beginCatalogDrag(event,item)}
                            onDragEnd={endCatalogDrag}
                            onClick={()=>{
                              if(isOut||catalogDragWasActiveRef.current) return;
                              addItem(item);
                            }}
                            title={canDragToFloor&&!isOut?'Drag onto the booth floor or click to add':undefined}
                            style={{position:'relative',opacity:isOut?0.58:1,background:isDragging?`${C.green}12`:isActive?'#f0ecff':placed?`${C.blue}08`:C.bg,border:`1px ${isActive||isDragging?'solid':hasCount?'solid':'dashed'} ${isDragging?C.green:isActive?C.ink:placed?C.blue:C.hair}`,borderRadius:5,padding:7,cursor:isOut?'not-allowed':canDragToFloor?'grab':'pointer',display:'grid',gridTemplateColumns:'72px 1fr',gap:8,textAlign:'left',transition:'all 0.1s',alignItems:'center'}}>
                            {placed&&(
                              <div style={{position:'absolute',top:3,right:3,background:C.blue,borderRadius:2,padding:'1px 4px'}}>
                                <span style={{fontFamily:MONO,fontSize:8,color:'#fff',fontWeight:700}}>x{placedCount}</span>
                              </div>
                            )}
                            {!placed&&hasCount&&(
                              <span style={{position:'absolute',top:3,right:3,fontFamily:MONO,fontSize:8,color:C.blue,fontWeight:700}}>×{item.inStand}</span>
                            )}
                            <CatalogPreview item={item} active={isActive}/>
                            <span style={{minWidth:0,display:'flex',flexDirection:'column',gap:3}}>
                              <span style={{fontSize:11.5,fontWeight:700,color:C.ink,lineHeight:1.15,wordBreak:'break-word'}}>{item.name}</span>
                              <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted,display:'flex',gap:5,flexWrap:'wrap'}}>
                                <span>{item.sku}</span>
                                {item.family&&<span>/ {item.family}</span>}
                              </span>
                              <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted}}>{item.dim} m</span>
                              {item.price!=null&&<span style={{fontFamily:MONO,fontSize:8.5,color:C.green,fontWeight:700}}>USD {item.price.toLocaleString()}</span>}
                              <span style={{fontFamily:MONO,fontSize:8.5,color:isOut?C.orange:isLow?'#8a6b20':C.muted,fontWeight:isOut||isLow?700:500}}>
                                {availability}
                              </span>
                              <span style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                                <button type="button" disabled={!placed} onClick={(event)=>{event.stopPropagation();removeCatalogItem(item.id);}}
                                  style={{width:24,height:22,border:`1px solid ${C.hair}`,borderRadius:4,background:placed?C.panel:C.bg,color:placed?C.ink:C.muted,cursor:placed?'pointer':'not-allowed',fontFamily:MONO,fontSize:13,lineHeight:1,opacity:placed?1:0.45}}>−</button>
                                <span style={{minWidth:24,textAlign:'center',fontFamily:MONO,fontSize:9.5,fontWeight:700,color:C.ink}}>{placedCount}</span>
                                <button type="button" disabled={isOut} onClick={(event)=>{event.stopPropagation();addItem(item);}}
                                  style={{width:24,height:22,border:`1px solid ${isOut?C.hair:C.blue}`,borderRadius:4,background:isOut?C.bg:`${C.blue}12`,color:isOut?C.muted:C.blue,cursor:isOut?'not-allowed':'pointer',fontFamily:MONO,fontSize:13,lineHeight:1,opacity:isOut?0.5:1}}>+</button>
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Placed items summary */}
          {placedItems.length>0&&(
            <div style={{padding:'8px 14px',borderTop:`1px solid ${C.hair}`,background:C.bg,flexShrink:0}}>
              <div style={{fontFamily:MONO,fontSize:9,color:C.muted,marginBottom:4}}>PLACED IN STAND</div>
              {placedItems.map(p=>{
                const issues = placementIssueByItem.get(p.id) || [];
                return (
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                  <div style={{width:8,height:8,borderRadius:2,background:issues.length?C.orange:p.color,flexShrink:0}} title={issues.map(issue=>issue.message).join(', ')}/>
                  <span style={{fontFamily:MONO,fontSize:9,flex:1,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                  {issues.length>0&&<span title={issues.map(issue=>issue.message).join(', ')} style={{fontFamily:MONO,fontSize:8,color:C.orange,border:`1px solid ${C.orange}40`,borderRadius:3,padding:'1px 4px',background:`${C.orange}10`}}>CHECK</span>}
                  <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>×{p.qty}</span>
                  <button
                    type="button"
                    title={`Remove ${p.name}`}
                    aria-label={`Remove ${p.name}`}
                    data-workspace-remove-item={p.id}
                    onClick={()=>removeItem(p.id)}
                    style={{background:'none',border:'none',cursor:'pointer',padding:2,color:C.muted,display:'flex'}}
                  >
                    <Trash2 size={10}/>
                  </button>
                </div>
              );})}
            </div>
          )}
        </aside>}

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
                  <label style={{fontFamily:MONO,fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:4}}>Support X position</label>
                  <input type="range" min={0.45} max={Math.max(0.45,booth.width-0.45)} step={0.05}
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
                  <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:3}}>System</label>
                  <select value={booth.system} onChange={e=>set('system',e.target.value as BoothSystem)}
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
                    <div key={room.id} data-workspace-room-editor={room.id} onClick={()=>setActiveRoomId(room.id)} style={{border:`1px solid ${activeRoomId===room.id?C.blue:C.hair}`,borderRadius:5,background:activeRoomId===room.id?`${C.blue}08`:C.bg,padding:9}}>
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
                        <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Room wall image</label>
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
                            <img src={room.designImageUrl} alt="" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'62px 1fr',gap:7,alignItems:'center',marginTop:7}}>
                            <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Opacity</label>
                            <input type="range" min={0.15} max={1} step={0.05} value={room.designOpacity ?? 1} onChange={e=>updateRoom(room.id,{designOpacity:Number(e.target.value)})}
                              style={{width:'100%',accentColor:C.blue}}/>
                          </div>
                          <button onClick={()=>updateRoom(room.id,{designImageUrl:undefined,designImageName:undefined,designOpacity:undefined})}
                            style={{width:'100%',height:28,marginTop:7,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',fontFamily:UI,fontSize:11,fontWeight:700}}>
                            Remove room image
                          </button>
                        </>}
                      </div>
                      <div style={{marginTop:7}}>
                        <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Snap target</label>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
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
                        <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Door wall & width</label>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr) 76px',gap:4}}>
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
                        <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Door position</label>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
                          {(['left','center','right'] as DoorPosition[]).map(position=>(
                            <button key={position} onClick={()=>updateRoom(room.id,{doorPosition:position,hasDoor:true})}
                              style={{height:24,border:`1px solid ${room.doorPosition===position&&room.hasDoor?C.orange:C.hair}`,borderRadius:4,background:room.doorPosition===position&&room.hasDoor?`${C.orange}12`:C.panel,color:room.doorPosition===position&&room.hasDoor?C.orange:C.ink,cursor:'pointer',fontFamily:MONO,fontSize:8.5,textTransform:'uppercase'}}>
                              {position === 'center' ? 'Ctr' : position === 'left' ? 'L' : 'R'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{marginTop:7}}>
                        <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Door swing</label>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
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
                      <div onClick={()=>set(key,!on)} style={{width:14,height:14,borderRadius:3,flexShrink:0,border:`1px solid ${on?C.blue:C.hair}`,background:on?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
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
                    <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Text</label>
                    <input value={activePanelOverride.brandText || ''} onChange={e=>updatePanelOverride(activePanel.id,{brandText:e.target.value.slice(0,40)})}
                      placeholder="Company logo, product name, sticker"
                      style={{width:'100%',height:32,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:12,color:C.ink,paddingLeft:9,boxSizing:'border-box',outline:'none'}}/>
                    <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:8,marginTop:9,alignItems:'center'}}>
                      <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Color</label>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <input type="color" value={activePanelOverride.brandColor || '#111827'} onChange={e=>updatePanelOverride(activePanel.id,{brandColor:e.target.value})}
                          style={{width:34,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,cursor:'pointer',padding:2}}/>
                        <input value={activePanelOverride.brandColor || '#111827'} onChange={e=>updatePanelOverride(activePanel.id,{brandColor:e.target.value})}
                          style={{flex:1,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:MONO,fontSize:10.5,color:C.ink,paddingLeft:8,outline:'none'}}/>
                      </div>
                      <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Scale</label>
                      <input type="range" min={0.08} max={0.45} step={0.01} value={activePanelOverride.brandScale ?? 0.15} onChange={e=>updatePanelOverride(activePanel.id,{brandScale:Number(e.target.value)})}
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
                        <img src={activePanelOverride.designImageUrl} alt="" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:8,alignItems:'center',marginTop:9}}>
                        <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Opacity</label>
                        <input type="range" min={0.15} max={1} step={0.05} value={activePanelOverride.designOpacity ?? 1} onChange={e=>updatePanelOverride(activePanel.id,{designOpacity:Number(e.target.value)})}
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
                      <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Text / logo wordmark</label>
                      <input value={activeFasciaOverride.brandText || ''} disabled={!activeFasciaId} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{brandText:e.target.value.slice(0,40)})}
                        placeholder={activeFasciaId === 'fascia-front' ? booth.companyName : 'Brand / fascia text'}
                        style={{width:'100%',height:32,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:12,color:C.ink,paddingLeft:9,boxSizing:'border-box',outline:'none'}}/>
                      <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:8,marginTop:9,alignItems:'center'}}>
                        <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Color</label>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <input type="color" value={activeFasciaOverride.brandColor || '#23262c'} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{brandColor:e.target.value})}
                            style={{width:34,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,cursor:'pointer',padding:2}}/>
                          <input value={activeFasciaOverride.brandColor || '#23262c'} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{brandColor:e.target.value})}
                            style={{flex:1,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:MONO,fontSize:10.5,color:C.ink,paddingLeft:8,outline:'none'}}/>
                        </div>
                        <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Scale</label>
                        <input type="range" min={0.08} max={0.45} step={0.01} value={activeFasciaOverride.brandScale ?? 0.2} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{brandScale:Number(e.target.value)})}
                          style={{width:'100%',accentColor:C.blue}}/>
                      </div>
                      <label style={{height:34,marginTop:10,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.ink,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7,fontFamily:MONO,fontSize:9.5,fontWeight:800,padding:'0 10px',overflow:'hidden'}}>
                        <ImagePlus size={13}/>
                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeFasciaOverride.designImageName || 'Choose logo or fascia design'}</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" disabled={!activeFasciaId} onChange={e=>{if(activeFasciaId) uploadPanelDesign(activeFasciaId,e.target.files?.[0]); e.currentTarget.value='';}} style={{display:'none'}}/>
                      </label>
                      {activeFasciaOverride.designImageUrl&&<>
                        <div style={{height:62,marginTop:8,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                          <img src={activeFasciaOverride.designImageUrl} alt="" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'72px 1fr',gap:8,alignItems:'center',marginTop:9}}>
                          <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase'}}>Opacity</label>
                          <input type="range" min={0.15} max={1} step={0.05} value={activeFasciaOverride.designOpacity ?? 1} onChange={e=>activeFasciaId&&updatePanelOverride(activeFasciaId,{designOpacity:Number(e.target.value)})}
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
            <div style={{flex:1,overflowY:'auto',padding:'0 16px'}}>
              <div style={{padding:'10px 0',borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <div>
                  <div style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>BOM Export</div>
                  <div style={{fontFamily:MONO,fontSize:8.5,color:C.muted,marginTop:2}}>{structItems.reduce((a,s)=>a+s.qty,0) + totalParts} parts / {roomItems.length} room lines / {formatUsd(quoteTotal)}</div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button onClick={exportBomCsv}
                    style={{height:30,border:`1px solid ${C.blue}`,borderRadius:4,background:`${C.blue}10`,color:C.blue,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontFamily:MONO,fontSize:9,fontWeight:700,padding:'0 9px',whiteSpace:'nowrap'}}>
                    <Download size={11}/> CSV
                  </button>
                  <button onClick={exportProductionChecklist}
                    style={{height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,color:C.ink,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontFamily:MONO,fontSize:9,fontWeight:700,padding:'0 9px',whiteSpace:'nowrap'}}>
                    <Download size={11}/> TXT
                  </button>
                </div>
              </div>
              <div style={{padding:'12px 0',borderBottom:`1px solid ${C.hair}`}}>
                <MonoLabel right={`${structWeight.toFixed(0)} kg`}>§ Structural</MonoLabel>
                {structItems.map((s,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${C.hair}28`}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:C.ink}}>{s.name}</div>
                      <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{s.sku} / {formatUsd(s.unitPrice)} {s.unit}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:MONO,fontSize:11,fontWeight:700,color:C.ink}}>×{s.qty}</div>
                      <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{(s.qty*s.weight).toFixed(0)} kg / {formatUsd(s.qty*s.unitPrice)}</div>
                    </div>
                  </div>
                ))}
              </div>
              {roomItems.length>0&&(
                <div style={{padding:'12px 0',borderBottom:`1px solid ${C.hair}`}}>
                  <MonoLabel right={`${roomWeight.toFixed(0)} kg`}>Room Materials</MonoLabel>
                  {roomItems.map((item,index)=>(
                    <button key={`${item.roomId}-${item.sku}-${index}`} type="button" onClick={()=>{setActiveRoomId(item.roomId);setActivePlacedId('');setActiveTab('props');}}
                      style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'5px 0',border:0,borderBottom:`1px solid ${C.hair}28`,background:'transparent',cursor:'pointer',textAlign:'left'}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:600,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.roomName} - {item.name}</div>
                        <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{item.sku} / {item.notes}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontFamily:MONO,fontSize:10,fontWeight:700,color:C.ink}}>{item.qty} {item.unit}</div>
                        <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{formatUsd(item.qty*item.unitPrice)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {placedItems.length>0&&(
                <div style={{padding:'12px 0',borderBottom:`1px solid ${C.hair}`}}>
                  <MonoLabel right={`${totalWeight.toFixed(0)} kg`}>§ Placed Items</MonoLabel>
                  {placedItems.map(p=>{
                    const issues = placementIssueByItem.get(p.id) || [];
                    return (
                    <div key={p.id} onClick={()=>{setActivePlacedId(p.id);setActiveRoomId('');}} style={{padding:'7px 0',borderBottom:`1px solid ${issues.length?C.orange:C.hair}28`,background:issues.length?`${C.orange}08`:activePlacedId===p.id?`${C.orange}12`:'transparent',cursor:'pointer'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:10,height:10,borderRadius:2,background:issues.length?C.orange:p.color,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontWeight:600,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                          <div style={{fontFamily:MONO,fontSize:8,color:issues.length?C.orange:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{issues.length ? issues.map(issue=>issue.message).join(' / ') : `${p.sku} / ${p.kind} / ${catalogItemFor(p.catalogId)?.price ? formatUsd(catalogItemFor(p.catalogId)?.price || 0) : 'Unpriced'}${p.modelUrl ? ` / ${p.modelUrl}` : ''}`}</div>
                        </div>
                        <div style={{fontFamily:MONO,fontSize:9,fontWeight:700,color:C.ink,whiteSpace:'nowrap'}}>{catalogItemFor(p.catalogId)?.price ? formatUsd((catalogItemFor(p.catalogId)?.price || 0)*p.qty) : 'TBD'}</div>
                        <button onClick={(event)=>{event.stopPropagation();updateItem(p.id,{locked:!p.locked});}} title={p.locked?'Unlock item':'Lock item'} style={{width:24,height:24,border:`1px solid ${p.locked?C.blue:C.hair}`,borderRadius:4,background:p.locked?`${C.blue}12`:C.bg,color:p.locked?C.blue:C.muted,cursor:'pointer',display:'grid',placeItems:'center',flexShrink:0}}>
                          {p.locked?<Lock size={10}/>:<Unlock size={10}/>}</button>
                        <button onClick={(event)=>{event.stopPropagation();duplicateItem(p.id);}} title="Duplicate item" style={{width:24,height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.muted,cursor:'pointer',display:'grid',placeItems:'center',flexShrink:0}}>
                          <Copy size={10}/>
                        </button>
                        <button onClick={(event)=>{event.stopPropagation();removeItem(p.id);}} title="Remove item" style={{width:24,height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.muted,cursor:'pointer',display:'grid',placeItems:'center',flexShrink:0}}>
                          <Trash2 size={10}/>
                        </button>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5,marginTop:6}}>
                        <DimInput label="X" value={p.x} min={positionBoundsForItem(p,booth).minX} max={positionBoundsForItem(p,booth).maxX} step={0.05} onChange={v=>updateItemTransform(p.id,{x:v})}/>
                        <DimInput label="Z" value={p.z} min={positionBoundsForItem(p,booth).minZ} max={positionBoundsForItem(p,booth).maxZ} step={0.05} onChange={v=>updateItemTransform(p.id,{z:v})}/>
                        <div>
                          <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:3}}>Yaw</label>
                          <button onClick={(event)=>{event.stopPropagation();rotateItem(p.id,90);}}
                            style={{width:'100%',height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,cursor:'pointer',fontFamily:MONO,fontSize:11,color:C.ink}}>
                            {Number(p.rotationY ?? p.rotation)} deg
                          </button>
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5,marginTop:5}}>
                        <DimInput label="Rot X" value={Number(p.rotationX) || 0} min={-180} max={180} step={15} onChange={v=>updateItemTransform(p.id,{rotationX:v})}/>
                        <DimInput label="Rot Y" value={Number(p.rotationY ?? p.rotation) || 0} min={0} max={345} step={15} onChange={v=>updateItemTransform(p.id,{rotation:v,rotationY:v})}/>
                        <DimInput label="Rot Z" value={Number(p.rotationZ) || 0} min={-180} max={180} step={15} onChange={v=>updateItemTransform(p.id,{rotationZ:v})}/>
                      </div>
                    </div>
                  );})}
                </div>
              )}
              <div style={{padding:'12px 0'}}>
                <MonoLabel>§ Totals</MonoLabel>
                {[
                  {label:'Structural Parts', value:`${structItems.reduce((a,s)=>a+s.qty,0)}`},
                  {label:'Room Material Lines',value:`${roomItems.length}`},
                  {label:'Placed Items',      value:`${totalParts}`},
                  {label:'Structure Estimate',value:formatUsd(structSubtotal)},
                  {label:'Room Estimate',     value:formatUsd(roomSubtotal)},
                  {label:'Placed Estimate',   value:unpricedItems?`${formatUsd(placedSubtotal)} + ${unpricedItems} TBD`:formatUsd(placedSubtotal)},
                  {label:'Fascia Option',     value:booth.fasciaEnabled?formatUsd(fasciaSubtotal):'Off'},
                  {label:'Quote Allowance',   value:formatUsd(quoteAllowance)},
                  {label:'Quote Total',       value:formatUsd(quoteTotal)},
                  {label:'Total Weight',      value:`${(structWeight+roomWeight+totalWeight).toFixed(0)} kg`},
                  {label:'Floor Area',        value:`${floorArea} m²`},
                  {label:'System',            value:booth.system==='maxima'?'Maxima (2 m)':'Octanorm (1 m)'},
                ].map(row=>(
                  <div key={row.label} style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}>
                    <span style={{fontFamily:MONO,fontSize:9.5,color:C.muted}}>{row.label}</span>
                    <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,color:C.ink}}>{row.value}</span>
                  </div>
                ))}
              </div>
              {placedItems.length===0&&rooms.length===0&&(
                <div style={{padding:'20px 0',textAlign:'center',color:C.muted,fontFamily:MONO,fontSize:9.5}}>
                  Click catalog items to add<br/>them to your Bill of Materials
                </div>
              )}
            </div>
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
          <div style={{position:'fixed',inset:0,background:'rgba(24,22,19,0.5)',zIndex:200}} onClick={()=>{ setShowSendDlg(false); setSendConfirmed(false); }}/>
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
        <>
          <div style={{position:'fixed',inset:0,background:'rgba(24,22,19,0.45)',zIndex:200}} onClick={()=>setShowSnapDlg(false)}/>
          <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:C.panel,border:`1px solid ${C.hair}`,borderRadius:8,padding:24,zIndex:201,width:340,boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
            <h3 style={{fontSize:14,fontWeight:700,margin:'0 0 14px',display:'flex',alignItems:'center',gap:8}}><Camera size={15} style={{color:C.blue}}/> Save Snapshot</h3>
            <input id="snapshot-name" name="snapshot-name" value={snapName} onChange={e=>setSnapName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createSnapshot()}
              placeholder="e.g. v2 — After client review"
              autoFocus
              style={{width:'100%',height:36,border:`1px solid ${C.hair}`,borderRadius:5,background:C.bg,fontFamily:UI,fontSize:13,color:C.ink,paddingLeft:10,boxSizing:'border-box',outline:'none',marginBottom:12}}/>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowSnapDlg(false)} style={{flex:1,height:36,background:'none',border:`1px solid ${C.hair}`,borderRadius:5,cursor:'pointer',fontFamily:UI,fontSize:12,color:C.ink}}>Cancel</button>
              <button onClick={createSnapshot} disabled={!snapName.trim()} style={{flex:2,height:36,background:C.blue,border:'none',color:'#fff',borderRadius:5,cursor:snapName.trim()?'pointer':'not-allowed',fontFamily:UI,fontSize:12,fontWeight:700,opacity:snapName.trim()?1:0.5}}>Save Snapshot</button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast&&<Toast msg={toast} onClose={()=>setToast('')}/>}
    </div>
  );
}
