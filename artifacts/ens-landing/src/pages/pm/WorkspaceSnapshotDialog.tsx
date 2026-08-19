import { Camera } from "lucide-react";
import { C, UI } from "./workspace-constants";

// Modal for naming and saving a workspace snapshot (version). Self-contained,
// driven by props, split out of PMWorkspace.tsx.

export function WorkspaceSnapshotDialog({
  name, onName, onSave, onClose,
}: {
  name: string;
  onName: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div aria-hidden="true" style={{position:'fixed',inset:0,background:'rgba(24,22,19,0.45)',zIndex:200}} onClick={onClose}/>
      <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:C.panel,border:`1px solid ${C.hair}`,borderRadius:8,padding:24,zIndex:201,width:340,boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
        <h3 style={{fontSize:14,fontWeight:700,margin:'0 0 14px',display:'flex',alignItems:'center',gap:8}}><Camera size={15} style={{color:C.blue}}/> Save Snapshot</h3>
        <input id="snapshot-name" name="snapshot-name" aria-label="Snapshot name" value={name} onChange={e=>onName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onSave()}
          placeholder="e.g. v2 — After client review"
          autoFocus
          style={{width:'100%',height:36,border:`1px solid ${C.hair}`,borderRadius:5,background:C.bg,fontFamily:UI,fontSize:13,color:C.ink,paddingLeft:10,boxSizing:'border-box',outline:'none',marginBottom:12}}/>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{flex:1,height:36,background:'none',border:`1px solid ${C.hair}`,borderRadius:5,cursor:'pointer',fontFamily:UI,fontSize:12,color:C.ink}}>Cancel</button>
          <button onClick={onSave} disabled={!name.trim()} style={{flex:2,height:36,background:C.blue,border:'none',color:'#fff',borderRadius:5,cursor:name.trim()?'pointer':'not-allowed',fontFamily:UI,fontSize:12,fontWeight:700,opacity:name.trim()?1:0.5}}>Save Snapshot</button>
        </div>
      </div>
    </>
  );
}
