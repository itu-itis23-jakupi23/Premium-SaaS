import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * A small "what is this?" marker next to something that needs explaining.
 *
 * Opens on click rather than hover, deliberately. A hover tooltip is invisible
 * on a touch screen and unreachable by keyboard unless it is also focusable, so
 * the two groups most likely to need the explanation are the two least likely
 * to get it. A popover is a real button: tab to it, Enter or Space to open,
 * Escape to close, and it works the same under a finger.
 *
 * `title` and `body` are translation keys rather than strings, so a hint cannot
 * be added in English only - the locale coverage test will fail the build.
 */
export interface HelpHintProps {
  /** Translation key for the heading. */
  title: string;
  /** Translation key for the explanation. */
  body: string;
  /** Translation key for an optional second paragraph, usually the caveat. */
  note?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

export function HelpHint({ title, body, note, side = "top", align = "center", className }: HelpHintProps) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger
        className={[
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle",
          "text-muted-foreground/70 transition-colors hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          className ?? "",
        ].join(" ")}
        // Named for what it explains, so a screen reader reading the controls
        // on a page hears "help: outstanding balance", not fourteen "help"s.
        aria-label={t("help.openLabel", { subject: t(title) })}
        data-testid="help-hint"
        // A hint often sits inside something clickable - a collapsing card
        // header, a table row. Without this, asking what a figure means also
        // toggles whatever the figure is sitting in. Radix's own handler is on
        // this same element, so stopping the bubble does not stop the popover
        // from opening. Space and Enter need the same treatment, because an
        // ancestor listening for them would otherwise fire as well.
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") event.stopPropagation();
        }}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-72 text-sm">
        <p className="font-semibold text-foreground">{t(title)}</p>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">{t(body)}</p>
        {note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">{t(note)}</p>}
      </PopoverContent>
    </Popover>
  );
}

export default HelpHint;
