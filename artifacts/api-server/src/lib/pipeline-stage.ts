/**
 * Where a project sits on the delivery pipeline.
 *
 * The board's stage is stored in `projects.metadata.pipelineStage`, because a
 * team can move a card without the project's lifecycle status changing. Status
 * is only the fallback for projects that have never been moved by hand - which
 * is most of them, so the fallback carries real weight in the analytics.
 */
export type PipelineStage = "intake" | "design" | "review" | "production" | "closed";

/** The board's stage if it is one, otherwise nothing - callers fall back. */
export function normalizePipelineStage(stage: string | null): PipelineStage | null {
  if (
    stage === "intake" ||
    stage === "design" ||
    stage === "review" ||
    stage === "production" ||
    stage === "closed"
  ) {
    return stage;
  }
  return null;
}

/**
 * Infer a stage from the project's lifecycle status.
 *
 * Every terminal status must land on "closed". The pipeline-flow report leaves
 * the current stage's span open to `now` for anything that is not closed, and
 * lists those projects as slowest-in-stage, so a status that misses "closed"
 * does not merely sit in the wrong column - it accrues time forever. A project
 * cancelled last year read as "stuck in intake for 365 days", topped the
 * chief's slowest-projects list, and dragged the intake average up with it.
 * `cancelled` and `archived` used to fall through to "intake" and did exactly
 * that.
 *
 * `delayed` is deliberately left on the "intake" fallback. It is a live project
 * whose position genuinely is not encoded in its status, so there is no honest
 * answer here; unlike the terminal statuses it belongs in the flow, and where
 * the team has moved the card, metadata answers before this function is asked.
 */
export function pipelineStageFromProjectStatus(status: string): PipelineStage {
  if (
    status === "completed" ||
    status === "approved" ||
    status === "cancelled" ||
    status === "archived"
  ) {
    return "closed";
  }
  if (status === "in_production") return "production";
  if (status === "client_review" || status === "revision") return "review";
  if (status === "in_design") return "design";
  return "intake";
}
