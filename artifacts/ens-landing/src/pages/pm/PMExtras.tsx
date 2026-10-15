import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Printer, ChevronRight, ClipboardList } from "lucide-react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { HelpHint } from "@/components/HelpHint";
import {
  getExtrasShows,
  getExhibitionFurnitureManifest,
  type ExtrasShow,
  type ExhibitionFurnitureManifest,
} from "@/lib/platform-api";
import "./pm-extras.css";

/**
 * Extras: the furniture loading list for a whole show.
 *
 * This replaces a job done on paper. Before each show someone goes through the
 * stands one by one and writes out what furniture each needs; that sheet is
 * what the warehouse loads from. Reading it out of the drawings removes the
 * transcription, and transcription is where a missing chair comes from.
 *
 * A page in the main navigation rather than a panel inside the workspace. It
 * was put in the workspace first, which was wrong twice over: a loading list
 * is a job for a whole show, not something you reach for while pricing one
 * stand, and the workspace is desktop-only while this is a sheet somebody
 * prints from wherever they are.
 *
 * Printing uses `window.print()` against a print stylesheet rather than a
 * generated PDF: no new dependency, it honours the paper the browser is set
 * to, and "Save as PDF" in the print dialog is the download.
 */
export default function PMExtras() {
  const { t } = useTranslation();
  const [shows, setShows] = useState<ExtrasShow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedShow, setSelectedShow] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ExhibitionFurnitureManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [manifestError, setManifestError] = useState("");

  useEffect(() => {
    document.title = t("pm.extras.pageTitle");
  }, [t]);

  const loadShows = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const response = await getExtrasShows();
      setShows(response.shows ?? []);
    } catch {
      setListError(t("pm.extras.loadError"));
    } finally {
      setLoadingList(false);
    }
  }, [t]);

  useEffect(() => { void loadShows(); }, [loadShows]);

  const openShow = useCallback(async (name: string) => {
    setSelectedShow(name);
    setManifest(null);
    setManifestError("");
    setLoadingManifest(true);
    try {
      setManifest(await getExhibitionFurnitureManifest(name));
    } catch {
      setManifestError(t("pm.extras.manifestError"));
    } finally {
      setLoadingManifest(false);
    }
  }, [t]);

  /** Stands with furniture first: an empty stand is a question, not a job. */
  const booths = useMemo(() => {
    if (!manifest) return [];
    return [...manifest.booths].sort((a, b) => {
      if (a.items.length === 0 && b.items.length > 0) return 1;
      if (b.items.length === 0 && a.items.length > 0) return -1;
      return (a.clientName ?? a.projectName).localeCompare(b.clientName ?? b.projectName);
    });
  }, [manifest]);

  return (
    <DashboardLayout role="pm">
      <div className="pm-extras-page space-y-6">
        <PageHeader
          className="extras-chrome"
          title={t("pm.extras.title")}
          breadcrumbs={[
            { label: t("pm.nav.dashboard"), href: "/pm" },
            { label: t("pm.extras.title") },
          ]}
        />

        <p className="extras-chrome flex items-center gap-2 text-sm text-muted-foreground">
          {t("pm.extras.intro")}
          <HelpHint
            title="help.extras.sheet.title"
            body="help.extras.sheet.body"
            note="help.extras.sheet.note"
          />
        </p>

        {listError && (
          <div role="alert" className="extras-chrome rounded-lg border border-destructive p-3 text-sm">
            {listError}
            <Button variant="outline" className="ms-2 min-h-11" onClick={() => void loadShows()}>
              {t("experience.retry")}
            </Button>
          </div>
        )}

        <div className="extras-layout grid gap-6">
          {/* ── Shows ──────────────────────────────────────────────── */}
          <div className="extras-chrome space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("pm.extras.shows")}
            </p>
            {loadingList && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />}
            {!loadingList && shows.length === 0 && !listError && (
              <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                {t("pm.extras.noShows")}
              </p>
            )}
            {shows.map((show) => {
              const active = show.name === selectedShow;
              return (
                <button
                  key={show.name}
                  type="button"
                  onClick={() => void openShow(show.name)}
                  aria-pressed={active}
                  data-testid={`extras-show-${show.name}`}
                  className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "hover:border-foreground/30"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{show.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {[show.venue, show.city].filter(Boolean).join(" · ")
                        || t("pm.extras.standCount", { count: show.boothCount })}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          {/* ── The sheet ──────────────────────────────────────────── */}
          <div>
            {!selectedShow && (
              <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
                <ClipboardList className="mx-auto mb-3 h-8 w-8 opacity-40" aria-hidden="true" />
                {t("pm.extras.pickShow")}
              </div>
            )}
            {loadingManifest && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />}
            {manifestError && (
              <div role="alert" className="rounded-lg border border-destructive p-3 text-sm">
                {manifestError}
              </div>
            )}

            {manifest && (
              <>
                <div className="extras-chrome mb-4 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {t("pm.extras.summary", {
                      booths: manifest.totals.booths,
                      items: manifest.totals.items,
                    })}
                  </span>
                  <Button
                    type="button"
                    className="ms-auto gap-2"
                    onClick={() => window.print()}
                    data-testid="extras-print"
                  >
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    {t("pm.extras.print")}
                  </Button>
                </div>

                {/* The printed sheet. Everything else on the page is hidden
                    when printing; this becomes the document. */}
                <div className="extras-sheet rounded-lg border">
                  <div className="extras-sheet-head">
                    <h1>{manifest.exhibition.name}</h1>
                    <p>
                      {[manifest.exhibition.venue, manifest.exhibition.city, manifest.exhibition.country]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="extras-sheet-sub">
                      {t("pm.extras.sheetSubtitle", {
                        booths: manifest.totals.booths,
                        items: manifest.totals.items,
                      })}
                    </p>
                  </div>

                  {booths.map((booth) => (
                    <section key={booth.projectId} className="extras-booth">
                      <h2>
                        {booth.clientName || booth.projectName}
                        {booth.standNumber ? (
                          <span className="extras-stand"> · {t("pm.extras.stand", { number: booth.standNumber })}</span>
                        ) : null}
                      </h2>
                      {booth.items.length === 0 ? (
                        <p className="extras-empty">{t("pm.extras.boothEmpty")}</p>
                      ) : (
                        <table className="extras-table">
                          <thead>
                            <tr>
                              <th className="extras-tick" scope="col">✓</th>
                              <th scope="col">{t("pm.extras.col.code")}</th>
                              <th scope="col">{t("pm.extras.col.item")}</th>
                              <th className="extras-qty" scope="col">{t("pm.extras.col.qty")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {booth.items.map((item, index) => (
                              <tr key={`${item.sku}-${index}`}>
                                {/* An empty box to tick when the item is loaded. */}
                                <td className="extras-tick"><span className="extras-box" /></td>
                                <td className="extras-code">{item.sku || "—"}</td>
                                <td>{item.name}</td>
                                <td className="extras-qty">{item.qty}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </section>
                  ))}

                  <footer className="extras-sheet-foot">
                    <span>{t("pm.extras.loadedBy")}</span>
                    <span>{t("pm.extras.checkedBy")}</span>
                    <span>{t("pm.extras.date")}</span>
                  </footer>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
