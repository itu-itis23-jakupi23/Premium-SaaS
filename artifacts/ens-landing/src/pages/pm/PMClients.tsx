import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getPlatformClients, type PlatformClient } from "@/lib/platform-api";
import {
  Search,
  Monitor,
  Mail,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  Users,
  type LucideIcon,
} from "lucide-react";

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  Active: { bg: "rgba(47,125,58,0.1)", text: "#2f7d3a" },
  Lead: { bg: "rgba(29,78,216,0.1)", text: "#1d4ed8" },
  Pending: { bg: "rgba(194,65,12,0.1)", text: "#c2410c" },
  Inactive: { bg: "rgba(107,114,128,0.12)", text: "#6b7280" },
};

export default function PMClients() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clients, setClients] = useState<PlatformClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getPlatformClients()
      .then((data) => {
        if (!isMounted) return;
        setClients(data.clients);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Could not load clients.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return clients;

    return clients.filter((client) =>
      [client.name, client.contactName, client.contactEmail, client.exhibition, client.pm]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [clients, search]);

  const activeCount = clients.filter((client) => client.status === "Active").length;
  const pendingCount = clients.filter((client) => ["Lead", "Pending"].includes(client.status)).length;

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader title="My Clients" breadcrumbs={[{ label: "Dashboard", href: "/pm" }, { label: "My Clients" }]}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients..."
              className="pl-8 pr-3 h-8 text-xs border rounded-md bg-muted/30 outline-none focus:border-primary w-48"
            />
          </div>
        </PageHeader>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {([
            ["Total Clients", clients.length, "text-foreground", Users],
            ["Active", activeCount, "text-green-600", CheckCircle2],
            ["Needs Setup", pendingCount, "text-orange-600", AlertCircle],
          ] satisfies Array<[string, number, string, LucideIcon]>).map(([label, value, color, Icon]) => (
            <div key={label as string} className="border rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label as string}</p>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={`text-2xl font-bold font-mono mt-2 ${color as string}`}>{value as number}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2.5">
          {isLoading ? (
            <EmptyState text="Loading clients from PostgreSQL..." />
          ) : filtered.length > 0 ? (
            filtered.map((client) => {
              const sc = STATUS_COLOR[client.status] ?? STATUS_COLOR.Pending;
              const isExpanded = expanded === client.id;

              return (
                <div key={client.id} className="border rounded-lg bg-card overflow-hidden hover:border-primary/30 transition-all">
                  <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : client.id)}>
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-bold text-primary">{initials(client.name)}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{client.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.text }}>{client.status}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {client.contactName} / {client.contactEmail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-mono bg-muted/50 border rounded px-2 py-0.5 max-w-[180px] truncate">{client.exhibition}</span>
                      <a
                        href={`mailto:${client.contactEmail}`}
                        onClick={(event) => event.stopPropagation()}
                        title="Email client"
                        className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border hover:border-primary/30 transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                      <Link href="/pm/workspace">
                        <button
                          onClick={(event) => event.stopPropagation()}
                          title="Open workspace"
                          className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border hover:border-primary/30 transition-colors"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t bg-muted/10 p-5 grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Client Details</p>
                        <div className="space-y-2.5">
                          <DetailRow icon={Building2} value={client.name} />
                          <DetailRow icon={Mail} value={client.contactEmail} />
                          <DetailRow icon={Users} value={`Assigned PM: ${client.pm}`} />
                          <DetailRow icon={Layers} value={client.exhibition} />
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Operational Status</p>
                        <div className="space-y-2">
                          <div className="flex items-start gap-3 p-2.5 rounded-md bg-card border border-border/50">
                            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 bg-primary/10">
                              <Clock className="h-3 w-3 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11.5px] font-medium leading-tight">Last activity: {client.lastActivity}</p>
                              <p className="text-[9.5px] font-mono text-muted-foreground mt-0.5">Loaded from PostgreSQL client and project records</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <EmptyState text="No clients match the current search." />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function DetailRow({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <div className="w-7 h-7 rounded bg-muted/50 flex items-center justify-center flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
