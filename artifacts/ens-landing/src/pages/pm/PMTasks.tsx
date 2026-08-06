import { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  createPmTask,
  deletePmTask,
  getPmTaskBoard,
  updatePmTask,
  type PmTask,
  type PmTaskColumn,
  type PmTaskPriority,
  type PmTaskProjectOption,
} from "@/lib/platform-api";
import { Plus, X, Clock, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Flag, Loader2, Pencil } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Skeleton } from "@/components/ui/skeleton";

type Priority = PmTaskPriority;
type Col = PmTaskColumn;

type NewTask = Partial<{
  title: string;
  projectId: string;
  priority: Priority;
  deadline: string;
  col: Col;
  notes: string;
}>;

type TaskDraft = {
  title: string;
  projectId: string;
  priority: Priority;
  deadline: string;
  col: Col;
  notes: string;
};

const COL_IDS: Col[] = ["todo", "in_progress", "blocked", "done"];
const PRIORITY_FILTER_OPTIONS = ["All", "High", "Medium", "Low"] as const;

const PRIORITY_CFG: Record<Priority, { color: string; bg: string }> = {
  High: { color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
  Medium: { color: "#d97706", bg: "rgba(217,119,6,0.08)" },
  Low: { color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
};

function isOverdue(deadline: string) {
  if (!deadline) return false;
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return Number.isFinite(new Date(`${value}T00:00:00`).getTime());
}

function daysUntil(value: string) {
  if (!value) return null;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 86400));
}

function todayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialPriorityFilter(): Priority | "All" {
  const value = new URLSearchParams(window.location.search).get("priority");
  if (!value) return "All";
  const match = PRIORITY_FILTER_OPTIONS.find((priority) => priority.toLowerCase() === value.toLowerCase());
  return match ?? "All";
}

function urlTaskId() {
  return new URLSearchParams(window.location.search).get("taskId") ?? "";
}

function compareTasks(a: PmTask, b: PmTask) {
  const overdueDelta = Number(isOverdue(b.deadline)) - Number(isOverdue(a.deadline));
  if (overdueDelta !== 0) return overdueDelta;

  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;

  const dateDelta = dateRank(a.deadline) - dateRank(b.deadline);
  if (dateDelta !== 0) return dateDelta;

  return a.title.localeCompare(b.title);
}

function priorityRank(priority: Priority) {
  if (priority === "High") return 0;
  if (priority === "Medium") return 1;
  return 2;
}

function dateRank(value: string) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

export default function PMTasks() {
  const { t, i18n } = useTranslation();
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [projects, setProjects] = useState<PmTaskProjectOption[]>([]);
  const [filterPri, setFilterPri] = useState<Priority | "All">(() => initialPriorityFilter());
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState<NewTask>({ priority: "Medium", col: "todo" });
  const [editingTask, setEditingTask] = useState<PmTask | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const { toast: showGlobalToast } = useToast();
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<PmTask | null>(null);

  // Focus trap refs
  const createTaskRef = useRef<HTMLDivElement>(null);
  const editTaskRef   = useRef<HTMLElement>(null);
  const deleteTaskRef = useRef<HTMLDivElement>(null);
  useFocusTrap(createTaskRef, showCreate,          () => setShowCreate(false));
  useFocusTrap(editTaskRef,   !!editingTask,        () => setEditingTask(null));
  useFocusTrap(deleteTaskRef, !!confirmDeleteTask,  () => setConfirmDeleteTask(null));

  useEffect(() => {
    document.title = t("pm.tasks.title");
  }, [t]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getPmTaskBoard()
      .then((board) => {
        if (!mounted) return;
        setTasks(board.tasks);
        setProjects(board.projects);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        setTasks([]);
        setProjects([]);
        setError(reason instanceof Error ? reason.message : t("pm.tasks.toast.loadError"));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, [t]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (filterPri === "All") {
      params.delete("priority");
    } else {
      params.set("priority", filterPri.toLowerCase());
    }
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [filterPri]);

  useEffect(() => {
    if (isLoading) return;
    const taskId = urlTaskId();
    if (!taskId || editingTask?.id === taskId) return;

    const match = tasks.find((task) => task.id === taskId);
    if (match) {
      setUrlTaskId(match.id);
      setEditingTask(match);
      setTaskDraft({
        title: match.title,
        projectId: match.projectId ?? "",
        priority: match.priority,
        deadline: match.deadline,
        col: match.col,
        notes: match.notes ?? "",
      });
      setEditError("");
    }
  }, [editingTask?.id, isLoading, tasks]);

  async function reloadBoard() {
    setIsLoading(true);
    setError("");
    try {
      const board = await getPmTaskBoard();
      applyBoard(board);
    } catch (reason) {
      setTasks([]);
      setProjects([]);
      setError(reason instanceof Error ? reason.message : t("pm.tasks.toast.loadError"));
    } finally {
      setIsLoading(false);
    }
  }

  const COLS = useMemo<{ id: Col; label: string; accent: string }[]>(() => [
    { id: "todo",        label: t("pm.tasks.cols.todo"),        accent: "#6b7280" },
    { id: "in_progress", label: t("pm.tasks.cols.in_progress"), accent: "#1d4ed8" },
    { id: "blocked",     label: t("pm.tasks.cols.blocked"),     accent: "#d97706" },
    { id: "done",        label: t("pm.tasks.cols.done"),        accent: "#2f7d3a" },
  ], [t]);

  function applyBoard(board: { tasks: PmTask[]; projects: PmTaskProjectOption[] }) {
    setTasks(board.tasks);
    setProjects(board.projects);
    setError("");
  }

  function fmtDate(s: string): string {
    if (!s) return t("pm.common.noDeadline");
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 86400));
    if (diff < 0) return t("pm.common.overdue", { count: Math.abs(diff) });
    if (diff === 0) return t("pm.common.today");
    if (diff === 1) return t("pm.common.tomorrow");
    return d.toLocaleDateString(i18n.language, { day: "2-digit", month: "short" });
  }

  function showToast(msg: string) {
    showGlobalToast({ title: msg });
  }

  function setUrlTaskId(taskId: string | null) {
    const params = new URLSearchParams(window.location.search);
    if (taskId) {
      params.set("taskId", taskId);
    } else {
      params.delete("taskId");
    }
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", next);
  }

  async function moveTask(task: PmTask, dir: "prev" | "next") {
    const idx = COL_IDS.indexOf(task.col);
    const nextIdx = dir === "next" ? Math.min(idx + 1, COL_IDS.length - 1) : Math.max(idx - 1, 0);
    const nextCol = COL_IDS[nextIdx];
    if (!nextCol || nextCol === task.col || busyAction) return;

    setBusyAction(`move-${task.id}`);
    try {
      const board = await updatePmTask(task.id, { status: nextCol });
      applyBoard(board);
      const colLabel = COLS.find((c) => c.id === nextCol)?.label ?? nextCol;
      showToast(t("pm.tasks.toast.movedClean", { title: task.title.slice(0, 30), col: colLabel }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pm.tasks.toast.updateError"));
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteTask(task: PmTask) {
    if (busyAction) return;
    setBusyAction(`delete-${task.id}`);
    try {
      const board = await deletePmTask(task.id);
      applyBoard(board);
      showToast(t("pm.tasks.toast.deleted", { title: task.title.slice(0, 30) }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pm.tasks.toast.deleteError"));
    } finally {
      setBusyAction(null);
    }
  }

  async function createTask() {
    if (!newTask.title || !newTask.projectId || !newTask.deadline || busyAction) return;
    if (!isValidDate(newTask.deadline)) {
      setFormError(t("pm.tasks.toast.deadlineInvalid"));
      return;
    }
    if (isOverdue(newTask.deadline)) {
      setFormError(t("pm.tasks.toast.deadlinePast"));
      return;
    }
    if ((newTask.notes?.length ?? 0) > 4000) {
      setFormError(t("pm.tasks.toast.notesTooLong"));
      return;
    }

    setBusyAction("create");
    setFormError("");
    try {
      const board = await createPmTask({
        title: newTask.title,
        projectId: newTask.projectId,
        priority: newTask.priority ?? "Medium",
        deadline: newTask.deadline,
        status: newTask.col ?? "todo",
        notes: newTask.notes?.trim() ?? "",
      });
      applyBoard(board);
      setShowCreate(false);
      setNewTask({ priority: "Medium", col: "todo" });
      showToast(t("pm.tasks.toast.created", { title: newTask.title.slice(0, 30) }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pm.tasks.toast.createError"));
    } finally {
      setBusyAction(null);
    }
  }

  function openTaskEditor(task: PmTask) {
    setUrlTaskId(task.id);
    setEditingTask(task);
    setTaskDraft({
      title: task.title,
      projectId: task.projectId ?? "",
      priority: task.priority,
      deadline: task.deadline,
      col: task.col,
      notes: task.notes ?? "",
    });
    setEditError("");
  }

  function closeTaskEditor() {
    if (busyAction === "edit") return;
    setUrlTaskId(null);
    setEditingTask(null);
    setTaskDraft(null);
    setEditError("");
  }

  async function saveTaskEdits() {
    if (!editingTask || !taskDraft || busyAction) return;
    if (!taskDraft.title.trim()) {
      setEditError(t("pm.tasks.toast.titleRequired"));
      return;
    }
    if (!taskDraft.projectId) {
      setEditError(t("pm.tasks.toast.projectRequired"));
      return;
    }
    if (taskDraft.deadline && !isValidDate(taskDraft.deadline)) {
      setEditError(t("pm.tasks.toast.deadlineInvalid"));
      return;
    }
    if (taskDraft.notes.length > 4000) {
      setEditError(t("pm.tasks.toast.notesTooLong"));
      return;
    }

    setBusyAction("edit");
    setEditError("");
    try {
      const board = await updatePmTask(editingTask.id, {
        title: taskDraft.title.trim(),
        projectId: taskDraft.projectId,
        priority: taskDraft.priority,
        deadline: taskDraft.deadline || null,
        status: taskDraft.col,
        notes: taskDraft.notes.trim() || null,
      });
      applyBoard(board);
      setUrlTaskId(null);
      setEditingTask(null);
      setTaskDraft(null);
      setEditError("");
      showToast(t("pm.tasks.toast.updated"));
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : t("pm.tasks.toast.updateError"));
    } finally {
      setBusyAction(null);
    }
  }

  const visible = useMemo(
    () => tasks.filter((task) => filterPri === "All" || task.priority === filterPri).sort(compareTasks),
    [filterPri, tasks],
  );

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader
          title={t("pm.tasks.title")}
          breadcrumbs={[{ label: t("pm.nav.dashboard"), href: "/pm" }, { label: t("pm.nav.tasks") }]}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
              {PRIORITY_FILTER_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPri(p)}
                  aria-pressed={filterPri === p}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all ${filterPri === p ? "bg-background shadow-sm text-foreground border" : "text-muted-foreground hover:text-foreground"}`}
                  style={filterPri === p && p !== "All" ? { color: PRIORITY_CFG[p].color } : {}}
                >
                  {p === "All" ? t("pm.tasks.filter.all") : t(`pm.common.priority.${p.toLowerCase()}`)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              data-testid="button-create-task"
              disabled={!projects.length}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-40"
            >
              <Plus aria-hidden="true" className="h-3.5 w-3.5" /> {t("pm.tasks.newTask")}
            </button>
          </div>
        </PageHeader>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
            <button
              type="button"
              onClick={reloadBoard}
              className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-semibold hover:bg-red-500/10"
            >
              {t("pm.tasks.actions.retry")}
            </button>
          </div>
        )}

        {!isLoading && !projects.length && !error && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            {t("pm.tasks.noProjects")}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLS.map((col) => (
              <div key={col.id} className="flex flex-col gap-3">
                {/* Column header skeleton */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.accent }} />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-5 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
                {/* Task card skeletons */}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border bg-card p-3.5 space-y-2" style={{ borderLeft: `3px solid ${col.accent}` }}>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-32" />
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLS.map((col) => {
              const colTasks = visible.filter((task) => task.col === col.id);
              return (
                <div key={col.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.accent }} />
                      <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">{col.label}</span>
                      <span className="text-[10px] font-mono bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">{colTasks.length}</span>
                    </div>
                    <button
                      onClick={() => { setNewTask((n) => ({ ...n, col: col.id })); setShowCreate(true); }}
                      disabled={!projects.length}
                      aria-label={t("pm.tasks.addToCol", { col: col.label })}
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors disabled:opacity-40"
                    >
                      <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2.5 min-h-[60px]">
                    {colTasks.map((task) => {
                      const pc = PRIORITY_CFG[task.priority];
                      const over = isOverdue(task.deadline) && col.id !== "done";
                      const colIdx = COL_IDS.indexOf(task.col);
                      const isBusy = busyAction === `move-${task.id}` || busyAction === `delete-${task.id}`;
                      const dueDays = col.id === "done" ? null : daysUntil(task.deadline);
                      const reminderLabel = dueDays === null
                        ? null
                        : dueDays < 0
                          ? t("pm.common.overdue", { count: Math.abs(dueDays) })
                          : dueDays === 0
                            ? t("pm.common.today")
                            : dueDays <= 2
                              ? t("pm.tasks.reminder.dueSoon", { count: dueDays })
                              : null;
                      return (
                        <div
                          key={task.id}
                          className="bg-card border rounded-lg p-3.5 hover:border-primary/40 hover:shadow-sm transition-all group cursor-default"
                          style={{ borderLeft: `3px solid ${col.accent}` }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{ background: pc.bg, color: pc.color }}>
                              <Flag aria-hidden="true" className="h-2.5 w-2.5 inline mr-1" />
                              {t(`pm.common.priority.${task.priority.toLowerCase()}`)}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isBusy && <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin text-muted-foreground" />}
                              <button
                                onClick={() => openTaskEditor(task)}
                                disabled={Boolean(busyAction)}
                                title={t("pm.tasks.actions.edit")}
                                aria-label={t("pm.tasks.actions.editTask", { title: task.title })}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40"
                              >
                                <Pencil aria-hidden="true" className="h-3 w-3" />
                              </button>
                              {colIdx > 0 && (
                                <button
                                  onClick={() => moveTask(task, "prev")}
                                  disabled={Boolean(busyAction)}
                                  title={t("pm.tasks.actions.moveLeft")}
                                  aria-label={t("pm.tasks.actions.moveLeft")}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40"
                                >
                                  <ChevronLeft aria-hidden="true" className="h-3 w-3" />
                                </button>
                              )}
                              {colIdx < COL_IDS.length - 1 && (
                                <button
                                  onClick={() => moveTask(task, "next")}
                                  disabled={Boolean(busyAction)}
                                  title={t("pm.tasks.actions.moveRight")}
                                  aria-label={t("pm.tasks.actions.moveRight")}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40"
                                >
                                  <ChevronRight aria-hidden="true" className="h-3 w-3" />
                                </button>
                              )}
                              <button
                                onClick={() => setConfirmDeleteTask(task)}
                                disabled={Boolean(busyAction)}
                                title={t("pm.tasks.actions.delete")}
                                aria-label={t("pm.tasks.actions.deleteTask", { title: task.title })}
                                className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 disabled:opacity-40"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm font-semibold leading-tight mb-1.5 group-hover:text-primary transition-colors">{task.title}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{task.client}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{task.project}</p>
                          {task.notes && (
                            <p className="mt-2 line-clamp-2 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                              {task.notes}
                            </p>
                          )}
                          {reminderLabel && (
                            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-orange-600">
                              <Clock aria-hidden="true" className="h-2.5 w-2.5" />
                              {reminderLabel}
                            </div>
                          )}
                          <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-border/50">
                            <div className="flex items-center gap-1 text-[11px] font-mono" style={{ color: over ? "#dc2626" : "var(--muted-foreground)" }}>
                              {over ? <AlertCircle aria-hidden="true" className="h-3 w-3" /> : col.id === "done" ? <CheckCircle2 aria-hidden="true" className="h-3 w-3 text-green-600" /> : <Clock aria-hidden="true" className="h-3 w-3" />}
                              {fmtDate(task.deadline)}
                            </div>
                            {col.id !== "done" && colIdx < COL_IDS.length - 1 && (
                              <button
                                onClick={() => moveTask(task, "next")}
                                disabled={Boolean(busyAction)}
                                className="text-[10px] font-mono font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5 disabled:opacity-40"
                              >
                                {COLS[colIdx + 1]?.label} <ChevronRight aria-hidden="true" className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {colTasks.length === 0 && (
                      <div className="border-2 border-dashed border-border/40 rounded-lg py-6 text-center text-[11px] font-mono text-muted-foreground/50">
                        {t("pm.tasks.noTasks")}
                      </div>
                    )}
                    <button
                      onClick={() => { setNewTask((n) => ({ ...n, col: col.id })); setShowCreate(true); }}
                      disabled={!projects.length}
                      className="w-full border border-dashed border-border/50 rounded-lg py-2.5 text-[11px] font-mono text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
                    >
                      <Plus aria-hidden="true" className="h-3 w-3" /> {t("pm.tasks.addTask")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-6 pt-2 border-t text-[11px] font-mono text-muted-foreground">
          {COLS.map((c) => (
            <span key={c.id} style={{ color: c.accent }}>
              {c.label}: {tasks.filter((task) => task.col === c.id).length}
            </span>
          ))}
          <span className="ml-auto">{t("pm.tasks.stats.total", { count: tasks.length })}</span>
          <span style={{ color: "#dc2626" }}>{t("pm.tasks.stats.overdue", { count: tasks.filter((task) => isOverdue(task.deadline) && task.col !== "done").length })}</span>
        </div>
      </div>

      {showCreate && (
        <>
          <div aria-hidden="true" className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowCreate(false)} />
          <div
            ref={createTaskRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-task-title"
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-lg p-6 z-50 w-[420px] shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="create-task-title" className="font-bold text-base">{t("pm.tasks.modal.title")}</h2>
              <button onClick={() => setShowCreate(false)} aria-label={t("pm.common.cancel")} className="text-muted-foreground hover:text-foreground">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            {formError && (
              <div role="alert" className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                {formError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{t("pm.tasks.modal.taskTitle")}</label>
                <input
                  value={newTask.title ?? ""}
                  onChange={(e) => setNewTask((n) => ({ ...n, title: e.target.value }))}
                  placeholder={t("pm.tasks.modal.taskTitlePlaceholder")}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  {t("pm.tasks.modal.notes")}
                </label>
                <textarea
                  value={newTask.notes ?? ""}
                  onChange={(e) => setNewTask((n) => ({ ...n, notes: e.target.value }))}
                  placeholder={t("pm.tasks.modal.notesPlaceholder")}
                  rows={3}
                  className="w-full resize-none rounded-md border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{t("pm.tasks.modal.project")}</label>
                <select
                  value={newTask.projectId ?? ""}
                  onChange={(e) => setNewTask((n) => ({ ...n, projectId: e.target.value }))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary"
                >
                  <option value="">{t("pm.tasks.modal.select")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.client} / {project.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{t("pm.tasks.modal.priority")}</label>
                  <select
                    value={newTask.priority ?? "Medium"}
                    onChange={(e) => setNewTask((n) => ({ ...n, priority: e.target.value as Priority }))}
                    className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary"
                  >
                    <option value="High">{t("pm.common.priority.high")}</option>
                    <option value="Medium">{t("pm.common.priority.medium")}</option>
                    <option value="Low">{t("pm.common.priority.low")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{t("pm.tasks.modal.deadline")}</label>
                  <input
                    type="date"
                    min={todayInputValue()}
                    value={newTask.deadline ?? ""}
                    onChange={(e) => { setFormError(""); setNewTask((n) => ({ ...n, deadline: e.target.value })); }}
                    className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{t("pm.tasks.modal.initialCol")}</label>
                <select
                  value={newTask.col ?? "todo"}
                  onChange={(e) => setNewTask((n) => ({ ...n, col: e.target.value as Col }))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary"
                >
                  {COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:text-foreground">
                {t("pm.common.cancel")}
              </button>
              <button
                onClick={createTask}
                disabled={!newTask.title || !newTask.projectId || !newTask.deadline || busyAction === "create"}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 flex items-center gap-2"
              >
                {busyAction === "create" && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
                {t("pm.tasks.modal.submit")}
              </button>
            </div>
          </div>
        </>
      )}

      {editingTask && taskDraft && (
        <>
          <div aria-hidden="true" className="fixed inset-0 bg-black/40 z-50" onClick={closeTaskEditor} />
          <aside
            ref={editTaskRef as React.RefObject<HTMLElement>}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-task-title"
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l bg-background shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{editingTask.client}</p>
                <h2 id="edit-task-title" className="truncate text-lg font-bold">
                  {t("pm.tasks.edit.title")}
                </h2>
              </div>
              <button onClick={closeTaskEditor} aria-label={t("pm.common.cancel")} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {editError && (
                <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                  {editError}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{t("pm.tasks.modal.taskTitle")}</label>
                <input
                  value={taskDraft.title}
                  onChange={(e) => setTaskDraft((current) => current ? { ...current, title: e.target.value } : current)}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{t("pm.tasks.modal.project")}</label>
                <select
                  value={taskDraft.projectId}
                  onChange={(e) => setTaskDraft((current) => current ? { ...current, projectId: e.target.value } : current)}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary"
                >
                  <option value="">{t("pm.tasks.modal.select")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.client} / {project.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{t("pm.tasks.modal.priority")}</label>
                  <select
                    value={taskDraft.priority}
                    onChange={(e) => setTaskDraft((current) => current ? { ...current, priority: e.target.value as Priority } : current)}
                    className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary"
                  >
                    <option value="High">{t("pm.common.priority.high")}</option>
                    <option value="Medium">{t("pm.common.priority.medium")}</option>
                    <option value="Low">{t("pm.common.priority.low")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{t("pm.tasks.modal.deadline")}</label>
                  <input
                    type="date"
                    value={taskDraft.deadline}
                    onChange={(e) => setTaskDraft((current) => current ? { ...current, deadline: e.target.value } : current)}
                    className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{t("pm.tasks.modal.initialCol")}</label>
                <select
                  value={taskDraft.col}
                  onChange={(e) => setTaskDraft((current) => current ? { ...current, col: e.target.value as Col } : current)}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-muted/30 outline-none focus:border-primary"
                >
                  {COLS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  {t("pm.tasks.modal.notes")}
                </label>
                <textarea
                  value={taskDraft.notes}
                  onChange={(e) => setTaskDraft((current) => current ? { ...current, notes: e.target.value } : current)}
                  rows={6}
                  className="w-full resize-none rounded-md border bg-muted/30 px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button onClick={closeTaskEditor} className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:text-foreground">
                {t("pm.common.cancel")}
              </button>
              <button
                onClick={saveTaskEdits}
                disabled={busyAction === "edit"}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 flex items-center gap-2"
              >
                {busyAction === "edit" && <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
                {t("pm.common.save")}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Delete task confirmation */}
      {confirmDeleteTask && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => setConfirmDeleteTask(null)}
          />
          <div
            ref={deleteTaskRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-task-confirm-title"
            className="fixed left-1/2 top-1/2 z-[61] w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl"
          >
            <h2 id="delete-task-confirm-title" className="mb-1 text-base font-bold">
              {t("pm.tasks.confirmDelete.title")}
            </h2>
            <p className="mb-1 truncate text-sm font-medium text-foreground">
              {confirmDeleteTask.title}
            </p>
            <p className="mb-5 text-sm text-muted-foreground">
              {t("pm.tasks.confirmDelete.body")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteTask(null)}
                className="rounded-md border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                {t("pm.common.cancel")}
              </button>
              <button
                onClick={async () => {
                  const task = confirmDeleteTask;
                  setConfirmDeleteTask(null);
                  await deleteTask(task);
                }}
                disabled={Boolean(busyAction)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t("pm.tasks.actions.delete")}
              </button>
            </div>
          </div>
        </>
      )}

    </DashboardLayout>
  );
}
