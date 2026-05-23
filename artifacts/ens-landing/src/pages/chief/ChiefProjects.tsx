import { useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockProjects } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  Search, Filter, LayoutGrid, List, Layers, ChevronRight, ChevronLeft,
  Calendar, User, AlertCircle, CheckCircle2, Clock, Plus, X,
} from "lucide-react";

// ── Pipeline stages ────────────────────────────────────────────────
type Stage = 'intake' | 'design' | 'review' | 'production' | 'closed';
const STAGES: { id: Stage; label: string; color: string; bg: string }[] = [
  { id:'intake',     label:'Intake',     color:'#6b7280', bg:'rgba(107,114,128,0.08)' },
  { id:'design',     label:'Design',     color:'#1d4ed8', bg:'rgba(29,78,216,0.08)' },
  { id:'review',     label:'Review',     color:'#d97706', bg:'rgba(217,119,6,0.08)' },
  { id:'production', label:'Production', color:'#7c3aed', bg:'rgba(124,58,237,0.08)' },
  { id:'closed',     label:'Closed',     color:'#2f7d3a', bg:'rgba(47,125,58,0.08)' },
];
const STAGE_ORDER: Stage[] = ['intake','design','review','production','closed'];

interface KanbanProject {
  id: string; name: string; client: string; pm: string;
  system: string; progress: number; deadline: string;
  status: string; stage: Stage; dims: string; priority: 'High'|'Medium'|'Low';
  waitDays: number;
}

const PRIORITY_COLOR: Record<string,string> = { High:'#dc2626', Medium:'#d97706', Low:'#6b7280' };
const STAGES_ASSIGN: Stage[] = ['intake','design','design','review','review','production','production','closed'];

function buildKanban(): KanbanProject[] {
  return mockProjects.map((p, i) => ({
    id: p.id, name: p.name, client: p.client, pm: p.pm,
    system: p.system ?? 'octanorm', progress: p.progress,
    deadline: p.deadline, status: p.status,
    stage: STAGES_ASSIGN[i % STAGES_ASSIGN.length],
    dims: ['6×3','8×6','4×4','10×5','6×6'][i%5],
    priority: (['High','Medium','Low','High','Medium'] as const)[i%5],
    waitDays: [0,0,3,6,0,2,0,8][i%8],
  }));
}

function ProgressBar({ value, color }: { value:number; color:string }) {
  return (
    <div style={{height:3,borderRadius:2,background:'#e5e7eb',overflow:'hidden'}}>
      <div style={{height:'100%',width:`${value}%`,background:color,borderRadius:2}}/>
    </div>
  );
}

export default function ChiefProjects() {
  const [location, navigate] = useLocation();
  const initialManager = new URLSearchParams(location.split("?")[1] ?? "").get("pm") ?? "";
  const [projects,   setProjects] = useState<KanbanProject[]>(buildKanban);
  const [view,       setView]     = useState<'kanban'|'list'>('kanban');
  const [search,     setSearch]   = useState(initialManager);
  const [filterSt,   setFilter]   = useState<'All'|'Active'|'Pending'|'Delayed'>('All');
  const [toast,      setToast]    = useState('');

  const move = (id: string, dir: 'prev'|'next') => {
    setProjects(prev => prev.map(p => {
      if(p.id !== id) return p;
      const idx = STAGE_ORDER.indexOf(p.stage);
      const newIdx = dir === 'next' ? Math.min(idx+1, 4) : Math.max(idx-1, 0);
      return {...p, stage: STAGE_ORDER[newIdx]};
    }));
  };

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    const match = p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q) || p.pm.toLowerCase().includes(q);
    const st = filterSt === 'All' || p.status === filterSt;
    return match && st;
  });

  const counts = Object.fromEntries(STAGES.map(s => [s.id, filtered.filter(p => p.stage === s.id).length]));
  const statusCounts = { Active: projects.filter(p=>p.status==='Active').length, Pending: projects.filter(p=>p.status==='Pending').length, Delayed: projects.filter(p=>p.status==='Delayed').length };

  const openMonitor = (projectName: string) => {
    setToast(`Opening monitor for ${projectName}`);
    window.setTimeout(() => navigate('/chief/workspace-monitor'), 500);
  };

  return (
    <DashboardLayout role="chief">
      <div className="space-y-5">
        <PageHeader title="Projects Pipeline" breadcrumbs={[{label:'Chief',href:'/chief'},{label:'Projects'}]}>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
              {([['kanban','Kanban'],['list','List']] as const).map(([k,l]) => (
                <button key={k} onClick={() => setView(k)}
                  className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded transition-all ${view===k?'bg-background shadow-sm text-foreground':'text-muted-foreground hover:text-foreground'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
                className="pl-8 pr-3 h-8 text-xs border rounded-md bg-muted/30 outline-none focus:border-primary w-44" />
            </div>
          </div>
        </PageHeader>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-3">
          {STAGES.map(s => (
            <div key={s.id} className="border rounded-lg p-3.5 bg-card" style={{borderTop:`3px solid ${s.color}`}}>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{color:s.color}}>{s.label}</p>
              <p className="text-xl font-bold font-mono" style={{color:s.color}}>{counts[s.id]??0}</p>
            </div>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          {(['All','Active','Pending','Delayed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-bold border transition-all ${filterSt===f?'bg-foreground text-background border-foreground':'bg-transparent text-muted-foreground border-border hover:border-foreground/50'}`}>
              {f}{f!=='All'?` · ${statusCounts[f as keyof typeof statusCounts]??0}`:''}
            </button>
          ))}
        </div>

        {/* ── Kanban View ── */}
        {view === 'kanban' && (
          <div className="grid grid-cols-5 gap-3" style={{minHeight:420}}>
            {STAGES.map(stage => {
              const colCards = filtered.filter(p => p.stage === stage.id);
              return (
                <div key={stage.id} className="flex flex-col gap-2">
                  {/* Column header */}
                  <div className="flex items-center justify-between px-1 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{background:stage.color}}/>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">{stage.label}</span>
                      <span className="text-[9px] font-mono bg-muted rounded-full px-1.5 text-muted-foreground">{colCards.length}</span>
                    </div>
                  </div>

                  {/* Cards */}
                  {colCards.map(p => {
                    const stageIdx = STAGE_ORDER.indexOf(p.stage);
                    return (
                      <div key={p.id} className="bg-card border rounded-lg p-3 hover:border-primary/40 hover:shadow-sm transition-all group"
                        style={{borderLeft:`3px solid ${stage.color}`}}>
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <p className="text-[11.5px] font-bold leading-tight flex-1 min-w-0 truncate group-hover:text-primary transition-colors">{p.name}</p>
                          <span className="text-[9px] font-mono font-bold shrink-0 mt-0.5" style={{color:PRIORITY_COLOR[p.priority]}}>{p.priority[0]}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono mb-2 truncate">{p.client}</p>

                        {p.waitDays > 0 && (
                          <div className="flex items-center gap-1 text-[9.5px] font-mono text-red-500 mb-2">
                            <AlertCircle className="h-2.5 w-2.5 shrink-0"/>{p.waitDays}d waiting
                          </div>
                        )}

                        <div className="mb-2">
                          <div className="flex justify-between text-[9px] font-mono text-muted-foreground mb-1">
                            <span>{p.system?.toUpperCase()}</span><span>{p.progress}%</span>
                          </div>
                          <ProgressBar value={p.progress} color={stage.color}/>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
                            <User className="h-2.5 w-2.5"/>{p.pm.split(' ')[0]}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {stageIdx > 0 && (
                              <button onClick={() => move(p.id,'prev')} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                <ChevronLeft className="h-3 w-3"/>
                              </button>
                            )}
                            {stageIdx < 4 && (
                              <button onClick={() => move(p.id,'next')} className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                <ChevronRight className="h-3 w-3"/>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {colCards.length === 0 && (
                    <div className="border-2 border-dashed border-border/30 rounded-lg py-8 text-center text-[10px] font-mono text-muted-foreground/40">
                      Empty
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── List View ── */}
        {view === 'list' && (
          <div className="border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  {['Project','Client','PM','System','Stage','Progress','Status',''].map(h=>(
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const sc = STAGES.find(s=>s.id===p.stage)!;
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors group">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-sm leading-tight">{p.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{p.dims} m</div>
                      </td>
                      <td className="px-4 py-2.5 text-sm">{p.client}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-[8px] font-mono font-bold text-primary">{p.pm.split(' ').map((n:string)=>n[0]).join('')}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{p.pm.split(' ')[0]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><span className="text-[10px] font-mono bg-muted/50 rounded px-2 py-0.5">{p.system?.toUpperCase()}</span></td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{background:sc.bg,color:sc.color}}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-2.5 min-w-[100px]">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={p.progress} color={sc.color}/>
                          <span className="text-[10px] font-mono shrink-0">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${p.status==='Active'?'bg-green-50 text-green-700':p.status==='Delayed'?'bg-red-50 text-red-700':'bg-orange-50 text-orange-700'}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => openMonitor(p.name)} className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-semibold text-primary border border-primary/30 rounded px-2 py-1 hover:bg-primary hover:text-white transition-all">
                          <Layers className="h-2.5 w-2.5"/> Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No projects match.</div>}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 text-[10px] font-mono text-muted-foreground pt-2 border-t">
          {STAGES.map(s=>(
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{background:s.color}}/>
              {s.label}: {counts[s.id]??0}
            </span>
          ))}
          <span className="ml-auto">Total: {filtered.length} · Drag cards ◁ ▷ to advance stage</span>
        </div>
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-primary/30 bg-card px-4 py-3 text-sm shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
