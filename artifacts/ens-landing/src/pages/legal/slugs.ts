/**
 * Public legal route slugs (CS-02).
 *
 * Kept in a standalone module so `App.tsx` can register routes without pulling
 * the full document text into the initial bundle. `content.ts` types its
 * documents against `LegalSlug`, so adding a route here without adding the
 * matching document (or vice versa) is a compile-time error.
 */

export const LEGAL_SLUGS = ["privacy", "terms", "security", "cookies", "gdpr"] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];
