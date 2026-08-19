import { useTranslation } from "react-i18next";

/**
 * "Skip to content" link (WCAG 2.4.1, Bypass Blocks).
 *
 * The public pages open with a header full of navigation, a language switcher
 * and a theme toggle. A keyboard or screen-reader user had no way past it and
 * had to tab through the whole header on every page — `DashboardLayout` has had
 * this link for a while, but none of the marketing pages did.
 *
 * Visually hidden until focused, then pinned to the top-left. Pair it with a
 * `<main id={targetId}>` on the same page; `MAIN_CONTENT_ID` is the default and
 * keeps the two ends of the link from drifting apart.
 */

export const MAIN_CONTENT_ID = "main-content";

export function SkipToContent({ targetId = MAIN_CONTENT_ID }: { targetId?: string }) {
  const { t } = useTranslation();

  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      data-testid="link-skip-to-content"
    >
      {t("layout.skipToContent")}
    </a>
  );
}
