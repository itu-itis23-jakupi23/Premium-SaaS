import { Download, Lock, Unlock, Copy, Trash2 } from "lucide-react";
import { C, MONO } from "./workspace-constants";
import { MonoLabel, DimInput, formatUsd } from "./workspace-ui";
import { catalogItemFor, type QuoteTotals, type RoomBomLine, type StructBomLine } from "./workspace-bom";
import { positionBoundsForItem, type PlacementIssue } from "./workspace-geometry";
import type { BoothState, WorkspacePlacedItem, WorkspaceRoom } from "./workspace-model";

// The right-panel "BOM" tab: export actions, the structural / room / placed
// take-offs, per-item transform controls, and the quote totals. Presentational —
// every number arrives computed (see ./workspace-bom) and every mutation is a
// callback into PMWorkspace.

export function WorkspaceBomPanel({
  booth, rooms, placedItems, structItems, roomItems, totals,
  totalParts, totalWeight, floorArea, placementIssueByItem, activePlacedId,
  onExportCsv, onExportChecklist, onSelectRoom, onSelectPlaced,
  onToggleLock, onDuplicate, onRemove, onTransform, onRotate,
}: {
  booth: BoothState;
  rooms: WorkspaceRoom[];
  placedItems: WorkspacePlacedItem[];
  structItems: StructBomLine[];
  roomItems: RoomBomLine[];
  totals: QuoteTotals;
  totalParts: number;
  totalWeight: number;
  floorArea: string;
  placementIssueByItem: Map<string, PlacementIssue[]>;
  activePlacedId: string;
  onExportCsv: () => void;
  onExportChecklist: () => void;
  /** Room BOM line click: focus that room in the Properties tab. */
  onSelectRoom: (roomId: string) => void;
  onSelectPlaced: (id: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onTransform: (id: string, patch: Partial<WorkspacePlacedItem>) => void;
  onRotate: (id: string, delta: number) => void;
}) {
  const {
    structWeight, structSubtotal, roomWeight, roomSubtotal,
    placedSubtotal, unpricedItems, quoteAllowance, quoteTotal,
  } = totals;
  const structPartCount = structItems.reduce((total, line) => total + line.qty, 0);

  const totalRows: { label: string; value: string }[] = [
    { label: 'Structural Parts',     value: `${structPartCount}` },
    { label: 'Room Material Lines',  value: `${roomItems.length}` },
    { label: 'Placed Items',         value: `${totalParts}` },
    { label: 'Structure Estimate',   value: formatUsd(structSubtotal) },
    { label: 'Room Estimate',        value: formatUsd(roomSubtotal) },
    { label: 'Placed Estimate',      value: unpricedItems ? `${formatUsd(placedSubtotal)} + ${unpricedItems} TBD` : formatUsd(placedSubtotal) },
    { label: 'Fascia Option',        value: booth.fasciaEnabled ? formatUsd(totals.fasciaSubtotal) : 'Off' },
    { label: 'Quote Allowance',      value: formatUsd(quoteAllowance) },
    { label: 'Quote Total',          value: formatUsd(quoteTotal) },
    { label: 'Total Weight',         value: `${(structWeight + roomWeight + totalWeight).toFixed(0)} kg` },
    { label: 'Floor Area',           value: `${floorArea} m²` },
    { label: 'System',               value: booth.system === 'maxima' ? 'Maxima (2 m)' : 'Octanorm (1 m)' },
  ];

  return (
    <div style={{flex:1,overflowY:'auto',padding:'0 16px'}}>
      <div style={{padding:'10px 0',borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <div>
          <div style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>BOM Export</div>
          <div style={{fontFamily:MONO,fontSize:8.5,color:C.muted,marginTop:2}}>{structPartCount + totalParts} parts / {roomItems.length} room lines / {formatUsd(quoteTotal)}</div>
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          <button onClick={onExportCsv}
            style={{height:30,border:`1px solid ${C.blue}`,borderRadius:4,background:`${C.blue}10`,color:C.blue,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontFamily:MONO,fontSize:9,fontWeight:700,padding:'0 9px',whiteSpace:'nowrap'}}>
            <Download size={11}/> CSV
          </button>
          <button onClick={onExportChecklist}
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
            <button key={`${item.roomId}-${item.sku}-${index}`} type="button" onClick={()=>onSelectRoom(item.roomId)}
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
            const catalogItem = catalogItemFor(p.catalogId);
            return (
            <div key={p.id} onClick={()=>onSelectPlaced(p.id)} onFocusCapture={()=>onSelectPlaced(p.id)} style={{padding:'7px 0',borderBottom:`1px solid ${issues.length?C.orange:C.hair}28`,background:issues.length?`${C.orange}08`:activePlacedId===p.id?`${C.orange}12`:'transparent',cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:10,height:10,borderRadius:2,background:issues.length?C.orange:p.color,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                  <div style={{fontFamily:MONO,fontSize:8,color:issues.length?C.orange:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{issues.length ? issues.map(issue=>issue.message).join(' / ') : `${p.sku} / ${p.kind} / ${catalogItem?.price ? formatUsd(catalogItem.price) : 'Unpriced'}${p.modelUrl ? ` / ${p.modelUrl}` : ''}`}</div>
                </div>
                <div style={{fontFamily:MONO,fontSize:9,fontWeight:700,color:C.ink,whiteSpace:'nowrap'}}>{catalogItem?.price ? formatUsd(catalogItem.price*p.qty) : 'TBD'}</div>
                <button onClick={(event)=>{event.stopPropagation();onToggleLock(p.id,!p.locked);}} title={p.locked?'Unlock item':'Lock item'} style={{width:24,height:24,border:`1px solid ${p.locked?C.blue:C.hair}`,borderRadius:4,background:p.locked?`${C.blue}12`:C.bg,color:p.locked?C.blue:C.muted,cursor:'pointer',display:'grid',placeItems:'center',flexShrink:0}}>
                  {p.locked?<Lock size={10}/>:<Unlock size={10}/>}</button>
                <button onClick={(event)=>{event.stopPropagation();onDuplicate(p.id);}} title="Duplicate item" style={{width:24,height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.muted,cursor:'pointer',display:'grid',placeItems:'center',flexShrink:0}}>
                  <Copy size={10}/>
                </button>
                <button onClick={(event)=>{event.stopPropagation();onRemove(p.id);}} title="Remove item" style={{width:24,height:24,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,color:C.muted,cursor:'pointer',display:'grid',placeItems:'center',flexShrink:0}}>
                  <Trash2 size={10}/>
                </button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5,marginTop:6}}>
                <DimInput label="X" value={p.x} min={positionBoundsForItem(p,booth).minX} max={positionBoundsForItem(p,booth).maxX} step={0.05} onChange={v=>onTransform(p.id,{x:v})}/>
                <DimInput label="Z" value={p.z} min={positionBoundsForItem(p,booth).minZ} max={positionBoundsForItem(p,booth).maxZ} step={0.05} onChange={v=>onTransform(p.id,{z:v})}/>
                <div>
                  <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:3}}>Yaw</label>
                  <button onClick={(event)=>{event.stopPropagation();onRotate(p.id,90);}}
                    style={{width:'100%',height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,cursor:'pointer',fontFamily:MONO,fontSize:11,color:C.ink}}>
                    {Number(p.rotationY ?? p.rotation)} deg
                  </button>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5,marginTop:5}}>
                <DimInput label="Rot X" value={Number(p.rotationX) || 0} min={-180} max={180} step={15} onChange={v=>onTransform(p.id,{rotationX:v})}/>
                <DimInput label="Rot Y" value={Number(p.rotationY ?? p.rotation) || 0} min={0} max={345} step={15} onChange={v=>onTransform(p.id,{rotation:v,rotationY:v})}/>
                <DimInput label="Rot Z" value={Number(p.rotationZ) || 0} min={-180} max={180} step={15} onChange={v=>onTransform(p.id,{rotationZ:v})}/>
              </div>
            </div>
          );})}
        </div>
      )}

      <div style={{padding:'12px 0'}}>
        <MonoLabel>§ Totals</MonoLabel>
        {totalRows.map(row=>(
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
  );
}
