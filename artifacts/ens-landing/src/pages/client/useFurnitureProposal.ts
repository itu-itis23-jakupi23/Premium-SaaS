import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import {
  getWorkspaceProposal,
  saveWorkspaceProposal,
  submitWorkspaceProposal,
  withdrawWorkspaceProposal,
  type ProjectWorkspace,
  type WorkspaceProposal,
  type WorkspaceProposalState,
} from "@/lib/platform-api";
import {
  catalogFurnitureProps,
  type FurnitureCatalogItem,
} from "@/lib/furniture-catalog";

type Workspace = ProjectWorkspace["workspace"];
type PlacedItem = Workspace["placedItems"][number];

/**
 * The client's furniture sandbox.
 *
 * Holds a working copy of the layout that the client can rearrange, saves it to
 * the proposal endpoint, and hands it to the PM on submit. It never writes to
 * the design: the sandbox is a separate record, and the server rebuilds
 * everything but the furniture from the PM's version on every save, so a bug
 * here cannot corrupt a design.
 *
 * `items` is the whole layout - structure included - because that is what the
 * renderer has to draw. Only the furniture in it is ever the client's.
 */
export function useFurnitureProposal(projectId: string | null, base: Workspace | undefined) {
  const [state, setState] = useState<WorkspaceProposalState | null>(null);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const saveTimer = useRef<number | null>(null);
  // The live item list, for callbacks that need it without taking it as a
  // dependency. commitMove fires at the end of a drag gesture, by which point
  // moveItem has already advanced the state several times.
  const itemsRef = useRef<PlacedItem[]>([]);
  itemsRef.current = items;

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      setState(await getWorkspaceProposal(projectId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load proposals.");
    }
  }, [projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // The PM accepting or declining happens elsewhere, so the client learns about
  // it by asking. Paused while they are editing or a save is in flight: a
  // refresh then would pull the server copy out from under the layout they are
  // still arranging.
  useLiveRefresh(refresh, { intervalMs: 30_000, enabled: !editing && !saving });

  const proposal: WorkspaceProposal | null = state?.proposal ?? null;
  const submitted = proposal?.status === "submitted";

  // Start from the sandbox if one exists, otherwise from the PM's design.
  const startingItems = useMemo<PlacedItem[]>(
    () => (proposal?.layout?.placedItems as PlacedItem[] | undefined) ?? base?.placedItems ?? [],
    [proposal, base],
  );

  const start = useCallback(() => {
    setItems(startingItems);
    setEditing(true);
    setDirty(false);
    setError("");
  }, [startingItems]);

  const stop = useCallback(() => {
    setEditing(false);
    setDirty(false);
    if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null; }
  }, []);

  const save = useCallback(async (next: PlacedItem[]) => {
    if (!projectId || !base) return;
    setSaving(true);
    setError("");
    try {
      const saved = await saveWorkspaceProposal(projectId, { ...base, placedItems: next });
      // Trust the server's copy: it is the one that dropped whatever was not
      // furniture, so rendering our own optimistic list would quietly show the
      // client edits that were never stored.
      if (saved?.layout?.placedItems) setItems(saved.layout.placedItems as PlacedItem[]);
      setState((prev) => (prev ? { ...prev, proposal: saved } : prev));
      setDirty(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the layout.");
    } finally {
      setSaving(false);
    }
  }, [projectId, base]);

  // Dragging produces a burst of positions; only the one the client settles on
  // is worth a request.
  const queueSave = useCallback((next: PlacedItem[]) => {
    setItems(next);
    setDirty(true);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void save(next); }, 900);
  }, [save]);

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  }, []);

  const addItem = useCallback((item: FurnitureCatalogItem, at: { x: number; z: number; rotationY?: number }) => {
    const props = catalogFurnitureProps(item);
    const placed = {
      id: `${item.id}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      catalogId: item.id,
      name: item.name,
      sku: item.sku,
      qty: 1,
      ...props,
      x: at.x,
      z: at.z,
      rotation: 0,
      rotationX: 0,
      rotationY: at.rotationY ?? 0,
      rotationZ: 0,
      // Always furniture. The server enforces this too - this is only so the
      // renderer draws it in the right layer before the save round-trips.
      kind: "furniture" as const,
      shape: item.shape,
      modelUrl: item.modelUrl,
    } as unknown as PlacedItem;
    queueSave([...itemsRef.current, placed]);
  }, [queueSave]);

  const moveItem = useCallback((id: string, patch: { x?: number; z?: number; rotationY?: number }) => {
    const applied = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const next = itemsRef.current.map((i) => (i.id === id ? { ...i, ...applied } : i));
    itemsRef.current = next;
    setItems(next);
    setDirty(true);
  }, []);

  /** Called when a drag gesture ends, so the settled position is what is saved. */
  const commitMove = useCallback(() => {
    queueSave(itemsRef.current);
  }, [queueSave]);

  const removeItem = useCallback((id: string) => {
    const target = itemsRef.current.find((i) => i.id === id);
    if (!target || target.kind !== "furniture") return;
    queueSave(itemsRef.current.filter((i) => i.id !== id));
  }, [queueSave]);

  const reset = useCallback(() => {
    queueSave(base?.placedItems ?? []);
  }, [base, queueSave]);

  const submit = useCallback(async (note: string) => {
    if (!projectId) return false;
    if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null; }
    setSaving(true);
    setError("");
    try {
      if (dirty) await save(items);
      await submitWorkspaceProposal(projectId, note);
      await refresh();
      setEditing(false);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit the layout.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [projectId, dirty, items, save, refresh]);

  const discard = useCallback(async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      await withdrawWorkspaceProposal(projectId);
      await refresh();
      stop();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not discard the layout.");
    } finally {
      setSaving(false);
    }
  }, [projectId, refresh, stop]);

  const furnitureCount = items.filter((i) => i.kind === "furniture").length;

  return useMemo(() => ({
    state, proposal, submitted, editing, items, saving, dirty, error, furnitureCount,
    start, stop, addItem, moveItem, commitMove, removeItem, reset, submit, discard, refresh,
    canPropose: state?.canPropose ?? false,
    revisions: state?.revisions ?? null,
    history: state?.history ?? [],
  }), [
    state, proposal, submitted, editing, items, saving, dirty, error, furnitureCount,
    start, stop, addItem, moveItem, commitMove, removeItem, reset, submit, discard, refresh,
  ]);
}
