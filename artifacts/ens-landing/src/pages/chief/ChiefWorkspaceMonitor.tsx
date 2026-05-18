import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockProjects } from "@/lib/mock-data";
import { Link } from "wouter";
import {
  Activity, Maximize2, Users, Clock, ExternalLink, ChevronDown,
  CheckCircle2, AlertCircle, Circle, RefreshCw, UserCheck, X,
} from "lucide-react";

const C = { bg:'#f3f1ec',panel:'#ffffff',ink:'#181613',hair:'#d8d3c9',blue:'#1d4ed8',orange:'#c2410c',green:'#2f7d3a',muted:'#6b6560',red:'#dc2626' } as const;
const MONO = '"JetBrains Mono","Courier New",monospace';
const UI   = 'Inter,system-ui,sans-serif';

type WStatus = 'live' | 'pending' | 'review' | 'blocked';
const STATUS_CFG: Record<WStatus,{label:string;color:string;dot:string}> = {
  live:    { label:'Live',    color:C.green,  dot:C.green },
  review:  { label:'Review',  color:C.blue,   dot:C.blue },
  pending: { label:'Pending', color:C.orange, dot:C.orange },
  blocked: { label:'Blocked', color:C.red,    dot:C.red },
};
const PM_LIST = ['Sarah M.','Alex K.','Jordan L.','Maya R.','Chris P.'];
const ACTIONS = ['Updating wall finish','Adding furniture','Adjusting lighting','Reviewing BOM','Sending to client','Idle'];

function MiniBooth({ status }: { status:WStatus }) {
  const accent = STATUS_CFG[status].dot;
  return (
    <svg width="100%" height="100%" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet"
      style={{ background:C.bg,display:'block',backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 9px,#d8d3c9 9px,#d8d3c9 10px),repeating-linear-gradient(90deg,transparent,transparent 9px,#d8d3c9 9px,#d8d3c9 10px)' }}>
      <polygon points="40,65 80,80 120,65 80,50" fill={`${accent}18`} stroke={accent} strokeWidth="0.8"/>
      <polygon points="40,65 40,35 80,20 80,50" fill={`${accent}10`} stroke={accent} strokeWidth="0.8"/>
      <polygon points="80,50 80,20 120,35 120,65" fill={`${accent}06`} stroke={accent} strokeWidth="0.8"/>
      <polygon points="40,35 40,30 80,15 80,20" fill={accent} opacity="0.6"/>
      <polygon points="80,20 80,15 120,30 120,35" fill={accent} opacity="0.4"/>
      <line x1="40" y1="65" x2="80" y2="80" stroke={C.orange} strokeWidth="1" strokeDasharray="3 2"/>
      {([[40,65],[40,35],[80,80],[80,20],[120,65],[120,35]] as [number,number][]).map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={1.8} fill={accent}/>
      ))}
    </svg>
  );
}

function StatCard({ label,value,sub,color=C.ink }: { label:string;value:string|number;sub?:string;color?:string }) {
  return (
    <div style={{ background:C.panel,border:`1px solid ${C.hair}`,borderRadius:4,padding:'12px 16px',display:'flex',flexDirection:'column',gap:2 }}>
      <span style={{ fontFamily:MONO,fontSize:9,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase' as const }}>{label}</span>
      <span style={{ fontFamily:MONO,fontSize:22,fontWeight:700,color,lineHeight:1 }}>{value}</span>
      {sub&&<span style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>{sub}</span>}
    </div>
  );
}

// Per-project data enriched with live state
interface WProject {
  id: string; name: string; client: string; system: string;
  status: WStatus; version: string; dims: string;
  pm: string; lastActionMins: number; currentAction: string;
  waitingDays: number; progress: number;
}

function buildProjects(): WProject[] {
  const statuses: WStatus[] = ['live','review','live','pending','blocked','live','review','pending'];
  return mockProjects.map((p, i) => ({
    id: p.id, name: p.name, client: p.client,
    system: p.system ?? 'octanorm',
    status: statuses[i % statuses.length],
    version: `v${2+(i%3)}.${i%5}`,
    dims: ['6×3','8×6','4×4','10×5','6×6'][i%5],
    pm: PM_LIST[i % PM_LIST.length],
    lastActionMins: [1,5,12,35,92,180][i%6],
    currentAction: ACTIONS[i % ACTIONS.length],
    waitingDays: [0,0,2,5,0,8,1,0][i % 8],
    progress: [85,62,40,10,95,30,72,55][i%8],
  }));
}

export default function ChiefWorkspaceMonitor() {
  const [projects,     setProjects]    = useState<WProject[]>(buildProjects);
  const [filter,       setFilter]      = useState<'all'|WStatus>('all');
  const [reassignDlg,  setReassignDlg] = useState<WProject|null>(null);
  const [newPM,        setNewPM]       = useState('');
  const [toast,        setToast]       = useState('');
  const [tick,         setTick]        = useState(0);

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''),3000); };

  // Simulate live presence: tick every 8 seconds, randomly update "lastActionMins" for live projects
  useEffect(() => {
    const t = setInterval(() => {
      setTick(n => n+1);
      setProjects(prev => prev.map(p => {
        if(p.status !== 'live') return p;
        const roll = Math.random();
        return {
          ...p,
          lastActionMins: roll < 0.3 ? 0 : p.lastActionMins,
          currentAction: roll < 0.25 ? ACTIONS[Math.floor(Math.random()*ACTIONS.length)] : p.currentAction,
        };
      }));
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const reassign = () => {
    if(!reassignDlg || !newPM) return;
    setProjects(prev => prev.map(p => p.id===reassignDlg.id ? {...p, pm:newPM} : p));
    showToast(`${reassignDlg.name} reassigned to ${newPM}`);
    setReassignDlg(null); setNewPM('');
  };

  const counts = {
    live:    projects.filter(p=>p.status==='live').length,
    review:  projects.filter(p=>p.status==='review').length,
    pending: projects.filter(p=>p.status==='pending').length,
    blocked: projects.filter(p=>p.status==='blocked').length,
  };
  const bottlenecks = projects.filter(p => p.waitingDays >= 3);
  const filtered    = projects.filter(p => filter==='all' || p.status===filter);

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader title="Workspace Monitor" breadcrumbs={[{label:'Chief',href:'/chief'},{label:'Monitor'}]}>
          <div style={{ display:'flex',alignItems:'center',gap:10,fontFamily:MONO }}>
            <span style={{ fontSize:10,display:'flex',alignItems:'center',gap:6,color:C.green }}>
              <span style={{ width:7,height:7,borderRadius:'50%',background:C.green,display:'inline-block',boxShadow:`0 0 0 ${tick%2===0?4:6}px ${C.green}30` }}/>
              {counts.live} Active Now
            </span>
            <button onClick={() => { setProjects(buildProjects()); showToast('Refreshed all workspaces'); }}
              style={{ background:C.panel,border:`1px solid ${C.hair}`,borderRadius:4,padding:'5px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontFamily:MONO,fontSize:10,color:C.muted }}
              data-testid="button-refresh-monitor">
              <RefreshCw size={11}/> Refresh
            </button>
          </div>
        </PageHeader>

        {/* Stats row */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10 }}>
          <StatCard label="Active Now"  value={counts.live}    sub="In workspace"         color={C.green}  />
          <StatCard label="In Review"   value={counts.review}  sub="Client sign-off"       color={C.blue}   />
          <StatCard label="Pending"     value={counts.pending} sub="Need attention"        color={C.orange} />
          <StatCard label="Blocked"     value={counts.blocked} sub="Action required"       color={C.red}    />
          <StatCard label="Total"       value={projects.length} sub="All workspaces"/>
        </div>

        {/* Bottleneck alerts */}
        {bottlenecks.length > 0 && (
          <div style={{ background:`${C.red}08`,border:`1px solid ${C.red}30`,borderRadius:6,padding:'12px 16px' }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
              <AlertCircle size={14} style={{ color:C.red,flexShrink:0 }}/>
              <span style={{ fontFamily:MONO,fontSize:10,fontWeight:700,color:C.red,letterSpacing:'0.06em',textTransform:'uppercase' }}>
                Bottleneck Alerts — {bottlenecks.length} project{bottlenecks.length>1?'s':''} waiting for client response
              </span>
            </div>
            <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
              {bottlenecks.map(p=>(
                <div key={p.id} style={{ background:C.panel,border:`1px solid ${C.red}30`,borderRadius:4,padding:'7px 12px',display:'flex',alignItems:'center',gap:8 }}>
                  <div style={{ width:6,height:6,borderRadius:'50%',background:C.red,flexShrink:0 }}/>
                  <span style={{ fontFamily:MONO,fontSize:9.5,color:C.ink,fontWeight:600 }}>{p.name}</span>
                  <span style={{ fontFamily:MONO,fontSize:9,color:C.red }}>· {p.waitingDays}d waiting</span>
                  <span style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>PM: {p.pm}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display:'flex',gap:4,background:C.bg,border:`1px solid ${C.hair}`,borderRadius:4,padding:3,width:'fit-content' }}>
          {(['all','live','review','pending','blocked'] as const).map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              style={{ background:filter===f?C.panel:'none',border:filter===f?`1px solid ${C.hair}`:'1px solid transparent',borderRadius:3,padding:'4px 12px',cursor:'pointer',fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:filter===f?C.ink:C.muted,boxShadow:filter===f?'0 1px 3px rgba(0,0,0,0.07)':'none',transition:'all 0.1s' }}>
              {f==='all'?`All · ${projects.length}`:STATUS_CFG[f as WStatus]?`${STATUS_CFG[f as WStatus].label} · ${counts[f as WStatus]}`:''}
            </button>
          ))}
        </div>

        {/* Card grid */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(264px,1fr))',gap:12 }}>
          {filtered.map(project => {
            const sc = STATUS_CFG[project.status];
            const isLive = project.status === 'live';
            const justNow = project.lastActionMins === 0;
            return (
              <div key={project.id}
                style={{ background:C.panel,border:`1px solid ${C.hair}`,borderRadius:4,overflow:'hidden',display:'flex',flexDirection:'column',transition:'border-color 0.15s',fontFamily:UI }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.hair)}>

                {/* Preview */}
                <div style={{ height:100,position:'relative',overflow:'hidden' }}>
                  <MiniBooth status={project.status}/>
                  <span style={{ position:'absolute',top:6,left:6,fontFamily:MONO,fontSize:8.5,background:C.panel,border:`1px solid ${C.hair}`,borderRadius:3,padding:'2px 6px',color:C.muted }}>{project.version}</span>
                  <Link href="/pm/workspace">
                    <button style={{ position:'absolute',top:4,right:4,background:`${C.panel}e0`,border:`1px solid ${C.hair}`,borderRadius:3,width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:C.muted }}>
                      <Maximize2 size={10}/>
                    </button>
                  </Link>
                  {/* Live pulse */}
                  {isLive && (
                    <div style={{ position:'absolute',bottom:6,right:6,display:'flex',alignItems:'center',gap:4,background:`${C.green}14`,borderRadius:3,padding:'2px 6px',border:`1px solid ${C.green}30` }}>
                      <span style={{ width:5,height:5,borderRadius:'50%',background:C.green,display:'inline-block',
                        boxShadow: justNow?`0 0 0 ${tick%2===0?3:5}px ${C.green}25`:'none' }}/>
                      <span style={{ fontFamily:MONO,fontSize:8,color:C.green,fontWeight:700 }}>
                        {justNow?'Editing now':project.lastActionMins<60?`${project.lastActionMins}m ago`:`${Math.floor(project.lastActionMins/60)}h ago`}
                      </span>
                    </div>
                  )}
                  {project.waitingDays >= 3 && (
                    <div style={{ position:'absolute',bottom:6,left:6,display:'flex',alignItems:'center',gap:4,background:`${C.red}14`,borderRadius:3,padding:'2px 6px',border:`1px solid ${C.red}30` }}>
                      <AlertCircle size={8} style={{ color:C.red }}/>
                      <span style={{ fontFamily:MONO,fontSize:8,color:C.red,fontWeight:700 }}>{project.waitingDays}d waiting</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding:'10px 12px',display:'flex',flexDirection:'column',gap:7 }}>
                  <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:6 }}>
                    <span style={{ fontSize:12,fontWeight:700,lineHeight:1.3,color:C.ink }}>{project.name}</span>
                    <span style={{ fontFamily:MONO,fontSize:8.5,padding:'2px 7px',borderRadius:3,flexShrink:0,background:`${sc.dot}14`,color:sc.color,border:`1px solid ${sc.dot}30`,display:'flex',alignItems:'center',gap:4 }}>
                      {project.status==='live'?<span style={{width:5,height:5,borderRadius:'50%',background:sc.dot,display:'inline-block'}}/>:
                       project.status==='review'?<CheckCircle2 size={8}/>:<Circle size={8}/>}
                      {sc.label}
                    </span>
                  </div>

                  {/* Current action */}
                  {isLive && (
                    <div style={{ fontFamily:MONO,fontSize:9,color:C.blue,display:'flex',alignItems:'center',gap:4 }}>
                      <Activity size={9}/>
                      <span style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{project.currentAction}</span>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div>
                    <div style={{ display:'flex',justifyContent:'space-between',fontFamily:MONO,fontSize:8.5,color:C.muted,marginBottom:3 }}>
                      <span>{project.system?.toUpperCase()} · {project.dims} m</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div style={{ height:3,borderRadius:2,background:C.hair,overflow:'hidden' }}>
                      <div style={{ height:'100%',width:`${project.progress}%`,background:sc.dot,borderRadius:2,transition:'width 0.5s ease' }}/>
                    </div>
                  </div>

                  {/* PM + reassign */}
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:6,borderTop:`1px solid ${C.hair}` }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                      <div style={{ width:22,height:22,borderRadius:'50%',background:C.blue,display:'flex',alignItems:'center',justifyContent:'center' }}>
                        <span style={{ fontFamily:MONO,fontSize:7.5,color:'#fff',fontWeight:700 }}>{project.pm.split(' ').map(n=>n[0]).join('')}</span>
                      </div>
                      <span style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>{project.pm}</span>
                    </div>
                    <div style={{ display:'flex',gap:5 }}>
                      <button onClick={()=>{setReassignDlg(project);setNewPM(project.pm);}}
                        style={{ background:`${C.blue}10`,border:`1px solid ${C.blue}25`,borderRadius:3,padding:'4px 8px',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontFamily:MONO,fontSize:8.5,color:C.blue }}>
                        <UserCheck size={9}/> Reassign
                      </button>
                      <Link href="/pm/workspace">
                        <button style={{ background:C.blue,border:'none',color:'#fff',borderRadius:3,padding:'4px 8px',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,fontFamily:UI }}>
                          <ExternalLink size={9}/> Join
                        </button>
                      </Link>
                    </div>
                  </div>

                  <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                    <Users size={9} style={{color:C.muted}}/>
                    <span style={{ fontFamily:MONO,fontSize:9,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{project.client}</span>
                    <Clock size={9} style={{color:C.muted,marginLeft:8}}/>
                    <span style={{ fontFamily:MONO,fontSize:9,color:C.muted }}>{project.lastActionMins<60?`${project.lastActionMins}m ago`:`${Math.floor(project.lastActionMins/60)}h ago`}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend + auto-refresh */}
        <div style={{ display:'flex',alignItems:'center',gap:16,padding:'8px 0',borderTop:`1px solid ${C.hair}` }}>
          {Object.entries(STATUS_CFG).map(([k,cfg])=>(
            <span key={k} style={{ fontFamily:MONO,fontSize:9.5,color:C.muted,display:'flex',alignItems:'center',gap:5 }}>
              <span style={{ width:7,height:7,borderRadius:'50%',background:cfg.dot,display:'inline-block' }}/>{cfg.label}
            </span>
          ))}
          <span style={{ fontFamily:MONO,fontSize:9,color:C.muted,marginLeft:'auto',display:'flex',alignItems:'center',gap:5 }}>
            <span style={{ width:5,height:5,borderRadius:'50%',background:C.green,display:'inline-block' }}/>
            Live — refreshes every 8 s
          </span>
        </div>
      </div>

      {/* Reassign Dialog */}
      {reassignDlg && (
        <>
          <div style={{ position:'fixed',inset:0,background:'rgba(24,22,19,0.4)',zIndex:100 }} onClick={()=>setReassignDlg(null)}/>
          <div style={{ position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:C.panel,border:`1px solid ${C.hair}`,borderRadius:8,padding:24,zIndex:101,width:380,boxShadow:'0 8px 32px rgba(0,0,0,0.12)',fontFamily:UI }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
              <h3 style={{ fontSize:14,fontWeight:700,margin:0 }}>Reassign Project Manager</h3>
              <button onClick={()=>setReassignDlg(null)} style={{ background:'none',border:'none',cursor:'pointer',color:C.muted,display:'flex' }}><X size={14}/></button>
            </div>
            <div style={{ background:C.bg,borderRadius:4,padding:'10px 12px',marginBottom:16 }}>
              <div style={{ fontFamily:MONO,fontSize:9,color:C.muted,marginBottom:2 }}>PROJECT</div>
              <div style={{ fontSize:13,fontWeight:600 }}>{reassignDlg.name}</div>
              <div style={{ fontFamily:MONO,fontSize:9.5,color:C.muted,marginTop:2 }}>{reassignDlg.client}</div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:6 }}>Assign to PM</label>
              <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
                {PM_LIST.map(pm=>(
                  <label key={pm} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:4,border:`1px solid ${newPM===pm?C.blue:C.hair}`,background:newPM===pm?`${C.blue}08`:C.bg,cursor:'pointer' }}
                    onClick={()=>setNewPM(pm)}>
                    <div style={{ width:8,height:8,borderRadius:'50%',border:`2px solid ${newPM===pm?C.blue:C.hair}`,background:newPM===pm?C.blue:'transparent',flexShrink:0,transition:'all 0.1s' }}/>
                    <div style={{ width:28,height:28,borderRadius:'50%',background:C.blue,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                      <span style={{ fontFamily:MONO,fontSize:8,color:'#fff',fontWeight:700 }}>{pm.split(' ').map(n=>n[0]).join('')}</span>
                    </div>
                    <span style={{ fontSize:13,fontWeight:newPM===pm?600:400,color:newPM===pm?C.ink:C.muted }}>{pm}</span>
                    {pm===reassignDlg.pm&&<span style={{ fontFamily:MONO,fontSize:8.5,color:C.muted,marginLeft:'auto' }}>Current</span>}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
              <button onClick={()=>setReassignDlg(null)} style={{ background:'none',border:`1px solid ${C.hair}`,borderRadius:4,padding:'8px 14px',cursor:'pointer',fontFamily:UI,fontSize:12,color:C.ink }}>Cancel</button>
              <button onClick={reassign} disabled={!newPM||newPM===reassignDlg.pm}
                style={{ background:newPM&&newPM!==reassignDlg.pm?C.blue:'#ccc',border:'none',color:'#fff',borderRadius:4,padding:'8px 18px',cursor:newPM&&newPM!==reassignDlg.pm?'pointer':'not-allowed',fontFamily:UI,fontSize:12,fontWeight:700 }}>
                Reassign
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div style={{ position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:C.ink,color:'#fff',fontFamily:UI,fontSize:12,fontWeight:600,padding:'10px 20px',borderRadius:6,zIndex:200,display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 20px rgba(0,0,0,0.3)',whiteSpace:'nowrap' }}>
          <CheckCircle2 size={14} style={{color:'#6ee7b7'}}/>{toast}
        </div>
      )}
    </DashboardLayout>
  );
}
