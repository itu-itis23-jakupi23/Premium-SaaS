import { useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockProjects } from "@/lib/mock-data";
import { Plus, Search, Filter, LayoutGrid, List, Layers, Calendar, User, CheckCircle2, Clock, AlertCircle, ArrowUpRight, X, Ruler } from "lucide-react";

const STATUS_COLOR: Record<string,{bg:string;text:string}> = {
  Active:    { bg:'rgba(47,125,58,0.1)',  text:'#2f7d3a' },
  Pending:   { bg:'rgba(194,65,12,0.1)',  text:'#c2410c' },
  Delayed:   { bg:'rgba(220,38,38,0.1)',  text:'#dc2626' },
  Completed: { bg:'rgba(29,78,216,0.1)',  text:'#1d4ed8' },
};
const PRIORITY_COLOR: Record<string,string> = { High:'#dc2626', Medium:'#d97706', Low:'#6b7280' };

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? '#2f7d3a' : value >= 40 ? '#1d4ed8' : '#c2410c';
  return (
    <div style={{ height:4, borderRadius:2, background:'#e5e7eb', overflow:'hidden', width:'100%' }}>
      <div style={{ height:'100%', width:`${value}%`, background:color, borderRadius:2 }} />
    </div>
  );
}

const EXTRA = mockProjects.map((_,i) => ({
  size:     ['6×3','8×6','4×4','10×5','6×6'][i%5],
  priority: (['High','Medium','Low','High','Medium'] as const)[i%5],
  assignee: ['Sarah M.','Alex K.','Jordan L.','Maya R.','Chris P.'][i%5],
}));

const STATUSES = ['All','Active','Pending','Delayed','Completed'] as const;
type FilterStatus = typeof STATUSES[number];

export default function PMProjects() {
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState<FilterStatus>('All');
  const [view,       setView]       = useState<'list'|'grid'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ name:'', client:'', system:'octanorm', width:'6', depth:'3', deadline:'' });
  const [projects,   setProjects]   = useState(mockProjects);
  const [toast,      setToast]      = useState('');

  const filtered = projects.filter(p => {
    const match = p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase());
    const stat  = filter === 'All' || p.status === filter;
    return match && stat;
  });

  const counts: Record<string,number> = {};
  STATUSES.slice(1).forEach(f => { counts[f] = projects.filter(p => p.status === f).length; });

  const createProject = () => {
    if (!newProject.name || !newProject.client) return;
    setProjects(prev => [...prev, {
      id:`p${Date.now()}`, name:newProject.name, client:newProject.client, pm:'Sarah M.',
      exhibition:'New Exhibition', status:'Pending', progress:0,
      deadline:newProject.deadline||'2024-12-31', system:newProject.system as any,
      standType:newProject.system==='maxima'?'Maxima Premium':'Octanorm Standard',
      dimensions:`${newProject.width}×${newProject.depth} m`,
      description:'', lastUpdate:'Just now', revisions:[], approvals:[],
    }]);
    setShowCreate(false);
    setNewProject({ name:'', client:'', system:'octanorm', width:'6', depth:'3', deadline:'' });
    setToast(`Project "${newProject.name}" created`);
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader title="My Projects" breadcrumbs={[{label:'Dashboard',href:'/pm'},{label:'Projects'}]}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border">
              {([['list',List],['grid',LayoutGrid]] as const).map(([k,Icon]) => (
                <button key={k} onClick={() => setView(k)} data-testid={`button-view-${k}`}
                  className={`p-1.5 rounded transition-colors ${view===k?'bg-background shadow-sm text-foreground':'text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            <button onClick={() => setShowCreate(true)} data-testid="button-create-project"
              className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="h-3.5 w-3.5" /> New Project
            </button>
          </div>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[{l:'Total',v:projects.length,I:Layers,c:'text-foreground'},{l:'Active',v:counts.Active||0,I:CheckCircle2,c:'text-green-600'},{l:'Pending',v:counts.Pending||0,I:Clock,c:'text-orange-600'},{l:'Delayed',v:counts.Delayed||0,I:AlertCircle,c:'text-red-600'}]
            .map(s => (
              <div key={s.l} className="bg-card border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{s.l}</span>
                  <s.I className={`h-4 w-4 ${s.c}`} />
                </div>
                <p className={`text-2xl font-bold font-mono ${s.c}`}>{s.v}</p>
              </div>
            ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUSES.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wide border transition-all ${filter===f?'bg-foreground text-background border-foreground':'bg-transparent text-muted-foreground border-border hover:border-foreground/50'}`}>
                {f}{f!=='All'&&counts[f]!==undefined?` · ${counts[f]}`:''}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
                className="pl-8 pr-3 h-8 text-xs border rounded-md bg-muted/30 outline-none focus:border-primary w-52"
                data-testid="input-search-projects" />
            </div>
            <button className="flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground" data-testid="button-filter">
              <Filter className="h-3 w-3" /> Filter
            </button>
          </div>
        </div>

        {/* List View */}
        {view === 'list' && (
          <div className="border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  {['Project','Client','Size','Progress','Deadline','Status','Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const sc = STATUS_COLOR[p.status] ?? STATUS_COLOR.Active;
                  const ex = EXTRA[i % EXTRA.length];
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm leading-tight">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.exhibition ?? 'Exhibition TBD'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">{p.client}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><User className="h-2.5 w-2.5"/>{ex.assignee}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs flex items-center gap-1 whitespace-nowrap"><Ruler className="h-2.5 w-2.5 text-muted-foreground"/>{ex.size} m</span>
                        <span className="text-[10px] text-muted-foreground font-mono uppercase block mt-0.5">{p.system}</span>
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                          <span style={{ color:PRIORITY_COLOR[ex.priority] }}>{ex.priority}</span>
                          <span className="text-muted-foreground">{p.progress}%</span>
                        </div>
                        <ProgressBar value={p.progress} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                          <Calendar className="h-3 w-3"/>
                          {new Date(p.deadline).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full font-bold" style={{background:sc.bg,color:sc.text}}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href="/pm/workspace">
                            <button className="text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded px-2 py-1 hover:bg-primary hover:text-white transition-colors flex items-center gap-1 whitespace-nowrap">
                              <Layers className="h-2.5 w-2.5"/> Open
                            </button>
                          </Link>
                          <button className="text-[11px] text-muted-foreground bg-muted border border-border rounded px-2 py-1 flex items-center gap-1 whitespace-nowrap">
                            <ArrowUpRight className="h-2.5 w-2.5"/> Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No projects match your filter.</div>}
          </div>
        )}

        {/* Grid View */}
        {view === 'grid' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => {
              const sc = STATUS_COLOR[p.status] ?? STATUS_COLOR.Active;
              const ex = EXTRA[i % EXTRA.length];
              return (
                <div key={p.id} className="border rounded-lg bg-card hover:border-primary/50 hover:shadow-md transition-all">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-bold text-sm leading-tight">{p.name}</h3>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.client}</p>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full font-bold shrink-0" style={{background:sc.bg,color:sc.text}}>{p.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                      {[['System',p.system?.toUpperCase()],['Size',`${ex.size} m`],['Deadline',new Date(p.deadline).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})],['PM',ex.assignee]].map(([k,v]) => (
                        <div key={k as string} className="bg-muted/30 rounded p-1.5">
                          <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{k}</p>
                          <p className="text-[11px] font-semibold font-mono mt-0.5">{v}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1"><span>Progress</span><span>{p.progress}%</span></div>
                      <ProgressBar value={p.progress} />
                    </div>
                    <Link href="/pm/workspace">
                      <button className="w-full flex items-center justify-center gap-1.5 border border-primary/20 text-primary rounded-md py-1.5 text-xs font-semibold hover:bg-primary hover:text-white transition-colors">
                        <Layers className="h-3 w-3"/> Open Workspace
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowCreate(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-lg p-6 z-50 w-[440px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">Create New Project</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>
            </div>
            <div className="space-y-3">
              {([['Project Name','name','text','e.g. TechCon 2025 Stand'],['Client','client','text','e.g. TechCorp Industries']] as const).map(([l,k]) => (
                <div key={k}>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{l}</label>
                  <input value={(newProject as any)[k]} onChange={e => setNewProject(p => ({...p,[k]:e.target.value}))} placeholder={l}
                    className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary" />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Deadline</label>
                <input type="date" value={newProject.deadline} onChange={e => setNewProject(p => ({...p,deadline:e.target.value}))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">System</label>
                <select value={newProject.system} onChange={e => setNewProject(p => ({...p,system:e.target.value}))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary">
                  <option value="octanorm">Octanorm (1 m module)</option>
                  <option value="maxima">Maxima (2 m module)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([['Width (m)','width'],['Depth (m)','depth']] as const).map(([l,k]) => (
                  <div key={k}>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{l}</label>
                    <input type="number" min="2" max="30" step="0.5" value={(newProject as any)[k]} onChange={e => setNewProject(p => ({...p,[k]:e.target.value}))}
                      className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={createProject} disabled={!newProject.name || !newProject.client}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors">
                Create Project
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xl z-50">
          <CheckCircle2 className="h-4 w-4 text-green-400" /> {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
