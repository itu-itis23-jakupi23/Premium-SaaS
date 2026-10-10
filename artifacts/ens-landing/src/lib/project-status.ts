// Project status presentation, shared by the client project list and testable
// on its own. It lives here rather than inside the page because the colour map
// has to stay complete against the `project_status` enum, and a page module
// cannot be imported by the DOM-free unit suite.

export interface ProjectStatusStyle {
  bg: string;
  text: string;
  border: string;
}

const GREEN: ProjectStatusStyle = { bg: "rgba(47,125,58,0.08)", text: "#2f7d3a", border: "rgba(47,125,58,0.3)" };
const AMBER: ProjectStatusStyle = { bg: "rgba(194,65,12,0.08)", text: "#c2410c", border: "rgba(194,65,12,0.3)" };
const RED: ProjectStatusStyle = { bg: "rgba(220,38,38,0.08)", text: "#dc2626", border: "rgba(220,38,38,0.3)" };
const BLUE: ProjectStatusStyle = { bg: "rgba(29,78,216,0.08)", text: "#1d4ed8", border: "rgba(29,78,216,0.3)" };
const GREY: ProjectStatusStyle = { bg: "rgba(100,116,139,0.08)", text: "#64748b", border: "rgba(100,116,139,0.3)" };

/** Neutral styling for a label this map has never heard of. */
export const UNKNOWN_PROJECT_STATUS_STYLE = GREY;

/**
 * Every display label the API can return, not a handful of them.
 *
 * Four were listed before - Active, Pending, Delayed, Completed - and
 * everything else fell through a `?? STATUS_CFG.Active` fallback and rendered
 * in green. A cancelled project was therefore shown to the client in the same
 * colour as a healthy one, reading "Cancelled" in green. Held complete against
 * the enum by project-status.test.ts.
 */
export const PROJECT_STATUS_STYLES: Record<string, ProjectStatusStyle> = {
  Draft: GREY,
  Planning: GREY,
  "In Design": BLUE,
  "Client Review": AMBER,
  Pending: AMBER,
  Revision: AMBER,
  Approved: GREEN,
  Active: GREEN,
  "In Production": BLUE,
  Production: BLUE,
  Delayed: RED,
  Cancelled: RED,
  Completed: BLUE,
  Archived: GREY,
};

export function projectStatusStyle(label: string): ProjectStatusStyle {
  return PROJECT_STATUS_STYLES[label] ?? UNKNOWN_PROJECT_STATUS_STYLE;
}

/**
 * `project_status` as the database stores it, turned into the display label the
 * `client.projects.status.*` keys are named after.
 *
 * Mirrors `toTitle()` in artifacts/api-server/src/routes/platform.ts, which is
 * what produces the label on a project record. The lifecycle history reports
 * the raw enum instead, so without this the client reads "client_review".
 */
export function projectStatusLabel(raw: string): string {
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** The five pipeline stages, in the order a project passes through them. */
export const PROJECT_STAGES = ["intake", "design", "review", "production", "closed"] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];
