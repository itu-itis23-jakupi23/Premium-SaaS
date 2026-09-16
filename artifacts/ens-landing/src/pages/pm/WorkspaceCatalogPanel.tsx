import { useCallback, useState } from "react";
import type { DragEvent, MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { Search, ChevronDown, Trash2 } from "lucide-react";
import { C, MONO, UI, CAT_TOTAL, FURNITURE_CATEGORY_ORDER } from "./workspace-constants";
import { CatalogPreview } from "./workspace-ui";
import type { CatItem, FurnitureCategory, WorkspacePlacedItem } from "./workspace-model";
import type { PlacementIssue } from "./workspace-geometry";

// The left "Components" catalog: search, collapsible category groups, furniture
// sub-filters, per-item add/remove/drag, and a placed-items summary. Presentational
// — all state and handlers come from PMWorkspace via props, apart from whether
// the placed-items list is folded away, which is this panel's own affair.

const PLACED_LIST_KEY = 'ens-workspace-placed-open';

/**
 * The half of a catalogue name a designer reads.
 *
 * ENS names every item in both languages - "AHSAP YUVARLAK MASA - WOODEN ROUND
 * TABLE" - which is right for the take-off and far too long for a 240px panel:
 * at forty characters it wrapped to three lines in the name column and pushed
 * the row past 150px, so barely one item was on screen at a time. The English
 * half alone is eighteen characters and fits on one line.
 *
 * Split on " - " only. A bare hyphen is part of a code ("312-S", "100 W
 * 3-COLORED LAMP") and splitting on it would cut a name in the middle of a
 * word. Anything without the separator is already one language and is left
 * alone. The full original is kept on the row's tooltip, because the Turkish
 * half is what appears on a picking list.
 */
export function catalogDisplayName(name: string) {
  const halves = String(name || '').split(' - ');
  const english = halves.length > 1 ? halves[halves.length - 1].trim() : '';
  return english || String(name || '').trim();
}

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
  // Folded state survives a reload, the way the inspector's does - a designer
  // who folded this away does not want it back on every page load.
  const [placedOpen, setPlacedOpen] = useState(() => {
    try { return window.localStorage.getItem(PLACED_LIST_KEY) !== 'closed'; }
    catch { return true; }
  });
  const togglePlaced = useCallback(() => {
    setPlacedOpen(open => {
      const next = !open;
      try { window.localStorage.setItem(PLACED_LIST_KEY, next ? 'open' : 'closed'); } catch { /* private mode */ }
      return next;
    });
  }, []);
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
                <ChevronDown size={11} style={{color:C.muted,transform:isOpen?'rotate(0deg)':'rotate(-90deg)',transition:'transform 100ms cubic-bezier(0.22, 1, 0.36, 1)',flexShrink:0}}/>
              </button>

              {isOpen&&(
                <div style={{padding:'6px 8px 8px',display:'flex',flexDirection:'column',gap:3}}>
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
                        title={`${item.name}${item.family?` · ${item.family}`:''}${canDragToFloor&&!isOut?'\nDrag onto the booth floor or click to add':''}`}
                        style={{position:'relative',opacity:isOut?0.58:1,background:isDragging?`${C.green}12`:isActive?'#f0ecff':placed?`${C.blue}08`:C.bg,border:`1px ${isActive||isDragging?'solid':hasCount?'solid':'dashed'} ${isDragging?C.green:isActive?C.ink:placed?C.blue:C.hair}`,borderRadius:5,padding:'5px 6px',cursor:isOut?'not-allowed':canDragToFloor?'grab':'pointer',display:'grid',gridTemplateColumns:'30px 1fr',gap:7,textAlign:'left',transition:'background-color 90ms ease-out, border-color 90ms ease-out',alignItems:'center'}}>
                        <CatalogPreview item={item} active={isActive} height={18}/>
                        <span style={{minWidth:0,display:'flex',flexDirection:'column',gap:1}}>
                          {/* Name and count on one line. The count used to be a
                              badge pinned to the card's top-right corner, where
                              it sat on top of the name it was counting. */}
                          <span style={{display:'flex',alignItems:'baseline',gap:5,minWidth:0}}>
                            <span style={{flex:1,minWidth:0,fontSize:11,fontWeight:700,color:C.ink,lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {catalogDisplayName(item.name)}
                            </span>
                            {placed&&(
                              <span style={{flexShrink:0,background:C.blue,borderRadius:2,padding:'0 3px',fontFamily:MONO,fontSize:8,color:'#fff',fontWeight:700,lineHeight:'13px'}}>×{placedCount}</span>
                            )}
                            {!placed&&hasCount&&(
                              <span style={{flexShrink:0,fontFamily:MONO,fontSize:8,color:C.blue,fontWeight:700}}>×{item.inStand}</span>
                            )}
                          </span>
                          <span style={{display:'flex',alignItems:'center',gap:4,minWidth:0}}>
                            <span style={{flex:1,minWidth:0,fontFamily:MONO,fontSize:8.5,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                              {item.sku} · {item.dim}
                              {item.price!=null&&<span style={{color:C.green,fontWeight:700}}> · USD {item.price.toLocaleString()}</span>}
                            </span>
                            {/* Only when it is news. "98 available" on all
                                fifty-two rows told a designer nothing. */}
                            {(isOut||isLow)&&(
                              <span style={{flexShrink:0,fontFamily:MONO,fontSize:8,color:isOut?C.orange:'#8a6b20',fontWeight:700}}>{availability}</span>
                            )}
                            {/* Minus only where it can do something. It was
                                rendered disabled on every row that had nothing
                                placed, which is most of them. */}
                            {placed&&(
                              <button type="button" aria-label={`Remove one ${catalogDisplayName(item.name)}`} onClick={(event)=>{event.stopPropagation();onRemoveCatalogItem(item.id);}}
                                style={{flexShrink:0,width:18,height:18,border:`1px solid ${C.hair}`,borderRadius:3,background:C.panel,color:C.ink,cursor:'pointer',fontFamily:MONO,fontSize:11,lineHeight:1,padding:0}}>−</button>
                            )}
                            <button type="button" disabled={isOut} aria-label={`Add ${catalogDisplayName(item.name)}`} onClick={(event)=>{event.stopPropagation();onAddItem(item);}}
                              style={{flexShrink:0,width:18,height:18,border:`1px solid ${isOut?C.hair:C.blue}`,borderRadius:3,background:isOut?C.bg:`${C.blue}12`,color:isOut?C.muted:C.blue,cursor:isOut?'not-allowed':'pointer',fontFamily:MONO,fontSize:11,lineHeight:1,padding:0,opacity:isOut?0.5:1}}>+</button>
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

      {/* Placed items summary. Folds away: a full stand puts twenty-odd rows
          here and pushes the catalogue itself off the bottom of the panel. */}
      {placedItems.length>0&&(
        <div style={{padding:'8px 14px',borderTop:`1px solid ${C.hair}`,background:C.bg,flexShrink:0}}>
          <button
            type="button"
            onClick={togglePlaced}
            aria-expanded={placedOpen}
            title={placedOpen?'Hide the placed items':'Show the placed items'}
            style={{width:'100%',display:'flex',alignItems:'center',gap:6,background:'none',border:'none',
                    padding:0,marginBottom:placedOpen?4:0,cursor:'pointer',fontFamily:MONO,fontSize:9,
                    color:C.muted,letterSpacing:'0.05em'}}>
            <ChevronDown size={11} style={{transform:placedOpen?'rotate(0deg)':'rotate(-90deg)',
                                           transition:'transform 130ms cubic-bezier(0.22, 1, 0.36, 1)',flexShrink:0}}/>
            <span style={{flex:1,textAlign:'left'}}>PLACED IN STAND</span>
            <span style={{color:C.ink,fontWeight:700}}>{placedItems.reduce((sum,p)=>sum+p.qty,0)}</span>
          </button>
          {placedOpen&&<div style={{maxHeight:186,overflowY:'auto'}}>
          {placedItems.map(p=>{
            const issues = placementIssueByItem.get(p.id) || [];
            return (
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
              <div style={{width:8,height:8,borderRadius:2,background:issues.length?C.orange:p.color,flexShrink:0}} title={issues.map(issue=>issue.message).join(', ')}/>
              <span title={p.name} style={{fontFamily:MONO,fontSize:9,flex:1,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{catalogDisplayName(p.name)}</span>
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
          </div>}
        </div>
      )}
    </aside>
  );
}
