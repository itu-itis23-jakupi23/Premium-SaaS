// Static config + types for the client's read-only booth review workspace,
// split out of ClientWorkspace.tsx.

export const MONO = 'var(--app-font-mono)';
export const UI   = 'var(--app-font-samsung)';

export const CATALOG_GROUP_ORDER = ["Structure", "Furniture", "Lighting", "Fascia"] as const;
export const THEME_COLORS = ["#3b3e44", "#dde0e4", "#7a4a2a", "#1a2640"];
export const WALL_COLORS = ["#f8fafc", "#dfe4ea", "#f3eadc", "#9aa1aa"];
export const FRAME_COLORS = ["#b8bdc3", "#3d4249", "#c7b99a", "#e4e7eb"];
export const FASCIA_COLORS = ["#ffffff", "#eef2f7", "#fff7ed", "#d2d7de"];
export const CARPET_COLORS = [
  "#1a1a1a",
  "#dde0e4",
  "#7a7e84",
  "#1a2640",
  "#1e3a28",
  "#5a2316",
];

export interface Comment {
  id: string | number;
  user: string;
  initials: string;
  text: string;
  time: string;
  type?: "comment" | "change" | "pin";
  status?: "open" | "resolved";
  partId?: string;
}
export interface PinAnnotation {
  id: string | number;
  x: number;
  y: number;
  z?: number;
  text: string;
  num: number;
  status?: "open" | "resolved";
  partId?: string;
}
export const INITIAL_COMMENTS: Comment[] = [];
export const VERSIONS = [
  { label: "v2.4 — Latest (Current)", value: "2.4" },
  { label: "v2.3 — May 12", value: "2.3" },
  { label: "v2.2 — May 10", value: "2.2" },
  { label: "v1.0 — Initial", value: "1.0" },
];

export type RightTab = "thread" | "approvals" | "pins";
export type FeedbackFilter = "open" | "all" | "resolved";
