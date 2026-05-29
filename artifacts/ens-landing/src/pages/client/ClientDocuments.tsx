import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  FileText,
  Download,
  Upload,
  Search,
  Eye,
  Trash2,
  File,
  Image,
  FileSpreadsheet,
  X,
  CheckCircle2,
} from "lucide-react";

type DocType = "pdf" | "image" | "spreadsheet" | "doc";
type DocStatus = "final" | "draft" | "review";

interface Doc {
  id: string;
  name: string;
  type: DocType;
  size: string;
  uploadedAt: string;
  uploadedBy: string;
  status: DocStatus;
  category: string;
  tags: string[];
}

const TYPE_CFG: Record<
  DocType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  pdf: { icon: FileText, color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
  image: { icon: Image, color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  spreadsheet: {
    icon: FileSpreadsheet,
    color: "#2f7d3a",
    bg: "rgba(47,125,58,0.08)",
  },
  doc: { icon: File, color: "#1d4ed8", bg: "rgba(29,78,216,0.08)" },
};

const STATUS_CFG: Record<DocStatus, { text: string; bg: string }> = {
  final: { text: "#2f7d3a", bg: "rgba(47,125,58,0.08)" },
  draft: { text: "#d97706", bg: "rgba(217,119,6,0.08)" },
  review: { text: "#1d4ed8", bg: "rgba(29,78,216,0.08)" },
};

const INITIAL_DOCS: Doc[] = [
  {
    id: "d1",
    name: "TechCon_2024_Design_Brief.pdf",
    type: "pdf",
    size: "2.4 MB",
    uploadedAt: "May 15, 2024",
    uploadedBy: "You",
    status: "final",
    category: "Brief",
    tags: ["design", "reference"],
  },
  {
    id: "d2",
    name: "Brand_Guidelines_v3.pdf",
    type: "pdf",
    size: "8.1 MB",
    uploadedAt: "May 14, 2024",
    uploadedBy: "You",
    status: "final",
    category: "Branding",
    tags: ["brand", "logo"],
  },
  {
    id: "d3",
    name: "Booth_Render_v2.4.png",
    type: "image",
    size: "3.8 MB",
    uploadedAt: "May 18, 2024",
    uploadedBy: "Sarah M. (PM)",
    status: "review",
    category: "Renders",
    tags: ["render", "preview"],
  },
  {
    id: "d4",
    name: "Stand_BOM_v2.xlsx",
    type: "spreadsheet",
    size: "156 KB",
    uploadedAt: "May 16, 2024",
    uploadedBy: "Sarah M. (PM)",
    status: "final",
    category: "BOM",
    tags: ["materials", "list"],
  },
  {
    id: "d5",
    name: "Contract_TechCon2024.pdf",
    type: "pdf",
    size: "520 KB",
    uploadedAt: "May 10, 2024",
    uploadedBy: "You",
    status: "final",
    category: "Legal",
    tags: ["contract", "signed"],
  },
  {
    id: "d6",
    name: "Venue_FloorPlan_TechCon.pdf",
    type: "pdf",
    size: "1.2 MB",
    uploadedAt: "May 8, 2024",
    uploadedBy: "Sarah M. (PM)",
    status: "final",
    category: "Venue",
    tags: ["floor", "map"],
  },
  {
    id: "d7",
    name: "Reference_Images.zip",
    type: "doc",
    size: "24 MB",
    uploadedAt: "May 6, 2024",
    uploadedBy: "You",
    status: "final",
    category: "Reference",
    tags: ["inspiration", "images"],
  },
  {
    id: "d8",
    name: "Revision_Notes_v2.3.doc",
    type: "doc",
    size: "88 KB",
    uploadedAt: "May 12, 2024",
    uploadedBy: "Sarah M. (PM)",
    status: "draft",
    category: "Notes",
    tags: ["notes", "revision"],
  },
];

const DATA_CATEGORIES = Array.from(
  new Set(INITIAL_DOCS.map((d) => d.category)),
);

export default function ClientDocuments() {
  const { t, i18n } = useTranslation();
  const [docs, setDocs] = useState<Doc[]>(INITIAL_DOCS);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [dragOver, setDragOver] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [preview, setPreview] = useState<Doc | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = t("client.documents.pageTitle");
  }, [t]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const handleUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const type: DocType = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
        ? "image"
        : ["xls", "xlsx", "csv"].includes(ext)
          ? "spreadsheet"
          : ext === "pdf"
            ? "pdf"
            : "doc";
      const newDoc: Doc = {
        id: `d${Date.now()}-${Math.random()}`,
        name: file.name,
        type,
        size:
          file.size > 1024 * 1024
            ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
            : `${Math.round(file.size / 1024)} KB`,
        uploadedAt: new Date().toLocaleDateString(i18n.language, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        uploadedBy: "You",
        status: "draft",
        category: "Uploaded",
        tags: ["new"],
      };
      setDocs((prev) => [newDoc, ...prev]);
    });
    showToast(t("client.documents.toast.uploaded", { count: files.length }));
  };

  const deleteDoc = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    showToast(t("client.documents.toast.fileRemoved"));
  };

  const simulateDownload = (doc: Doc) => {
    showToast(t("client.documents.toast.downloading", { name: doc.name }));
  };

  const filtered = docs.filter((d) => {
    const q = search.toLowerCase();
    const match =
      d.name.toLowerCase().includes(q) ||
      d.tags.some((tag) => tag.includes(q)) ||
      d.category.toLowerCase().includes(q);
    const cat = category === "All" || d.category === category;
    return match && cat;
  });

  const stats = useMemo(
    () => [
      {
        label: t("client.documents.stat.total"),
        value: docs.length,
        color: "text-foreground",
      },
      {
        label: t("client.documents.stat.final"),
        value: docs.filter((d) => d.status === "final").length,
        color: "text-green-600",
      },
      {
        label: t("client.documents.stat.inReview"),
        value: docs.filter((d) => d.status === "review").length,
        color: "text-blue-600",
      },
      {
        label: t("client.documents.stat.drafts"),
        value: docs.filter((d) => d.status === "draft").length,
        color: "text-orange-600",
      },
    ],
    [docs, t],
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

  return (
    <DashboardLayout role="client">
      {/* ARIA live region for toast notifications */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xl transition-all duration-300 ${
          toastVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        <CheckCircle2 className="h-4 w-4 text-green-400" aria-hidden="true" />
        {toastMsg}
      </div>

      <div className="space-y-6">
        <PageHeader
          title={t("client.documents.title")}
          breadcrumbs={[
            {
              label: t("client.documents.breadcrumbDashboard"),
              href: "/client",
            },
            { label: t("client.documents.title") },
          ]}
        >
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
            data-testid="button-upload"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {t("client.documents.uploadBtn")}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            aria-hidden="true"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="border rounded-lg p-3.5 bg-card">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                {s.label}
              </p>
              <p className={`text-2xl font-bold font-mono ${s.color}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleUpload(e.dataTransfer.files);
          }}
          role="region"
          aria-label={t("client.documents.dropZone.ariaLabel")}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border/60 hover:border-primary/40"
          }`}
        >
          <Upload
            className="h-8 w-8 mx-auto mb-2 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-muted-foreground">
            {t("client.documents.dropZone.textBefore")}{" "}
            <button
              onClick={() => fileInput.current?.click()}
              className="text-primary underline underline-offset-2"
            >
              {t("client.documents.dropZone.browse")}
            </button>
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
            {t("client.documents.dropZone.hint")}
          </p>
        </div>

        {/* Category filter + search */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div
            className="flex items-center gap-1.5 flex-wrap"
            role="group"
            aria-label={t("client.documents.filterGroup")}
          >
            {["All", ...DATA_CATEGORIES].map((cat) => (
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
          <table className="w-full text-sm">
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
              {filtered.map((doc) => {
                const tc = TYPE_CFG[doc.type];
                const sc = STATUS_CFG[doc.status];
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
                          <Icon
                            className="h-4 w-4"
                            style={{ color: tc.color }}
                          />
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
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {doc.uploadedBy}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                      {doc.uploadedAt}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[11px] font-mono font-bold capitalize px-2 py-0.5 rounded"
                        style={{ background: sc.bg, color: sc.text }}
                      >
                        {t(`client.documents.status.${doc.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setPreview(doc)}
                          aria-label={t("client.documents.actions.preview", {
                            name: doc.name,
                          })}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => simulateDownload(doc)}
                          aria-label={t(
                            "client.documents.actions.download",
                            { name: doc.name },
                          )}
                          className="p-1.5 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground"
                          data-testid={`button-download-${doc.id}`}
                        >
                          <Download
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        </button>
                        {doc.uploadedBy === "You" && (
                          <button
                            onClick={() => deleteDoc(doc.id)}
                            aria-label={t(
                              "client.documents.actions.remove",
                              { name: doc.name },
                            )}
                            className="p-1.5 rounded hover:bg-red-50 hover:text-red-500 text-muted-foreground"
                          >
                            <Trash2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
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
                      <Icon
                        className="h-5 w-5"
                        style={{ color: tc.color }}
                      />
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
                {
                  key: t("client.documents.preview.category"),
                  value: preview.category,
                },
                {
                  key: t("client.documents.preview.status"),
                  value: t(`client.documents.status.${preview.status}`),
                },
                {
                  key: t("client.documents.preview.uploadedBy"),
                  value: preview.uploadedBy,
                },
                {
                  key: t("client.documents.preview.tags"),
                  value: preview.tags.join(", "),
                },
              ].map(({ key, value }) => (
                <div key={key} className="bg-muted/30 rounded p-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                    {key}
                  </p>
                  <p className="font-semibold capitalize">{value}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                simulateDownload(preview);
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
