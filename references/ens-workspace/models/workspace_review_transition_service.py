from dataclasses import dataclass
from datetime import datetime

from app.time_utils import utc_now_naive


WORKSPACE_DRAFT_STATUS = "draft"
CLIENT_WORKSPACE_REVIEW_STATUS = "review"
CLIENT_WORKSPACE_CHANGES_REQUESTED_STATUS = "needs_changes"
CLIENT_WORKSPACE_APPROVED_STATUS = "approved"
WORKSPACE_REVIEW_TRANSITIONS = {
    "send_to_client": {
        "from_statuses": (
            WORKSPACE_DRAFT_STATUS,
            CLIENT_WORKSPACE_REVIEW_STATUS,
            CLIENT_WORKSPACE_CHANGES_REQUESTED_STATUS,
            CLIENT_WORKSPACE_APPROVED_STATUS,
        ),
        "default_to_status": CLIENT_WORKSPACE_REVIEW_STATUS,
        "to_status_by_current": {
            CLIENT_WORKSPACE_APPROVED_STATUS: CLIENT_WORKSPACE_APPROVED_STATUS,
        },
    },
    "submit_arrangement": {
        "from_statuses": (CLIENT_WORKSPACE_REVIEW_STATUS,),
        "default_to_status": CLIENT_WORKSPACE_CHANGES_REQUESTED_STATUS,
    },
    "approve": {
        "from_statuses": (CLIENT_WORKSPACE_REVIEW_STATUS,),
        "default_to_status": CLIENT_WORKSPACE_APPROVED_STATUS,
    },
    "request_changes": {
        "from_statuses": (CLIENT_WORKSPACE_REVIEW_STATUS,),
        "default_to_status": CLIENT_WORKSPACE_CHANGES_REQUESTED_STATUS,
    },
}
WORKSPACE_SEND_TO_CLIENT_ALLOWED_STATUSES = tuple(
    WORKSPACE_REVIEW_TRANSITIONS["send_to_client"]["from_statuses"]
)
CLIENT_WORKSPACE_REVIEW_TRANSITIONS = {
    key: WORKSPACE_REVIEW_TRANSITIONS[key]
    for key in ("approve", "request_changes")
}


class WorkspaceReviewTransitionError(ValueError):
    def __init__(
        self,
        message,
        *,
        action,
        current_status,
        allowed_statuses,
        status_code=409,
    ):
        super().__init__(message)
        self.action = action
        self.current_status = current_status
        self.allowed_statuses = tuple(allowed_statuses or ())
        self.status_code = status_code


@dataclass(frozen=True)
class WorkspaceReviewTransitionResult:
    action: str
    from_status: str
    to_status: str
    changed_at: datetime


def normalize_workspace_review_status(workspace):
    status = str(getattr(workspace, "status", "") or "").strip().lower()
    return status or WORKSPACE_DRAFT_STATUS


def workspace_review_transition_map():
    transition_map = {
        WORKSPACE_DRAFT_STATUS: [],
        CLIENT_WORKSPACE_REVIEW_STATUS: [],
        CLIENT_WORKSPACE_CHANGES_REQUESTED_STATUS: [],
        CLIENT_WORKSPACE_APPROVED_STATUS: [],
    }
    for action, transition in WORKSPACE_REVIEW_TRANSITIONS.items():
        for from_status in transition["from_statuses"]:
            transition_map.setdefault(from_status, []).append(action)
    return {
        status: tuple(actions)
        for status, actions in transition_map.items()
    }


def client_review_transition_map():
    return workspace_review_transition_map()


def _invalid_transition_message(action, current_status):
    if action == "send_to_client":
        return "This workspace is not ready to be shared with the client."

    if action == "submit_arrangement":
        if current_status == CLIENT_WORKSPACE_APPROVED_STATUS:
            return "This workspace is already approved."
        return "This workspace is waiting for the project manager to share the next review copy."

    if action == "approve":
        if current_status == CLIENT_WORKSPACE_APPROVED_STATUS:
            return "This design has already been approved."
        if current_status == CLIENT_WORKSPACE_CHANGES_REQUESTED_STATUS:
            return (
                "Changes have already been requested. Wait for the project manager "
                "to share the next review copy."
            )
        return "This design is not currently awaiting client approval."

    if action == "request_changes":
        if current_status == CLIENT_WORKSPACE_APPROVED_STATUS:
            return "Approved designs cannot request more changes."
        if current_status == CLIENT_WORKSPACE_CHANGES_REQUESTED_STATUS:
            return (
                "Changes have already been requested. Wait for the project manager "
                "to share the next review copy."
            )
        return "This design is not currently awaiting client review."

    return "This workspace transition is not allowed."


def allowed_workspace_review_actions(workspace):
    return workspace_review_transition_map().get(
        normalize_workspace_review_status(workspace),
        (),
    )


def can_apply_workspace_review_action(workspace, action):
    return action in allowed_workspace_review_actions(workspace)


def _resolve_transition_target_status(transition, current_status):
    overrides = transition.get("to_status_by_current") or {}
    return overrides.get(
        current_status,
        transition.get("default_to_status") or current_status,
    )


def require_workspace_review_transition(workspace, action):
    transition = WORKSPACE_REVIEW_TRANSITIONS.get(action)
    current_status = normalize_workspace_review_status(workspace)
    if not transition:
        raise WorkspaceReviewTransitionError(
            "This workspace transition is not supported.",
            action=action,
            current_status=current_status,
            allowed_statuses=(),
            status_code=400,
        )

    allowed_statuses = tuple(transition["from_statuses"])
    if current_status not in allowed_statuses:
        raise WorkspaceReviewTransitionError(
            _invalid_transition_message(action, current_status),
            action=action,
            current_status=current_status,
            allowed_statuses=allowed_statuses,
        )
    return transition, current_status


def require_workspace_send_to_client(workspace):
    current_status = normalize_workspace_review_status(workspace)
    if not getattr(workspace, "client", None):
        raise WorkspaceReviewTransitionError(
            "Workspace client not found.",
            action="send_to_client",
            current_status=current_status,
            allowed_statuses=WORKSPACE_SEND_TO_CLIENT_ALLOWED_STATUSES,
            status_code=400,
        )
    require_workspace_review_transition(workspace, "send_to_client")
    return current_status


def require_client_review_transition(workspace, action):
    transition, current_status = require_workspace_review_transition(workspace, action)
    if action not in CLIENT_WORKSPACE_REVIEW_TRANSITIONS:
        raise WorkspaceReviewTransitionError(
            _invalid_transition_message(action, current_status),
            action=action,
            current_status=current_status,
            allowed_statuses=(),
            status_code=400,
        )
    return transition


def apply_workspace_review_transition(workspace, action, *, changed_at=None):
    transition, previous_status = require_workspace_review_transition(workspace, action)
    timestamp = changed_at or utc_now_naive()
    workspace.status = _resolve_transition_target_status(transition, previous_status)
    workspace.updated_at = timestamp
    return WorkspaceReviewTransitionResult(
        action=action,
        from_status=previous_status,
        to_status=workspace.status,
        changed_at=timestamp,
    )


def apply_workspace_send_to_client_transition(workspace, *, changed_at=None):
    require_workspace_send_to_client(workspace)
    return apply_workspace_review_transition(
        workspace,
        "send_to_client",
        changed_at=changed_at,
    )


def apply_client_review_transition(workspace, action, *, changed_at=None):
    require_client_review_transition(workspace, action)
    return apply_workspace_review_transition(workspace, action, changed_at=changed_at)
