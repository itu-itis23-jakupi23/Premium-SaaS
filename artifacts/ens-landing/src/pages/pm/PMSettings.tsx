/**
 * PMSettings — Project Manager account settings page.
 *
 * Delegates to ChiefSettings with role="pm" so the shared settings
 * implementation (profile, notifications, appearance, security) works
 * for PMs with the correct breadcrumbs, storage key, and dashboard href.
 *
 * Chief-only sections (organization plan, billing, team management)
 * are not shown because ChiefSettings conditionally renders them only
 * when role === "chief".
 */
import ChiefSettings from "@/pages/chief/ChiefSettings";

export default function PMSettings() {
  return <ChiefSettings role="pm" sectionLabel="Project Manager" />;
}
