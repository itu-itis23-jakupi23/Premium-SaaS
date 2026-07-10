import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Booth3D } from "@/components/workspace/Booth3D";
import {
  getCurrentWorkspace,
  submitClientChangeRequest,
  getWorkspaceComments,
  createWorkspaceComment,
  updateWorkspaceCommentStatus,
  deleteWorkspaceComment,
  saveElementStatus,
  approveProjectWorkspace,
  createWorkspaceSubscriptionRequest,
  workspaceApprovalStage,
  workspaceApprovalStageLabel,
  type ProjectWorkspace,
  type WorkspaceState,
} from "@/lib/platform-api";
import {
  Lock,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronDown,
  Layers,
  RotateCcw,
  MessageSquare,
  Download,
  Pin,
  X,
  GitCompare,
  CheckSquare,
} from "lucide-react";

const C = {
  bg:    'var(--workspace-bg, #f3f1ec)',
  panel: 'var(--workspace-panel, #ffffff)',
  ink:   'var(--workspace-ink, #181613)',
  hair:  'var(--workspace-hair, #d8d3c9)',
  blue:  'var(--workspace-blue, #1d4ed8)',
  orange:'var(--workspace-orange, #c2410c)',
  green: 'var(--workspace-green, #2f7d3a)',
  muted: 'var(--workspace-muted, #6b6560)',
} as const;
const MONO = 'var(--app-font-mono)';
const UI   = 'var(--app-font-samsung)';

const CATALOG_GROUP_ORDER = ["Structure", "Furniture", "Lighting", "Fascia"] as const;
const THEME_COLORS = ["#3b3e44", "#dde0e4", "#7a4a2a", "#1a2640"];
const WALL_COLORS = ["#f8fafc", "#dfe4ea", "#f3eadc", "#9aa1aa"];
const FRAME_COLORS = ["#b8bdc3", "#3d4249", "#c7b99a", "#e4e7eb"];
const FASCIA_COLORS = ["#ffffff", "#eef2f7", "#fff7ed", "#d2d7de"];
const CARPET_COLORS = [
  "#1a1a1a",
  "#dde0e4",
  "#7a7e84",
  "#1a2640",
  "#1e3a28",
  "#5a2316",
];

interface Comment {
  id: string | number;
  user: string;
  initials: string;
  text: string;
  time: string;
  type?: "comment" | "change" | "pin";
  status?: "open" | "resolved";
  partId?: string;
}
interface PinAnnotation {
  id: string | number;
  x: number;
  y: number;
  z?: number;
  text: string;
  num: number;
  status?: "open" | "resolved";
  partId?: string;
}
const INITIAL_COMMENTS: Comment[] = [];
const VERSIONS = [
  { label: "v2.4 — Latest (Current)", value: "2.4" },
  { label: "v2.3 — May 12", value: "2.3" },
  { label: "v2.2 — May 10", value: "2.2" },
  { label: "v1.0 — Initial", value: "1.0" },
];

type RightTab = "thread" | "approvals" | "pins";
type FeedbackFilter = "open" | "all" | "resolved";

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: C.muted,
        textTransform: "uppercase" as const,
      }}
    >
      {children}
    </span>
  );
}
function Hairline() {
  return <div style={{ height: 1, background: C.hair }} />;
}
function workspaceToBoothConfig(workspace?: WorkspaceState | null) {
  const booth = workspace?.booth;
  return {
    width: booth?.width ?? 8,
    depth: booth?.depth ?? 6,
    height: booth?.height ?? 3,
    system: booth?.system ?? "maxima",
    companyName: booth?.companyName ?? "TECHCORP INDUSTRIES",
    primaryColor: THEME_COLORS[workspace?.themeIdx ?? 0] ?? THEME_COLORS[0],
    wallColor: WALL_COLORS[workspace?.wallFinishIdx ?? 0] ?? WALL_COLORS[0],
    frameColor: FRAME_COLORS[workspace?.frameFinishIdx ?? 0] ?? FRAME_COLORS[0],
    fasciaColor: FASCIA_COLORS[workspace?.fasciaFinishIdx ?? 0] ?? FASCIA_COLORS[0],
    carpetColor: CARPET_COLORS[workspace?.carpetIdx ?? 0] ?? CARPET_COLORS[0],
    openFront: booth?.openFront ?? true,
    openBack: booth?.openBack ?? false,
    openLeft: booth?.openLeft ?? false,
    openRight: booth?.openRight ?? false,
    fasciaEnabled: booth?.fasciaEnabled ?? true,
    fasciaOption: booth?.fasciaOption ?? "classic",
    lightingPreset: workspace?.lightingPreset ?? "exhibition",
  };
}

export default function ClientWorkspace() {
  const { t } = useTranslation();
  const [workspaceRecord, setWorkspaceRecord] =
    useState<ProjectWorkspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [newComment, setNewComment] = useState("");
  const [version, setVersion] = useState("2.4");
  const [compareVersion, setCompareVersion] = useState("2.3");
  const [showVersions, setShowVersions] = useState(false);
  const [showChangeDlg, setShowChangeDlg] = useState(false);
  const [showSubscriptionDlg, setShowSubscriptionDlg] = useState(false);
  const [changeText, setChangeText] = useState("");
  const [approved, setApproved] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<PinAnnotation[]>([]);
  const [pinText, setPinText] = useState("");
  const [pendingPin, setPendingPin] = useState<{
    x: number;
    y: number;
    z?: number;
    partId?: string;
  } | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("thread");
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>("open");
  const [elementStatus, setElementStatus] = useState<
    Record<string, "approved" | "pending" | "rejected">
  >({
    structure: "approved",
    furniture: "pending",
    branding: "approved",
    lighting: "pending",
  });
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [revisionCount, setRevisionCount] = useState(0);
  const revisionLimit = workspaceRecord ? (workspaceRecord.revisionLimit ?? 2) : 2;
  const revisionsExhausted = revisionCount >= revisionLimit;
  const feedbackMatchesFilter = (status: "open" | "resolved" | undefined) => (
    feedbackFilter === "all" || (status ?? "open") === feedbackFilter
  );
  const visibleComments = comments.filter((comment) => feedbackMatchesFilter(comment.status));
  const visiblePins = pins.filter((pin) => feedbackMatchesFilter(pin.status));
  const openFeedbackCount = comments.filter((comment) => (comment.status ?? "open") === "open").length
    + pins.filter((pin) => (pin.status ?? "open") === "open").length;

  useEffect(() => {
    document.title = t("client.workspace.pageTitle");
  }, [t]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const elements = useMemo(
    () => [
      { id: "structure", label: t("client.workspace.element.structure") },
      { id: "furniture", label: t("client.workspace.element.furniture") },
      { id: "branding", label: t("client.workspace.element.branding") },
      { id: "lighting", label: t("client.workspace.element.lighting") },
    ],
    [t],
  );

  const allApproved = Object.values(elementStatus).every(
    (s) => s === "approved",
  );
  const versionOptions =
    workspaceRecord?.versions.map((v) => ({
      label: `v${v.versionNumber} - ${v.title}`,
      value: String(v.versionNumber),
    })) ?? VERSIONS;
  const selectedWorkspace =
    workspaceRecord?.versions.find((v) => String(v.versionNumber) === version)
      ?.workspace ?? workspaceRecord?.workspace;
  const comparedWorkspace =
    workspaceRecord?.versions.find(
      (v) => String(v.versionNumber) === compareVersion,
    )?.workspace ?? selectedWorkspace;
  const selectedBoothConfig = useMemo(() => ({
    ...workspaceToBoothConfig(selectedWorkspace),
    placedItems: selectedWorkspace?.placedItems ?? [],
    rooms: selectedWorkspace?.rooms ?? [],
    pins,
    pinMode,
  }), [selectedWorkspace, pins, pinMode]);
  const comparedBoothConfig = useMemo(() => ({
    ...workspaceToBoothConfig(comparedWorkspace),
    placedItems: comparedWorkspace?.placedItems ?? [],
    rooms: comparedWorkspace?.rooms ?? [],
    pins: [],
    pinMode: false,
  }), [comparedWorkspace]);
  const selectedBooth = selectedWorkspace?.booth;

  const clientCatalog = useMemo(() => {
    const items = selectedWorkspace?.placedItems ?? [];
    const byGroup = new Map<string, Set<string>>();
    for (const item of items) {
      const group =
        item.kind === "structure" ? "Structure"
        : item.kind === "fascia"  ? "Fascia"
        : item.kind === "light"   ? "Lighting"
        : "Furniture";
      if (!byGroup.has(group)) byGroup.set(group, new Set());
      byGroup.get(group)!.add(item.name);
    }
    return CATALOG_GROUP_ORDER
      .filter((g) => byGroup.has(g))
      .map((g) => ({ name: g, items: Array.from(byGroup.get(g)!) }));
  }, [selectedWorkspace]);

  const projectTitle =
    workspaceRecord?.project.name ?? t("client.workspace.loadingWorkspace");
  const approvalStage = workspaceApprovalStage(workspaceRecord);
  const approvalStageLabel = workspaceApprovalStageLabel(approvalStage);
  const approvalStageColor = approvalStage === "approved" || approvalStage === "locked"
    ? C.green
    : approvalStage === "revision_requested"
      ? C.orange
      : approvalStage === "sent" || approvalStage === "viewed"
        ? C.blue
        : C.muted;

  useEffect(() => {
    if (allApproved && !approved) {
      setApproved(true);
      showToast(t("client.workspace.toast.allApproved"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allApproved]);

  useEffect(() => {
    let isMounted = true;
    getCurrentWorkspace()
      .then((record) => {
        if (!isMounted) return;
        setWorkspaceRecord(record);
        setRevisionCount(record.revisionCount ?? 0);
        if (record.elementStatus) {
          setElementStatus(record.elementStatus);
        }
        if (record.approved !== undefined) {
          setApproved(record.approved);
        }
        const current = String(
          record.currentVersion?.versionNumber ??
            record.design.currentVersionNumber,
        );
        setVersion(current);
        setCompareVersion(
          String(
            record.versions[1]?.versionNumber ??
              record.versions[0]?.versionNumber ??
              current,
          ),
        );
        setWorkspaceError("");
      })
      .catch((err) => {
        if (!isMounted) return;
        setWorkspaceError(
          err instanceof Error
            ? err.message
            : t("client.workspace.errorLoad"),
        );
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!workspaceRecord?.project.id) return;
    let isMounted = true;
    getWorkspaceComments(workspaceRecord.project.id)
      .then(({ comments: loadedComments }) => {
        if (!isMounted) return;
        // Parse database comments to match frontend structure
        const formatted = loadedComments.map(c => ({
          id: c.id,
          user: c.user,
          initials: c.initials,
          text: c.text,
          time: c.time,
          type: c.type,
          status: c.status ?? "open",
        }));
        setComments(formatted);

        const loadedPins = loadedComments
          .filter((c) => c.type === "pin" && c.pin)
          .map((c, i) => ({
            id: c.id,
            x: c.pin!.x,
            y: c.pin!.y,
            z: c.pin!.z,
            text: c.text.replace(/^.*Pin Annotation #\d+(?: \([^)]+\))?: /, ""),
            num: i + 1,
            status: c.status ?? "open",
          }));
        setPins(loadedPins);
      })
      .catch((err) => {
        console.error("Failed to load comments", err);
      });
    return () => {
      isMounted = false;
    };
  }, [workspaceRecord?.project.id]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'pinRequested') {
        setPendingPin({
          x: e.data.x,
          y: e.data.y,
          z: e.data.z,
          partId: typeof e.data.partId === "string" ? e.data.partId : undefined,
        });
        setPinText("");
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const addComment = () => {
    if (!newComment.trim() || !workspaceRecord?.project.id) return;
    const body = newComment.trim();
    createWorkspaceComment(workspaceRecord.project.id, body, null, "comment")
      .then(({ comment }) => {
        setComments((c) => [
          ...c,
          {
            id: comment.id,
            user: comment.user,
            initials: comment.initials,
            text: comment.text,
            time: comment.time,
            type: comment.type,
            status: comment.status ?? "open",
          },
        ]);
        setNewComment("");
      })
      .catch(() => {
        showToast("Failed to post comment.");
      });
  };
  const submitChange = () => {
    if (!changeText.trim() || !workspaceRecord?.project.id) return;
    const projectId = workspaceRecord.project.id;
    submitClientChangeRequest(projectId, changeText.trim())
      .then((updated) => {
        setWorkspaceRecord(updated);
        setRevisionCount(updated.revisionCount);
        setChangeText("");
        setShowChangeDlg(false);
        showToast(t("client.workspace.toast.changeRequestSent"));

        getWorkspaceComments(projectId).then(({ comments: loadedComments }) => {
          const formatted = loadedComments.map(c => ({
            id: c.id,
            user: c.user,
            initials: c.initials,
            text: c.text,
            time: c.time,
            type: c.type,
            status: c.status ?? "open",
          }));
          setComments(formatted);
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to submit change request.";
        showToast(msg);
        setShowChangeDlg(false);
      });
  };
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPendingPin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };
  const addPin = () => {
    if (!pendingPin || !pinText.trim() || !workspaceRecord?.project.id) return;
    const num = pins.length + 1;
    const body = `Pin Annotation #${num}${pendingPin.partId ? ` (${pendingPin.partId})` : ''}: ${pinText.trim()}`;
    const pinCoords = { x: pendingPin.x, y: pendingPin.y, z: pendingPin.z };
    createWorkspaceComment(workspaceRecord.project.id, body, pinCoords, "pin")
      .then(({ comment }) => {
        setComments((c) => [
          ...c,
          {
            id: comment.id,
            user: comment.user,
            initials: comment.initials,
            text: comment.text,
            time: comment.time,
            type: comment.type,
            status: comment.status ?? "open",
          },
        ]);
        setPins((prev) => [
          ...prev,
          {
            id: comment.id,
            x: pinCoords.x,
            y: pinCoords.y,
            z: pinCoords.z,
            text: pinText.trim(),
            num,
            status: comment.status ?? "open",
            partId: pendingPin.partId,
          },
        ]);
        setPinText("");
        setPendingPin(null);
        setPinMode(false);
        showToast(t("client.workspace.toast.pinAdded", { num }));
      })
      .catch(() => {
        showToast("Failed to place pin.");
      });
  };
  const setFeedbackStatus = (feedbackId: string | number, status: "open" | "resolved") => {
    const previousComments = comments;
    const previousPins = pins;
    const applyStatus = <T extends { id: string | number; status?: "open" | "resolved" }>(item: T): T =>
      item.id === feedbackId ? { ...item, status } : item;

    setComments((current) => current.map(applyStatus));
    setPins((current) => current.map(applyStatus));

    if (!workspaceRecord?.project.id || typeof feedbackId !== "string") return;

    updateWorkspaceCommentStatus(workspaceRecord.project.id, feedbackId, status)
      .catch(() => {
        setComments(previousComments);
        setPins(previousPins);
        showToast("Failed to save feedback status.");
      });
  };
  const approveElement = (id: string) => {
    if (!workspaceRecord?.project.id) return;
    const nextStatus = { ...elementStatus, [id]: "approved" as const };
    setElementStatus(nextStatus);
    saveElementStatus(workspaceRecord.project.id, nextStatus)
      .then(() => {
        showToast(
          t("client.workspace.toast.elementApproved", {
            label: elements.find((e) => e.id === id)?.label,
          }),
        );
      })
      .catch(() => {
        showToast("Failed to save status.");
      });
  };
  const rejectElement = (id: string) => {
    if (!workspaceRecord?.project.id) return;
    const nextStatus = { ...elementStatus, [id]: "rejected" as const };
    setElementStatus(nextStatus);
    saveElementStatus(workspaceRecord.project.id, nextStatus)
      .then(() => {
        showToast(t("client.workspace.toast.feedbackSent"));
      })
      .catch(() => {
        showToast("Failed to save status.");
      });
  };
  const simulateDownload = () => {
    const lines = [
      `Workspace approval summary - ${projectTitle}`,
      `Client: ${workspaceRecord?.project.client ?? "Client"}`,
      `Exhibition: ${workspaceRecord?.project.exhibition ?? "Review"}`,
      `Approval status: ${approvalStageLabel}`,
      `Version: v${version}`,
      '',
      'Stand',
      `- System: ${selectedBoothConfig.system === "maxima" ? "Maxima" : "Octanorm"}`,
      `- Dimensions: ${selectedBoothConfig.width} x ${selectedBoothConfig.depth} x ${selectedBoothConfig.height} m`,
      `- Floor area: ${(selectedBoothConfig.width * selectedBoothConfig.depth).toFixed(1)} m2`,
      `- Open sides: ${[
        selectedBoothConfig.openFront ? "front" : "",
        selectedBoothConfig.openBack ? "back" : "",
        selectedBoothConfig.openLeft ? "left" : "",
        selectedBoothConfig.openRight ? "right" : "",
      ].filter(Boolean).join(", ") || "none"}`,
      '',
      'Element approvals',
      ...elements.map((element) => `- ${element.label}: ${elementStatus[element.id] ?? "pending"}`),
      '',
      'Feedback',
      `- Open feedback items: ${openFeedbackCount}`,
      `- Pins: ${pins.length}`,
      `- Comments: ${comments.length}`,
    ].join('\r\n');
    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
    link.href = url;
    link.download = `${safeName}-approval-summary.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(t("client.workspace.toast.downloadStarted"));
  };
  const handlePurchasePlan = (planCode: string) => {
    if (!workspaceRecord?.project.id) return;
    createWorkspaceSubscriptionRequest(workspaceRecord.project.id, planCode)
      .then(({ checkout_url }) => {
        if (checkout_url) {
          window.location.href = checkout_url;
        } else {
          showToast("Failed to initiate upgrade.");
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to initiate upgrade.";
        showToast(msg);
      });
  };

  if (workspaceError && !workspaceRecord) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.bg,
          color: C.ink,
          fontFamily: UI,
          padding: 24,
        }}
      >
        <div
          style={{
            width: "min(520px, 100%)",
            background: C.panel,
            border: `1px solid ${C.hair}`,
            borderRadius: 18,
            padding: 28,
            textAlign: "center",
            boxShadow: "0 18px 50px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              margin: "0 auto 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#c2410c",
            }}
          >
            <Lock size={24} aria-hidden />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{t("client.workspace.unassigned.title")}</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: C.muted, marginBottom: 20 }}>
            {t("client.workspace.unassigned.body")}
          </p>
          <button
            type="button"
            onClick={() => window.location.assign("/client")}
            style={{
              height: 38,
              borderRadius: 999,
              border: `1px solid ${C.hair}`,
              background: C.panel,
              color: C.ink,
              padding: "0 18px",
              fontFamily: UI,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("client.workspace.unassigned.backBtn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: C.bg,
        color: C.ink,
        fontFamily: UI,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* ARIA live region for toasts */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          bottom: 48,
          left: "50%",
          transform: `translateX(-50%) translateY(${toastVisible ? "0" : "8px"})`,
          background: C.ink,
          color: "#fff",
          fontFamily: UI,
          fontSize: 12,
          fontWeight: 600,
          padding: "10px 20px",
          borderRadius: 6,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          whiteSpace: "nowrap",
          opacity: toastVisible ? 1 : 0,
          pointerEvents: toastVisible ? "auto" : "none",
          transition: "opacity 0.3s, transform 0.3s",
        }}
      >
        <CheckCircle2 size={14} style={{ color: "#6ee7b7" }} aria-hidden />
        {toastMsg}
      </div>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header
        style={{
          height: 46,
          borderBottom: `1px solid ${C.hair}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          background: C.panel,
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <a
            href="/client"
            aria-label={t("client.workspace.backToDashboard")}
            title={t("client.workspace.backToDashboard")}
            style={{
              display: "flex",
              alignItems: "center",
              color: C.muted,
              flexShrink: 0,
              lineHeight: 0,
              textDecoration: "none",
            }}
          >
            <ChevronLeft size={16} aria-hidden />
          </a>
          <Layers size={14} style={{ color: C.blue, flexShrink: 0 }} aria-hidden />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {projectTitle}
          </span>
          <div
            style={{
              width: 1,
              height: 18,
              background: C.hair,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9.5,
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: `${C.orange}12`,
              color: C.orange,
              border: `1px solid ${C.orange}30`,
              borderRadius: 4,
              padding: "3px 9px",
              flexShrink: 0,
            }}
          >
            <Eye size={10} aria-hidden /> {t("client.workspace.viewOnly")}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9.5,
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: `${approvalStageColor}12`,
              color: approvalStageColor,
              border: `1px solid ${approvalStageColor}30`,
              borderRadius: 4,
              padding: "3px 9px",
              flexShrink: 0,
              textTransform: "uppercase",
            }}
          >
            {approvalStageLabel}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          {/* Version dropdown */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowVersions((s) => !s)}
              aria-label={t("client.workspace.versionSelect")}
              aria-expanded={showVersions}
              style={{
                background: "none",
                border: `1px solid ${C.hair}`,
                borderRadius: 4,
                padding: "5px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                fontFamily: MONO,
                color: C.ink,
              }}
            >
              v{version} <ChevronDown size={11} aria-hidden />
            </button>
            {showVersions && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  background: C.panel,
                  border: `1px solid ${C.hair}`,
                  borderRadius: 4,
                  zIndex: 50,
                  minWidth: 180,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                }}
              >
                {versionOptions.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => {
                      setVersion(v.value);
                      setShowVersions(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      fontFamily: MONO,
                      fontSize: 11,
                      color: version === v.value ? C.blue : C.ink,
                      background:
                        version === v.value ? `${C.blue}08` : "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Compare */}
          <button
            onClick={() => setCompareMode((m) => !m)}
            aria-pressed={compareMode}
            aria-label={t("client.workspace.compareBtn")}
            style={{
              background: compareMode ? C.blue : "none",
              border: `1px solid ${compareMode ? C.blue : C.hair}`,
              borderRadius: 4,
              padding: "5px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontFamily: UI,
              color: compareMode ? "#fff" : C.muted,
            }}
          >
            <GitCompare size={12} aria-hidden /> {t("client.workspace.compareBtn")}
          </button>
          {/* Pin */}
          <button
            onClick={() => setPinMode((m) => !m)}
            aria-pressed={pinMode}
            aria-label={
              pinMode
                ? t("client.workspace.pinningLabel")
                : t("client.workspace.addPinBtn")
            }
            style={{
              background: pinMode ? `${C.orange}14` : "none",
              border: `1px solid ${pinMode ? C.orange : C.hair}`,
              borderRadius: 4,
              padding: "5px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontFamily: UI,
              color: pinMode ? C.orange : C.muted,
            }}
          >
            <Pin size={12} aria-hidden />
            {pinMode
              ? t("client.workspace.pinningLabel")
              : t("client.workspace.addPinBtn")}
          </button>
          {/* Download */}
          <button
            onClick={simulateDownload}
            aria-label={t("client.workspace.downloadBtn")}
            style={{
              background: "none",
              border: `1px solid ${C.hair}`,
              borderRadius: 4,
              padding: "5px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontFamily: UI,
              color: C.muted,
            }}
          >
            <Download size={12} aria-hidden /> {t("client.workspace.downloadBtn")}
          </button>
          {/* Revision counter badge */}
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9.5,
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: revisionsExhausted ? `${C.orange}18` : `${C.green}12`,
              color: revisionsExhausted ? C.orange : C.green,
              border: `1px solid ${revisionsExhausted ? C.orange : C.green}30`,
              borderRadius: 4,
              padding: "3px 9px",
              flexShrink: 0,
            }}
            title="Number of change requests used"
          >
            {t("client.workspace.revisions.counter", { count: revisionCount, limit: revisionLimit })}
          </span>
          {/* Request Changes */}
          <button
            onClick={() => {
              if (revisionsExhausted) {
                setShowSubscriptionDlg(true);
                return;
              }
              setShowChangeDlg(true);
            }}
            aria-label={revisionsExhausted ? t("client.workspace.revisions.upgradeBtn") : t("client.workspace.requestChangesBtn")}
            title={revisionsExhausted ? "Choose a plan to request more revisions" : undefined}
            style={{
              background: "none",
              border: `1px solid ${C.orange}40`,
              borderRadius: 4,
              padding: "5px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              fontFamily: UI,
              color: C.orange,
              opacity: 1,
            }}
          >
            <AlertCircle size={12} aria-hidden />{" "}
            {revisionsExhausted ? t("client.workspace.revisions.upgradeBtn") : t("client.workspace.requestChangesBtn")}
          </button>
          {/* Approve */}
          {approved ? (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10.5,
                color: C.green,
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                border: `1px solid ${C.green}40`,
                borderRadius: 4,
                background: `${C.green}08`,
              }}
            >
              <CheckCircle2 size={12} aria-hidden />{" "}
              {t("client.workspace.approvedLabel")}
            </span>
          ) : (
            <button
              onClick={() => {
                if (!workspaceRecord?.project.id) return;
                approveProjectWorkspace(workspaceRecord.project.id)
                  .then((record) => {
                    setWorkspaceRecord(record);
                    setApproved(true);
                    showToast(t("client.workspace.toast.designApproved"));
                  })
                  .catch(() => {
                    showToast("Failed to approve design.");
                  });
              }}
              style={{
                background: C.green,
                border: "none",
                color: "#fff",
                borderRadius: 4,
                padding: "6px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: UI,
              }}
            >
              <CheckCircle2 size={12} aria-hidden />{" "}
              {t("client.workspace.approveDesignBtn")}
            </button>
          )}
        </div>
      </header>
      {showVersions && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 40 }}
          onClick={() => setShowVersions(false)}
          aria-hidden="true"
        />
      )}

      {revisionsExhausted && (
        <div
          style={{
            background: "#fdf2f8",
            borderBottom: "1px solid #fbcfe8",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#9d174d",
            fontSize: 12.5,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          <AlertCircle size={15} style={{ color: "#db2777" }} />
          <span>{t("client.workspace.revisions.exhaustedBody")}</span>
          <button
            onClick={() => setShowSubscriptionDlg(true)}
            style={{
              marginLeft: "auto",
              background: "#db2777",
              color: "white",
              border: "none",
              borderRadius: 4,
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {t("client.workspace.revisions.upgradeBtn")}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left — Locked Asset Library ─────────────────────── */}
        <aside
          style={{
            width: 220,
            borderRight: `1px solid ${C.hair}`,
            background: C.panel,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflow: "hidden",
          }}
          aria-label={t("client.workspace.assetLibraryLabel")}
        >
          <div
            style={{
              padding: "8px 14px",
              borderBottom: `1px solid ${C.hair}`,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <Lock size={10} style={{ color: C.muted }} aria-hidden />
            <MonoLabel>§ {t("client.workspace.assetLibraryLabel")}</MonoLabel>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9.5,
                color: C.muted,
                marginLeft: "auto",
              }}
            >
              {t("client.workspace.lockedLabel")}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {clientCatalog.length === 0 && (
              <div style={{ padding: "24px 14px", color: C.muted, fontSize: 11, textAlign: "center", fontFamily: MONO }}>
                No items placed yet
              </div>
            )}
            {clientCatalog.map((cat) => (
              <div key={cat.name} style={{ borderBottom: `1px solid ${C.hair}` }}>
                <div style={{ padding: "7px 14px" }}>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: C.muted,
                    }}
                  >
                    {cat.name}
                  </span>
                </div>
                <div
                  style={{
                    padding: "4px 10px 10px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 4,
                  }}
                >
                  {cat.items.map((item) => (
                    <div
                      key={item}
                      style={{
                        position: "relative",
                        background: C.bg,
                        border: `1px dashed ${C.hair}`,
                        borderRadius: 4,
                        padding: "8px 6px 6px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                        opacity: 0.55,
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 3,
                          background: C.hair,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 500,
                          color: C.muted,
                          textAlign: "center",
                          lineHeight: 1.2,
                        }}
                      >
                        {item}
                      </span>
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: 0,
                          borderRadius: 4,
                          background: `${C.panel}cc`,
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.opacity = "1")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.opacity = "0")
                        }
                      >
                        <Lock size={11} style={{ color: C.muted }} aria-hidden />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderTop: `1px solid ${C.hair}`,
              background: C.bg,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 8.5,
                color: C.muted,
                lineHeight: 1.5,
              }}
            >
              {t("client.workspace.reviewModeNote")}
            </span>
          </div>
        </aside>

        {/* ── Center — Canvas ─────────────────────────────────── */}
        <main
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            backgroundColor: C.bg,
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px)",
          }}
          aria-label={t("client.workspace.canvasLabel")}
        >
          {compareMode ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                height: "100%",
                position: "absolute",
                inset: 0,
                gap: 0,
              }}
            >
              <div
                style={{
                  position: "relative",
                  borderRight: `2px solid ${C.blue}`,
                }}
              >
                <Booth3D config={selectedBoothConfig} />
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    fontFamily: MONO,
                    fontSize: 9.5,
                    background: C.blue,
                    color: "#fff",
                    borderRadius: 4,
                    padding: "4px 9px",
                  }}
                >
                  {t("client.workspace.compareCurrentLabel", { v: version })}
                </div>
              </div>
              <div style={{ position: "relative" }}>
                <Booth3D config={comparedBoothConfig} />
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    fontFamily: MONO,
                    fontSize: 9.5,
                    background: C.muted,
                    color: "#fff",
                    borderRadius: 4,
                    padding: "4px 9px",
                  }}
                >
                  {t("client.workspace.comparePreviousLabel", {
                    v: compareVersion,
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                cursor: pinMode ? "crosshair" : "default",
              }}
              onClick={handleCanvasClick}
            >
              <Booth3D config={selectedBoothConfig} />

              {pins.map((pin) => (
                <div
                  key={pin.id}
                  style={{
                    position: "absolute",
                    left: `${pin.x}%`,
                    top: `${pin.y}%`,
                    transform: "translate(-50%,-50%)",
                    zIndex: 20,
                    pointerEvents: "auto",
                  }}
                >
                  <div
                    title={pin.text}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: C.orange,
                      border: "2px solid #fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        color: "#fff",
                        fontWeight: 700,
                      }}
                    >
                      {pin.num}
                    </span>
                  </div>
                </div>
              ))}

              {pendingPin && (
                <div
                  style={{
                    position: "absolute",
                    left: `${pendingPin.x}%`,
                    top: `${pendingPin.y}%`,
                    transform: "translate(-50%,-100%)",
                    zIndex: 30,
                    background: C.panel,
                    border: `1px solid ${C.hair}`,
                    borderRadius: 6,
                    padding: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                    minWidth: 220,
                  }}
                >
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: 9.5,
                      color: C.muted,
                      marginBottom: 6,
                    }}
                  >
                    {t("client.workspace.pinAnnotationPrompt")}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <label className="sr-only" htmlFor="pin-input">
                      {t("client.workspace.pinPlaceholder")}
                    </label>
                    <input
                      id="pin-input"
                      value={pinText}
                      onChange={(e) => setPinText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPin()}
                      placeholder={t("client.workspace.pinPlaceholder")}
                      style={{
                        flex: 1,
                        height: 28,
                        border: `1px solid ${C.hair}`,
                        borderRadius: 4,
                        background: C.bg,
                        fontFamily: UI,
                        fontSize: 11.5,
                        color: C.ink,
                        paddingLeft: 7,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                      autoFocus
                    />
                    <button
                      onClick={addPin}
                      aria-label={t("client.workspace.confirmPin")}
                      style={{
                        background: C.orange,
                        border: "none",
                        color: "#fff",
                        borderRadius: 4,
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <Pin size={12} aria-hidden />
                    </button>
                    <button
                      onClick={() => {
                        setPendingPin(null);
                        setPinText("");
                      }}
                      aria-label={t("client.workspace.cancelPin")}
                      style={{
                        background: "none",
                        border: `1px solid ${C.hair}`,
                        borderRadius: 4,
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: C.muted,
                        flexShrink: 0,
                      }}
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Top badges */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              display: "flex",
              gap: 6,
              zIndex: 10,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            {[
              {
                text:
                  selectedBooth?.system === "maxima"
                    ? "MAXIMA SYSTEM"
                    : "OCTANORM SYSTEM",
                color: C.muted,
              },
              {
                text: `${selectedBoothConfig.width} x ${selectedBoothConfig.depth} M`,
                color: C.muted,
              },
            ].map((b) => (
              <span
                key={b.text}
                style={{
                  fontFamily: MONO,
                  fontSize: 9.5,
                  background: C.panel,
                  border: `1px solid ${C.hair}`,
                  borderRadius: 4,
                  padding: "4px 9px",
                  color: b.color,
                }}
              >
                {b.text}
              </span>
            ))}
            {pinMode && (
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 9.5,
                  background: `${C.orange}14`,
                  border: `1px solid ${C.orange}30`,
                  borderRadius: 4,
                  padding: "4px 9px",
                  color: C.orange,
                  pointerEvents: "none",
                }}
              >
                ◉ {t("client.workspace.clickToPin")}
              </span>
            )}
          </div>



          {/* VIEW ONLY watermark */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%) rotate(-25deg)",
              fontFamily: MONO,
              fontSize: 64,
              fontWeight: 900,
              color: C.ink,
              opacity: 0.025,
              letterSpacing: "0.05em",
              pointerEvents: "none",
              zIndex: 5,
              whiteSpace: "nowrap",
            }}
            aria-hidden="true"
          >
            {t("client.workspace.viewOnly")}
          </div>


        </main>

        {/* ── Right — Tabs ─────────────────────────────────────── */}
        <aside
          style={{
            width: 306,
            borderLeft: `1px solid ${C.hair}`,
            background: C.panel,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${C.hair}`,
              flexShrink: 0,
            }}
            role="tablist"
          >
            {(
              [
                ["thread", t("client.workspace.tab.thread"), MessageSquare],
                ["approvals", t("client.workspace.tab.approvals"), CheckSquare],
                ["pins", t("client.workspace.tab.pins"), Pin],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                role="tab"
                aria-selected={rightTab === k}
                onClick={() => setRightTab(k)}
                style={{
                  flex: 1,
                  background: rightTab === k ? C.panel : "transparent",
                  border: "none",
                  borderBottom:
                    rightTab === k
                      ? `2px solid ${C.blue}`
                      : "2px solid transparent",
                  padding: "8px 4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  fontFamily: MONO,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: rightTab === k ? C.blue : C.muted,
                  textTransform: "uppercase",
                  position: "relative",
                }}
              >
                <Icon size={10} aria-hidden /> {label}
                {k === "approvals" &&
                  Object.values(elementStatus).filter((s) => s === "pending")
                    .length > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 6,
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: C.orange,
                      }}
                      aria-label={t("client.workspace.pendingDot")}
                    />
                  )}
              </button>
            ))}
          </div>

          {/* Thread tab */}
          {rightTab === "thread" && (
            <>
              <div
                style={{
                  padding: "8px 16px",
                  borderBottom: `1px solid ${C.hair}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <MonoLabel>§ {t("client.workspace.reviewThread")}</MonoLabel>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 9.5,
                    color: C.muted,
                    marginLeft: "auto",
                  }}
                >
                  {openFeedbackCount} {t("client.workspace.feedbackFilter.open")}
                </span>
              </div>
              <div
                style={{
                  padding: "8px 16px",
                  borderBottom: `1px solid ${C.hair}`,
                  display: "flex",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                {(["open", "all", "resolved"] as FeedbackFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setFeedbackFilter(filter)}
                    style={{
                      border: `1px solid ${feedbackFilter === filter ? C.blue : C.hair}`,
                      background: feedbackFilter === filter ? `${C.blue}10` : "none",
                      color: feedbackFilter === filter ? C.blue : C.muted,
                      borderRadius: 4,
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontFamily: MONO,
                      fontSize: 9.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {t(`client.workspace.feedbackFilter.${filter}`)}
                  </button>
                ))}
              </div>
              <div
                role="log"
                aria-label={t("client.workspace.reviewThread")}
                aria-live="polite"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {visibleComments.map((comment) => {
                  const isMe = comment.user === "You";
                  const isResolved = (comment.status ?? "open") === "resolved";
                  return (
                    <div
                      key={comment.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isMe ? "flex-end" : "flex-start",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 5 }}
                      >
                        {!isMe && (
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: C.blue,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                            aria-hidden="true"
                          >
                            <span
                              style={{
                                fontFamily: MONO,
                                fontSize: 7.5,
                                color: "#fff",
                                fontWeight: 700,
                              }}
                            >
                              {comment.initials}
                            </span>
                          </div>
                        )}
                        <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>
                          {comment.user}
                        </span>
                        {isMe && (
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: C.hair,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                            aria-hidden="true"
                          >
                            <span
                              style={{
                                fontFamily: MONO,
                                fontSize: 7.5,
                                color: C.ink,
                                fontWeight: 700,
                              }}
                            >
                              YO
                            </span>
                          </div>
                        )}
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 8,
                            color: isResolved ? C.green : C.orange,
                            border: `1px solid ${isResolved ? C.green : C.orange}30`,
                            background: `${isResolved ? C.green : C.orange}10`,
                            borderRadius: 3,
                            padding: "1px 5px",
                            textTransform: "uppercase",
                          }}
                        >
                          {isResolved ? t("client.workspace.pinStatus.resolved") : t("client.workspace.pinStatus.open")}
                        </span>
                      </div>
                      <div
                        style={{
                          maxWidth: "88%",
                          padding: "8px 11px",
                          borderRadius: 6,
                          fontSize: 12,
                          lineHeight: 1.5,
                          background:
                            comment.type === "change"
                              ? `${C.orange}10`
                              : isMe
                                ? C.blue
                                : C.bg,
                          color:
                            comment.type === "change"
                              ? C.orange
                              : isMe
                                ? "#fff"
                                : C.ink,
                          border:
                            comment.type === "change"
                              ? `1px solid ${C.orange}30`
                              : isMe
                                ? "none"
                                : `1px solid ${C.hair}`,
                        }}
                      >
                        {comment.text}
                      </div>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 8.5,
                          color: C.muted,
                        }}
                      >
                        {comment.time}
                      </span>
                      <button
                        onClick={() => setFeedbackStatus(comment.id, isResolved ? "open" : "resolved")}
                        style={{
                          background: "none",
                          border: `1px solid ${C.hair}`,
                          borderRadius: 4,
                          color: C.muted,
                          cursor: "pointer",
                          fontFamily: MONO,
                          fontSize: 8.5,
                          padding: "3px 7px",
                        }}
                      >
                        {isResolved ? t("client.workspace.pinStatus.reopen") : t("client.workspace.pinStatus.resolve")}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  borderTop: `1px solid ${C.hair}`,
                  display: "flex",
                  gap: 6,
                  background: C.bg,
                  flexShrink: 0,
                }}
              >
                <label htmlFor="thread-input" className="sr-only">
                  {t("client.workspace.commentPlaceholder")}
                </label>
                <input
                  id="thread-input"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                  placeholder={t("client.workspace.commentPlaceholder")}
                  style={{
                    flex: 1,
                    height: 34,
                    border: `1px solid ${C.hair}`,
                    borderRadius: 4,
                    background: C.panel,
                    fontFamily: UI,
                    fontSize: 12,
                    color: C.ink,
                    paddingLeft: 10,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={addComment}
                  aria-label={t("client.workspace.sendComment")}
                  style={{
                    background: C.blue,
                    border: "none",
                    color: "#fff",
                    borderRadius: 4,
                    width: 34,
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <Send size={13} aria-hidden />
                </button>
              </div>
              <Hairline />
              <div style={{ padding: "12px 16px", flexShrink: 0 }}>
                <MonoLabel>§ {t("client.workspace.projectInfoLabel")}</MonoLabel>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 7,
                    marginTop: 8,
                  }}
                >
                  {[
                    [
                      t("client.workspace.info.system"),
                      selectedBooth?.system === "maxima"
                        ? "Maxima (2 m module)"
                        : "Octanorm (1 m module)",
                    ],
                    [
                      t("client.workspace.info.floorArea"),
                      `${(selectedBoothConfig.width * selectedBoothConfig.depth).toFixed(1)} m²`,
                    ],
                    [
                      t("client.workspace.info.dimensions"),
                      `${selectedBoothConfig.width} x ${selectedBoothConfig.depth} x ${selectedBoothConfig.height} m`,
                    ],
                    [
                      t("client.workspace.info.approval"),
                      approvalStageLabel,
                    ],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 8.5,
                          color: C.muted,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          display: "block",
                        }}
                      >
                        {l}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: MONO,
                          color:
                            l === t("client.workspace.info.approval")
                              ? approvalStageColor
                              : "inherit",
                        }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Approvals tab */}
          {rightTab === "approvals" && (
            <div
              style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 9.5,
                  color: C.muted,
                  marginBottom: 12,
                }}
              >
                {t("client.workspace.elementApprovalHeading")}
              </div>
              {elements.map((el) => {
                const st = elementStatus[el.id];
                const stColor =
                  st === "approved"
                    ? C.green
                    : st === "rejected"
                      ? "#dc2626"
                      : C.orange;
                return (
                  <div
                    key={el.id}
                    style={{
                      padding: "12px",
                      borderRadius: 6,
                      border: `1px solid ${C.hair}`,
                      marginBottom: 8,
                      background:
                        st === "approved"
                          ? `${C.green}06`
                          : st === "rejected"
                            ? "rgba(220,38,38,0.04)"
                            : "transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: C.ink,
                        }}
                      >
                        {el.label}
                      </span>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 9,
                          fontWeight: 700,
                          color: stColor,
                          background: `${stColor}15`,
                          border: `1px solid ${stColor}30`,
                          borderRadius: 3,
                          padding: "2px 7px",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {t(`client.workspace.elementStatus.${st}`)}
                      </span>
                    </div>
                    {st === "pending" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => approveElement(el.id)}
                          style={{
                            flex: 1,
                            background: `${C.green}12`,
                            border: `1px solid ${C.green}30`,
                            borderRadius: 4,
                            padding: "5px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: C.green,
                          }}
                        >
                          <CheckCircle2 size={11} aria-hidden />{" "}
                          {t("client.workspace.approveBtn")}
                        </button>
                        <button
                          onClick={() => rejectElement(el.id)}
                          style={{
                            flex: 1,
                            background: "rgba(220,38,38,0.06)",
                            border: "1px solid rgba(220,38,38,0.3)",
                            borderRadius: 4,
                            padding: "5px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#dc2626",
                          }}
                        >
                          <X size={11} aria-hidden /> {t("client.workspace.requestFixBtn")}
                        </button>
                      </div>
                    )}
                    {st !== "pending" && (
                      <button
                        onClick={() => {
                          if (!workspaceRecord?.project.id) return;
                          const nextStatus = { ...elementStatus, [el.id]: "pending" as const };
                          setElementStatus(nextStatus);
                          saveElementStatus(workspaceRecord.project.id, nextStatus).catch(() => {
                            showToast("Failed to save status.");
                          });
                        }}
                        style={{
                          width: "100%",
                          background: "none",
                          border: `1px dashed ${C.hair}`,
                          borderRadius: 4,
                          padding: "4px",
                          cursor: "pointer",
                          fontSize: 10,
                          fontFamily: MONO,
                          color: C.muted,
                        }}
                      >
                        {t("client.workspace.resetBtn")}
                      </button>
                    )}
                  </div>
                );
              })}
              <div
                style={{
                  padding: "12px",
                  borderRadius: 6,
                  background: allApproved
                    ? `${C.green}08`
                    : `${C.orange}06`,
                  border: `1px solid ${allApproved ? C.green : C.orange}30`,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 9.5,
                    color: allApproved ? C.green : C.orange,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  {allApproved
                    ? t("client.workspace.allApprovedMsg")
                    : t("client.workspace.pendingApprovalMsg")}
                </div>
                <div
                  style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}
                >
                  {t("client.workspace.approvedCount", {
                    approved: Object.values(elementStatus).filter(
                      (s) => s === "approved",
                    ).length,
                    total: elements.length,
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Pins tab */}
          {rightTab === "pins" && (
            <div
              style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 9.5,
                    color: C.muted,
                  }}
                >
                  {t("client.workspace.canvasAnnotations")}
                </div>
                <button
                  onClick={() => setPinMode((m) => !m)}
                  aria-pressed={pinMode}
                  style={{
                    background: pinMode ? `${C.orange}14` : "none",
                    border: `1px solid ${pinMode ? C.orange : C.hair}`,
                    borderRadius: 4,
                    padding: "4px 9px",
                    cursor: "pointer",
                    fontSize: 10,
                    fontFamily: MONO,
                    fontWeight: 700,
                    color: pinMode ? C.orange : C.muted,
                  }}
                >
                  {pinMode
                    ? t("client.workspace.placingLabel")
                    : t("client.workspace.addPinBtn")}
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {(["open", "all", "resolved"] as FeedbackFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setFeedbackFilter(filter)}
                    style={{
                      border: `1px solid ${feedbackFilter === filter ? C.blue : C.hair}`,
                      background: feedbackFilter === filter ? `${C.blue}10` : "none",
                      color: feedbackFilter === filter ? C.blue : C.muted,
                      borderRadius: 4,
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontFamily: MONO,
                      fontSize: 9.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              {visiblePins.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "30px 0",
                    color: C.muted,
                    fontFamily: MONO,
                    fontSize: 9.5,
                  }}
                >
                  <Pin
                    size={24}
                    style={{ margin: "0 auto 10px", opacity: 0.3 }}
                    aria-hidden
                  />
                  {t("client.workspace.noPins")}
                </div>
              )}
              {visiblePins.map((pin) => {
                const isResolved = (pin.status ?? "open") === "resolved";
                return (
                <div
                  key={pin.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px",
                    borderRadius: 5,
                    border: `1px solid ${isResolved ? C.green : C.hair}`,
                    marginBottom: 7,
                    background: isResolved ? `${C.green}06` : C.bg,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: isResolved ? C.green : C.orange,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        color: "#fff",
                        fontWeight: 700,
                      }}
                    >
                      {pin.num}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 8,
                          color: isResolved ? C.green : C.orange,
                          border: `1px solid ${isResolved ? C.green : C.orange}30`,
                          background: `${isResolved ? C.green : C.orange}10`,
                          borderRadius: 3,
                          padding: "1px 5px",
                          textTransform: "uppercase",
                        }}
                      >
                        {isResolved ? t("client.workspace.pinStatus.resolved") : t("client.workspace.pinStatus.open")}
                      </span>
                      {pin.partId && (
                        <span style={{ fontFamily: MONO, fontSize: 8, color: C.muted }}>
                          {pin.partId}
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: C.ink,
                        lineHeight: 1.4,
                      }}
                    >
                      {pin.text}
                    </p>
                    <p
                      style={{
                        fontFamily: MONO,
                        fontSize: 8.5,
                        color: C.muted,
                        marginTop: 3,
                      }}
                    >
                      {pin.x.toFixed(0)}% × {pin.y.toFixed(0)}%
                    </p>
                    <button
                      onClick={() => setFeedbackStatus(pin.id, isResolved ? "open" : "resolved")}
                      style={{
                        background: "none",
                        border: `1px solid ${C.hair}`,
                        borderRadius: 4,
                        color: C.muted,
                        cursor: "pointer",
                        fontFamily: MONO,
                        fontSize: 8.5,
                        padding: "3px 7px",
                        marginTop: 8,
                      }}
                    >
                      {isResolved ? t("client.workspace.pinStatus.reopen") : t("client.workspace.pinStatus.resolve")}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setPins((p) => p.filter((pi) => pi.id !== pin.id));
                      const pid = workspaceRecord?.project.id;
                      if (pid) void deleteWorkspaceComment(pid, String(pin.id));
                    }}
                    aria-label={t("client.workspace.removePin", {
                      num: pin.num,
                    })}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: C.muted,
                      padding: 2,
                      display: "flex",
                      alignItems: "flex-start",
                    }}
                  >
                    <X size={11} aria-hidden />
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* ── Status Bar ────────────────────────────────────────────── */}
      <footer
        style={{
          height: 26,
          background: "#1a1815",
          borderTop: "1px solid #111",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9.5,
              color: "#6a5a40",
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#6a5a40",
                display: "inline-block",
              }}
            />
            {t("client.workspace.statusBar.viewOnly")}
          </span>
          {[
            workspaceRecord?.project.name ?? "Workspace",
            `${selectedBooth?.system === "maxima" ? "Maxima" : "Octanorm"} System`,
            `v${version}`,
            `${pins.length} pins`,
            `Floor ${(selectedBoothConfig.width * selectedBoothConfig.depth).toFixed(1)} m²`,
          ].map((s, i) => (
            <span
              key={i}
              style={{ fontFamily: MONO, fontSize: 9.5, color: "#5a5048", marginLeft: 4 }}
            >
              · {s}
            </span>
          ))}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: "#5a5048" }}>
          {t("client.workspace.statusBar.restricted")}
        </span>
      </footer>

      {/* ── Request Changes Dialog ───────────────────────────────── */}
      {showChangeDlg && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(24,22,19,0.4)",
              zIndex: 100,
            }}
            onClick={() => setShowChangeDlg(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-dlg-title"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              background: C.panel,
              border: `1px solid ${C.hair}`,
              borderRadius: 6,
              padding: 24,
              zIndex: 101,
              width: 420,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            <h3
              id="change-dlg-title"
              style={{
                fontSize: 15,
                fontWeight: 700,
                marginBottom: 4,
                marginTop: 0,
              }}
            >
              {t("client.workspace.dialog.title")}
            </h3>
            <p
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: C.muted,
                marginBottom: 14,
              }}
            >
              {t("client.workspace.dialog.subtitle")}
            </p>
            <label htmlFor="change-textarea" className="sr-only">
              {t("client.workspace.dialog.placeholder")}
            </label>
            <textarea
              id="change-textarea"
              value={changeText}
              onChange={(e) => setChangeText(e.target.value)}
              placeholder={t("client.workspace.dialog.placeholder")}
              rows={5}
              style={{
                width: "100%",
                border: `1px solid ${C.hair}`,
                borderRadius: 4,
                padding: 10,
                fontFamily: UI,
                fontSize: 13,
                color: C.ink,
                background: C.bg,
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
                lineHeight: 1.5,
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 12,
              }}
            >
              <button
                onClick={() => setShowChangeDlg(false)}
                style={{
                  background: "none",
                  border: `1px solid ${C.hair}`,
                  borderRadius: 4,
                  padding: "7px 14px",
                  cursor: "pointer",
                  fontFamily: UI,
                  fontSize: 12,
                  color: C.ink,
                }}
              >
                {t("client.workspace.dialog.cancel")}
              </button>
              <button
                onClick={submitChange}
                style={{
                  background: C.blue,
                  border: "none",
                  color: "#fff",
                  borderRadius: 4,
                  padding: "7px 16px",
                  cursor: "pointer",
                  fontFamily: UI,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {t("client.workspace.dialog.submit")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Upgrade Revisions Dialog ──────────────────────────────── */}
      {showSubscriptionDlg && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(24,22,19,0.4)",
              zIndex: 100,
            }}
            onClick={() => setShowSubscriptionDlg(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-dlg-title"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              background: C.panel,
              border: `1px solid ${C.hair}`,
              borderRadius: 8,
              padding: 24,
              zIndex: 101,
              width: 500,
              boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
              color: C.ink,
            }}
          >
            <h3
              id="subscription-dlg-title"
              style={{
                fontSize: 17,
                fontWeight: 700,
                marginBottom: 6,
                marginTop: 0,
                color: C.blue,
              }}
            >
              {t("client.workspace.revisions.upgradeDialog.title")}
            </h3>
            <p
              style={{
                fontSize: 12.5,
                color: C.muted,
                marginBottom: 20,
                lineHeight: 1.4,
              }}
            >
              {t("client.workspace.revisions.upgradeDialog.subtitle")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {/* Starter Plan */}
              <div style={{
                border: `1px solid ${C.hair}`,
                borderRadius: 6,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: C.bg
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{t("client.workspace.revisions.upgradeDialog.starter.name")}</h4>
                  <p style={{ margin: "2px 0 0 0", fontSize: 11.5, color: C.muted }}>{t("client.workspace.revisions.upgradeDialog.starter.description")}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{t("client.workspace.revisions.upgradeDialog.starter.price")}</div>
                  <button
                    onClick={() => handlePurchasePlan("starter")}
                    style={{
                      background: C.blue,
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      padding: "5px 12px",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                      marginTop: 4
                    }}
                  >
                    Select
                  </button>
                </div>
              </div>

              {/* Pro Plan */}
              <div style={{
                border: `2px solid ${C.blue}`,
                borderRadius: 6,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f0f9ff"
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.blue }}>{t("client.workspace.revisions.upgradeDialog.pro.name")}</h4>
                  <p style={{ margin: "2px 0 0 0", fontSize: 11.5, color: C.muted }}>{t("client.workspace.revisions.upgradeDialog.pro.description")}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>{t("client.workspace.revisions.upgradeDialog.pro.price")}</div>
                  <button
                    onClick={() => handlePurchasePlan("pro")}
                    style={{
                      background: C.blue,
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      padding: "5px 12px",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                      marginTop: 4
                    }}
                  >
                    Select
                  </button>
                </div>
              </div>

              {/* Unlimited Plan */}
              <div style={{
                border: `1px solid ${C.hair}`,
                borderRadius: 6,
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: C.bg
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{t("client.workspace.revisions.upgradeDialog.unlimited.name")}</h4>
                  <p style={{ margin: "2px 0 0 0", fontSize: 11.5, color: C.muted }}>{t("client.workspace.revisions.upgradeDialog.unlimited.description")}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{t("client.workspace.revisions.upgradeDialog.unlimited.price")}</div>
                  <button
                    onClick={() => handlePurchasePlan("unlimited")}
                    style={{
                      background: C.blue,
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      padding: "5px 12px",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                      marginTop: 4
                    }}
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowSubscriptionDlg(false)}
                style={{
                  background: "none",
                  border: `1px solid ${C.hair}`,
                  borderRadius: 4,
                  padding: "7px 16px",
                  cursor: "pointer",
                  fontFamily: UI,
                  fontSize: 12,
                  color: C.ink,
                }}
              >
                {t("client.workspace.revisions.upgradeDialog.cancelBtn")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
