import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Printer, ChevronRight, ClipboardList, Send, Warehouse } from "lucide-react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { HelpHint } from "@/components/HelpHint";
import {
  getExtrasShows,
  getExhibitionFurnitureManifest,
  sendExtrasToChief,
  type ExtrasShow,
  type ExhibitionFurnitureManifest,
} from "@/lib/platform-api";
import "./extras.css";

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
 * Both a project manager and a chief reach it, from their own sidebars, so it
 * lives with the other shared staff pages and takes its chrome role as a prop.
 * The chief is who the sheet is usually sent to: they are signing off what
 * leaves the warehouse, and the pull list below is the number they check.
 *
 * Printing uses `window.print()` against a print stylesheet rather than a
 * generated PDF: no new dependency, it honours the paper the browser is set
 * to, and "Save as PDF" in the print dialog is the download.
 */
export default function Extras({ role }: { role: "chief" | "pm" }) {
  const { t } = useTranslation();
  const [shows, setShows] = useState<ExtrasShow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedShow, setSelectedShow] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ExhibitionFurnitureManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [manifestError, setManifestError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    document.title = t("extras.pageTitle");
  }, [t]);

  const loadShows = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const response = await getExtrasShows();
      setShows(response.shows ?? []);
    } catch {
      setListError(t("extras.loadError"));
    } finally {
      setLoadingList(false);
    }
  }, [t]);

  useEffect(() => { void loadShows(); }, [loadShows]);

  /**
   * Which of the two sheets is being printed.
   *
   * They are one document on screen and two different jobs on paper. The
   * warehouse wants the pull list by itself - one page it can carry to the
   * racking - and whoever sets the show wants the per-stand pages without a
   * pull list stapled to the front. Printing the lot and telling people which
   * pages to keep is how the wrong half ends up in the van.
   *
   * The mode has to be in the DOM before the print dialog opens, and a React
   * state update is not guaranteed to have flushed by the next statement, so
   * this commits it synchronously rather than hoping.
   */
  const [printMode, setPrintMode] = useState<"all" | "stands" | "warehouse">("all");

  const printSheet = useCallback((mode: "all" | "stands" | "warehouse") => {
    flushSync(() => setPrintMode(mode));
    window.print();
  }, []);

  /**
   * Narrowing the sheet lasts for that one print.
   *
   * Each button is a deliberate choice about one job. Leaving the choice in
   * place afterwards means the next Ctrl+P - which says nothing about
   * warehouses, and plainly means "print what I am looking at" - quietly
   * prints half the document instead.
   */
  useEffect(() => {
    const restore = () => setPrintMode("all");
    window.addEventListener("afterprint", restore);
    return () => window.removeEventListener("afterprint", restore);
  }, []);

  /**
   * Post the lists to whoever signs off what leaves the warehouse.
   *
   * The result says what actually happened rather than "Sent": the in-app
   * notification always lands, the email only once a sending key is
   * configured, and a chief who believes an email went out when it did not is
   * worse off than one who was told plainly.
   */
  const sendToChief = useCallback(async () => {
    if (!selectedShow) return;
    setSending(true);
    setSendResult(null);
    try {
      const result = await sendExtrasToChief(selectedShow);
      setSendResult({
        ok: true,
        message: result.emailed > 0
          ? t("extras.sendDone", { count: result.notified, names: result.recipients.join(", ") })
          : t("extras.sendDoneNoEmail", { count: result.notified, names: result.recipients.join(", ") }),
      });
    } catch {
      setSendResult({ ok: false, message: t("extras.sendError") });
    } finally {
      setSending(false);
    }
  }, [selectedShow, t]);

  const openShow = useCallback(async (name: string) => {
    setSelectedShow(name);
    setManifest(null);
    setManifestError("");
    // The confirmation names a show. Carrying it to the next one claims that
    // show was sent to the chief as well, which is worse than saying nothing.
    setSendResult(null);
    setLoadingManifest(true);
    try {
      setManifest(await getExhibitionFurnitureManifest(name));
    } catch {
      setManifestError(t("extras.manifestError"));
    } finally {
      setLoadingManifest(false);
    }
  }, [t]);

  /**
   * What the warehouse pulls, counted once for the whole show.
   *
   * The per-stand lists below say where everything goes; they are no use to
   * the person loading the van, who needs to know that this show takes nine
   * leather chairs in total, not that stand A-14 takes two of them. Reading
   * that off forty stand lists by hand is exactly the counting this page
   * exists to remove, and it is where a miscount turns into a second trip.
   *
   * Summed on the client because the manifest already carries every line: the
   * query groups one row per stand and item, so an item appears once per stand
   * it is used on, and `stands` is therefore a count of stands rather than of
   * rows. Keyed on the catalogue code, which is the identity the warehouse
   * works in; items that carry no code fall back to their name so two
   * genuinely different unnamed things are not merged into one.
   */
  const pullList = useMemo(() => {
    if (!manifest) return [];
    const byItem = new Map<string, { sku: string; name: string; qty: number; stands: number }>();
    for (const booth of manifest.booths) {
      for (const item of booth.items) {
        const key = item.sku || item.name;
        const row = byItem.get(key) ?? { sku: item.sku, name: item.name, qty: 0, stands: 0 };
        row.qty += item.qty;
        row.stands += 1;
        byItem.set(key, row);
      }
    }
    return [...byItem.values()].sort((a, b) =>
      (a.sku || a.name).localeCompare(b.sku || b.name, undefined, { numeric: true }),
    );
  }, [manifest]);

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
    <DashboardLayout role={role}>
      <div className="pm-extras-page space-y-6" data-print={printMode}>
        <PageHeader
          className="extras-chrome"
          title={t("extras.title")}
          breadcrumbs={[
            { label: t("pm.nav.dashboard"), href: "/pm" },
            { label: t("extras.title") },
          ]}
        />

        <p className="extras-chrome flex items-center gap-2 text-sm text-muted-foreground">
          {t("extras.intro")}
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
              {t("extras.shows")}
            </p>
            {loadingList && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />}
            {!loadingList && shows.length === 0 && !listError && (
              <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                {t("extras.noShows")}
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
                        || t("extras.standCount", { count: show.boothCount })}
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
                {t("extras.pickShow")}
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
                    {t("extras.summary", {
                      booths: manifest.totals.booths,
                      items: manifest.totals.items,
                    })}
                  </span>
                  <div className="ms-auto flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 gap-2"
                      onClick={() => void sendToChief()}
                      disabled={sending}
                      data-testid="extras-send-chief"
                    >
                      {sending
                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        : <Send className="h-4 w-4" aria-hidden="true" />}
                      {t("extras.sendToChief")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 gap-2"
                      onClick={() => printSheet("warehouse")}
                      data-testid="extras-print-warehouse"
                    >
                      <Warehouse className="h-4 w-4" aria-hidden="true" />
                      {t("extras.printWarehouse")}
                    </Button>
                    <Button
                      type="button"
                      className="min-h-11 gap-2"
                      onClick={() => printSheet("stands")}
                      data-testid="extras-print"
                    >
                      <Printer className="h-4 w-4" aria-hidden="true" />
                      {t("extras.printStands")}
                    </Button>
                  </div>
                </div>

                {sendResult && (
                  <div
                    role="status"
                    className={`extras-chrome mb-4 rounded-lg border p-3 text-sm ${
                      sendResult.ok ? "border-primary/40 bg-primary/5" : "border-destructive"
                    }`}
                  >
                    {sendResult.message}
                  </div>
                )}

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
                      {t("extras.sheetSubtitle", {
                        booths: manifest.totals.booths,
                        items: manifest.totals.items,
                      })}
                    </p>
                  </div>

                  {/* The pull list comes first and takes its own page: the
                      warehouse loads from this, then the stand pages below
                      say where each piece goes. */}
                  <section className="extras-pull">
                    <h2>
                      {t("extras.pullTitle")}
                      <span className="extras-stand"> · {t("extras.pullSummary", {
                        types: pullList.length,
                        pieces: manifest.totals.items,
                      })}</span>
                    </h2>
                    <p className="extras-pull-note">{t("extras.pullNote")}</p>
                    {pullList.length === 0 ? (
                      <p className="extras-empty">{t("extras.pullEmpty")}</p>
                    ) : (
                      <table className="extras-table">
                        <thead>
                          <tr>
                            <th className="extras-tick" scope="col">✓</th>
                            <th scope="col">{t("extras.col.code")}</th>
                            <th scope="col">{t("extras.col.item")}</th>
                            <th className="extras-qty" scope="col">{t("extras.col.stands")}</th>
                            <th className="extras-qty" scope="col">{t("extras.col.qty")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pullList.map((item) => (
                            <tr key={item.sku || item.name}>
                              <td className="extras-tick"><span className="extras-box" /></td>
                              <td className="extras-code">{item.sku || "—"}</td>
                              <td>{item.name}</td>
                              <td className="extras-qty extras-muted">{item.stands}</td>
                              <td className="extras-qty extras-total">{item.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>

                  {booths.map((booth) => (
                    <section key={booth.projectId} className="extras-booth">
                      <h2>
                        {booth.clientName || booth.projectName}
                        {booth.standNumber ? (
                          <span className="extras-stand"> · {t("extras.stand", { number: booth.standNumber })}</span>
                        ) : null}
                      </h2>
                      {booth.items.length === 0 ? (
                        <p className="extras-empty">{t("extras.boothEmpty")}</p>
                      ) : (
                        <table className="extras-table">
                          <thead>
                            <tr>
                              <th className="extras-tick" scope="col">✓</th>
                              <th scope="col">{t("extras.col.code")}</th>
                              <th scope="col">{t("extras.col.item")}</th>
                              <th className="extras-qty" scope="col">{t("extras.col.qty")}</th>
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
                    <span>{t("extras.loadedBy")}</span>
                    <span>{t("extras.checkedBy")}</span>
                    <span>{t("extras.date")}</span>
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
