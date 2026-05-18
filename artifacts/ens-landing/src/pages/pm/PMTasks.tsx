import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Plus, X, Calendar, Clock, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Flag } from "lucide-react";

type Priority = 'High' | 'Medium' | 'Low';
type Col = 'todo' | 'inprogress' | 'review' | 'done';

interface Task {
  id: string; title: string; client: string; project: string;
  priority: Priority; deadline: string; col: Col; notes?: string;
}

const INITIAL_TASKS: Task[] = [
  { id:'t1', title:'Finalize TechCon furniture layout', client:'TechCorp', project:'TechCon 2024', priority:'High', deadline:'2024-08-12', col:'todo' },
  { id:'t2', title:'Send contract for HealthExpo', client:'MediLife', project:'HealthExpo Booth', priority:'Medium', deadline:'2024-08-15', col:'todo' },
  { id:'t3', title:'3D modeling for AutoShow', client:'FastCars Co', project:'AutoShow Stand', priority:'High', deadline:'2024-08-10', col:'inprogress' },
  { id:'t4', title:'Revision A: MediLife branding', client:'MediLife', project:'HealthExpo Booth', priority:'Medium', deadline:'2024-08-11', col:'inprogress' },
  { id:'t5', title:'Review Greenworld booth specs', client:'GreenTech', project:'EcoFair Stand', priority:'Low', deadline:'2024-08-20', col:'review' },
  { id:'t6', title:'Initial proposal: TechCon', client:'TechCorp', project:'TechCon 2024', priority:'Low', deadline:'2024-08-05', col:'done' },
  { id:'t7', title:'Confirm carpet color with client', client:'FastCars Co', project:'AutoShow Stand', priority:'Medium', deadline:'2024-08-09', col:'done' },
];

const COLS: { id: Col; label: string; accent: string }[] = [
  { id:'todo',       label:'To Do',      accent:'#6b7280' },
  { id:'inprogress', label:'In Progress', accent:'#1d4ed8' },
  { id:'review',     label:'In Review',  accent:'#d97706' },
  { id:'done',       label:'Done',       accent:'#2f7d3a' },
];

const COL_ORDER: Col[] = ['todo','inprogress','review','done'];

const PRIORITY_CFG: Record<Priority,{color:string;bg:string}> = {
  High:   { color:'#dc2626', bg:'rgba(220,38,38,0.08)' },
  Medium: { color:'#d97706', bg:'rgba(217,119,6,0.08)' },
  Low:    { color:'#6b7280', bg:'rgba(107,114,128,0.08)' },
};

const PROJECTS = ['TechCon 2024','HealthExpo Booth','AutoShow Stand','EcoFair Stand','RetailPeak Expo'];
const CLIENTS  = ['TechCorp','MediLife','FastCars Co','GreenTech','RetailBrand'];

function isOverdue(deadline: string) { return new Date(deadline) < new Date(); }
function fmtDate(s: string) {
  const d = new Date(s); const today = new Date();
  const diff = Math.round((d.getTime()-today.getTime())/(1000*86400));
  if(diff<0) return `${Math.abs(diff)}d overdue`;
  if(diff===0) return 'Due today';
  if(diff===1) return 'Due tomorrow';
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
}

export default function PMTasks() {
  const [tasks,      setTasks]      = useState<Task[]>(INITIAL_TASKS);
  const [filterPri,  setFilterPri]  = useState<Priority|'All'>('All');
  const [showCreate, setShowCreate] = useState(false);
  const [newTask,    setNewTask]    = useState<Partial<Task>>({ priority:'Medium', col:'todo' });
  const [toast,      setToast]      = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const moveTask = (id: string, dir: 'prev' | 'next') => {
    setTasks(prev => prev.map(t => {
      if(t.id !== id) return t;
      const idx = COL_ORDER.indexOf(t.col);
      const newIdx = dir === 'next' ? Math.min(idx+1, 3) : Math.max(idx-1, 0);
      const newCol = COL_ORDER[newIdx];
      if(newCol !== t.col) showToast(`"${t.title.slice(0,30)}…" → ${COLS.find(c=>c.id===newCol)?.label}`);
      return { ...t, col: newCol };
    }));
  };

  const deleteTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  const createTask = () => {
    if(!newTask.title || !newTask.client || !newTask.project || !newTask.deadline) return;
    const task: Task = {
      id: `t${Date.now()}`,
      title: newTask.title!, client: newTask.client!, project: newTask.project!,
      priority: newTask.priority as Priority ?? 'Medium',
      deadline: newTask.deadline!, col: newTask.col as Col ?? 'todo',
    };
    setTasks(prev => [...prev, task]);
    setShowCreate(false);
    setNewTask({ priority:'Medium', col:'todo' });
    showToast(`Task created: "${task.title.slice(0,30)}"`);
  };

  const visible = tasks.filter(t => filterPri === 'All' || t.priority === filterPri);

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader title="Tasks Kanban" breadcrumbs={[{label:'Dashboard',href:'/pm'},{label:'Tasks'}]}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
              {(['All','High','Medium','Low'] as const).map(p => (
                <button key={p} onClick={() => setFilterPri(p)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all ${filterPri===p?'bg-background shadow-sm text-foreground border':'text-muted-foreground hover:text-foreground'}`}
                  style={filterPri===p&&p!=='All'?{color:PRIORITY_CFG[p as Priority]?.color}:{}}>
                  {p}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCreate(true)} data-testid="button-create-task"
              className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" /> New Task
            </button>
          </div>
        </PageHeader>

        {/* Kanban Board */}
        <div className="grid grid-cols-4 gap-4">
          {COLS.map(col => {
            const colTasks = visible.filter(t => t.col === col.id);
            return (
              <div key={col.id} className="flex flex-col gap-3">
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.accent }} />
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">{col.label}</span>
                    <span className="text-[10px] font-mono bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <button onClick={() => { setNewTask(n => ({...n, col:col.id})); setShowCreate(true); }}
                    className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Tasks */}
                <div className="flex flex-col gap-2.5 min-h-[60px]">
                  {colTasks.map(task => {
                    const pc = PRIORITY_CFG[task.priority];
                    const over = isOverdue(task.deadline) && col.id !== 'done';
                    const colIdx = COL_ORDER.indexOf(task.col);
                    return (
                      <div key={task.id}
                        className="bg-card border rounded-lg p-3.5 hover:border-primary/40 hover:shadow-sm transition-all group cursor-default"
                        style={{ borderLeft: `3px solid ${col.accent}` }}>
                        {/* Priority + actions */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{ background:pc.bg, color:pc.color }}>
                            <Flag className="h-2.5 w-2.5 inline mr-1" />{task.priority}
                          </span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {colIdx > 0 && (
                              <button onClick={() => moveTask(task.id,'prev')} title="Move left" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                <ChevronLeft className="h-3 w-3" />
                              </button>
                            )}
                            {colIdx < 3 && (
                              <button onClick={() => moveTask(task.id,'next')} title="Move right" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                            <button onClick={() => deleteTask(task.id)} title="Delete" className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-semibold leading-tight mb-1.5 group-hover:text-primary transition-colors">{task.title}</p>
                        <p className="text-[11px] text-muted-foreground mb-3 font-mono">{task.client}</p>
                        <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
                          <div className="flex items-center gap-1 text-[11px] font-mono" style={{ color: over?'#dc2626':'var(--muted-foreground)' }}>
                            {over ? <AlertCircle className="h-3 w-3" /> : col.id === 'done' ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Clock className="h-3 w-3" />}
                            {fmtDate(task.deadline)}
                          </div>
                          {col.id !== 'done' && colIdx < 3 && (
                            <button onClick={() => moveTask(task.id,'next')}
                              className="text-[10px] font-mono font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5">
                              {COLS[colIdx+1]?.label} <ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="border-2 border-dashed border-border/40 rounded-lg py-6 text-center text-[11px] font-mono text-muted-foreground/50">
                      No tasks
                    </div>
                  )}
                  <button onClick={() => { setNewTask(n => ({...n,col:col.id})); setShowCreate(true); }}
                    className="w-full border border-dashed border-border/50 rounded-lg py-2.5 text-[11px] font-mono text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1">
                    <Plus className="h-3 w-3" /> Add task
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 pt-2 border-t text-[11px] font-mono text-muted-foreground">
          {COLS.map(c => <span key={c.id} style={{color:c.accent}}>{c.label}: {tasks.filter(t=>t.col===c.id).length}</span>)}
          <span className="ml-auto">Total: {tasks.length} tasks</span>
          <span style={{color:'#dc2626'}}>Overdue: {tasks.filter(t=>isOverdue(t.deadline)&&t.col!=='done').length}</span>
        </div>
      </div>

      {/* Create Task Dialog */}
      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowCreate(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-lg p-6 z-50 w-[420px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">Create Task</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Title</label>
                <input value={newTask.title??''} onChange={e => setNewTask(t=>({...t,title:e.target.value}))} placeholder="Task description…"
                  className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Client</label>
                  <select value={newTask.client??''} onChange={e => setNewTask(t=>({...t,client:e.target.value}))}
                    className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary">
                    <option value="">Select…</option>
                    {CLIENTS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Project</label>
                  <select value={newTask.project??''} onChange={e => setNewTask(t=>({...t,project:e.target.value}))}
                    className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary">
                    <option value="">Select…</option>
                    {PROJECTS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Priority</label>
                  <select value={newTask.priority??'Medium'} onChange={e => setNewTask(t=>({...t,priority:e.target.value as Priority}))}
                    className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary">
                    <option>High</option><option>Medium</option><option>Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Deadline</label>
                  <input type="date" value={newTask.deadline??''} onChange={e => setNewTask(t=>({...t,deadline:e.target.value}))}
                    className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Initial Column</label>
                <select value={newTask.col??'todo'} onChange={e => setNewTask(t=>({...t,col:e.target.value as Col}))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary">
                  {COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={createTask} disabled={!newTask.title||!newTask.client||!newTask.project||!newTask.deadline}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold disabled:opacity-40 hover:bg-primary/90">
                Create Task
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
