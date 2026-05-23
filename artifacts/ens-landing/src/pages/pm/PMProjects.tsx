import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  createPlatformProject,
  getPlatformProjects,
  type PlatformProject,
} from "@/lib/platform-api";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Plus,
  Ruler,
  Search,
  User,
  X,
} from "lucide-react";

const STATUS_OPTIONS = [
  "All",
  "Planning",
  "In Design",
  "Client Review",
  "Revision",
  "Delayed",
  "Approved",
  "Completed",
] as const;

type FilterStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  Planning: { bg: "rgba(194,65,12,0.1)", text: "#c2410c" },
  "In Design": { bg: "rgba(47,125,58,0.1)", text: "#2f7d3a" },
  "Client Review": { bg: "rgba(29,78,216,0.1)", text: "#1d4ed8" },
  Revision: { bg: "rgba(217,119,6,0.1)", text: "#d97706" },
  Delayed: { bg: "rgba(220,38,38,0.1)", text: "#dc2626" },
  Approved: { bg: "rgba(34,197,94,0.1)", text: "#16a34a" },
  Completed: { bg: "rgba(29,78,216,0.1)", text: "#1d4ed8" },
};

const PRIORITY_COLOR: Record<string, string> = {
  High: "#dc2626",
  Medium: "#d97706",
  Low: "#6b7280",
};

const PM_FALLBACKS = ["Sarah M.", "Alex K.", "Jordan L.", "Maya R.", "Chris P."];
const PRIORITIES = ["High", "Medium", "Low", "High", "Medium"] as const;

export default function PMProjects() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("All");
  const [view, setView] = useState<"list" | "grid">("list");
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    client: "",
    system: "octanorm",
    width: "6",
    depth: "3",
    deadline: "",
  });
  const [projects, setProjects] = useState<PlatformProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let mounted = true;

    getPlatformProjects()
      .then((data) => {
        if (mounted) setProjects(data.projects);
      })
      .catch((reason: unknown) => {
        if (!mounted) return;
        showToast(reason instanceof Error ? reason.message : "Unable to load projects");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const counts = useMemo(() => {
    return projects.reduce<Record<string, number>>((acc, project) => {
      acc[project.status] = (acc[project.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [projects]);

  const filtered = projects.filter((project) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      project.name.toLowerCase().includes(query) ||
      project.client.toLowerCase().includes(query) ||
      project.exhibition.toLowerCase().includes(query);
    const matchesStatus = filter === "All" || project.status === filter;

    return matchesSearch && matchesStatus;
  });

  async function createProject() {
    if (!newProject.name.trim() || !newProject.client.trim() || isSaving) return;

    setIsSaving(true);

    try {
      const created = await createPlatformProject(newProject);
      setProjects((current) => [
        created.project,
        ...current.filter((project) => project.id !== created.project.id),
      ]);
      setShowCreate(false);
      setNewProject({ name: "", client: "", system: "octanorm", width: "6", depth: "3", deadline: "" });
      showToast(`Project "${created.project.name}" saved to PostgreSQL`);
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Unable to create project");
    } finally {
      setIsSaving(false);
    }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader title="My Projects" breadcrumbs={[{ label: "Dashboard", href: "/pm" }, { label: "Projects" }]}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-1">
              {([
                ["list", List],
                ["grid", LayoutGrid],
              ] as const).map(([key, Icon]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  data-testid={`button-view-${key}`}
                  className={`rounded p-1.5 transition-colors ${
                    view === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              data-testid="button-create-project"
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> New Project
            </button>
          </div>
        </PageHeader>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total", value: projects.length, Icon: Layers, color: "text-foreground" },
            { label: "In Design", value: counts["In Design"] ?? 0, Icon: CheckCircle2, color: "text-green-600" },
            { label: "Review", value: counts["Client Review"] ?? 0, Icon: Clock, color: "text-blue-600" },
            { label: "Delayed", value: counts.Delayed ?? 0, Icon: AlertCircle, color: "text-red-600" },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`rounded-md border px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wide transition-all ${
                  filter === status
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground/50"
                }`}
              >
                {status}
                {status !== "All" && counts[status] !== undefined ? ` ${counts[status]}` : ""}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects..."
                className="h-8 w-52 rounded-md border bg-muted/30 pl-8 pr-3 text-xs outline-none focus:border-primary"
                data-testid="input-search-projects"
              />
            </div>
            <button className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground" data-testid="button-filter">
              <Filter className="h-3 w-3" /> Filter
            </button>
          </div>
        </div>

        {view === "list" ? (
          <ProjectTable projects={filtered} isLoading={isLoading} />
        ) : (
          <ProjectGrid projects={filtered} isLoading={isLoading} />
        )}
      </div>

      {showCreate && (
        <CreateProjectModal
          value={newProject}
          isSaving={isSaving}
          onChange={setNewProject}
          onCancel={() => setShowCreate(false)}
          onSubmit={createProject}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-xl">
          <CheckCircle2 className="h-4 w-4 text-green-400" /> {toast}
        </div>
      )}
    </DashboardLayout>
  );
}

function ProjectTable({ projects, isLoading }: { projects: PlatformProject[]; isLoading: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20">
            {["Project", "Client", "Size", "Progress", "Deadline", "Status", "Actions"].map((heading) => (
              <th key={heading} className="px-4 py-2.5 text-left text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((project, index) => {
            const status = STATUS_COLOR[project.status] ?? STATUS_COLOR.Planning;
            const priority = PRIORITIES[index % PRIORITIES.length];

            return (
              <tr key={project.id} className="group border-b transition-colors last:border-0 hover:bg-muted/10">
                <td className="px-4 py-3">
                  <div className="text-sm font-semibold leading-tight">{project.name}</div>
                  <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">{project.exhibition}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">{project.client}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <User className="h-2.5 w-2.5" />
                    {project.pm || PM_FALLBACKS[index % PM_FALLBACKS.length]}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 whitespace-nowrap text-xs font-mono">
                    <Ruler className="h-2.5 w-2.5 text-muted-foreground" />
                    {project.dimensions}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-mono uppercase text-muted-foreground">{project.system}</span>
                </td>
                <td className="min-w-[120px] px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-mono">
                    <span style={{ color: PRIORITY_COLOR[priority] }}>{priority}</span>
                    <span className="text-muted-foreground">{project.progress}%</span>
                  </div>
                  <ProgressBar value={project.progress} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDeadline(project.deadline)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold font-mono" style={{ background: status.bg, color: status.text }}>
                    {project.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link href="/pm/workspace">
                      <button className="flex items-center gap-1 whitespace-nowrap rounded border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white">
                        <Layers className="h-2.5 w-2.5" /> Open
                      </button>
                    </Link>
                    <button className="flex items-center gap-1 whitespace-nowrap rounded border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      <ArrowUpRight className="h-2.5 w-2.5" /> Details
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!projects.length && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {isLoading ? "Loading projects from PostgreSQL..." : "No projects match your filter."}
        </div>
      )}
    </div>
  );
}

function ProjectGrid({ projects, isLoading }: { projects: PlatformProject[]; isLoading: boolean }) {
  if (!projects.length) {
    return (
      <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
        {isLoading ? "Loading projects from PostgreSQL..." : "No projects match your filter."}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => {
        const status = STATUS_COLOR[project.status] ?? STATUS_COLOR.Planning;

        return (
          <div key={project.id} className="rounded-lg border bg-card transition-all hover:border-primary/50 hover:shadow-md">
            <div className="p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold leading-tight">{project.name}</h3>
                  <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">{project.client}</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold font-mono" style={{ background: status.bg, color: status.text }}>
                  {project.status}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {[
                  ["System", project.system.toUpperCase()],
                  ["Size", project.dimensions],
                  ["Deadline", formatDeadline(project.deadline, false)],
                  ["PM", project.pm],
                ].map(([label, value]) => (
                  <div key={label} className="rounded bg-muted/30 p-1.5">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-[11px] font-semibold font-mono">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <ProgressBar value={project.progress} />
              </div>
              <Link href="/pm/workspace">
                <button className="flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/20 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white">
                  <Layers className="h-3 w-3" /> Open Workspace
                </button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreateProjectModal({
  value,
  isSaving,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: { name: string; client: string; system: string; width: string; depth: string; deadline: string };
  isSaving: boolean;
  onChange: (value: { name: string; client: string; system: string; width: string; depth: string; deadline: string }) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Create New Project</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {([
            ["Project Name", "name"],
            ["Client", "client"],
          ] as const).map(([label, key]) => (
            <div key={key}>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</label>
              <input
                value={value[key]}
                onChange={(event) => onChange({ ...value, [key]: event.target.value })}
                placeholder={label}
                className="h-9 w-full rounded-md border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          ))}

          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Deadline</label>
            <input
              type="date"
              value={value.deadline}
              onChange={(event) => onChange({ ...value, deadline: event.target.value })}
              className="h-9 w-full rounded-md border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">System</label>
            <select
              value={value.system}
              onChange={(event) => onChange({ ...value, system: event.target.value })}
              className="h-9 w-full rounded-md border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
            >
              <option value="octanorm">Octanorm</option>
              <option value="maxima">Maxima</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {([
              ["Width (m)", "width"],
              ["Depth (m)", "depth"],
            ] as const).map(([label, key]) => (
              <div key={key}>
                <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.5"
                  value={value[key]}
                  onChange={(event) => onChange({ ...value, [key]: event.target.value })}
                  className="h-9 w-full rounded-md border bg-muted/30 px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!value.name.trim() || !value.client.trim() || isSaving}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            {isSaving ? "Saving..." : "Create Project"}
          </button>
        </div>
      </div>
    </>
  );
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? "#2f7d3a" : value >= 40 ? "#1d4ed8" : "#c2410c";
  return (
    <div style={{ height: 4, borderRadius: 2, background: "#e5e7eb", overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 2 }} />
    </div>
  );
}

function formatDeadline(value: string | null, includeYear = true) {
  if (!value) return "No deadline";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "2-digit" as const } : {}),
  });
}
