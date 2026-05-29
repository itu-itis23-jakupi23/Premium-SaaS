import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"]),details>summary,[contenteditable]:not([contenteditable="false"])';

/**
 * Traps keyboard focus inside `containerRef` while `isActive` is true.
 * Restores focus to the previously-focused element on deactivation.
 * Fires `onClose` when the user presses Escape.
 *
 * The ref can be `RefObject<HTMLDivElement>`, `RefObject<HTMLElement>`, etc.
 * We accept the common structural type `{ current: HTMLElement | null }` to
 * avoid TypeScript variance errors.
 */
export function useFocusTrap(
  containerRef: { current: HTMLElement | null },
  isActive: boolean,
  onClose?: () => void,
) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    // Remember who had focus before the modal opened
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest("[aria-hidden='true']"),
      );

    // Focus first focusable element in the modal
    const first = focusables()[0];
    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const con = containerRef.current;
      if (!con) return;

      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = items[0];
      const lastEl = items[items.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl || !con.contains(document.activeElement)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl || !con.contains(document.activeElement)) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the element that was active before the modal
      previouslyFocusedRef.current?.focus();
    };
  // containerRef is a stable object — we only need isActive + onClose in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, onClose]);
}
