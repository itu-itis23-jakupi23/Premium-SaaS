from app.models.user import Client
from app.models.workspace import Workspace
from app.workspace import get_workspace_for_actor, resolve_project_workspace


class WorkspaceAccessValidationError(ValueError):
    def __init__(self, message, status_code):
        super().__init__(message)
        self.status_code = status_code


def _raise_access_error(error, *, missing_message):
    if error == "not_found":
        raise WorkspaceAccessValidationError(missing_message, 404)
    raise WorkspaceAccessValidationError("Forbidden", 403)


def require_admin_workspace_access(
    ws_id, role, actor_id, *, missing_message="Workspace not found"
):
    workspace, error = get_workspace_for_actor(ws_id, role, actor_id)
    if error:
        _raise_access_error(error, missing_message=missing_message)
    return workspace


def require_project_workspace_access(
    project_id,
    role,
    actor_id,
    *,
    target="auto",
    missing_message="Workspace or client not found",
):
    workspace, error = resolve_project_workspace(
        project_id, role, actor_id, target=target
    )
    if error:
        _raise_access_error(error, missing_message=missing_message)
    return workspace


def require_client_workspace_access(ws_id, client_id, *, missing_message="Not found"):
    workspace = Workspace.query.filter_by(id=ws_id, client_id=client_id).first()
    if not workspace:
        raise WorkspaceAccessValidationError(missing_message, 404)
    return workspace


def require_project_manager_client_access(
    client_id,
    project_manager_id,
    *,
    missing_message="Not found",
):
    client = Client.query.filter_by(
        id=client_id,
        project_manager_id=project_manager_id,
    ).first()
    if not client:
        raise WorkspaceAccessValidationError(missing_message, 404)
    return client


def require_project_manager_workspace_access(
    ws_id,
    project_manager_id,
    *,
    missing_message="Not found",
):
    workspace = Workspace.query.filter_by(
        id=ws_id,
        project_manager_id=project_manager_id,
    ).first()
    if not workspace:
        raise WorkspaceAccessValidationError(missing_message, 404)
    return workspace
