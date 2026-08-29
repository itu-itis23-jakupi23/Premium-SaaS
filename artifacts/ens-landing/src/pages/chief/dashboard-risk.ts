/**
 * Which projects count as "delayed" on the chief's dashboard.
 *
 * Status and health are separate enums and carry different words. Reading one
 * for the other's values is the trap here, and the original fell into it:
 *
 *   project_status: draft planning in_design client_review revision approved
 *                   delayed in_production completed cancelled archived
 *   project_health: on_track at_risk blocked delayed
 *
 * `blocked` is a *health*, and the check looked for it in the *status* string,
 * where it can never appear. A blocked project was therefore missing from the
 * count the chief reads to judge portfolio risk - and so was one whose health
 * was `delayed`, since health was only ever tested for "risk".
 *
 * Each field is now read for its own vocabulary.
 */
export function isDelayedDashboardProject(status: string, health: string): boolean {
  const statusValue = status.toLowerCase();
  const healthValue = health.toLowerCase();
  return (
    statusValue.includes("delay") ||
    healthValue.includes("delay") ||
    healthValue.includes("blocked") ||
    healthValue.includes("risk")
  );
}
