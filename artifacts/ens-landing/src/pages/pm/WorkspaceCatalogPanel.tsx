import type { DragEvent, MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { Search, ChevronDown, Trash2 } from "lucide-react";
import { C, MONO, UI, CAT_TOTAL, FURNITURE_CATEGORY_ORDER } from "./workspace-constants";
import { CatalogPreview } from "./workspace-ui";
import type { CatItem, FurnitureCategory, WorkspacePlacedItem } from "./workspace-model";
import type { PlacementIssue } from "./workspace-geometry";

// The left "Components" catalog: search, collapsible category groups, furniture
// sub-filters, per-item add/remove/drag, and a placed-items summary. Presentational
// — all state and handlers come from PMWorkspace via props.

export function WorkspaceCatalogPanel({
  visibleCatalog, filteredCatalog, search, onSearch, openCats, onToggleCat,
  activeFurnitureCategory, onFurnitureCategory, furnitureCategoryCounts,
  activeId, draggedCatalogItem, placedItems, placementIssueByItem,
  onBeginDrag, onEndDrag, onAddItem, onRemoveCatalogItem, onRemoveItem,
  catalogDragWasActiveRef,
}: {
  visibleCatalog: Record<string, CatItem[]>;
  filteredCatalog: Record<string, CatItem[]>;
  search: string;
  onSearch: (value: string) => void;
  openCats: Set<string>;
  onToggleCat: (cat: string) => void;
  activeFurnitureCategory: FurnitureCategory;
  onFurnitureCategory: (category: FurnitureCategory) => void;
  furnitureCategoryCounts: Map<FurnitureCategory, number>;
  activeId: string;
  draggedCatalogItem: CatItem | null;
  placedItems: WorkspacePlacedItem[];
  placementIssueByItem: Map<string, PlacementIssue[]>;
  onBeginDrag: (event: DragEvent<HTMLDivElement>, item: CatItem) => void;
  onEndDrag: () => void;
  onAddItem: (item: CatItem) => void;
  onRemoveCatalogItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  catalogDragWasActiveRef: MutableRefObject<boolean>;
}) {
  const { t } = useTranslation();
  return (
    <aside style={{width:240,borderRight:`1px solid ${C.hair}`,background:C.panel,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
      <div style={{padding:'8px 14px',borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.12em',color:C.muted,textTransform:'uppercase'}}>§ Components</span>
        <span style={{fontFamily:MONO,fontSize:9.5,color:C.muted}}>{Object.values(visibleCatalog).reduce((a,b)=>a+b.length,0)} items</span>
      </div>

      <div style={{padding:'8px 10px',borderBottom:`1px solid ${C.hair}`,flexShrink:0}}>
        <div style={{position:'relative'}}>
          <Search size={11} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:C.muted}}/>
          <input id="furniture-search" name="furniture-search" aria-label="Search components" value={search} onChange={e=>onSearch(e.target.value)} placeholder="Search items, SKUs…"
            style={{width:'100%',height:28,paddingLeft:26,paddingRight:32,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:11.5,color:C.ink,outline:'none',boxSizing:'border-box'}}/>
          <span style={{position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',fontFamily:MONO,fontSize:8.5,color:C.muted,border:`1px solid ${C.hair}`,borderRadius:3,padding:'1px 4px',lineHeight:1.2}}>⌘K</span>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {Object.entries(filteredCatalog).map(([cat,items])=>{
          const isOpen = openCats.has(cat);
          return (
            <div key={cat} style={{borderBottom:`1px solid ${C.hair}`}}>
              <button onClick={()=>onToggleCat(cat)}
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
                          <button key={category} type="button" onClick={()=>onFurnitureCategory(category)}
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
                        onDragStart={(event)=>onBeginDrag(event,item)}
                        onDragEnd={onEndDrag}
                        onClick={()=>{
                          if(isOut||catalogDragWasActiveRef.current) return;
                          onAddItem(item);
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
                            <button type="button" disabled={!placed} onClick={(event)=>{event.stopPropagation();onRemoveCatalogItem(item.id);}}
                              style={{width:24,height:22,border:`1px solid ${C.hair}`,borderRadius:4,background:placed?C.panel:C.bg,color:placed?C.ink:C.muted,cursor:placed?'pointer':'not-allowed',fontFamily:MONO,fontSize:13,lineHeight:1,opacity:placed?1:0.45}}>−</button>
                            <span style={{minWidth:24,textAlign:'center',fontFamily:MONO,fontSize:9.5,fontWeight:700,color:C.ink}}>{placedCount}</span>
                            <button type="button" disabled={isOut} onClick={(event)=>{event.stopPropagation();onAddItem(item);}}
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
                onClick={()=>onRemoveItem(p.id)}
                style={{background:'none',border:'none',cursor:'pointer',padding:2,color:C.muted,display:'flex'}}
              >
                <Trash2 size={10}/>
              </button>
            </div>
          );})}
        </div>
      )}
    </aside>
  );
}
