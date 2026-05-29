import { useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface FocusTrapProps {
  /** Whether the trap is active (modal is open). */
  isActive: boolean;
  /** Called when the user presses Escape. */
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Drop-in wrapper that traps keyboard focus while `isActive` is true.
 * Renders as a plain `<div>` so it can wrap any modal content.
 *
 * Usage:
 *   <FocusTrap isActive={isOpen} onClose={() => setOpen(false)}>
 *     ...modal content...
 *   </FocusTrap>
 */
export function FocusTrap({ isActive, onClose, children, className, style }: FocusTrapProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, isActive, onClose);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
