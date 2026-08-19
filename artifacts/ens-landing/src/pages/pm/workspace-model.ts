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
export interface WorkspacePlacedItem { id:string; catalogId:string; name:string; sku:string; qty:number; w:number; d:number; h:number; color:string; weight:number; x:number; z:number; rotation:number; rotationX?:number; rotationY?:number; rotationZ?:number; locked?:boolean; kind:'furniture'|'light'|'structure'|'fascia'|'asset'; shape?:CatItem['shape']; modelUrl?:string; source?:string; }
export interface WorkspaceRoom { id:string; name:string; width:number; depth:number; height:number; x:number; z:number; hasDoor:boolean; hasCeiling:boolean; doorSide:DoorSide; doorWidth:number; doorPosition:DoorPosition; doorSwing:DoorSwing; doorOpen:boolean; wallFinish:RoomWallFinish; floorColor:string; locked:boolean; designImageUrl?:string; designImageName?:string; designOpacity?:number; designWall:DoorSide; designFit:RoomGraphicFit; }
export interface PanelOverride { color?:string; brandText?:string; brandColor?:string; brandScale?:number; designImageUrl?:string; designImageName?:string; designOpacity?:number; }
export interface Note { id:string; text:string; color:string; createdAt:string; }
export interface Snapshot { id:string; name:string; data:WSData; createdAt:string; }
export interface WSData { booth:BoothState; themeIdx:number; wallFinishIdx:number; frameFinishIdx:number; fasciaFinishIdx:number; carpetIdx:number; lightingPreset:LightingPreset; placedItems:WorkspacePlacedItem[]; rooms:WorkspaceRoom[]; notes:Note[]; panelOverrides:Record<string,PanelOverride>; frontSupportPositions:number[]; suppressedDefaultPositions:number[]; }
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
export type FeedbackFilter = 'open' | 'all' | 'resolved';

// ── Catalog ────────────────────────────────────────────────────────
export interface CatItem { id:string; name:string; sku:string; dim:string; inStand:number; icon:ElementType; family?:string; price?:number; stock?:number; lowStockAt?:number; shape?:'round_table'|'rect_table'|'counter'|'shelf'|'wall_shelf'|'cabinet'|'cube'|'chair'|'bar_stool'|'light'|'rail_light'|'box'; modelUrl?:string; furnitureCategory?:FurnitureCategory; }
export type FurnitureCategory = 'all' | 'chairs' | 'stools' | 'seating' | 'tables' | 'storage' | 'shelves' | 'appliances' | 'lighting' | 'decor' | 'parts';

export const SEDEF_FURNITURE_ITEMS: Omit<CatItem,'icon'>[] = [
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
