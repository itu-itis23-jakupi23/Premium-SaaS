import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Monitor, ArrowLeft } from 'lucide-react';

/**
 * Desktop-only guard for the 3D booth editor (WS-18).
 *
 * The editor is a pointer-driven CAD-style surface: drag-to-place furniture,
 * marquee selection, a multi-panel inspector, and a Three.js viewport. None of
 * it has a touch or small-viewport design: `PMWorkspace.tsx` and
 * `ClientWorkspace.tsx` contain no responsive breakpoints at all, and both
 * mount the Three.js `Booth3D` viewport (the client view renders two of them
 * side by side when comparing revisions). Rendering either on a phone produced
 * a laid-out but unusable screen, which reads as a broken product rather than
 * an unsupported one.
 *
 * Applied to all three editor routes: /pm/workspace, /chief/workspace and
 * /client/workspace. The client route matters most - clients are the users
 * most likely to open a link on a phone.
 *
 * WS-18 allows either tested mobile support or an explicit limitation screen.
 * This is the second option, stated plainly. When touch support is built, the
 * honest change is to delete this component — not to widen the threshold.
 */

/**
 * Minimum viewport width, in CSS pixels, the editor is designed for.
 * A landscape tablet (1024) passes; a portrait tablet or phone does not.
 */
export const EDITOR_MIN_WIDTH_PX = 1024;

/**
 * Where the "Back to dashboard" button goes.
 *
 * The guard wraps the editor in three portals and each has a different home.
 * Sending a client to `/pm` would bounce them off ProtectedRoute into a
 * forbidden screen — an explanatory page that dead-ends is no better than the
 * broken layout it replaced, so the caller states the destination.
 */
export function DesktopOnlyGuard({
  children,
  backTo = '/pm',
}: {
  children: ReactNode;
  backTo?: string;
}) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  // Undefined until measured, so the guard never flashes before it knows.
  const [isWideEnough, setIsWideEnough] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${EDITOR_MIN_WIDTH_PX}px)`);
    const update = () => setIsWideEnough(query.matches);

    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (isWideEnough === undefined) return null;
  if (isWideEnough) return <>{children}</>;

  return (
    <div
      className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-16"
      data-testid="editor-desktop-only"
    >
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Monitor className="h-7 w-7" />
        </div>

        <h1 className="mb-3 text-2xl font-bold tracking-tight">
          {t('workspace.desktopOnly.title')}
        </h1>

        <p className="mb-2 text-sm leading-relaxed text-muted-foreground">
          {t('workspace.desktopOnly.body')}
        </p>

        <p className="mb-8 text-xs text-muted-foreground/80">
          {t('workspace.desktopOnly.requirement', { width: EDITOR_MIN_WIDTH_PX })}
        </p>

        <Button
          variant="outline"
          className="gap-2 rounded-full px-6"
          onClick={() => navigate(backTo)}
          data-testid="btn-desktop-only-back"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('workspace.desktopOnly.back')}
        </Button>
      </div>
    </div>
  );
}
