import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trophy, Mail, Phone, CalendarClock, Pencil, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getPipeline, updateLeadStage, updateLead, type Pipeline, type PipelineLead, type LeadStage } from "@/lib/platform-api";
import { money } from "@/lib/quote-format";

// Columns shown on the board. "won" leaves the board (promoted to approval), so
// it isn't a column; "lost" stays visible so it can be reviewed or revived.
const BOARD_STAGES: LeadStage[] = ["new", "contacted", "qualified", "proposal", "lost"];
const MOVE_STAGES: LeadStage[] = ["new", "contacted", "qualified", "proposal", "lost"];

const STAGE_ACCENT: Record<LeadStage, string> = {
  new: "border-t-slate-400",
  contacted: "border-t-blue-500",
  qualified: "border-t-amber-500",
  proposal: "border-t-violet-500",
  won: "border-t-green-500",
  lost: "border-t-red-500",
};

export default function ChiefPipeline() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [board, setBoard] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PipelineLead | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editFollowUp, setEditFollowUp] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try { setBoard(await getPipeline()); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  const totals = useMemo(() => {
    if (!board) return { count: 0, valueCents: 0 };
    return BOARD_STAGES.filter((s) => s !== "lost").reduce(
      (acc, s) => ({ count: acc.count + board.columns[s].count, valueCents: acc.valueCents + board.columns[s].valueCents }),
      { count: 0, valueCents: 0 },
    );
  }, [board]);

  async function move(lead: PipelineLead, stage: LeadStage) {
    if (stage === lead.leadStage) return;
    setBusyId(lead.id);
    try {
      await updateLeadStage(lead.id, stage);
      if (stage === "won") toast({ title: t("pipeline.toast.won", { company: lead.companyName }) });
      void refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t("pipeline.error") });
    } finally { setBusyId(null); }
  }

  function openEdit(lead: PipelineLead) {
    setEditing(lead);
    setEditValue(lead.leadValueCents ? String(lead.leadValueCents / 100) : "");
    setEditFollowUp(lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : "");
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateLead(editing.id, {
        leadValueCents: Math.round((Number(editValue) || 0) * 100),
        nextFollowUpAt: editFollowUp ? new Date(editFollowUp).toISOString() : null,
      });
      setEditing(null);
      void refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t("pipeline.error") });
    } finally { setSaving(false); }
  }

  const isOverdue = (d: string | null) => d != null && new Date(d) < new Date();

  return (
    <DashboardLayout role="chief">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("pipeline.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pipeline.subtitle")}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-2 text-right">
          <div className="text-lg font-bold">{money(totals.valueCents, "USD")}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("pipeline.openValue", { count: totals.count })}</div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {BOARD_STAGES.map((stage) => {
            const col = board!.columns[stage];
            return (
              <div key={stage} className="flex w-72 shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold">{t(`pipeline.stage.${stage}`)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{col.count}</span>
                </div>
                {stage !== "lost" && (
                  <div className="mb-2 px-1 text-[11px] text-muted-foreground">{money(col.valueCents, "USD")}</div>
                )}
                <div className="flex flex-col gap-2">
                  {col.leads.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">{t("pipeline.emptyColumn")}</div>
                  ) : col.leads.map((lead) => (
                    <div key={lead.id} className={`rounded-lg border border-t-2 bg-card p-3 shadow-sm ${STAGE_ACCENT[stage]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold leading-tight">{lead.companyName}</span>
                        <button onClick={() => openEdit(lead)} className="text-muted-foreground hover:text-foreground" aria-label={t("pipeline.edit")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{lead.contactEmail}</span>
                      </div>
                      {lead.phone && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {lead.phone}</div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {lead.leadValueCents > 0 && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">{money(lead.leadValueCents, "USD")}</span>
                        )}
                        {lead.nextFollowUpAt && (
                          <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${isOverdue(lead.nextFollowUpAt) ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground"}`}>
                            {isOverdue(lead.nextFollowUpAt) ? <AlertTriangle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
                            {new Date(lead.nextFollowUpAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {lead.lostReason && <p className="mt-2 text-[11px] italic text-muted-foreground">{lead.lostReason}</p>}

                      <div className="mt-3 flex items-center gap-2">
                        <select
                          value={lead.leadStage}
                          disabled={busyId === lead.id}
                          onChange={(e) => move(lead, e.target.value as LeadStage)}
                          aria-label={t("pipeline.moveStage")}
                          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {MOVE_STAGES.map((s) => <option key={s} value={s}>{t(`pipeline.stage.${s}`)}</option>)}
                        </select>
                        <Button size="sm" variant="outline" className="h-8" disabled={busyId === lead.id} onClick={() => move(lead, "won")}>
                          <Trophy className="mr-1 h-3.5 w-3.5 text-green-600" /> {t("pipeline.won")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing?.companyName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-value" className="text-xs">{t("pipeline.dealValue")}</Label>
              <Input id="lead-value" type="number" min="0" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-followup" className="text-xs">{t("pipeline.followUp")}</Label>
              <Input id="lead-followup" type="date" value={editFollowUp} onChange={(e) => setEditFollowUp(e.target.value)} />
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t("common.save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
