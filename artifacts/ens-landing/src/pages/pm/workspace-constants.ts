import { Square, LayoutTemplate, Box, Lightbulb } from "lucide-react";
import {
  SEDEF_FURNITURE_ITEMS,
  type CatItem,
  type FasciaOption,
  type FurnitureCategory,
  type LightingPreset,
  type RoomTemplateKey,
} from "./workspace-model";

// Static configuration for the booth workspace — palette, finishes, pricing,
// catalog, and room templates. Pure data, split out of PMWorkspace.tsx.

// ── Palette ────────────────────────────────────────────────────────
export const C = {
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
export const MONO = 'var(--app-font-mono)';
export const UI   = 'var(--app-font-samsung)';

export const FURNITURE_CATEGORY_ORDER: FurnitureCategory[] = ['all','chairs','stools','seating','tables','counters','displays','storage','shelves','appliances','lighting','decor','parts'];
export function furnitureCategoryFor(item: Pick<CatItem,'name'|'sku'|'shape'>): FurnitureCategory {
  const text = `${item.name} ${item.sku}`.toLowerCase();
  if (item.shape === 'bar_stool' || text.includes('tabure') || text.includes('bar stool') || text.includes('bar chair')) return 'stools';
  if (item.shape === 'chair' || text.includes('sandalye') || text.includes('chair')) {
    if (text.includes('koltuk') || text.includes('armchair') || text.includes('sofa')) return 'seating';
    return 'chairs';
  }
  if (text.includes('koltuk') || text.includes('sofa') || text.includes('puf') || text.includes('pouffe')) return 'seating';
  if (item.shape === 'round_table' || item.shape === 'rect_table' || text.includes('masa') || text.includes('table')) return 'tables';
  if (item.shape === 'counter' || text.includes('banko') || text.includes('counter')) return 'counters';
  if (item.shape === 'cube' || text.includes('vitrin') || text.includes('showcase') || text.includes('teshir') || text.includes('display')) return 'displays';
  if (item.shape === 'shelf' || item.shape === 'wall_shelf' || text.includes('raf') || text.includes('shelf') || text.includes('brosurluk') || text.includes('brochure')) return 'shelves';
  if (text.includes('buzdolabi') || text.includes('refrigerator') || text.includes('sebil') || text.includes('water fountain') || text.includes('evye') || text.includes('sink')) return 'appliances';
  if (item.shape === 'cabinet' || text.includes('dolap') || text.includes('cabinet') || text.includes('rack')) return 'storage';
  if (item.shape === 'rail_light' || item.shape === 'light' || text.includes('lamba') || text.includes('lamp') || text.includes('spotlight')) return 'lighting';
  if (text.includes('bitki') || text.includes('plant') || text.includes('ciceklik') || text.includes('floral')) return 'decor';
  return 'parts';
}
export const SEDEF_ITEM_PROPS: Record<string,{w:number;d:number;h:number;color:string;weight:number}> = Object.fromEntries(
  SEDEF_FURNITURE_ITEMS.map(item => {
    const [w,d,h] = item.dim.split(' x ').map(Number);
    return [item.id, {w:w || 0.8, d:d || 0.8, h:h || 0.8, color:'#d9d2c5', weight:12}];
  })
) as Record<string,{w:number;d:number;h:number;color:string;weight:number}>;
export const CATALOG: Record<string,CatItem[]> = {
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

export const ITEM_PROPS: Record<string,{w:number;d:number;h:number;color:string;weight:number}> = {
  s1:{w:1.0,d:0.08,h:2.5,color:'#4a90d9',weight:28}, s2:{w:1.0,d:0.05,h:2.5,color:'#7bb8f0',weight:22},
  s3:{w:1.0,d:0.08,h:2.5,color:'#6bb0e8',weight:26}, s4:{w:2.0,d:0.15,h:0.85,color:'#5580c0',weight:18},
  f1:{w:1.0,d:0.15,h:0.3,color:'#8868ee',weight:8},   f2:{w:0.3,d:0.3,h:0.3,color:'#9878f0',weight:5},
  l1:{w:0.15,d:0.15,h:0.3,color:'#d4af37',weight:2},  l2:{w:1.0,d:0.05,h:0.1,color:'#c8a020',weight:1},
  l3:{w:0.4,d:0.3,h:0.5,color:'#b89018',weight:3},
  '417':{w:0.18,d:0.18,h:0.28,color:'#2b3037',weight:2}, '418':{w:0.22,d:0.18,h:0.26,color:'#313740',weight:2.5},
  fascia_light:{w:0.32,d:0.14,h:0.14,color:'#dce3ea',weight:1.8},
  ...SEDEF_ITEM_PROPS,
};

export function catalogItemProps(item:CatItem) {
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

export const ENS_MODEL_URLS: Record<string,string> = {};
export const KNOWN_CATALOG_IDS = new Set(Object.values(CATALOG).flat().map(item => item.id));

export const THEMES  = [{label:'Charcoal',color:'#3b3e44'},{label:'White',color:'#dde0e4'},{label:'Walnut',color:'#7a4a2a'},{label:'Navy',color:'#1a2640'}];
export const WALL_FINISHES = [{label:'White Laminate',color:'#f8fafc'},{label:'Cool Grey',color:'#dfe4ea'},{label:'Warm Ivory',color:'#f3eadc'},{label:'Graphite',color:'#9aa1aa'}];
export const FRAME_FINISHES = [{label:'Anodized',color:'#b8bdc3'},{label:'Black',color:'#3d4249'},{label:'Champagne',color:'#c7b99a'},{label:'White',color:'#e4e7eb'}];
export const FASCIA_FINISHES = [{label:'White',color:'#ffffff'},{label:'Ice Grey',color:'#eef2f7'},{label:'Warm White',color:'#fff7ed'},{label:'Graphite',color:'#d2d7de'}];
export const CARPETS = [{label:'Black',color:'#1a1a1a'},{label:'Bone',color:'#dde0e4'},{label:'Gray',color:'#7a7e84'},{label:'Navy',color:'#1a2640'},{label:'Forest',color:'#1e3a28'},{label:'Terracotta',color:'#5a2316'}];
export const NOTE_COLORS = ['#1d4ed8','#c2410c','#2f7d3a','#7c3aed','#b45309'];
export const CAT_TOTAL: Record<string,number> = { Structure:4, Fascia:2, Furniture:SEDEF_FURNITURE_ITEMS.length, Lighting:3 };
export const FASCIA_OPTIONS: {value:FasciaOption; label:string; price:number; minWidth:number; note:string; boardMm:number}[] = [
  {value:'classic', label:'Standard rail sign', price:1200, minWidth:2, note:'Front and rear fascia integrated into the top rail.', boardMm:110},
  {value:'full', label:'Full length rail sign', price:1800, minWidth:2, note:'Longer rail-integrated fascia with continuous front/rear branding.', boardMm:110},
  {value:'custom', label:'Custom oval fascia', price:2500, minWidth:3, note:'Custom face board for wider stands; text is required.', boardMm:140},
];
export const LIGHTING_PRESETS: {value:LightingPreset; label:string}[] = [
  {value:'neutral', label:'Neutral'},
  {value:'exhibition', label:'Exhibition'},
  {value:'accent', label:'Accent'},
  {value:'spotlight', label:'Spotlight'},
  {value:'ambient', label:'Ambient'},
];
export const STRUCT_UNIT_PRICE: Record<string,number> = { post:95, rail:42, panel:85, fascia:120, foot:28 };
export const ROOM_UNIT_PRICE = { profile:42, panel:85, door:240, floor:35, ceiling:55, graphic:45 } as const;
export const ROOM_TEMPLATES:{value:RoomTemplateKey;label:string;name:string;width:number;depth:number;hasCeiling:boolean}[] = [
  {value:'storage',label:'Storage 2 x 1 m',name:'Storage room',width:2,depth:1,hasCeiling:false},
  {value:'meeting',label:'Meeting 3 x 2 m',name:'Meeting room',width:3,depth:2,hasCeiling:true},
  {value:'utility',label:'Utility 1 x 1 m',name:'Utility room',width:1,depth:1,hasCeiling:true},
];
