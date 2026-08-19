import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  FileText,
  Download,
  Search,
  Eye,
  File,
  Image,
  FileSpreadsheet,
  X,
  AlertCircle,
} from "lucide-react";
import { type ClientDocument, getClientDocuments, getDocumentDownloadUrl } from "@/lib/platform-api";

type DocType = "pdf" | "image" | "spreadsheet" | "doc";

function mimeToType(mimeType: string): DocType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv"
  ) return "spreadsheet";
  return "doc";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang, { day: "2-digit", month: "short", year: "numeric" });
}

const TYPE_CFG: Record<DocType, { icon: React.ElementType; color: string; bg: string }> = {
  pdf: { icon: FileText, color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
  image: { icon: Image, color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  spreadsheet: { icon: FileSpreadsheet, color: "#2f7d3a", bg: "rgba(47,125,58,0.08)" },
  doc: { icon: File, color: "#1d4ed8", bg: "rgba(29,78,216,0.08)" },
};

const STATUS_CFG = {
  approved: { text: "#2f7d3a", bg: "rgba(47,125,58,0.08)" },
  pending: { text: "#1d4ed8", bg: "rgba(29,78,216,0.08)" },
};

interface DisplayDoc {
  id: string;
  name: string;
  type: DocType;
  size: string;
  uploadedAt: string;
  uploadedBy: string;
  approved: boolean;
  category: string;
  mimeType: string;
}

function toDisplayDoc(d: ClientDocument, lang: string): DisplayDoc {
  return {
    id: d.id,
    name: d.fileName,
    type: mimeToType(d.mimeType),
    size: formatBytes(d.sizeBytes),
    uploadedAt: formatDate(d.createdAt, lang),
    uploadedBy: d.uploadedBy ?? "Agency",
    approved: d.approvedAt !== null,
    category: d.kind || "General",
    mimeType: d.mimeType,
  };
}

export default function ClientDocuments() {
  const { t, i18n } = useTranslation();
  const [docs, setDocs] = useState<DisplayDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [preview, setPreview] = useState<DisplayDoc | null>(null);

  useEffect(() => {
    document.title = t("client.documents.pageTitle");
  }, [t]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getClientDocuments()
      .then((list) => setDocs(list.map((d) => toDisplayDoc(d, i18n.language))))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load documents"))
      .finally(() => setLoading(false));
  }, [i18n.language]);

  const categories = useMemo(() => Array.from(new Set(docs.map((d) => d.category))), [docs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return docs.filter((d) => {
      const match = d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q);
      const cat = category === "All" || d.category === category;
      return match && cat;
    });
  }, [docs, search, category]);

  const stats = useMemo(
    () => [
      { label: t("client.documents.stat.total"), value: docs.length, color: "text-foreground" },
      { label: t("client.documents.stat.final"), value: docs.filter((d) => d.approved).length, color: "text-green-600" },
      { label: t("client.documents.stat.inReview"), value: docs.filter((d) => !d.approved).length, color: "text-blue-600" },
      { label: t("client.documents.stat.categories"), value: categories.length, color: "text-muted-foreground" },
    ],
    [docs, categories.length, t],
  );

  const tableHeaders = useMemo(
    () => [
      t("client.documents.table.file"),
      t("client.documents.table.category"),
      t("client.documents.table.uploadedBy"),
      t("client.documents.table.date"),
      t("client.documents.table.status"),
      "",
    ],
    [t],
  );

  const handleDownload = (doc: DisplayDoc) => {
    window.open(getDocumentDownloadUrl(doc.id), "_blank", "noopener");
  };

  if (error) {
    return (
      <DashboardLayout role="client">
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <p className="text-sm">{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        <PageHeader
          title={t("client.documents.title")}
          breadcrumbs={[
            { label: t("client.documents.breadcrumbDashboard"), href: "/client" },
            { label: t("client.documents.title") },
          ]}
        />

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="border rounded-lg p-3.5 bg-card">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                {s.label}
              </p>
              <p className={`text-2xl font-bold font-mono ${loading ? "animate-pulse text-muted" : s.color}`}>
                {loading ? "—" : s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Category filter + search */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div
            className="flex items-center gap-1.5 flex-wrap"
            role="group"
            aria-label={t("client.documents.filterGroup")}
          >
            {["All", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono font-bold border transition-all ${
                  category === cat
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/50"
                }`}
              >
                {cat === "All" ? t("client.documents.filter.all") : cat}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="doc-search" className="sr-only">
              {t("client.documents.searchPlaceholder")}
            </label>
            <input
              id="doc-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("client.documents.searchPlaceholder")}
              className="pl-8 pr-3 h-8 text-xs border rounded-md bg-muted/30 outline-none focus:border-primary w-52"
            />
          </div>
        </div>

        {/* File list */}
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="w-full overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b bg-muted/20">
                {tableHeaders.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-bold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b animate-pulse">
                      <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-48" /></td>
                      <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16" /></td>
                      <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-24" /></td>
                      <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20" /></td>
                      <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-12" /></td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))
                : filtered.map((doc) => {
                    const tc = TYPE_CFG[doc.type];
                    const sc = doc.approved ? STATUS_CFG.approved : STATUS_CFG.pending;
                    const Icon = tc.icon;
                    return (
                      <tr
                        key={doc.id}
                        className="border-b last:border-0 hover:bg-muted/10 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                              style={{ background: tc.bg }}
                              aria-hidden="true"
                            >
                              <Icon className="h-4 w-4" style={{ color: tc.color }} />
                            </div>
                            <div>
                              <p className="font-semibold text-sm leading-tight max-w-[280px] truncate">
                                {doc.name}
                              </p>
                              <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                {doc.size}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono bg-muted/50 rounded px-2 py-0.5">
                            {doc.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{doc.uploadedBy}</td>
                        <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                          {doc.uploadedAt}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-[11px] font-mono font-bold capitalize px-2 py-0.5 rounded"
                            style={{ background: sc.bg, color: sc.text }}
                          >
                            {doc.approved
                              ? t("client.documents.status.final")
                              : t("client.documents.status.review")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setPreview(doc)}
                              aria-label={t("client.documents.actions.preview", { name: doc.name })}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => handleDownload(doc)}
                              aria-label={t("client.documents.actions.download", { name: doc.name })}
                              className="p-1.5 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground"
                              data-testid={`button-download-${doc.id}`}
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          </div>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t("client.documents.emptyState")}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50"
            onClick={() => setPreview(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-modal-title"
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-xl p-6 z-50 w-[520px] shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const tc = TYPE_CFG[preview.type];
                  const Icon = tc.icon;
                  return (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: tc.bg }}
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" style={{ color: tc.color }} />
                    </div>
                  );
                })()}
                <div>
                  <h3
                    id="preview-modal-title"
                    className="font-bold text-sm leading-tight max-w-[360px] truncate"
                  >
                    {preview.name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {preview.size} · {preview.uploadedBy} · {preview.uploadedAt}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreview(null)}
                aria-label={t("client.documents.preview.close")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="bg-muted/30 rounded-lg h-48 flex items-center justify-center mb-4 border border-dashed">
              {preview.type === "image" ? (
                <div className="text-center">
                  <Image
                    className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-mono text-muted-foreground">
                    {t("client.documents.preview.imageUnavailable")}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <FileText
                    className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-mono text-muted-foreground">
                    {t("client.documents.preview.typeUnavailable", {
                      type: preview.type.toUpperCase(),
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
              {[
                { key: t("client.documents.preview.category"), value: preview.category },
                {
                  key: t("client.documents.table.status"),
                  value: preview.approved
                    ? t("client.documents.status.final")
                    : t("client.documents.status.review"),
                },
                { key: t("client.documents.preview.uploadedBy"), value: preview.uploadedBy },
                { key: t("client.documents.preview.mimeType"), value: preview.mimeType },
              ].map(({ key, value }) => (
                <div key={key} className="bg-muted/30 rounded p-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                    {key}
                  </p>
                  <p className="font-semibold truncate">{value}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                handleDownload(preview);
                setPreview(null);
              }}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2.5 font-semibold hover:bg-primary/90 transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {t("client.documents.preview.downloadBtn")}
            </button>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
