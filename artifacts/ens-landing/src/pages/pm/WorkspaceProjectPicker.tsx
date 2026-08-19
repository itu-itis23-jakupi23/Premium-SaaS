import { Link } from "wouter";
import { ChevronLeft, Search } from "lucide-react";
import type { PlatformProject } from "@/lib/platform-api";
import { C, MONO, UI } from "./workspace-constants";

// The "Choose a project" screen shown before the 3D booth workspace opens.
// A self-contained view: search + a project grid, driven entirely by props.

const STATUS_DOT: Record<string, string> = {
  'In Design': C.blue, 'Under Review': '#c2410c', 'Approved': C.green, 'Completed': '#6b6560', 'Pending': C.orange,
};

export function WorkspaceProjectPicker({
  search, onSearch, isLoading, projects, onSelect,
}: {
  search: string;
  onSearch: (value: string) => void;
  isLoading: boolean;
  projects: PlatformProject[];
  onSelect: (project: PlatformProject) => void;
}) {
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:C.bg,color:C.ink,fontFamily:UI,overflow:'hidden'}}>
      {/* Header */}
      <header style={{height:46,borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',gap:10,padding:'0 16px',background:C.panel,flexShrink:0}}>
        <Link href="/pm">
          <button style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4,color:C.muted,padding:'4px 6px',borderRadius:4}}>
            <ChevronLeft size={13}/><span style={{fontFamily:MONO,fontSize:10}}>Back</span>
          </button>
        </Link>
        <div style={{width:1,height:18,background:C.hair}}/>
        <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.muted}}>Select Project Workspace</span>
      </header>

      {/* Body */}
      <div style={{flex:1,overflow:'auto',padding:'32px 40px'}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
          {/* Title */}
          <div style={{marginBottom:28}}>
            <h1 style={{fontSize:22,fontWeight:800,letterSpacing:'-0.03em',margin:'0 0 6px',color:C.ink}}>Choose a Project</h1>
            <p style={{fontFamily:MONO,fontSize:10.5,color:C.muted,margin:0}}>Select a project to open its 3D booth workspace</p>
          </div>

          {/* Search */}
          <div style={{position:'relative',marginBottom:22}}>
            <Search size={13} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:C.muted,pointerEvents:'none'}}/>
            <input
              value={search} onChange={e=>onSearch(e.target.value)}
              placeholder="Search projects, clients…"
              aria-label="Search projects"
              autoFocus
              style={{width:'100%',height:38,paddingLeft:34,paddingRight:12,border:`1px solid ${C.hair}`,borderRadius:5,background:C.panel,fontFamily:UI,fontSize:13,color:C.ink,outline:'none',boxSizing:'border-box'}}
            />
          </div>

          {/* Projects grid */}
          {isLoading ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
              {[1,2,3,4,5,6].map(i=>(
                <div key={i} style={{height:120,borderRadius:6,background:`${C.hair}50`,animation:'pulse 1.5s ease-in-out infinite'}}/>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div style={{textAlign:'center',padding:'60px 0',color:C.muted,fontFamily:MONO,fontSize:10}}>
              {search ? `No projects match "${search}"` : 'No projects found'}
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
              {projects.map(project=>(
                <button key={project.id} onClick={()=>onSelect(project)}
                  style={{background:C.panel,border:`1px solid ${C.hair}`,borderRadius:6,padding:'16px',cursor:'pointer',textAlign:'left',transition:'box-shadow 0.12s,border-color 0.12s',display:'flex',flexDirection:'column',gap:8}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.blue;(e.currentTarget as HTMLElement).style.boxShadow=`0 0 0 3px ${C.blue}18`;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=C.hair;(e.currentTarget as HTMLElement).style.boxShadow='none';}}>
                  {/* Row 1: name + status dot */}
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:C.ink,lineHeight:1.3,flex:1,textAlign:'left'}}>{project.name}</span>
                    <span style={{width:8,height:8,borderRadius:'50%',background:STATUS_DOT[project.status]??C.muted,flexShrink:0,marginTop:4}}/>
                  </div>
                  {/* Row 2: client + system */}
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <span style={{fontFamily:MONO,fontSize:9,color:C.muted,background:C.bg,borderRadius:3,padding:'2px 6px',border:`1px solid ${C.hair}`}}>{project.client}</span>
                    <span style={{fontFamily:MONO,fontSize:9,color:C.muted,background:C.bg,borderRadius:3,padding:'2px 6px',border:`1px solid ${C.hair}`}}>{project.system}</span>
                    <span style={{fontFamily:MONO,fontSize:9,color:C.muted,background:C.bg,borderRadius:3,padding:'2px 6px',border:`1px solid ${C.hair}`}}>{project.dimensions}</span>
                  </div>
                  {/* Row 3: progress bar */}
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>{project.status}</span>
                      <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted}}>{project.progress}%</span>
                    </div>
                    <div style={{height:3,borderRadius:2,background:`${C.hair}80`,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${project.progress}%`,background:C.blue,borderRadius:2,transition:'width 0.3s'}}/>
                    </div>
                  </div>
                  {/* Row 4: open workspace label */}
                  <div style={{fontFamily:MONO,fontSize:9,color:C.blue,letterSpacing:'0.04em',textAlign:'right'}}>Open Workspace →</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
