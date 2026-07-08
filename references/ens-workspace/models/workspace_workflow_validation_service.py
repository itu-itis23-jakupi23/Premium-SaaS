from dataclasses import dataclass

from app.services.workspace_service import client_arrangement_permissions


CLIENT_WORKSPACE_ACTION_RULES = {
    "save_scene": {
        "permission_key": "can_save",
        "reason_keys": ("edit_disabled_reason", "send_disabled_reason"),
        "default_message": "Workspace editing is not available.",
    },
    "submit_arrangement": {
        "permission_key": "can_send_arrangement",
        "reason_keys": ("send_disabled_reason", "edit_disabled_reason"),
        "default_message": "Workspace submission is not available.",
    },
}


class WorkspaceWorkflowValidationError(ValueError):
    def __init__(self, message, *, action, status_code=403, permissions=None):
        super().__init__(message)
        self.action = action
        self.status_code = status_code
        self.permissions = permissions


@dataclass(frozen=True)
class ClientWorkspaceActionValidation:
    action: str
    permissions: dict


def validate_client_workspace_action(workspace, action, *, permissions=None):
    rule = CLIENT_WORKSPACE_ACTION_RULES.get(action)
    if not rule:
        raise WorkspaceWorkflowValidationError(
            "This workspace action is not supported.",
            action=action,
            status_code=400,
        )

    resolved_permissions = permissions or client_arrangement_permissions(workspace)
    if resolved_permissions.get(rule["permission_key"]):
        return ClientWorkspaceActionValidation(
            action=action,
            permissions=resolved_permissions,
        )

    message = None
    for key in rule["reason_keys"]:
        if resolved_permissions.get(key):
            message = resolved_permissions.get(key)
            break
    raise WorkspaceWorkflowValidationError(
        message or rule["default_message"],
        action=action,
        status_code=403,
        permissions=resolved_permissions,
    )
