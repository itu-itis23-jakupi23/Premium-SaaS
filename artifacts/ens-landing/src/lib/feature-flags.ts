/**
 * Build-time feature flags (AX-06).
 *
 * Unfinished controls must not reach a production build. A disabled button is
 * a small embarrassment; a *stateful* unfinished control is a real problem.
 * The two-factor block was the latter: it renders an "Enabled"/"Disabled"
 * security badge from a `twoFactorEnabled` value that round-trips through the
 * API, while no second factor is implemented anywhere. A Chief reading
 * "Enabled" would believe their account was protected when it was not.
 *
 * Flags resolve at build time so the code is dropped by tree-shaking in
 * production rather than merely hidden at runtime.
 */

/**
 * Whether to render features that are visibly incomplete.
 *
 * False in production builds. `VITE_SHOW_UNFINISHED=true` forces them on for
 * an internal staging demo — never set it on a customer-facing deployment.
 */
export const SHOW_UNFINISHED_FEATURES =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_UNFINISHED === "true";

/**
 * Two-factor authentication (AU-04).
 *
 * Set this to true only when enrolment, challenge, and recovery are actually
 * implemented and tested end to end — not when the UI exists.
 */
export const FEATURE_TWO_FACTOR = SHOW_UNFINISHED_FEATURES;
