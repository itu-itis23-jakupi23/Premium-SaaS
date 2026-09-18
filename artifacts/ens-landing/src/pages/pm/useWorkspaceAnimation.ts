import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspacePlacedItem } from "./workspace-model";

/**
 * Makes the workspace's discrete actions legible, without letting the renderer
 * know that anything is moving.
 *
 * Align, distribute, rotate, duplicate and delete all change the stand in one
 * step. Committed straight to the scene they read as cuts: eight chairs are
 * somewhere, then they are somewhere else, and the designer has to work out
 * what happened. Played over ~150 ms they read as the action that caused them.
 *
 * Two rules shape how this is built.
 *
 * The committed state is never animated. `ws.placedItems` goes to its final
 * value immediately, exactly as before - validation, undo history, autosave and
 * the take-off all see the end state on the same tick they always did. What
 * moves is a *display* copy handed to the renderer, which is the committed
 * items with a short-lived override merged over the top. The workspace never
 * holds a position it has not accepted.
 *
 * And the renderer is never taught to animate. booth-render.js draws whatever
 * items it is given; this drives those items from out here, frame by frame,
 * through exactly the path a drag already uses. Nothing in the draw loop gains
 * a notion of time - that layer has lost renderOrder, normal and partId to a
 * single spread-order mistake, and per-frame interpolation inside it would be a
 * correctness risk rather than a polish one.
 *
 * Only x, z, y and rotationY may be driven. Width, depth and height are part of
 * the GLB cache key in booth-render.html, so varying them would dispose and
 * re-clone every model on every frame - which rules out scale-based effects for
 * the whole furniture catalogue, and is why removal lifts an item out rather
 * than shrinking it.
 */

/** The fields that are safe to drive per frame. */
export type ItemOverride = Partial<Pick<WorkspacePlacedItem, "x" | "z" | "y" | "rotationY" | "rotation">>;

export type OverrideMap = Record<string, ItemOverride>;

export interface AnimationSpec {
  /** Milliseconds. Kept short: this confirms an action, it does not stage one. */
  duration: number;
  /** Overrides for a point in the animation. `eased` is 0..1, already eased. */
  frame: (eased: number, raw: number) => OverrideMap;
  /** Items already gone from the workspace that should stay on screen until this ends. */
  ghosts?: WorkspacePlacedItem[];
  /** Runs when the animation finishes, is interrupted, or is skipped entirely. */
  onDone?: () => void;
}

/** Decelerating: fast off the mark, settling into place. */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function useWorkspaceAnimation() {
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [ghosts, setGhosts] = useState<WorkspacePlacedItem[]>([]);
  const frameRef = useRef<number | null>(null);
  const doneRef = useRef<(() => void) | null>(null);

  /**
   * Whether the person at the keyboard has asked for less motion.
   *
   * Read live rather than once, because it can be toggled while the app is
   * open, and an animation that keeps playing after the setting changes is the
   * one thing this must not do.
   */
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  /** Stop whatever is playing and drop back to the committed state. */
  const cancel = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const done = doneRef.current;
    doneRef.current = null;
    setOverrides((current) => (Object.keys(current).length ? {} : current));
    setGhosts((current) => (current.length ? [] : current));
    if (done) done();
  }, []);

  const play = useCallback((spec: AnimationSpec) => {
    // A second action interrupts the first rather than queueing behind it.
    // Holding ] down should chase the rotation, not play out a backlog of
    // fifteen-degree steps after the key comes up.
    cancel();

    if (reducedMotion || spec.duration <= 0) {
      // The committed state is already the end state, so there is nothing to
      // show - just let the caller finish.
      spec.onDone?.();
      return;
    }

    doneRef.current = spec.onDone ?? null;
    if (spec.ghosts?.length) setGhosts(spec.ghosts);

    const started = performance.now();
    const step = () => {
      const raw = Math.min(1, (performance.now() - started) / spec.duration);
      setOverrides(spec.frame(easeOut(raw), raw));
      if (raw < 1) {
        frameRef.current = requestAnimationFrame(step);
        return;
      }
      frameRef.current = null;
      const done = doneRef.current;
      doneRef.current = null;
      setOverrides({});
      setGhosts([]);
      if (done) done();
    };
    frameRef.current = requestAnimationFrame(step);
  }, [cancel, reducedMotion]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const isAnimating = Object.keys(overrides).length > 0 || ghosts.length > 0;

  /**
   * The committed items with the current frame merged over them.
   *
   * Returns the committed array unchanged when nothing is playing, so the
   * iframe payload keeps its identity and no message is sent.
   */
  const withOverrides = useCallback((items: WorkspacePlacedItem[]) => {
    if (!isAnimating) return items;
    const moved = items.map((item) => {
      const override = overrides[item.id];
      return override ? { ...item, ...override } : item;
    });
    if (!ghosts.length) return moved;
    return [
      ...moved,
      ...ghosts.map((ghost) => {
        const override = overrides[ghost.id];
        return override ? { ...ghost, ...override } : ghost;
      }),
    ];
  }, [ghosts, isAnimating, overrides]);

  return useMemo(() => ({
    play, cancel, withOverrides, reducedMotion, isAnimating,
  }), [play, cancel, withOverrides, reducedMotion, isAnimating]);
}
