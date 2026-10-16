import { Link } from "wouter";
import { ArrowLeft, ChevronDown, Undo2, Redo2, Save, Camera, History, Grid2X2, Maximize2, Minimize2, Send } from "lucide-react";
import { CurrencySwitcher } from "@/lib/currency";
import "./workspace-toolbar.css";

interface WorkspaceToolbarProps {
  projectName: string;
  version: number;
  stage: string;
  stageColor: string;
  saveStatus: { label: string; detail: string; color: string };
  busy: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  historyOpen: boolean;
  snapshotCount: number;
  showGrid: boolean;
  preview: boolean;
  canSend: boolean;
  sent: boolean;
  sendDisabledReason: string;
  onSwitch: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSnapshot: () => void;
  onHistory: () => void;
  onGrid: () => void;
  onPreview: () => void;
  onSend: () => void;
}

export function WorkspaceToolbar(props: WorkspaceToolbarProps) {
  return (
    <header className="workspace-toolbar" aria-label="Workspace controls">
      <div className="workspace-toolbar__identity">
        <Link href="/pm" className="workspace-toolbar__back" title="Back to dashboard" aria-label="Back to dashboard"><ArrowLeft size={15} /></Link>
        <button type="button" className="workspace-toolbar__project" onClick={props.onSwitch} disabled={props.busy}
          aria-label="Switch project" title={`Switch project: ${props.projectName}`}>
          <span className="workspace-toolbar__project-name">{props.projectName}</span><ChevronDown size={13} />
        </button>
        <span className="workspace-toolbar__version">v{props.version}</span>
        <span className="workspace-toolbar__stage" style={{ color: props.stageColor }}>{props.stage}</span>
        <span className="workspace-toolbar__status" role="status" style={{ color: props.saveStatus.color }} title={props.saveStatus.detail}>
          <span aria-hidden="true" className="workspace-toolbar__status-dot" /><span className="workspace-toolbar__status-label">{props.saveStatus.label}</span>
        </span>
      </div>
      <div className="workspace-toolbar__actions">
        <div className="workspace-toolbar__group" role="group" aria-label="Edit history">
          <button type="button" onClick={props.onUndo} disabled={!props.canUndo || props.busy} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 size={14} /></button>
          <button type="button" onClick={props.onRedo} disabled={!props.canRedo || props.busy} title="Redo (Ctrl+Y)" aria-label="Redo"><Redo2 size={14} /></button>
        </div>
        <div className="workspace-toolbar__group" role="group" aria-label="Save and versions">
          <button type="button" onClick={props.onSave} disabled={props.busy} title="Save (Ctrl+S)"><Save size={14} /><span>{props.saving ? "Saving…" : "Save"}</span></button>
          <button type="button" onClick={props.onSnapshot} disabled={props.busy} title="Save a named snapshot" aria-label="Save snapshot"><Camera size={14} /><span className="workspace-toolbar__optional-label">Snapshot</span></button>
          <button type="button" onClick={props.onHistory} title="Version history" aria-label="Version history" aria-expanded={props.historyOpen} aria-controls="workspace-history">
            <History size={14} /><span className="workspace-toolbar__optional-label">History</span><span className="workspace-toolbar__count">{props.snapshotCount}</span>
          </button>
        </div>
        <div className="workspace-toolbar__group" role="group" aria-label="View options">
          <button type="button" onClick={props.onGrid} title={props.showGrid ? "Hide floor grid" : "Show floor grid"} aria-label="Floor grid" aria-pressed={props.showGrid}><Grid2X2 size={14} /><span className="workspace-toolbar__optional-label">Grid</span></button>
          <CurrencySwitcher variant="toolbar" />
          <button type="button" onClick={props.onPreview} title={props.preview ? "Exit preview" : "Preview workspace"} aria-label={props.preview ? "Exit preview" : "Preview workspace"} aria-pressed={props.preview}>
            {props.preview ? <Minimize2 size={14} /> : <Maximize2 size={14} />}<span className="workspace-toolbar__optional-label">{props.preview ? "Exit preview" : "Preview"}</span>
          </button>
        </div>
        <button type="button" className="workspace-toolbar__send" onClick={props.onSend} disabled={!props.canSend || props.busy}
          title={props.sendDisabledReason || "Send workspace to client"}><Send size={14} /><span>{props.sent ? "Sent to Client" : "Send to Client"}</span></button>
      </div>
    </header>
  );
}
