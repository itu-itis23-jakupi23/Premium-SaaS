import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { Check, X, Eye, EyeOff, Loader2 } from "lucide-react";
import { HelpHint } from "@/components/HelpHint";
import {
  getWorkspaceProposal,
  decideWorkspaceProposal,
  type WorkspaceProposal,
} from "@/lib/platform-api";

type PlacedItem = {
  id: string;
  catalogId: string;
  name: string;
  kind: string;
  x: number;
  z: number;
};

/**
 * What the client changed, in the terms a PM cares about.
 *
 * Only furniture can differ - the server rebuilds everything else from the PM's
 * own version - so this compares furniture and nothing else. Matching is by id,
 * because the client keeps the ids of the pieces they did not touch.
 */
export function furnitureDiff(current: PlacedItem[], proposed: PlacedItem[]) {
  const isFurniture = (item: PlacedItem) => item.kind === "furniture";
  const before = new Map(current.filter(isFurniture).map((item) => [item.id, item]));
  const after = new Map(proposed.filter(isFurniture).map((item) => [item.id, item]));

  const added = [...after.values()].filter((item) => !before.has(item.id));
  const removed = [...before.values()].filter((item) => !after.has(item.id));
  const moved = [...after.values()].filter((item) => {
    const was = before.get(item.id);
    if (!was) return false;
    // A centimetre of drift is the placement grid, not an intention.
    return Math.abs(was.x - item.x) > 0.01 || Math.abs(was.z - item.z) > 0.01;
  });

  return { added, removed, moved, empty: !added.length && !removed.length && !moved.length };
}

export interface PMProposalReviewProps {
  projectId: string | null;
  currentItems: PlacedItem[];
  previewing: boolean;
  onPreviewChange: (on: boolean, items: PlacedItem[] | null) => void;
  /** Reload the workspace after an accepted proposal rewrites the design. */
  onAccepted: () => void;
  onToast: (message: string) => void;
  colors: { panel: string; hair: string; ink: string; muted: string; blue: string; green: string; orange: string };
  mono: string;
}

/**
 * The client's proposed layout, and the PM's decision on it.
 *
 * Shows nothing at all until a proposal is actually waiting, so the workspace is
 * unchanged for the PM who has none.
 */
export function PMProposalReview({
  projectId, currentItems, previewing, onPreviewChange, onAccepted, onToast, colors: C, mono: MONO,
}: PMProposalReviewProps) {
  const [proposal, setProposal] = useState<WorkspaceProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!projectId) { setProposal(null); return; }
    try {
      const state = await getWorkspaceProposal(projectId);
      setProposal(state.proposal?.status === "submitted" ? state.proposal : null);
    } catch {
      setProposal(null);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  // A client can submit while the PM has the workspace open. Without this the
  // card only appears on a reload, and the PM has no reason to perform one.
  // Not while a decision is in flight: reloading mid-request would race the
  // very proposal being accepted.
  useLiveRefresh(load, { intervalMs: 30_000, enabled: !busy });

  const proposedItems = useMemo(
    () => ((proposal?.layout?.placedItems ?? []) as unknown as PlacedItem[]),
    [proposal],
  );
  const diff = useMemo(
    () => furnitureDiff(currentItems, proposedItems),
    [currentItems, proposedItems],
  );

  // Drop the preview if the proposal goes away underneath it, or the PM is left
  // looking at a layout that no longer exists.
  useEffect(() => {
    if (!proposal && previewing) onPreviewChange(false, null);
  }, [proposal, previewing, onPreviewChange]);

  if (!projectId || !proposal) return null;

  const decide = async (decision: "accept" | "reject") => {
    setBusy(true);
    try {
      await decideWorkspaceProposal(projectId, proposal.id, decision, note);
      onPreviewChange(false, null);
      setProposal(null);
      setNote("");
      setRejecting(false);
      if (decision === "accept") onAccepted();
      onToast(decision === "accept" ? "Client layout applied to the design" : "Client layout declined");
    } catch (reason) {
      onToast(reason instanceof Error ? reason.message : "Could not record that decision");
    } finally {
      setBusy(false);
    }
  };

  const line = (label: string, items: PlacedItem[], color: string) =>
    items.length > 0 && (
      <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color, textTransform: "uppercase", minWidth: 52 }}>
          {label}
        </span>
        <span style={{ fontSize: 10.5, color: C.ink, lineHeight: 1.45 }}>
          {items.map((item) => item.name.split(" - ").pop()).join(", ")}
        </span>
      </div>
    );

  return (
    <div
      style={{
        position: "absolute", top: 12, right: 12, zIndex: 30, width: 320,
        background: C.panel, border: `1px solid ${C.blue}55`, borderRadius: 6,
        boxShadow: "0 10px 30px rgba(0,0,0,0.16)", overflow: "hidden",
      }}
    >
      <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.hair}`, background: `${C.blue}0e` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: C.blue, textTransform: "uppercase" }}>
            Client proposed a layout
          </span>
          <HelpHint
            title="help.proposal.review.title"
            body="help.proposal.review.body"
            note="help.proposal.review.note"
            side="left"
          />
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
          {proposal.createdBy ?? "Client"}
          {proposal.submittedAt ? ` · ${new Date(proposal.submittedAt).toLocaleDateString()}` : ""}
        </div>
      </div>

      {proposal.note && (
        <p style={{ margin: 0, padding: "8px 12px", fontSize: 11, color: C.ink, lineHeight: 1.5, borderBottom: `1px solid ${C.hair}` }}>
          “{proposal.note}”
        </p>
      )}

      <div style={{ padding: "8px 12px", display: "grid", gap: 4, borderBottom: `1px solid ${C.hair}` }}>
        {diff.empty ? (
          <span style={{ fontSize: 10.5, color: C.muted }}>No furniture changes — the layout matches the design.</span>
        ) : (
          <>
            {line("Added", diff.added, C.green)}
            {line("Removed", diff.removed, C.orange)}
            {line("Moved", diff.moved, C.muted)}
          </>
        )}
      </div>

      <div style={{ padding: "8px 12px", display: "flex", gap: 6, alignItems: "center" }}>
        <button
          type="button"
          data-testid="proposal-preview"
          onClick={() => onPreviewChange(!previewing, previewing ? null : proposedItems)}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", cursor: "pointer",
            fontSize: 11, borderRadius: 4, border: `1px solid ${previewing ? C.blue : C.hair}`,
            background: previewing ? `${C.blue}14` : "transparent", color: previewing ? C.blue : C.muted,
          }}
        >
          {previewing ? <EyeOff size={12} aria-hidden /> : <Eye size={12} aria-hidden />}
          {previewing ? "Show design" : "Preview"}
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          data-testid="proposal-decline"
          onClick={() => setRejecting((open) => !open)}
          disabled={busy}
          style={{
            display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", cursor: "pointer",
            fontSize: 11, borderRadius: 4, border: `1px solid ${C.hair}`, color: C.muted, background: "transparent",
          }}
        >
          <X size={12} aria-hidden /> Decline
        </button>
        <button
          type="button"
          data-testid="proposal-apply"
          onClick={() => void decide("accept")}
          disabled={busy}
          style={{
            display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", cursor: busy ? "wait" : "pointer",
            fontSize: 11, fontWeight: 700, borderRadius: 4, border: `1px solid ${C.green}`,
            background: C.green, color: "#fff", opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Check size={12} aria-hidden />} Apply
        </button>
      </div>

      {rejecting && (
        <div style={{ padding: "0 12px 10px", display: "grid", gap: 6 }}>
          <label htmlFor="proposal-decline-note" className="sr-only">Why this layout was declined</label>
          <textarea
            id="proposal-decline-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Why? The client sees this."
            style={{ width: "100%", padding: 7, fontSize: 11, borderRadius: 4, border: `1px solid ${C.hair}`, resize: "vertical" }}
          />
          <button
            type="button"
            onClick={() => void decide("reject")}
            disabled={busy || !note.trim()}
            style={{
              padding: "5px 9px", fontSize: 11, fontWeight: 700, borderRadius: 4, cursor: "pointer",
              border: `1px solid ${C.orange}`, background: C.orange, color: "#fff",
              opacity: busy || !note.trim() ? 0.6 : 1,
            }}
          >
            Send decline
          </button>
        </div>
      )}
    </div>
  );
}
