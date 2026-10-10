import { useMemo, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { Search, Trash2, X } from "lucide-react";
import { ENS_FURNITURE_ITEMS, type FurnitureCatalogItem } from "@/lib/furniture-catalog";
import { HelpHint } from "@/components/HelpHint";
import { MONO } from "./client-workspace-model";

/**
 * The furniture a client may add, and the pieces they have placed.
 *
 * Deliberately furniture only: structure, fascia and lighting belong to the PM,
 * and the proposal endpoint drops anything else regardless, so offering them
 * here would only promise something the server would quietly undo.
 */
export interface ClientFurniturePanelProps {
  placed: { id: string; catalogId: string; name: string; kind: string }[];
  draggingId: string | null;
  onBeginDrag: (event: DragEvent<HTMLElement>, item: FurnitureCatalogItem) => void;
  onEndDrag: () => void;
  /** Click or keyboard: place the piece without a drag. */
  onAdd: (item: FurnitureCatalogItem) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  colors: { bg: string; panel: string; hair: string; ink: string; muted: string; blue: string };
}

export function ClientFurniturePanel({
  placed, draggingId, onBeginDrag, onEndDrag, onAdd, onRemove, onReset, colors: C,
}: ClientFurniturePanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ENS_FURNITURE_ITEMS;
    return ENS_FURNITURE_ITEMS.filter(
      (item) => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q),
    );
  }, [search]);

  const mine = placed.filter((item) => item.kind === "furniture");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.panel }}>
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.hair}` }}>
        <div style={{ position: "relative" }}>
          <Search
            size={13}
            aria-hidden
            style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: C.muted }}
          />
          <label htmlFor="client-furniture-search" className="sr-only">
            {t("client.workspace.propose.searchLabel")}
          </label>
          <input
            id="client-furniture-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("client.workspace.propose.searchPlaceholder")}
            style={{
              width: "100%", padding: "6px 8px 6px 26px", fontSize: 11, fontFamily: MONO,
              background: C.bg, color: C.ink, border: `1px solid ${C.hair}`, borderRadius: 4,
            }}
          />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 10, color: C.muted, lineHeight: 1.4, display: "flex", gap: 6, alignItems: "flex-start" }}>
          <span style={{ flex: 1 }}>{t("client.workspace.propose.addHint")}</span>
          <HelpHint
            title="help.workspace.propose.title"
            body="help.workspace.propose.body"
            note="help.workspace.propose.note"
            side="left"
          />
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {results.map((item) => {
            const isDragging = draggingId === item.id;
            const count = mine.filter((p) => p.catalogId === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                draggable
                onDragStart={(event) => onBeginDrag(event, item)}
                onDragEnd={onEndDrag}
                onClick={() => onAdd(item)}
                title={item.name}
                aria-label={t("client.workspace.propose.addItem", { name: item.name })}
                style={{
                  position: "relative", cursor: "grab", borderRadius: 5, padding: "7px 6px",
                  background: isDragging ? `${C.blue}18` : C.bg,
                  border: `1px ${isDragging ? "solid" : "dashed"} ${isDragging ? C.blue : C.hair}`,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center",
                  font: "inherit", color: "inherit", width: "100%",
                }}
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    style={{ width: 34, height: 34, objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: 3, background: C.hair }} />
                )}
                <span style={{ fontSize: 9, color: C.ink, lineHeight: 1.2 }}>
                  {item.name.split(" - ").pop()}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: C.muted }}>{item.sku}</span>
                {count > 0 && (
                  <span
                    style={{
                      position: "absolute", top: 3, right: 3, background: C.blue, color: "#fff",
                      borderRadius: 2, padding: "0 3px", fontFamily: MONO, fontSize: 8, fontWeight: 700,
                    }}
                  >
                    ×{count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {results.length === 0 && (
          <p style={{ padding: "18px 4px", textAlign: "center", fontSize: 11, color: C.muted, fontFamily: MONO }}>
            {t("client.workspace.propose.noResults")}
          </p>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${C.hair}`, maxHeight: "34%", overflowY: "auto" }}>
        <div
          style={{
            padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em",
            textTransform: "uppercase", color: C.muted,
          }}
        >
          <span>{t("client.workspace.propose.yourFurniture", { count: mine.length })}</span>
          {mine.length > 0 && (
            <button
              type="button"
              onClick={onReset}
              style={{ fontFamily: MONO, fontSize: 9, color: C.muted, textTransform: "uppercase", cursor: "pointer" }}
            >
              {t("client.workspace.propose.reset")}
            </button>
          )}
        </div>
        {mine.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
              borderTop: `1px solid ${C.hair}`, fontSize: 10, color: C.ink,
            }}
          >
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.name.split(" - ").pop()}
            </span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={t("client.workspace.propose.removeItem", { name: item.name })}
              style={{ cursor: "pointer", color: C.muted, display: "flex" }}
            >
              <Trash2 size={11} aria-hidden />
            </button>
          </div>
        ))}
        {mine.length === 0 && (
          <p style={{ padding: "12px", textAlign: "center", fontSize: 10, color: C.muted, fontFamily: MONO }}>
            {t("client.workspace.propose.nothingPlaced")}
          </p>
        )}
      </div>
    </div>
  );
}

/** The small dialog that sends a finished layout to the project manager. */
export function ClientProposeSubmitDialog({
  open, note, saving, onNote, onCancel, onSubmit, colors: C,
}: {
  open: boolean;
  note: string;
  saving: boolean;
  onNote: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  colors: { panel: string; hair: string; ink: string; muted: string; blue: string; bg: string };
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("client.workspace.propose.submitTitle")}
      style={{
        position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center",
        justifyContent: "center", background: "rgba(0,0,0,0.45)", padding: 16,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, background: C.panel, border: `1px solid ${C.hair}`, borderRadius: 8, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.ink }}>
            {t("client.workspace.propose.submitTitle")}
          </h2>
          <button type="button" onClick={onCancel} aria-label={t("client.workspace.propose.cancel")} style={{ cursor: "pointer", color: C.muted, display: "flex" }}>
            <X size={15} aria-hidden />
          </button>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
          {t("client.workspace.propose.submitBody")}
        </p>
        <label htmlFor="propose-note" className="sr-only">{t("client.workspace.propose.noteLabel")}</label>
        <textarea
          id="propose-note"
          value={note}
          onChange={(event) => onNote(event.target.value)}
          rows={3}
          placeholder={t("client.workspace.propose.notePlaceholder")}
          style={{
            width: "100%", padding: 8, fontSize: 11, borderRadius: 4, resize: "vertical",
            background: C.bg, color: C.ink, border: `1px solid ${C.hair}`,
          }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: "6px 12px", fontSize: 11, borderRadius: 4, border: `1px solid ${C.hair}`, color: C.muted, cursor: "pointer" }}
          >
            {t("client.workspace.propose.cancel")}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 700, borderRadius: 4, cursor: saving ? "wait" : "pointer",
              background: C.blue, color: "#fff", border: `1px solid ${C.blue}`, opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? t("client.workspace.propose.sending") : t("client.workspace.propose.send")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * What the project manager decided about the last layout the client sent.
 *
 * The decline reason is the point. Without this the PM types "the aisle has to
 * stay clear", the server stores it, and the client sees their proposal quietly
 * vanish with no explanation at all.
 */
export function ClientProposalDecision({
  proposal, onDismiss, colors: C,
}: {
  proposal: { status: string; decisionNote: string | null; decidedAt: string | null } | null;
  onDismiss: () => void;
  colors: { panel: string; hair: string; ink: string; muted: string; green: string; orange: string };
}) {
  const { t } = useTranslation();
  if (!proposal || (proposal.status !== "accepted" && proposal.status !== "rejected")) return null;

  const accepted = proposal.status === "accepted";
  const accent = accepted ? C.green : C.orange;

  return (
    <div
      role="status"
      style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 40,
        width: "min(420px, calc(100% - 24px))", background: C.panel,
        border: `1px solid ${accent}55`, borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 10px 9px 12px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: accent, textTransform: "uppercase" }}>
            {accepted
              ? t("client.workspace.propose.decision.accepted")
              : t("client.workspace.propose.decision.declined")}
          </div>
          {proposal.decisionNote ? (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: C.ink, lineHeight: 1.5 }}>
              “{proposal.decisionNote}”
            </p>
          ) : (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
              {accepted
                ? t("client.workspace.propose.decision.acceptedBody")
                : t("client.workspace.propose.decision.declinedBody")}
            </p>
          )}
          {proposal.decidedAt && (
            <div style={{ marginTop: 3, fontFamily: MONO, fontSize: 9, color: C.muted }}>
              {new Date(proposal.decidedAt).toLocaleDateString()}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("client.workspace.propose.decision.dismiss")}
          style={{ cursor: "pointer", color: C.muted, display: "flex", flexShrink: 0 }}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
