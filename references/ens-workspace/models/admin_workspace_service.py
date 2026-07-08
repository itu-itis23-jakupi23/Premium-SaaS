import json
from dataclasses import dataclass
from datetime import datetime

from app.extensions import db
from app.models.contact_request import ClientContactRequest
from app.models.workspace import WorkspaceFeedbackRequest, WorkspaceVersion
from app.time_utils import utc_now_naive
from app.services.workspace_service import (
    latest_workspace_version_by_kind,
    parse_workspace_scene,
    resolve_open_feedback_requests,
    scenes_match,
    serialize_workspace_feedback_request,
    store_workspace_client_draft,
    workspace_client_draft_scene,
    workspace_review_payload,
    workspace_review_scene,
)
from app.services.workspace_review_transition_service import (
    CLIENT_WORKSPACE_APPROVED_STATUS,
    CLIENT_WORKSPACE_REVIEW_STATUS,
    apply_workspace_review_transition,
    apply_workspace_send_to_client_transition,
    normalize_workspace_review_status,
)
from app.workspace import (
    activity_actor_type,
    list_workspace_assets,
    version_payload,
    workspace_context,
    write_workspace_activity,
)

OPEN_CONTACT_REQUEST_STATUSES = {"new", "open", "pending", "in_progress"}


class AdminWorkspaceServiceError(ValueError):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class AdminWorkspaceSceneSaveOutcome:
    scene: dict
    version: int
    updated_at: datetime
    assets: list


@dataclass(frozen=True)
class AdminWorkspaceShareOutcome:
    context: dict


@dataclass(frozen=True)
class AdminWorkspaceVersionCreateOutcome:
    version: WorkspaceVersion
    items: list


@dataclass(frozen=True)
class AdminWorkspaceVersionRestoreOutcome:
    scene: dict
    version: int
    updated_at: datetime


@dataclass(frozen=True)
class AdminWorkspaceFeedbackOutcome:
    feedback: dict
    review: dict


def _admin_workspace_share_context(workspace):
    context = workspace_context(workspace)
    subscription_request = serialize_workspace_subscription_request(
        latest_workspace_subscription_request(workspace)
    )
    context["subscription_request"] = subscription_request
    context["review"] = workspace_review_payload(
        workspace, subscription_request=subscription_request
    )
    return context


def _is_duplicate_workspace_share(workspace, current_scene, note):
    latest_share = latest_workspace_version_by_kind(workspace, "pm_share")
    if not latest_share:
        return False
    latest_scene = parse_workspace_scene(latest_share.scene_data, normalize=True)
    latest_note = str(latest_share.notes or "")
    next_note = str(note or "")
    return latest_note == next_note and scenes_match(latest_scene, current_scene)


def is_workspace_subscription_request_open(contact_request):
    status = str(getattr(contact_request, "status", "") or "new").strip().lower()
    return status in OPEN_CONTACT_REQUEST_STATUSES or not status


def latest_workspace_subscription_request(workspace):
    if not workspace:
        return None
    query = ClientContactRequest.query.filter_by(
        workspace_id=workspace.id,
        request_type="subscription",
    ).order_by(ClientContactRequest.created_at.desc(), ClientContactRequest.id.desc())
    for item in query.all():
        if is_workspace_subscription_request_open(item):
            return item
    return None


def serialize_workspace_subscription_request(contact_request):
    if not contact_request:
        return None
    payload = contact_request.to_dict()
    return {
        "id": payload["id"],
        "request_type": payload["request_type"],
        "request_type_label": payload["request_type_label"],
        "subject": payload["subject"],
        "message_preview": payload["message_preview"],
        "status": payload["status"],
        "created_at": payload["created_at"],
    }


def build_admin_workspace_payload(workspace):
    payload = workspace_context(workspace)
    subscription_request = serialize_workspace_subscription_request(
        latest_workspace_subscription_request(workspace)
    )
    payload["scene"] = workspace_review_scene(workspace)
    payload["assets"] = list_workspace_assets(workspace)
    payload["versions"] = version_payload(workspace)
    payload["subscription_request"] = subscription_request
    payload["review"] = workspace_review_payload(
        workspace, subscription_request=subscription_request
    )
    payload["permissions"] = {"can_edit": True, "can_save": True}
    return payload


def save_admin_workspace_scene(workspace, scene, *, role, actor_id, updated_at=None):
    timestamp = updated_at or utc_now_naive()
    workspace.scene_data = json.dumps(scene)
    workspace.updated_at = timestamp
    workspace.version = (workspace.version or 0) + 1
    write_workspace_activity(
        workspace,
        f"Admin workspace saved (version {workspace.version})",
        role=role,
        actor_id=actor_id,
    )
    db.session.commit()
    return AdminWorkspaceSceneSaveOutcome(
        scene=scene,
        version=workspace.version,
        updated_at=timestamp,
        assets=list_workspace_assets(workspace),
    )


def share_admin_workspace_with_client(
    workspace, *, note, role, actor_id, shared_at=None
):
    timestamp = shared_at or utc_now_naive()
    current_status = normalize_workspace_review_status(workspace)
    current_scene = workspace_review_scene(workspace)
    if current_status in (
        CLIENT_WORKSPACE_REVIEW_STATUS,
        CLIENT_WORKSPACE_APPROVED_STATUS,
    ) and _is_duplicate_workspace_share(workspace, current_scene, note):
        client_scene = workspace_client_draft_scene(workspace)
        if not scenes_match(client_scene, current_scene):
            store_workspace_client_draft(workspace, current_scene, updated_at=timestamp)
            db.session.commit()
        return AdminWorkspaceShareOutcome(context=_admin_workspace_share_context(workspace))

    apply_workspace_send_to_client_transition(workspace, changed_at=timestamp)

    workspace.project_manager_id = (
        workspace.client.project_manager_id or workspace.project_manager_id
    )
    workspace.exhibition_id = workspace.client.exhibition_id or workspace.exhibition_id

    if not (isinstance(workspace.scene_data, str) and workspace.scene_data.strip()):
        workspace.scene_data = json.dumps(workspace_review_scene(workspace))

    store_workspace_client_draft(workspace, current_scene, updated_at=timestamp)
    resolve_open_feedback_requests(workspace, resolved_at=timestamp)
    db.session.add(
        WorkspaceVersion(
            workspace_id=workspace.id,
            label="Sent to client for review",
            scene_data=json.dumps(current_scene),
            version_kind="pm_share",
            notes=note or None,
            actor_type=activity_actor_type(role),
            actor_id=actor_id,
        )
    )

    action = "Design sent to client for review"
    if note:
        action = f"{action}: {note[:180]}"
    write_workspace_activity(workspace, action, role=role, actor_id=actor_id)
    db.session.commit()

    return AdminWorkspaceShareOutcome(context=_admin_workspace_share_context(workspace))


def create_admin_workspace_version(
    workspace, *, label, scene, role, actor_id
):
    version = WorkspaceVersion(
        workspace_id=workspace.id,
        label=label[:200],
        scene_data=json.dumps(scene),
        actor_type=activity_actor_type(role),
        actor_id=actor_id,
    )
    db.session.add(version)
    write_workspace_activity(
        workspace, f"Version saved: {label[:120]}", role=role, actor_id=actor_id
    )
    db.session.commit()
    return AdminWorkspaceVersionCreateOutcome(
        version=version,
        items=version_payload(workspace),
    )


def restore_admin_workspace_version(
    workspace, version, *, role, actor_id, restored_at=None
):
    timestamp = restored_at or utc_now_naive()
    scene = parse_workspace_scene(version.scene_data, normalize=True)
    workspace.scene_data = json.dumps(scene)
    workspace.updated_at = timestamp
    workspace.version = (workspace.version or 0) + 1
    write_workspace_activity(
        workspace, f"Version restored: {version.label}", role=role, actor_id=actor_id
    )
    db.session.commit()
    return AdminWorkspaceVersionRestoreOutcome(
        scene=scene,
        version=workspace.version,
        updated_at=timestamp,
    )


def resolve_feedback_target_version(workspace, target_version_id):
    if target_version_id not in (None, ""):
        return WorkspaceVersion.query.filter_by(
            id=target_version_id,
            workspace_id=workspace.id,
        ).first()
    return (
        WorkspaceVersion.query.filter_by(
            workspace_id=workspace.id, version_kind="client_submission"
        )
        .order_by(WorkspaceVersion.created_at.desc(), WorkspaceVersion.id.desc())
        .first()
    )


def create_admin_workspace_feedback(
    workspace,
    *,
    summary,
    items,
    role,
    actor_id,
    target_version_id=None,
    created_at=None,
):
    timestamp = created_at or utc_now_naive()
    apply_workspace_review_transition(
        workspace,
        "request_changes",
        changed_at=timestamp,
    )
    resolve_open_feedback_requests(workspace, resolved_at=timestamp)
    target_version = resolve_feedback_target_version(workspace, target_version_id)

    feedback_request = WorkspaceFeedbackRequest(
        workspace_id=workspace.id,
        target_version_id=target_version.id if target_version else None,
        summary=summary[:255],
        items_json=json.dumps(items),
        status="open",
        created_by_type=activity_actor_type(role),
        created_by_id=actor_id,
        created_at=timestamp,
        updated_at=timestamp,
    )
    db.session.add(feedback_request)
    write_workspace_activity(
        workspace,
        f"Project manager requested changes: {summary[:140]}",
        role=role,
        actor_id=actor_id,
    )
    db.session.commit()

    return AdminWorkspaceFeedbackOutcome(
        feedback=serialize_workspace_feedback_request(feedback_request),
        review=workspace_review_payload(
            workspace,
            subscription_request=serialize_workspace_subscription_request(
                latest_workspace_subscription_request(workspace)
            ),
        ),
    )
