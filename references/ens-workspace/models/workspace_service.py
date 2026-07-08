import json
from datetime import datetime

from sqlalchemy import and_, func, or_
from sqlalchemy import inspect
from sqlalchemy.orm import aliased

from app.extensions import db
from app.models.workspace import (
    Workspace,
    WorkspaceFeedbackRequest,
    WorkspaceVersion,
)
from app.time_utils import utc_now_naive
from app.services.activity_service import ACTOR_LABELS
from app.services.workspace_review_transition_service import (
    can_apply_workspace_review_action,
    normalize_workspace_review_status,
)
from app.workspace.scene import normalize_scene

CLIENT_ARRANGEMENT_ROUND_LIMIT = 2
OPEN_FEEDBACK_STATUSES = {"new", "open", "pending", "in_progress"}
SHARED_WORKSPACE_VERSION_KINDS = {"client_submission", "pm_share"}
CLIENT_SUBSCRIPTION_STATUS_INACTIVE = "inactive"
CLIENT_SUBSCRIPTION_STATUS_PENDING = "pending"
CLIENT_SUBSCRIPTION_STATUS_PAID = "paid"
CLIENT_SUBSCRIPTION_STATUS_ACTIVE = "active"
CLIENT_SUBSCRIPTION_STATUS_FAILED = "failed"
CLIENT_SUBSCRIPTION_STATUS_CANCELLED = "cancelled"
CLIENT_SUBSCRIPTION_STATUSES = {
    CLIENT_SUBSCRIPTION_STATUS_INACTIVE,
    CLIENT_SUBSCRIPTION_STATUS_PENDING,
    CLIENT_SUBSCRIPTION_STATUS_PAID,
    CLIENT_SUBSCRIPTION_STATUS_ACTIVE,
    CLIENT_SUBSCRIPTION_STATUS_FAILED,
    CLIENT_SUBSCRIPTION_STATUS_CANCELLED,
}
CLIENT_SUBSCRIPTION_VERIFIED_STATUSES = {
    CLIENT_SUBSCRIPTION_STATUS_PAID,
    CLIENT_SUBSCRIPTION_STATUS_ACTIVE,
}
CLIENT_SUBSCRIPTION_PLANS = {
    "starter": {
        "code": "starter",
        "label": "Starter",
        "price": 2.99,
        "currency": "USD",
        "extra_rounds": 3,
        "unlimited": False,
    },
    "pro": {
        "code": "pro",
        "label": "Pro",
        "price": 9.99,
        "currency": "USD",
        "extra_rounds": 8,
        "unlimited": False,
    },
    "unlimited": {
        "code": "unlimited",
        "label": "Unlimited",
        "price": 11.99,
        "currency": "USD",
        "extra_rounds": None,
        "unlimited": True,
    },
}
CLIENT_SUBSCRIPTION_PLAN_ORDER = ("starter", "pro", "unlimited")


def normalize_client_subscription_status(status):
    normalized = str(status or "").strip().lower()
    if normalized in CLIENT_SUBSCRIPTION_STATUSES:
        return normalized
    return CLIENT_SUBSCRIPTION_STATUS_INACTIVE


def client_subscription_is_verified(status):
    return normalize_client_subscription_status(status) in CLIENT_SUBSCRIPTION_VERIFIED_STATUSES


def normalize_client_subscription_plan(plan_code, *, unlimited_active=False):
    normalized = str(plan_code or "").strip().lower()
    if normalized in CLIENT_SUBSCRIPTION_PLANS:
        return normalized
    if unlimited_active:
        return "unlimited"
    return "none"


def client_subscription_plan_config(plan_code, *, unlimited_active=False):
    normalized = normalize_client_subscription_plan(
        plan_code, unlimited_active=unlimited_active
    )
    if normalized == "none":
        return {
            "code": "none",
            "label": "Included",
            "price": 0.0,
            "currency": "USD",
            "extra_rounds": 0,
            "unlimited": False,
        }
    return dict(CLIENT_SUBSCRIPTION_PLANS[normalized])


def client_subscription_catalog():
    return [
        client_subscription_plan_config(plan_code)
        for plan_code in CLIENT_SUBSCRIPTION_PLAN_ORDER
    ]


def latest_workspace_for_client(client_id):
    return (
        Workspace.query.filter_by(client_id=client_id)
        .order_by(Workspace.updated_at.desc(), Workspace.id.desc())
        .first()
    )


def latest_workspaces_for_clients(client_ids, *, project_manager_id=None):
    normalized_ids = []
    for client_id in client_ids or []:
        try:
            parsed = int(client_id)
        except (TypeError, ValueError):
            continue
        if parsed not in normalized_ids:
            normalized_ids.append(parsed)

    if not normalized_ids:
        return []

    later_workspace = aliased(Workspace)
    query = Workspace.query.filter(Workspace.client_id.in_(normalized_ids))
    if project_manager_id is not None:
        query = query.filter(Workspace.project_manager_id == project_manager_id)

    later_filters = [
        later_workspace.client_id == Workspace.client_id,
        or_(
            later_workspace.updated_at > Workspace.updated_at,
            and_(
                later_workspace.updated_at == Workspace.updated_at,
                later_workspace.id > Workspace.id,
            ),
        ),
    ]
    if project_manager_id is not None:
        later_filters.append(later_workspace.project_manager_id == project_manager_id)

    return (
        query.outerjoin(later_workspace, and_(*later_filters))
        .filter(later_workspace.id.is_(None))
        .order_by(Workspace.updated_at.desc(), Workspace.id.desc())
        .all()
    )


def parse_workspace_scene(scene_data, normalize=False):
    if not scene_data:
        return normalize_scene() if normalize else None
    if isinstance(scene_data, dict):
        return normalize_scene(scene_data) if normalize else scene_data
    try:
        parsed = json.loads(scene_data)
    except (TypeError, ValueError, json.JSONDecodeError):
        return normalize_scene() if normalize else None
    if not isinstance(parsed, dict):
        return normalize_scene() if normalize else None
    return normalize_scene(parsed) if normalize else parsed


def workspace_review_scene(workspace):
    return parse_workspace_scene(getattr(workspace, "scene_data", None), normalize=True)


def workspace_client_draft_scene(workspace):
    draft = getattr(workspace, "client_draft_scene_data", None)
    if isinstance(draft, str) and draft.strip():
        parsed = parse_workspace_scene(draft, normalize=False)
        if isinstance(parsed, dict):
            return parsed
    return workspace_review_scene(workspace)


def store_workspace_client_draft(workspace, scene, *, updated_at=None):
    bill_payload = None
    bill_sent_at = None
    if isinstance(scene, dict) and "bill" in scene:
        bill_payload = scene.get("bill")
        bill_sent_at = scene.get("bill_sent_at")
    if bill_payload is None:
        existing = getattr(workspace, "client_draft_scene_data", None)
        if isinstance(existing, str) and existing.strip():
            parsed = parse_workspace_scene(existing, normalize=False)
            if isinstance(parsed, dict) and "bill" in parsed:
                bill_payload = parsed.get("bill")
                bill_sent_at = parsed.get("bill_sent_at")
    if isinstance(scene, dict) and ("dims" in scene or "booth" in scene):
        normalized_scene = normalize_scene(scene)
    else:
        normalized_scene = scene

    if isinstance(normalized_scene, dict) and bill_payload is not None:
        normalized_scene["bill"] = bill_payload
        if bill_sent_at is not None:
            normalized_scene["bill_sent_at"] = bill_sent_at
    draft_scene = normalized_scene
    workspace.client_draft_scene_data = json.dumps(draft_scene)
    workspace.client_draft_updated_at = updated_at or utc_now_naive()
    return draft_scene


def scene_summary(scene):
    normalized = normalize_scene(scene or {})
    dims = normalized.get("dims") or {}
    models = normalized.get("models") or []
    open_sides = normalized.get("openSides") or {}
    booth = normalized.get("booth") or {}
    quote = normalized.get("quote") or {}
    lights = [
        item
        for item in models
        if str(item.get("objectKind") or item.get("shape") or "").strip().lower()
        in {"light", "rail_light"}
    ]
    texts = [
        item
        for item in models
        if str(item.get("objectKind") or item.get("shape") or "").strip().lower()
        == "text"
    ]
    width = float(dims.get("width") or 0)
    depth = float(dims.get("depth") or 0)
    height = float(dims.get("height") or 0)
    return {
        "dims_label": (
            f"{width:g}m x {depth:g}m x {height:g}m"
            if width and depth and height
            else "Dimensions unavailable"
        ),
        "width": width,
        "depth": depth,
        "height": height,
        "furniture_count": max(0, len(models) - len(lights) - len(texts)),
        "light_count": len(lights),
        "text_count": len(texts),
        "open_side_count": sum(1 for value in open_sides.values() if value),
        "booth_style": str(booth.get("boothStyle") or "").strip().lower() or "octanorm",
        "build_mode": str(booth.get("buildMode") or "").strip().lower() or "panel",
        "fascia_text": str(booth.get("fasciaText") or "").strip(),
        "quote_total": float(quote.get("grandTotal") or 0),
        "quote_currency": str(quote.get("currency") or "EUR").strip().upper() or "EUR",
    }


def _scene_signature(scene):
    normalized = normalize_scene(scene or {})
    return json.dumps(normalized, sort_keys=True, separators=(",", ":"))


def scenes_match(left_scene, right_scene):
    return _scene_signature(left_scene) == _scene_signature(right_scene)


def latest_workspace_version_by_kind(workspace, *version_kinds):
    if not workspace:
        return None
    query = WorkspaceVersion.query.filter_by(workspace_id=workspace.id)
    if version_kinds:
        query = query.filter(WorkspaceVersion.version_kind.in_(version_kinds))
    return query.order_by(WorkspaceVersion.created_at.desc(), WorkspaceVersion.id.desc()).first()


def latest_workspace_versions_by_kind(workspace, *version_kinds):
    if not workspace:
        return {}

    normalized_kinds = []
    for item in version_kinds or ():
        kind = str(item or "").strip()
        if kind and kind not in normalized_kinds:
            normalized_kinds.append(kind)
    if not normalized_kinds:
        return {}

    ranked_versions = (
        db.session.query(
            WorkspaceVersion.id.label("version_id"),
            WorkspaceVersion.version_kind.label("version_kind"),
            func.row_number()
            .over(
                partition_by=WorkspaceVersion.version_kind,
                order_by=(
                    WorkspaceVersion.created_at.desc(),
                    WorkspaceVersion.id.desc(),
                ),
            )
            .label("row_number"),
        )
        .filter(
            WorkspaceVersion.workspace_id == workspace.id,
            WorkspaceVersion.version_kind.in_(normalized_kinds),
        )
        .subquery()
    )

    rows = (
        db.session.query(WorkspaceVersion, ranked_versions.c.version_kind)
        .join(ranked_versions, WorkspaceVersion.id == ranked_versions.c.version_id)
        .filter(ranked_versions.c.row_number == 1)
        .all()
    )
    return {str(version_kind): version for version, version_kind in rows}


def serialize_workspace_version(version):
    if not version:
        return None
    payload = version.to_dict()
    payload["actor"] = ACTOR_LABELS.get(
        version.actor_type or "",
        (version.actor_type or "System").replace("_", " ").title(),
    )
    payload["kind_label"] = {
        "manual": "Manual save",
        "client_submission": "Client submission",
        "pm_share": "Sent to client",
    }.get(
        str(version.version_kind or "manual").strip().lower(),
        str(version.version_kind or "manual").replace("_", " ").title(),
    )
    return payload


def list_workspace_feedback_requests(workspace, *, include_resolved=True, limit=10):
    if not workspace:
        return []
    state = inspect(workspace)
    if "feedback_requests" not in state.unloaded:
        items = list(workspace.feedback_requests or [])
        if not include_resolved:
            items = [
                item
                for item in items
                if str(item.status or "open").strip().lower() in OPEN_FEEDBACK_STATUSES
            ]
        return items[:limit]

    query = WorkspaceFeedbackRequest.query.filter_by(workspace_id=workspace.id)
    if not include_resolved:
        query = query.filter(
            WorkspaceFeedbackRequest.status.in_(sorted(OPEN_FEEDBACK_STATUSES))
        )
    return (
        query.order_by(
            WorkspaceFeedbackRequest.created_at.desc(),
            WorkspaceFeedbackRequest.id.desc(),
        )
        .limit(limit)
        .all()
    )


def serialize_workspace_feedback_request(feedback_request):
    if not feedback_request:
        return None
    payload = feedback_request.to_dict()
    payload["created_by_label"] = ACTOR_LABELS.get(
        feedback_request.created_by_type or "",
        (feedback_request.created_by_type or "System").replace("_", " ").title(),
    )
    payload["is_open"] = (
        str(feedback_request.status or "open").strip().lower()
        in OPEN_FEEDBACK_STATUSES
    )
    return payload


def resolve_open_feedback_requests(workspace, *, resolved_at=None):
    if not workspace:
        return []
    timestamp = resolved_at or utc_now_naive()
    resolved_items = []
    for item in list_workspace_feedback_requests(
        workspace, include_resolved=False, limit=50
    ):
        item.status = "resolved"
        item.resolved_at = timestamp
        resolved_items.append(item)
    return resolved_items


def _milestone_state(is_done=False, is_current=False):
    if is_done:
        return "done"
    if is_current:
        return "current"
    return "pending"


def _format_timestamp(value):
    return value.isoformat() if value else None


def workspace_review_payload(workspace, *, subscription_request=None, permissions=None):
    return workspace_review_payload_latest(
        workspace,
        subscription_request=subscription_request,
        permissions=permissions,
    )


def _workspace_review_payload_impl(workspace, *, subscription_request=None, permissions=None):
    return _workspace_review_payload_v2(
        workspace,
        subscription_request=subscription_request,
        permissions=permissions,
    )


def _workspace_review_payload_v2(workspace, *, subscription_request=None, permissions=None):
    return _workspace_review_payload_v3(
        workspace,
        subscription_request=subscription_request,
        permissions=permissions,
    )


def _workspace_review_payload_v3(workspace, *, subscription_request=None, permissions=None):
    return _workspace_review_payload_current(
        workspace,
        subscription_request=subscription_request,
        permissions=permissions,
    )


def _workspace_review_payload_current(
    workspace, *, subscription_request=None, permissions=None
):
    return _workspace_review_payload_final(
        workspace,
        subscription_request=subscription_request,
        permissions=permissions,
    )


def _workspace_review_payload_final(
    workspace, *, subscription_request=None, permissions=None
):
    del subscription_request
    permissions = permissions or client_arrangement_permissions(workspace)
    limit = int(
        permissions.get("included_round_limit") or CLIENT_ARRANGEMENT_ROUND_LIMIT
    )
    used = int(permissions.get("arrangement_rounds_used") or 0)
    remaining = permissions.get("arrangement_rounds_remaining")
    remaining_value = None if remaining is None else max(0, int(remaining))
    plan_label = permissions.get("subscription_plan_label")
    purchased_total = max(0, int(permissions.get("purchased_rounds_total") or 0))
    purchased_remaining = permissions.get("purchased_rounds_remaining")
    purchased_remaining_value = (
        None if purchased_remaining is None else max(0, int(purchased_remaining))
    )
    review_scene = workspace_review_scene(workspace)
    client_draft_scene = workspace_client_draft_scene(workspace)
    latest_versions = latest_workspace_versions_by_kind(
        workspace,
        "client_submission",
        "pm_share",
    )
    latest_submission = latest_versions.get("client_submission")
    latest_pm_share = latest_versions.get("pm_share")
    latest_open_feedback = next(
        (
            item
            for item in list_workspace_feedback_requests(
                workspace, include_resolved=False, limit=1
            )
        ),
        None,
    )
    latest_feedback_items = [
        serialize_workspace_feedback_request(item)
        for item in list_workspace_feedback_requests(workspace, include_resolved=True, limit=5)
    ]
    status = str(getattr(workspace, "status", "") or "").strip().lower()
    client_has_unsent_changes = not scenes_match(review_scene, client_draft_scene)

    if permissions.get("subscription_unlimited"):
        arrangement_label = "Unlimited plan active"
    elif plan_label and purchased_total:
        arrangement_label = (
            f"{plan_label} plan used up"
            if permissions.get("subscription_required")
            else f"{plan_label} plan active · {max(0, remaining_value or 0)} total rounds left"
        )
    else:
        arrangement_label = (
            f"Revision {min(used, limit)} of {limit} used"
            if used
            else f"0 of {limit} client revisions used"
        )
        arrangement_label += (
            " · limit reached"
            if permissions.get("subscription_required")
            else f" · {remaining_value} left"
        )

    timeline = [
        {
            "id": "draft",
            "label": "Draft",
            "state": _milestone_state(
                is_done=bool(latest_pm_share or latest_submission or status == "approved"),
                is_current=status == "draft",
            ),
            "detail": "Project manager prepares the booth design.",
        },
        {
            "id": "sent_to_client",
            "label": "Sent to client",
            "state": _milestone_state(
                is_done=bool(latest_pm_share),
                is_current=status == "review" and not latest_submission,
            ),
            "detail": (
                f"Last shared {latest_pm_share.created_at.strftime('%b %d, %H:%M')}"
                if latest_pm_share and latest_pm_share.created_at
                else "Client can review the latest booth design."
            ),
        },
        {
            "id": "client_revision_1",
            "label": "Client revision 1",
            "state": _milestone_state(
                is_done=used >= 1 or bool(latest_submission and (latest_submission.submission_round or 0) >= 1),
                is_current=status == "needs_changes" and used == 1,
            ),
            "detail": "First included client revision round.",
        },
        {
            "id": "client_revision_2",
            "label": "Client revision 2",
            "state": _milestone_state(
                is_done=used >= 2 or bool(latest_submission and (latest_submission.submission_round or 0) >= 2),
                is_current=status == "needs_changes" and used >= 2 and not permissions.get("subscription_required"),
            ),
            "detail": "Second included client revision round.",
        },
        {
            "id": "subscription",
            "label": "Subscription",
            "state": _milestone_state(
                is_done=bool(permissions.get("subscription_active")),
                is_current=bool(
                    permissions.get("subscription_required")
                    or subscription_request
                ),
            ),
            "detail": (
                "Active for unlimited revisions."
                if permissions.get("subscription_active")
                else (
                    "Request pending with the project manager."
                    if subscription_request
                    else "Required after the 2 included client revisions."
                )
            ),
        },
        {
            "id": "approved",
            "label": "Approved",
            "state": _milestone_state(is_done=status == "approved", is_current=status == "approved"),
            "detail": "Client approves the final booth design.",
        },
    ]

    notifications = []
    if latest_open_feedback:
        notifications.append(
            {
                "tone": "amber",
                "title": "Open PM checklist",
                "detail": latest_open_feedback.summary,
                "created_at": _format_timestamp(latest_open_feedback.created_at),
            }
        )
    if subscription_request:
        notifications.append(
            {
                "tone": "purple",
                "title": "Subscription request pending",
                "detail": "The project manager can activate unlimited client revisions.",
                "created_at": subscription_request.get("created_at"),
            }
        )
    if client_has_unsent_changes:
        notifications.append(
            {
                "tone": "blue",
                "title": "Private draft changes",
                "detail": "There are client edits that have not been submitted yet.",
                "created_at": _format_timestamp(workspace.client_draft_updated_at),
            }
        )

    active_review_source = "workspace_draft"
    active_review_label = "Current review copy"
    if latest_submission and (
        not latest_pm_share
        or latest_submission.created_at >= latest_pm_share.created_at
    ):
        active_review_source = "client_submission"
        active_review_label = latest_submission.label
    elif latest_pm_share:
        active_review_source = "pm_share"
        active_review_label = latest_pm_share.label

    return {
        "arrangement_label": arrangement_label,
        "timeline": timeline,
        "draft_state": {
            "client_has_unsent_changes": client_has_unsent_changes,
            "client_draft_updated_at": _format_timestamp(
                getattr(workspace, "client_draft_updated_at", None)
            ),
            "client_draft_summary": scene_summary(client_draft_scene),
            "current_review_summary": scene_summary(review_scene),
            "active_review_source": active_review_source,
            "active_review_label": active_review_label,
            "last_client_submission": serialize_workspace_version(latest_submission),
            "last_pm_share": serialize_workspace_version(latest_pm_share),
        },
        "feedback_requests": latest_feedback_items,
        "latest_feedback_request": serialize_workspace_feedback_request(
            latest_open_feedback
        ),
        "notifications": notifications,
    }


def workspace_review_payload_latest(
    workspace, *, subscription_request=None, permissions=None
):
    del subscription_request
    permissions = permissions or client_arrangement_permissions(workspace)
    limit = int(
        permissions.get("included_round_limit") or CLIENT_ARRANGEMENT_ROUND_LIMIT
    )
    used = int(permissions.get("arrangement_rounds_used") or 0)
    remaining = permissions.get("arrangement_rounds_remaining")
    remaining_value = None if remaining is None else max(0, int(remaining))
    plan_label = permissions.get("subscription_plan_label")
    purchased_total = max(0, int(permissions.get("purchased_rounds_total") or 0))
    purchased_remaining = permissions.get("purchased_rounds_remaining")
    purchased_remaining_value = (
        None if purchased_remaining is None else max(0, int(purchased_remaining))
    )
    review_scene = workspace_review_scene(workspace)
    client_draft_scene = workspace_client_draft_scene(workspace)
    latest_versions = latest_workspace_versions_by_kind(
        workspace,
        "client_submission",
        "pm_share",
    )
    latest_submission = latest_versions.get("client_submission")
    latest_pm_share = latest_versions.get("pm_share")
    latest_open_feedback = next(
        (
            item
            for item in list_workspace_feedback_requests(
                workspace, include_resolved=False, limit=1
            )
        ),
        None,
    )
    latest_feedback_items = [
        serialize_workspace_feedback_request(item)
        for item in list_workspace_feedback_requests(
            workspace, include_resolved=True, limit=5
        )
    ]
    status = str(getattr(workspace, "status", "") or "").strip().lower()
    client_has_unsent_changes = not scenes_match(review_scene, client_draft_scene)

    if permissions.get("subscription_unlimited"):
        arrangement_label = "Unlimited plan active"
    elif plan_label and purchased_total:
        arrangement_label = (
            f"{plan_label} plan used up"
            if permissions.get("subscription_required")
            else f"{plan_label} plan active · {max(0, remaining_value or 0)} total rounds left"
        )
    else:
        arrangement_label = (
            f"Revision {min(used, limit)} of {limit} used"
            if used
            else f"0 of {limit} client revisions used"
        )
        arrangement_label += (
            " · limit reached"
            if permissions.get("subscription_required")
            else f" · {remaining_value} left"
        )

    timeline = [
        {
            "id": "draft",
            "label": "Draft",
            "state": _milestone_state(
                is_done=bool(latest_pm_share or latest_submission or status == "approved"),
                is_current=status == "draft",
            ),
            "detail": "Project manager prepares the booth design.",
        },
        {
            "id": "sent_to_client",
            "label": "Sent to client",
            "state": _milestone_state(
                is_done=bool(latest_pm_share),
                is_current=status == "review" and not latest_submission,
            ),
            "detail": (
                f"Last shared {latest_pm_share.created_at.strftime('%b %d, %H:%M')}"
                if latest_pm_share and latest_pm_share.created_at
                else "Client can review the latest booth design."
            ),
        },
        {
            "id": "client_revision_1",
            "label": "Client revision 1",
            "state": _milestone_state(
                is_done=used >= 1
                or bool(latest_submission and (latest_submission.submission_round or 0) >= 1),
                is_current=status == "needs_changes" and used == 1,
            ),
            "detail": "First included client revision round.",
        },
        {
            "id": "client_revision_2",
            "label": "Client revision 2",
            "state": _milestone_state(
                is_done=used >= 2
                or bool(latest_submission and (latest_submission.submission_round or 0) >= 2),
                is_current=status == "needs_changes"
                and used >= 2
                and not permissions.get("subscription_required"),
            ),
            "detail": "Second included client revision round.",
        },
        {
            "id": "subscription",
            "label": "Subscription",
            "state": _milestone_state(
                is_done=bool(plan_label),
                is_current=bool(
                    permissions.get("subscription_required") and not plan_label
                ),
            ),
            "detail": (
                "Unlimited plan active for unrestricted client revisions."
                if permissions.get("subscription_unlimited")
                else (
                    f"{plan_label} plan active with "
                    f"{max(0, purchased_remaining_value or 0)} paid rounds remaining."
                    if plan_label and purchased_total
                    else "Choose Starter, Pro, or Unlimited after the 2 included client revisions."
                )
            ),
        },
        {
            "id": "approved",
            "label": "Approved",
            "state": _milestone_state(
                is_done=status == "approved", is_current=status == "approved"
            ),
            "detail": "Client approves the final booth design.",
        },
    ]

    notifications = []
    if latest_open_feedback:
        notifications.append(
            {
                "tone": "amber",
                "title": "Open PM checklist",
                "detail": latest_open_feedback.summary,
                "created_at": _format_timestamp(latest_open_feedback.created_at),
            }
        )
    if permissions.get("subscription_required"):
        notifications.append(
            {
                "tone": "purple",
                "title": "More revisions need a plan",
                "detail": (
                    f"{plan_label} is fully used. Choose another plan to keep editing."
                    if plan_label and purchased_total
                    else "Choose Starter, Pro, or Unlimited to keep editing this booth."
                ),
                "created_at": _format_timestamp(workspace.updated_at),
            }
        )
    elif plan_label and (permissions.get("subscription_unlimited") or purchased_total):
        notifications.append(
            {
                "tone": "purple",
                "title": f"{plan_label} plan active",
                "detail": (
                    "Unlimited client revisions are enabled."
                    if permissions.get("subscription_unlimited")
                    else f"{max(0, purchased_remaining_value or 0)} paid revision rounds remain."
                ),
                "created_at": _format_timestamp(
                    getattr(
                        workspace.client, "workspace_editor_subscription_updated_at", None
                    )
                ),
            }
        )
    if client_has_unsent_changes:
        notifications.append(
            {
                "tone": "blue",
                "title": "Private draft changes",
                "detail": "There are client edits that have not been submitted yet.",
                "created_at": _format_timestamp(workspace.client_draft_updated_at),
            }
        )

    active_review_source = "workspace_draft"
    active_review_label = "Current review copy"
    if latest_submission and (
        not latest_pm_share
        or latest_submission.created_at >= latest_pm_share.created_at
    ):
        active_review_source = "client_submission"
        active_review_label = latest_submission.label
    elif latest_pm_share:
        active_review_source = "pm_share"
        active_review_label = latest_pm_share.label

    return {
        "arrangement_label": arrangement_label,
        "timeline": timeline,
        "draft_state": {
            "client_has_unsent_changes": client_has_unsent_changes,
            "client_draft_updated_at": _format_timestamp(
                getattr(workspace, "client_draft_updated_at", None)
            ),
            "client_draft_summary": scene_summary(client_draft_scene),
            "current_review_summary": scene_summary(review_scene),
            "active_review_source": active_review_source,
            "active_review_label": active_review_label,
            "last_client_submission": serialize_workspace_version(latest_submission),
            "last_pm_share": serialize_workspace_version(latest_pm_share),
        },
        "feedback_requests": latest_feedback_items,
        "latest_feedback_request": serialize_workspace_feedback_request(
            latest_open_feedback
        ),
        "notifications": notifications,
    }


def compare_workspace_snapshots(left_label, left_scene, right_label, right_scene):
    left_summary = scene_summary(left_scene)
    right_summary = scene_summary(right_scene)
    changes = []
    if left_summary["dims_label"] != right_summary["dims_label"]:
        changes.append(
            f"Dimensions changed from {left_summary['dims_label']} to {right_summary['dims_label']}."
        )
    if left_summary["furniture_count"] != right_summary["furniture_count"]:
        changes.append(
            f"Furniture items changed from {left_summary['furniture_count']} to {right_summary['furniture_count']}."
        )
    if left_summary["light_count"] != right_summary["light_count"]:
        changes.append(
            f"Lights changed from {left_summary['light_count']} to {right_summary['light_count']}."
        )
    if left_summary["text_count"] != right_summary["text_count"]:
        changes.append(
            f"Text objects changed from {left_summary['text_count']} to {right_summary['text_count']}."
        )
    if left_summary["open_side_count"] != right_summary["open_side_count"]:
        changes.append(
            "Open side count changed from "
            f"{left_summary['open_side_count']} to {right_summary['open_side_count']}."
        )
    if left_summary["fascia_text"] != right_summary["fascia_text"]:
        changes.append(
            "Fascia text changed from "
            f"\"{left_summary['fascia_text'] or '-'}\" to "
            f"\"{right_summary['fascia_text'] or '-'}\"."
        )
    if left_summary["quote_total"] != right_summary["quote_total"]:
        changes.append(
            f"Quote total changed from {left_summary['quote_total']:.2f} {left_summary['quote_currency']} "
            f"to {right_summary['quote_total']:.2f} {right_summary['quote_currency']}."
        )

    if not changes:
        changes.append("No summary-level differences were detected between these two snapshots.")

    return {
        "left": {"label": left_label, "summary": left_summary},
        "right": {"label": right_label, "summary": right_summary},
        "changes": changes,
    }


def client_arrangement_permissions(workspace):
    return client_arrangement_permissions_latest(workspace)


def client_arrangement_permissions_latest(workspace):
    if not workspace:
        return {
            "can_edit": False,
            "can_save": False,
            "can_send_arrangement": False,
            "arrangement_round_limit": CLIENT_ARRANGEMENT_ROUND_LIMIT,
            "arrangement_rounds_used": 0,
            "arrangement_rounds_remaining": CLIENT_ARRANGEMENT_ROUND_LIMIT,
            "total_round_limit": CLIENT_ARRANGEMENT_ROUND_LIMIT,
            "included_round_limit": CLIENT_ARRANGEMENT_ROUND_LIMIT,
            "included_rounds_used": 0,
            "included_rounds_remaining": CLIENT_ARRANGEMENT_ROUND_LIMIT,
            "purchased_rounds_total": 0,
            "purchased_rounds_used": 0,
            "purchased_rounds_remaining": 0,
            "subscription_active": False,
            "subscription_unlimited": False,
            "subscription_status": CLIENT_SUBSCRIPTION_STATUS_INACTIVE,
            "subscription_pending": False,
            "subscription_payment_verified": False,
            "subscription_required": False,
            "subscription_plan": None,
            "subscription_plan_label": None,
            "subscription_price": 0.0,
            "subscription_currency": "USD",
            "edit_disabled_reason": "Workspace not found.",
            "send_disabled_reason": "Workspace not found.",
        }

    client = getattr(workspace, "client", None)
    subscription_status = normalize_client_subscription_status(
        getattr(client, "workspace_editor_subscription_status", None)
    )
    verified_subscription = client_subscription_is_verified(subscription_status)
    unlimited_access = bool(
        client
        and verified_subscription
        and getattr(client, "workspace_editor_subscription_active", False)
    )
    subscription_plan = normalize_client_subscription_plan(
        getattr(client, "workspace_editor_subscription_plan", None)
        if verified_subscription
        else "none",
        unlimited_active=unlimited_access,
    )
    plan_config = client_subscription_plan_config(
        subscription_plan, unlimited_active=unlimited_access
    )
    purchased_rounds_total = max(
        0,
        int(getattr(client, "workspace_editor_extra_revision_rounds", 0) or 0),
    ) if verified_subscription else 0
    rounds_used = max(0, int(workspace.client_arrangement_rounds_used or 0))
    rounds_limit = CLIENT_ARRANGEMENT_ROUND_LIMIT
    total_round_limit = (
        None if unlimited_access else rounds_limit + purchased_rounds_total
    )
    rounds_remaining = (
        None
        if unlimited_access
        else max(0, int(total_round_limit or rounds_limit) - rounds_used)
    )
    included_rounds_used = min(rounds_used, rounds_limit)
    included_rounds_remaining = max(0, rounds_limit - included_rounds_used)
    purchased_rounds_used = (
        0
        if unlimited_access
        else min(purchased_rounds_total, max(0, rounds_used - rounds_limit))
    )
    purchased_rounds_remaining = (
        None
        if unlimited_access
        else max(0, purchased_rounds_total - purchased_rounds_used)
    )
    subscription_active = bool(
        unlimited_access
        or (
            subscription_plan != "none"
            and max(0, int(purchased_rounds_remaining or 0)) > 0
        )
    )
    subscription_pending = (
        subscription_status == CLIENT_SUBSCRIPTION_STATUS_PENDING
    )
    status = normalize_workspace_review_status(workspace)
    review_open = can_apply_workspace_review_action(workspace, "submit_arrangement")
    limit_reached = not unlimited_access and max(0, int(rounds_remaining or 0)) <= 0
    can_edit = review_open and not limit_reached

    disabled_reason = ""
    if not review_open:
        if status == "approved":
            disabled_reason = "This workspace is already approved."
        else:
            disabled_reason = (
                "This workspace is waiting for the project manager to share the next review copy."
            )
    elif limit_reached:
        if subscription_plan != "none":
            disabled_reason = (
                f"The {plan_config['label']} plan and included revisions are fully used. "
                "Choose another plan to continue."
            )
        elif subscription_pending:
            disabled_reason = (
                "Payment verification is still pending. Revision access will activate after server-side confirmation."
            )
        else:
            disabled_reason = (
                "You have used the 2 included arrangement rounds. Choose a plan to continue."
            )

    return {
        "can_edit": can_edit,
        "can_save": can_edit,
        "can_send_arrangement": can_edit,
        "arrangement_round_limit": rounds_limit,
        "arrangement_rounds_used": rounds_used,
        "arrangement_rounds_remaining": rounds_remaining,
        "total_round_limit": total_round_limit,
        "included_round_limit": rounds_limit,
        "included_rounds_used": included_rounds_used,
        "included_rounds_remaining": included_rounds_remaining,
        "purchased_rounds_total": purchased_rounds_total,
        "purchased_rounds_used": purchased_rounds_used,
        "purchased_rounds_remaining": purchased_rounds_remaining,
        "subscription_active": subscription_active,
        "subscription_unlimited": unlimited_access,
        "subscription_status": subscription_status,
        "subscription_pending": subscription_pending,
        "subscription_payment_verified": verified_subscription,
        "subscription_required": limit_reached,
        "subscription_plan": None if subscription_plan == "none" else subscription_plan,
        "subscription_plan_label": (
            None if subscription_plan == "none" else plan_config["label"]
        ),
        "subscription_price": plan_config["price"],
        "subscription_currency": plan_config["currency"],
        "edit_disabled_reason": disabled_reason or None,
        "send_disabled_reason": disabled_reason or None,
    }


def serialize_workspace(workspace, include_scene=False, normalize_scene_data=False):
    if not workspace:
        return None
    payload = workspace.to_dict()
    scene = workspace_review_scene(workspace) if normalize_scene_data else parse_workspace_scene(
        workspace.scene_data, normalize=False
    )
    payload["has_scene"] = scene is not None
    payload["client_arrangement"] = client_arrangement_permissions(workspace)
    if include_scene:
        payload["scene"] = scene
    return payload
