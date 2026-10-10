import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useUnsavedWarning } from "@/hooks/useUnsavedWarning";
import { approveProjectWorkspace, getCurrentWorkspace, getProjectWorkspace, getPlatformProjects, submitClientChangeRequest } from "@/lib/platform-api";

/** Phone review uses saved snapshots, keeping the CAD renderer off the critical path. */
export default function MobileClientReview() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [loadedPreview, setLoadedPreview] = useState("");
  const [changes, setChanges] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const projects = useQuery({ queryKey: ["mobile-review-projects"], queryFn: () => getPlatformProjects({ limit: 100 }), retry: false });
  const queryKey = ["mobile-review", projectId];
  const review = useQuery({ queryKey, queryFn: () => projectId ? getProjectWorkspace(projectId) : getCurrentWorkspace(), retry: false });
  const record = review.data;
  const version = record?.versions.find((item) => item.id === selectedVersionId) ?? record?.versions.find((item) => item.id === record.currentVersion?.id);
  const isCurrent = Boolean(version && version.id === record?.currentVersion?.id);
  const inReview = record?.project.status.toLowerCase().replaceAll("_", " ") === "client review";
  const canReview = Boolean(record?.currentVersion && inReview && !record.approved && !record.currentVersion.lockedAt);
  const previewKey = `${version?.id ?? ""}:${version?.snapshotUrl ?? ""}`;
  const canApprove = canReview && isCurrent && Boolean(version?.snapshotUrl) && loadedPreview === previewKey;
  useUnsavedWarning(Boolean(changes.trim()));

  async function submit(approve: boolean) {
    if (!record || busy || (approve ? !canApprove : !canReview || !changes.trim() || record.revisionCount >= record.revisionLimit)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Refuse to approve a newer design than the preview the client inspected.
      const latest = await getProjectWorkspace(record.project.id);
      if (latest.currentVersion?.id !== record.currentVersion?.id) {
        queryClient.setQueryData(queryKey, latest);
        setLoadedPreview("");
        throw new Error(t("experience.updated"));
      }
      const updated = approve ? await approveProjectWorkspace(record.project.id) : await submitClientChangeRequest(record.project.id, changes.trim());
      queryClient.setQueryData(queryKey, updated);
      setConfirmOpen(false);
      if (!approve) setChanges("");
      setNotice(t(approve ? "client.workspace.toast.designApproved" : "client.workspace.toast.changeRequestSent"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("experience.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout role="client">
      <section data-testid="mobile-client-review" className="space-y-4 pb-6">
        <h1 className="text-xl font-bold">{t("experience.mobileReview")}</h1>
        <p className="text-sm text-muted-foreground">{t("experience.previewHelp")}</p>
        {projects.isError && <div role="alert" className="text-sm">{t("experience.failed")} <Button variant="outline" onClick={() => void projects.refetch()}>{t("experience.retry")}</Button></div>}
        {projects.data && projects.data.projects.length > 1 && <label className="block text-sm">{t("client.nav.projects")}
          <select className="mt-1 min-h-11 w-full rounded-md border bg-background p-2" value={projectId || record?.project.id || ""} disabled={busy || Boolean(changes.trim())} onChange={(event) => { setProjectId(event.target.value); setSelectedVersionId(""); setLoadedPreview(""); setError(""); setNotice(""); }}>
            {!record && <option value="">{t("client.workspace.loadingWorkspace")}</option>}
            {projects.data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>}
        {review.isPending && <p role="status">{t("client.workspace.loadingWorkspace")}</p>}
        {review.isError && <div role="alert" className="rounded-lg border p-4"><p>{t("client.workspace.errorLoad")}</p><Button variant="outline" className="mt-2" onClick={() => void review.refetch()}>{t("experience.retry")}</Button></div>}
        {record && <>
          <div className="rounded-xl border bg-card p-4">
            <h2 className="break-words font-semibold">{record.project.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{record.project.exhibition} · {record.project.status}</p>
            <p className="mt-2 text-sm">{t("client.workspace.info.dimensions")}: {record.design.widthMm / 1000} × {record.design.depthMm / 1000} m</p>
          </div>
          {record.versions.length > 0 && <label className="block text-sm">{t("client.workspace.versionSelect")}
            <select className="mt-1 min-h-11 w-full rounded-md border bg-background p-2" value={version?.id ?? ""} disabled={busy} onChange={(event) => { setSelectedVersionId(event.target.value); setLoadedPreview(""); }}>
              {record.versions.map((item) => <option key={item.id} value={item.id}>v{item.versionNumber} — {item.title}</option>)}
            </select>
          </label>}
          {version?.snapshotUrl ? <a href={version.snapshotUrl} target="_blank" rel="noreferrer" className="block rounded-lg border bg-card">
            <img src={version.snapshotUrl} alt={t("client.workspace.canvasLabel")} className="h-auto w-full rounded-lg object-contain" decoding="async" onLoad={() => setLoadedPreview(previewKey)} onError={() => { setLoadedPreview(""); setError(t("experience.noPreview")); }} />
          </a> : <p className="rounded-lg border p-4 text-sm text-muted-foreground">{t("experience.noPreview")}</p>}
          {!isCurrent && version && <p role="status" className="text-sm text-muted-foreground">{t("experience.historical")}</p>}
          <p className="text-xs text-muted-foreground">{t("client.workspace.revisions.counter", { count: record.revisionCount, limit: record.revisionLimit })}</p>
          {notice && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">{notice}</p>}
          {error && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">{error}</p>}
          {canReview && <>
            <Button className="min-h-11 w-full" disabled={!canApprove || busy} onClick={() => setConfirmOpen(true)}>{t("client.workspace.approveDesignBtn")}</Button>
            <label className="block text-sm" htmlFor="mobile-review-changes">{t("client.workspace.dialog.title")}</label>
            <textarea id="mobile-review-changes" className="min-h-28 w-full rounded-md border bg-background p-3 text-base" value={changes} disabled={busy} maxLength={4000} onChange={(event) => setChanges(event.target.value)} placeholder={t("client.workspace.dialog.placeholder")} />
            <Button variant="outline" className="min-h-11 w-full" disabled={busy || !changes.trim() || record.revisionCount >= record.revisionLimit} onClick={() => void submit(false)}>{t(busy ? "client.workspace.propose.saving" : "client.workspace.dialog.submit")}</Button>
          </>}
        </>}
        <Button asChild variant="outline" className="min-h-11 w-full"><Link href="/client/messages">{t("client.nav.messages")}</Link></Button>
      </section>
      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!busy) setConfirmOpen(open); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>{t("client.approvals.confirm.approveTitle")}</DialogTitle><DialogDescription>{t("client.approvals.confirm.approveBody")}</DialogDescription></DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button disabled={busy || !canApprove} onClick={() => void submit(true)}>{t(busy ? "client.workspace.propose.saving" : "client.approvals.confirm.confirmApprove")}</Button>
          <Button variant="outline" disabled={busy} onClick={() => setConfirmOpen(false)}>{t("common.cancel")}</Button>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
