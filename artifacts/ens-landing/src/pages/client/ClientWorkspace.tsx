import { useState, useEffect } from "react";
import { Booth3D } from "@/components/workspace/Booth3D";
import {
  getCurrentWorkspace,
  type ProjectWorkspace,
  type WorkspaceState,
} from "@/lib/platform-api";
import {
  Lock, ZoomIn, ZoomOut, Maximize2, Send, CheckCircle2, AlertCircle,
  Eye, ChevronDown, Layers, RotateCcw, MessageSquare, Download,
  Pin, X, StickyNote, GitCompare, CheckSquare, Square,
} from "lucide-react";

const C = {
  bg:'#f3f1ec', panel:'#ffffff', ink:'#181613', hair:'#d8d3c9',
  blue:'#1d4ed8', orange:'#c2410c', green:'#2f7d3a', muted:'#6b6560',
} as const;
const MONO = '"SamsungOne","SamsungOne UI","SamsungOneKorean","Samsung Sharp Sans",system-ui,sans-serif';
const UI   = '"SamsungOne","SamsungOne UI","SamsungOneKorean","Samsung Sharp Sans",system-ui,sans-serif';

const CATALOG = [
  { name:'Structure', items:['Solid Wall','Glass Wall','Corner Post','Fascia'] },
  { name:'Furniture', items:['Reception Counter','Bar Stool','Meeting Table','Design Chair'] },
  { name:'Lighting',  items:['Spotlight','LED Strip','Arm Light'] },
];
const THEME_COLORS = ['#3b3e44','#dde0e4','#7a4a2a','#1a2640'];
const CARPET_COLORS = ['#1a1a1a','#dde0e4','#7a7e84','#1a2640','#1e3a28','#5a2316'];
interface Comment { id:number; user:string; initials:string; text:string; time:string; type?:'comment'|'change'|'pin'; }
const INITIAL_COMMENTS: Comment[] = [
  { id:1, user:'Sarah M. (PM)', initials:'PM', text:"I've added the lighting fixtures as requested, and updated the fascia to show the new branding.", time:'2h ago' },
  { id:2, user:'You', initials:'YO', text:'Looks great! Can we move the reception counter slightly to the left?', time:'1h ago', type:'change' },
  { id:3, user:'Sarah M. (PM)', initials:'PM', text:'Done — counter repositioned. Also added extra spotlights over the display area.', time:'45m ago' },
];
const VERSIONS = [
  { label:'v2.4 — Latest (Current)', value:'2.4' },
  { label:'v2.3 — May 12', value:'2.3' },
  { label:'v2.2 — May 10', value:'2.2' },
  { label:'v1.0 — Initial', value:'1.0' },
];
const ELEMENTS = [
  { id:'structure', label:'Structure & Framework' },
  { id:'furniture', label:'Furniture Layout' },
  { id:'branding',  label:'Branding Placement' },
  { id:'lighting',  label:'Lighting Design' },
];

type RightTab = 'thread' | 'approvals' | 'pins';

function MonoLabel({ children }: { children:React.ReactNode }) {
  return <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.1em',color:C.muted,textTransform:'uppercase' as const}}>{children}</span>;
}
function Hairline() { return <div style={{height:1,background:C.hair}}/>; }
function workspaceToBoothConfig(workspace?: WorkspaceState | null) {
  const booth = workspace?.booth;

  return {
    width: booth?.width ?? 8,
    depth: booth?.depth ?? 6,
    height: booth?.height ?? 3,
    system: booth?.system ?? 'maxima',
    companyName: booth?.companyName ?? 'TECHCORP INDUSTRIES',
    primaryColor: THEME_COLORS[workspace?.themeIdx ?? 0] ?? THEME_COLORS[0],
    carpetColor: CARPET_COLORS[workspace?.carpetIdx ?? 0] ?? CARPET_COLORS[0],
    openFront: booth?.openFront ?? true,
    openBack: booth?.openBack ?? false,
    openLeft: booth?.openLeft ?? false,
    openRight: booth?.openRight ?? false,
  };
}

export default function ClientWorkspace() {
  const [workspaceRecord, setWorkspaceRecord] = useState<ProjectWorkspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');
  const [comments,       setComments]      = useState<Comment[]>(INITIAL_COMMENTS);
  const [newComment,     setNewComment]    = useState('');
  const [version,        setVersion]       = useState('2.4');
  const [compareVersion, setCompareVersion]= useState('2.3');
  const [showVersions,   setShowVersions]  = useState(false);
  const [showChangeDlg,  setShowChangeDlg] = useState(false);
  const [changeText,     setChangeText]    = useState('');
  const [approved,       setApproved]      = useState(false);
  const [compareMode,    setCompareMode]   = useState(false);
  const [pinMode,        setPinMode]       = useState(false);
  const [pins,           setPins]          = useState<{id:number;x:number;y:number;text:string;num:number}[]>([]);
  const [pinText,        setPinText]       = useState('');
  const [pendingPin,     setPendingPin]    = useState<{x:number;y:number}|null>(null);
  const [rightTab,       setRightTab]      = useState<RightTab>('thread');
  const [elementStatus,  setElementStatus] = useState<Record<string,'approved'|'pending'|'rejected'>>({
    structure:'approved', furniture:'pending', branding:'approved', lighting:'pending',
  });
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const allApproved = Object.values(elementStatus).every(s => s === 'approved');
  const versionOptions = workspaceRecord?.versions.map(v => ({
    label: `v${v.versionNumber} - ${v.title}`,
    value: String(v.versionNumber),
  })) ?? VERSIONS;
  const selectedWorkspace = workspaceRecord?.versions.find(v => String(v.versionNumber) === version)?.workspace ?? workspaceRecord?.workspace;
  const comparedWorkspace = workspaceRecord?.versions.find(v => String(v.versionNumber) === compareVersion)?.workspace ?? selectedWorkspace;
  const selectedBoothConfig = workspaceToBoothConfig(selectedWorkspace);
  const comparedBoothConfig = workspaceToBoothConfig(comparedWorkspace);
  const selectedBooth = selectedWorkspace?.booth;
  const projectTitle = workspaceRecord?.project.name ?? 'Loading workspace';

  useEffect(() => {
    if(allApproved && !approved) { setApproved(true); showToast('All elements approved — design confirmed!'); }
  }, [allApproved]);

  useEffect(() => {
    let isMounted = true;

    getCurrentWorkspace()
      .then(record => {
        if(!isMounted) return;
        setWorkspaceRecord(record);
        const current = String(record.currentVersion?.versionNumber ?? record.design.currentVersionNumber);
        setVersion(current);
        setCompareVersion(String(record.versions[1]?.versionNumber ?? record.versions[0]?.versionNumber ?? current));
        setWorkspaceError('');
      })
      .catch(err => {
        if(!isMounted) return;
        setWorkspaceError(err instanceof Error ? err.message : 'Could not load workspace');
      });

    return () => { isMounted = false; };
  }, []);

  const addComment = () => {
    if(!newComment.trim()) return;
    setComments(c => [...c,{id:Date.now(),user:'You',initials:'YO',text:newComment.trim(),time:'Just now'}]);
    setNewComment('');
  };
  const submitChange = () => {
    if(!changeText.trim()) return;
    setComments(c => [...c,{id:Date.now(),user:'You',initials:'YO',text:`[Change Request] ${changeText.trim()}`,time:'Just now',type:'change'}]);
    setChangeText(''); setShowChangeDlg(false);
    showToast('Change request sent to PM');
  };
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if(!pinMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPendingPin({ x:((e.clientX-rect.left)/rect.width*100), y:((e.clientY-rect.top)/rect.height*100) });
  };
  const addPin = () => {
    if(!pendingPin||!pinText.trim()) return;
    const num = pins.length+1;
    setPins(prev => [...prev,{id:Date.now(),...pendingPin,text:pinText.trim(),num}]);
    setComments(c => [...c,{id:Date.now(),user:'You',initials:'YO',text:`📍 Pin #${num}: ${pinText.trim()}`,time:'Just now',type:'pin'}]);
    setPinText(''); setPendingPin(null); setPinMode(false);
    showToast(`Pin #${num} added`);
  };
  const approveElement = (id:string) => {
    setElementStatus(p => ({...p,[id]:'approved'}));
    showToast(`${ELEMENTS.find(e=>e.id===id)?.label} approved`);
  };
  const rejectElement = (id:string) => {
    setElementStatus(p => ({...p,[id]:'rejected'}));
    showToast('Feedback sent to PM');
  };
  const simulateDownload = () => {
    showToast('Rendering image… Download started');
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:C.bg,color:C.ink,fontFamily:UI,overflow:'hidden',userSelect:'none'}}>
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header style={{height:46,borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',background:C.panel,flexShrink:0,gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
          <Layers size={14} style={{color:C.blue,flexShrink:0}}/>
          <span style={{fontSize:13,fontWeight:700,letterSpacing:'-0.01em',whiteSpace:'nowrap'}}>{projectTitle}</span>
          <div style={{width:1,height:18,background:C.hair,flexShrink:0}}/>
          <span style={{fontFamily:MONO,fontSize:9.5,display:'flex',alignItems:'center',gap:5,background:`${C.orange}12`,color:C.orange,border:`1px solid ${C.orange}30`,borderRadius:4,padding:'3px 9px',flexShrink:0}}>
            <Eye size={10}/> VIEW ONLY
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          {/* Version dropdown */}
          <div style={{position:'relative'}}>
            <button onClick={()=>setShowVersions(s=>!s)} style={{background:'none',border:`1px solid ${C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:11.5,fontFamily:MONO,color:C.ink}}>
              v{version} <ChevronDown size={11}/>
            </button>
            {showVersions&&(
              <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,background:C.panel,border:`1px solid ${C.hair}`,borderRadius:4,zIndex:50,minWidth:180,boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
                {versionOptions.map(v=>(
                  <button key={v.value} onClick={()=>{setVersion(v.value);setShowVersions(false);}}
                    style={{display:'block',width:'100%',textAlign:'left',padding:'8px 12px',fontFamily:MONO,fontSize:11,color:version===v.value?C.blue:C.ink,background:version===v.value?`${C.blue}08`:'none',border:'none',cursor:'pointer'}}>
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Compare */}
          <button onClick={()=>setCompareMode(m=>!m)}
            style={{background:compareMode?C.blue:'none',border:`1px solid ${compareMode?C.blue:C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:compareMode?'#fff':C.muted}}>
            <GitCompare size={12}/> Compare
          </button>
          {/* Pin */}
          <button onClick={()=>setPinMode(m=>!m)} title="Click canvas to add a pin annotation"
            style={{background:pinMode?`${C.orange}14`:'none',border:`1px solid ${pinMode?C.orange:C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:pinMode?C.orange:C.muted}}>
            <Pin size={12}/> {pinMode?'Pinning…':'Add Pin'}
          </button>
          {/* Download */}
          <button onClick={simulateDownload} style={{background:'none',border:`1px solid ${C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:C.muted}}>
            <Download size={12}/> Download
          </button>
          {/* Request Changes */}
          <button onClick={()=>setShowChangeDlg(true)} style={{background:'none',border:`1px solid ${C.orange}40`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:C.orange}}>
            <AlertCircle size={12}/> Request Changes
          </button>
          {/* Approve */}
          {approved?(
            <span style={{fontFamily:MONO,fontSize:10.5,color:C.green,display:'flex',alignItems:'center',gap:5,padding:'5px 10px',border:`1px solid ${C.green}40`,borderRadius:4,background:`${C.green}08`}}>
              <CheckCircle2 size={12}/> Approved
            </span>
          ):(
            <button onClick={()=>{setApproved(true);showToast('Design approved — PM notified!');}}
              style={{background:C.green,border:'none',color:'#fff',borderRadius:4,padding:'6px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,fontFamily:UI}}>
              <CheckCircle2 size={12}/> Approve Design
            </button>
          )}
        </div>
      </header>
      {showVersions&&<div style={{position:'fixed',inset:0,zIndex:40}} onClick={()=>setShowVersions(false)}/>}

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* ── Left — Locked Asset Library ─────────────────────── */}
        <aside style={{width:220,borderRight:`1px solid ${C.hair}`,background:C.panel,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
          <div style={{padding:'8px 14px',borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
            <Lock size={10} style={{color:C.muted}}/>
            <MonoLabel>§ Asset Library</MonoLabel>
            <span style={{fontFamily:MONO,fontSize:9.5,color:C.muted,marginLeft:'auto'}}>Locked</span>
          </div>
          <div style={{flex:1,overflowY:'auto'}}>
            {CATALOG.map(cat=>(
              <div key={cat.name} style={{borderBottom:`1px solid ${C.hair}`}}>
                <div style={{padding:'7px 14px'}}>
                  <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:C.muted}}>{cat.name}</span>
                </div>
                <div style={{padding:'4px 10px 10px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                  {cat.items.map(item=>(
                    <div key={item} style={{position:'relative',background:C.bg,border:`1px dashed ${C.hair}`,borderRadius:4,padding:'8px 6px 6px',display:'flex',flexDirection:'column',alignItems:'center',gap:3,opacity:0.55}}>
                      <div style={{width:16,height:16,borderRadius:3,background:C.hair}}/>
                      <span style={{fontSize:9.5,fontWeight:500,color:C.muted,textAlign:'center',lineHeight:1.2}}>{item}</span>
                      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:0,borderRadius:4,background:`${C.panel}cc`}}
                        onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='0')}>
                        <Lock size={11} style={{color:C.muted}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{padding:'10px 14px',borderTop:`1px solid ${C.hair}`,background:C.bg}}>
            <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted,lineHeight:1.5}}>Design is in Review mode. Editing restricted to your PM.</span>
          </div>
        </aside>

        {/* ── Center — Canvas ─────────────────────────────────── */}
        <main style={{flex:1,position:'relative',overflow:'hidden',backgroundColor:C.bg,backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px)'}}>

          {compareMode ? (
            /* Split compare view */
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',height:'100%',position:'absolute',inset:0,gap:0}}>
              <div style={{position:'relative',borderRight:`2px solid ${C.blue}`}}>
                <Booth3D config={selectedBoothConfig}/>
                <div style={{position:'absolute',top:8,left:8,fontFamily:MONO,fontSize:9.5,background:C.blue,color:'#fff',borderRadius:4,padding:'4px 9px'}}>v{version} (Current)</div>
              </div>
              <div style={{position:'relative'}}>
                <Booth3D config={comparedBoothConfig}/>
                <div style={{position:'absolute',top:8,left:8,fontFamily:MONO,fontSize:9.5,background:C.muted,color:'#fff',borderRadius:4,padding:'4px 9px'}}>v{compareVersion} (Previous)</div>
              </div>
            </div>
          ) : (
            /* Normal view */
            <div style={{position:'absolute',inset:0,cursor:pinMode?'crosshair':'default'}} onClick={handleCanvasClick}>
              <Booth3D config={selectedBoothConfig}/>

              {/* Annotation pins */}
              {pins.map(pin=>(
                <div key={pin.id} style={{position:'absolute',left:`${pin.x}%`,top:`${pin.y}%`,transform:'translate(-50%,-50%)',zIndex:20,pointerEvents:'auto'}}>
                  <div title={pin.text} style={{width:22,height:22,borderRadius:'50%',background:C.orange,border:'2px solid #fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
                    <span style={{fontFamily:MONO,fontSize:9,color:'#fff',fontWeight:700}}>{pin.num}</span>
                  </div>
                </div>
              ))}

              {/* Pending pin target */}
              {pendingPin&&(
                <div style={{position:'absolute',left:`${pendingPin.x}%`,top:`${pendingPin.y}%`,transform:'translate(-50%,-100%)',zIndex:30,background:C.panel,border:`1px solid ${C.hair}`,borderRadius:6,padding:10,boxShadow:'0 4px 20px rgba(0,0,0,0.12)',minWidth:220}}>
                  <p style={{fontFamily:MONO,fontSize:9.5,color:C.muted,marginBottom:6}}>Add annotation at this point:</p>
                  <div style={{display:'flex',gap:6}}>
                    <input value={pinText} onChange={e=>setPinText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPin()}
                      placeholder="Describe the feedback…"
                      style={{flex:1,height:28,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:11.5,color:C.ink,paddingLeft:7,outline:'none',boxSizing:'border-box'}}
                      autoFocus/>
                    <button onClick={addPin} style={{background:C.orange,border:'none',color:'#fff',borderRadius:4,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                      <Pin size={12}/>
                    </button>
                    <button onClick={()=>{setPendingPin(null);setPinText('');}} style={{background:'none',border:`1px solid ${C.hair}`,borderRadius:4,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:C.muted,flexShrink:0}}>
                      <X size={12}/>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Top badges */}
          <div style={{position:'absolute',top:12,left:12,display:'flex',gap:6,zIndex:10,pointerEvents:'none'}}>
            {[{text:`${selectedBooth?.system === 'maxima' ? 'MAXIMA' : 'OCTANORM'} SYSTEM`,color:C.muted},{text:`${selectedBoothConfig.width} x ${selectedBoothConfig.depth} M`,color:C.muted}].map(b=>(
              <span key={b.text} style={{fontFamily:MONO,fontSize:9.5,background:C.panel,border:`1px solid ${C.hair}`,borderRadius:4,padding:'4px 9px',color:b.color}}>{b.text}</span>
            ))}
            {pinMode&&<span style={{fontFamily:MONO,fontSize:9.5,background:`${C.orange}14`,border:`1px solid ${C.orange}30`,borderRadius:4,padding:'4px 9px',color:C.orange,pointerEvents:'none',animation:'pulse 1.5s infinite'}}>◉ CLICK CANVAS TO PIN</span>}
          </div>

          {/* View controls */}
          <div style={{position:'absolute',bottom:38,left:'50%',transform:'translateX(-50%)',display:'flex',background:C.panel,border:`1px solid ${C.hair}`,borderRadius:20,overflow:'hidden',zIndex:10,padding:'2px 4px',gap:2}}>
            {[RotateCcw,ZoomIn,ZoomOut,Maximize2].map((Icon,i)=>(
              <button key={i} style={{background:'none',border:'none',cursor:'pointer',padding:'5px 9px',color:C.muted,borderRight:i<3?`1px solid ${C.hair}`:'none',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon size={13}/>
              </button>
            ))}
          </div>

          {/* VIEW ONLY watermark */}
          <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%) rotate(-25deg)',fontFamily:MONO,fontSize:64,fontWeight:900,color:C.ink,opacity:0.025,letterSpacing:'0.05em',pointerEvents:'none',zIndex:5,whiteSpace:'nowrap'}}>
            VIEW ONLY
          </div>

          {/* Bottom info bar */}
          <div style={{position:'absolute',bottom:0,left:0,right:0,height:32,background:C.panel,borderTop:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',zIndex:10}}>
            <div style={{display:'flex',alignItems:'center',gap:0}}>
              {[{text:selectedBooth?.system === 'maxima' ? 'Maxima Premium' : 'Octanorm',style:{fontWeight:700}},{text:'|',style:{color:C.hair,margin:'0 8px'}},{text:selectedBooth?.openFront?'OPEN SIDE - FRONT':'REVIEW MODE',style:{color:selectedBooth?.openFront?C.orange:C.muted}},{text:'|',style:{color:C.hair,margin:'0 8px'}},{text:`${selectedBoothConfig.width.toFixed(1)} x ${selectedBoothConfig.depth.toFixed(1)} m`},{text:`H ${selectedBoothConfig.height.toFixed(2)} m`,style:{marginLeft:10}}].map((s,i)=>(
                <span key={i} style={{fontFamily:MONO,fontSize:9.5,color:C.ink,letterSpacing:'0.04em',...s.style}}>{s.text}</span>
              ))}
            </div>
            <span style={{fontFamily:MONO,fontSize:9,color:workspaceError?C.orange:C.muted}}>v{version} - {workspaceError || (compareMode?'COMPARE MODE':'READ-ONLY')} - PERSPECTIVE VIEW</span>
          </div>
        </main>

        {/* ── Right — Tabs ─────────────────────────────────────── */}
        <aside style={{width:306,borderLeft:`1px solid ${C.hair}`,background:C.panel,display:'flex',flexDirection:'column',flexShrink:0}}>
          {/* Tab bar */}
          <div style={{display:'flex',borderBottom:`1px solid ${C.hair}`,flexShrink:0}}>
            {([['thread','Thread',MessageSquare],['approvals','Approvals',CheckSquare],['pins','Pins',Pin]] as const).map(([k,label,Icon])=>(
              <button key={k} onClick={()=>setRightTab(k)}
                style={{flex:1,background:rightTab===k?C.panel:'transparent',border:'none',borderBottom:rightTab===k?`2px solid ${C.blue}`:'2px solid transparent',padding:'8px 4px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.08em',color:rightTab===k?C.blue:C.muted,textTransform:'uppercase',position:'relative'}}>
                <Icon size={10}/> {label}
                {k==='approvals'&&Object.values(elementStatus).filter(s=>s==='pending').length>0&&(
                  <span style={{position:'absolute',top:4,right:6,width:7,height:7,borderRadius:'50%',background:C.orange}}/>
                )}
              </button>
            ))}
          </div>

          {/* Thread tab */}
          {rightTab==='thread'&&(<>
            <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
              <MonoLabel>§ Review Thread</MonoLabel>
              <span style={{fontFamily:MONO,fontSize:9.5,color:C.muted,marginLeft:'auto'}}>{comments.length} notes</span>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
              {comments.map(comment=>{
                const isMe=comment.user==='You';
                return (<div key={comment.id} style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:4}}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    {!isMe&&<div style={{width:20,height:20,borderRadius:'50%',background:C.blue,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontFamily:MONO,fontSize:7.5,color:'#fff',fontWeight:700}}>{comment.initials}</span></div>}
                    <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{comment.user}</span>
                    {isMe&&<div style={{width:20,height:20,borderRadius:'50%',background:C.hair,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontFamily:MONO,fontSize:7.5,color:C.ink,fontWeight:700}}>YO</span></div>}
                  </div>
                  <div style={{maxWidth:'88%',padding:'8px 11px',borderRadius:6,fontSize:12,lineHeight:1.5,
                    background:comment.type==='change'?`${C.orange}10`:isMe?C.blue:C.bg,
                    color:comment.type==='change'?C.orange:isMe?'#fff':C.ink,
                    border:comment.type==='change'?`1px solid ${C.orange}30`:isMe?'none':`1px solid ${C.hair}`}}>
                    {comment.text}
                  </div>
                  <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted}}>{comment.time}</span>
                </div>);
              })}
            </div>
            <div style={{padding:'10px 12px',borderTop:`1px solid ${C.hair}`,display:'flex',gap:6,background:C.bg,flexShrink:0}}>
              <input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addComment()}
                placeholder="Add a comment…"
                style={{flex:1,height:34,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,fontFamily:UI,fontSize:12,color:C.ink,paddingLeft:10,outline:'none',boxSizing:'border-box'}}/>
              <button onClick={addComment} style={{background:C.blue,border:'none',color:'#fff',borderRadius:4,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}><Send size={13}/></button>
            </div>
            <Hairline/>
            <div style={{padding:'12px 16px',flexShrink:0}}>
              <MonoLabel>§ Project Info</MonoLabel>
              <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:8}}>
                {[['System',selectedBooth?.system === 'maxima' ? 'Maxima (2 m module)' : 'Octanorm (1 m module)'],['Floor Area',`${(selectedBoothConfig.width * selectedBoothConfig.depth).toFixed(1)} m²`],['Dimensions',`${selectedBoothConfig.width} x ${selectedBoothConfig.depth} x ${selectedBoothConfig.height} m`],['Approval',approved?'Approved':'Awaiting']].map(([l,v])=>(
                  <div key={l}><span style={{fontFamily:MONO,fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em',display:'block'}}>{l}</span>
                    <span style={{fontSize:12,fontWeight:600,fontFamily:MONO,color:l==='Approval'?approved?C.green:C.orange:'inherit'}}>{v}</span></div>
                ))}
              </div>
            </div>
          </>)}

          {/* Approvals tab */}
          {rightTab==='approvals'&&(
            <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>
              <div style={{fontFamily:MONO,fontSize:9.5,color:C.muted,marginBottom:12}}>ELEMENT-BY-ELEMENT APPROVAL</div>
              {ELEMENTS.map(el=>{
                const st = elementStatus[el.id];
                const stColor = st==='approved'?C.green:st==='rejected'?'#dc2626':C.orange;
                return (<div key={el.id} style={{padding:'12px',borderRadius:6,border:`1px solid ${C.hair}`,marginBottom:8,background:st==='approved'?`${C.green}06`:st==='rejected'?'rgba(220,38,38,0.04)':'transparent'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:6,marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.ink}}>{el.label}</span>
                    <span style={{fontFamily:MONO,fontSize:9,fontWeight:700,color:stColor,background:`${stColor}15`,border:`1px solid ${stColor}30`,borderRadius:3,padding:'2px 7px',textTransform:'uppercase',letterSpacing:'0.04em'}}>{st}</span>
                  </div>
                  {st==='pending'&&(
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>approveElement(el.id)} style={{flex:1,background:`${C.green}12`,border:`1px solid ${C.green}30`,borderRadius:4,padding:'5px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontSize:11,fontWeight:600,color:C.green}}>
                        <CheckCircle2 size={11}/> Approve
                      </button>
                      <button onClick={()=>rejectElement(el.id)} style={{flex:1,background:'rgba(220,38,38,0.06)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:4,padding:'5px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontSize:11,fontWeight:600,color:'#dc2626'}}>
                        <X size={11}/> Request Fix
                      </button>
                    </div>
                  )}
                  {st!=='pending'&&(
                    <button onClick={()=>setElementStatus(p=>({...p,[el.id]:'pending'}))} style={{width:'100%',background:'none',border:`1px dashed ${C.hair}`,borderRadius:4,padding:'4px',cursor:'pointer',fontSize:10,fontFamily:MONO,color:C.muted}}>Reset</button>
                  )}
                </div>);
              })}
              <div style={{padding:'12px',borderRadius:6,background:allApproved?`${C.green}08`:`${C.orange}06`,border:`1px solid ${allApproved?C.green:C.orange}30`,marginTop:4}}>
                <div style={{fontFamily:MONO,fontSize:9.5,color:allApproved?C.green:C.orange,fontWeight:700,marginBottom:4}}>
                  {allApproved?'✓ All Elements Approved':'Pending Approval'}
                </div>
                <div style={{fontFamily:MONO,fontSize:9,color:C.muted}}>
                  {Object.values(elementStatus).filter(s=>s==='approved').length}/{ELEMENTS.length} elements approved
                </div>
              </div>
            </div>
          )}

          {/* Pins tab */}
          {rightTab==='pins'&&(
            <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div style={{fontFamily:MONO,fontSize:9.5,color:C.muted}}>CANVAS ANNOTATIONS</div>
                <button onClick={()=>setPinMode(m=>!m)}
                  style={{background:pinMode?`${C.orange}14`:'none',border:`1px solid ${pinMode?C.orange:C.hair}`,borderRadius:4,padding:'4px 9px',cursor:'pointer',fontSize:10,fontFamily:MONO,fontWeight:700,color:pinMode?C.orange:C.muted}}>
                  {pinMode?'◉ Placing…':'+ Add Pin'}
                </button>
              </div>
              {pins.length===0&&(
                <div style={{textAlign:'center',padding:'30px 0',color:C.muted,fontFamily:MONO,fontSize:9.5}}>
                  <Pin size={24} style={{margin:'0 auto 10px',opacity:0.3}}/>
                  No pins yet.<br/>Click "Add Pin" then click on<br/>the canvas to place a pin.
                </div>
              )}
              {pins.map(pin=>(
                <div key={pin.id} style={{display:'flex',gap:10,padding:'10px',borderRadius:5,border:`1px solid ${C.hair}`,marginBottom:7,background:C.bg}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:C.orange,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontFamily:MONO,fontSize:9,color:'#fff',fontWeight:700}}>{pin.num}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,color:C.ink,lineHeight:1.4}}>{pin.text}</p>
                    <p style={{fontFamily:MONO,fontSize:8.5,color:C.muted,marginTop:3}}>{pin.x.toFixed(0)}% × {pin.y.toFixed(0)}%</p>
                  </div>
                  <button onClick={()=>setPins(p=>p.filter(pi=>pi.id!==pin.id))} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,padding:2,display:'flex',alignItems:'flex-start'}}><X size={11}/></button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ── Status Bar ────────────────────────────────────────────── */}
      <footer style={{height:26,background:'#1a1815',borderTop:'1px solid #111',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:3}}>
          <span style={{fontFamily:MONO,fontSize:9.5,color:'#6a5a40',display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'#6a5a40',display:'inline-block'}}/>View-Only
          </span>
          {[workspaceRecord?.project.name ?? 'Workspace',`${selectedBooth?.system === 'maxima' ? 'Maxima' : 'Octanorm'} System`,`v${version}`,`${pins.length} pins`,`Floor ${(selectedBoothConfig.width * selectedBoothConfig.depth).toFixed(1)} m²`].map((s,i)=>(
            <span key={i} style={{fontFamily:MONO,fontSize:9.5,color:'#5a5048',marginLeft:4}}>· {s}</span>
          ))}
        </div>
        <span style={{fontFamily:MONO,fontSize:9.5,color:'#5a5048'}}>Editing restricted · Contact your PM</span>
      </footer>

      {/* ── Request Changes Dialog ───────────────────────────────── */}
      {showChangeDlg&&(
        <>
          <div style={{position:'fixed',inset:0,background:'rgba(24,22,19,0.4)',zIndex:100}} onClick={()=>setShowChangeDlg(false)}/>
          <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:C.panel,border:`1px solid ${C.hair}`,borderRadius:6,padding:24,zIndex:101,width:420,boxShadow:'0 8px 32px rgba(0,0,0,0.12)'}}>
            <h3 style={{fontSize:15,fontWeight:700,marginBottom:4,marginTop:0}}>Request Design Changes</h3>
            <p style={{fontFamily:MONO,fontSize:10,color:C.muted,marginBottom:14}}>Your feedback goes directly to your Project Manager.</p>
            <textarea value={changeText} onChange={e=>setChangeText(e.target.value)} placeholder="Describe the changes you'd like to see…" rows={5}
              style={{width:'100%',border:`1px solid ${C.hair}`,borderRadius:4,padding:10,fontFamily:UI,fontSize:13,color:C.ink,background:C.bg,resize:'vertical',outline:'none',boxSizing:'border-box',lineHeight:1.5}}/>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
              <button onClick={()=>setShowChangeDlg(false)} style={{background:'none',border:`1px solid ${C.hair}`,borderRadius:4,padding:'7px 14px',cursor:'pointer',fontFamily:UI,fontSize:12,color:C.ink}}>Cancel</button>
              <button onClick={submitChange} style={{background:C.blue,border:'none',color:'#fff',borderRadius:4,padding:'7px 16px',cursor:'pointer',fontFamily:UI,fontSize:12,fontWeight:600}}>Submit Request</button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast&&(
        <div style={{position:'fixed',bottom:48,left:'50%',transform:'translateX(-50%)',background:C.ink,color:'#fff',fontFamily:UI,fontSize:12,fontWeight:600,padding:'10px 20px',borderRadius:6,zIndex:1000,display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 20px rgba(0,0,0,0.3)',whiteSpace:'nowrap'}}>
          <CheckCircle2 size={14} style={{color:'#6ee7b7'}}/>{toast}
        </div>
      )}
    </div>
  );
}
