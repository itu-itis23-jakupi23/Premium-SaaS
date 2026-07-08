from urllib.parse import urlencode

from flask import current_app, request
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.activity import ActivityLog
from app.models.exhibition import Exhibition
from app.models.user import Client
from app.models.workspace import Workspace, WorkspaceAsset, WorkspaceVersion
from app.services.auth_service import LOCAL_HOSTS
from app.time_utils import isoformat_or_none
from app.workspace.storage_backends import build_workspace_storage_backend

ALLOWED_ASSET_KINDS = {"fascia_logo", "panel_artwork"}
ALLOWED_UPLOAD_MIME_TYPES = {"image/png", "image/jpeg"}
MAX_UPLOAD_BYTES = 2 * 1024 * 1024


def activity_actor_type(role):
    return "chief" if role == "chief_manager" else "project_manager"


def ensure_storage_directories(app):
    get_workspace_storage_backend(app).ensure_directories()


def get_workspace_storage_backend(app=None):
    target_app = app or current_app._get_current_object()
    backend = target_app.extensions.get("workspace_storage_backend")
    if backend is None:
        backend = build_workspace_storage_backend(target_app.config)
        target_app.extensions["workspace_storage_backend"] = backend
    return backend


def workspace_context(workspace):
    client = workspace.client
    has_saved_scene = bool(
        isinstance(workspace.scene_data, str) and workspace.scene_data.strip()
    )
    exhibition = None
    if client and client.exhibition and (
        not workspace.exhibition_id or client.exhibition_id == workspace.exhibition_id
    ):
        exhibition = client.exhibition
    elif workspace.exhibition_id:
        exhibition = db.session.get(Exhibition, workspace.exhibition_id)
    elif client and client.exhibition_id:
        exhibition = client.exhibition or db.session.get(Exhibition, client.exhibition_id)

    return {
        "workspace": {
            "id": workspace.id,
            "name": workspace.name,
            "status": workspace.status,
            "version": workspace.version,
            "client_arrangement_rounds_used": workspace.client_arrangement_rounds_used
            or 0,
            "project_manager_id": workspace.project_manager_id,
            "exhibition_id": workspace.exhibition_id,
            "has_scene": has_saved_scene,
            "client_draft_updated_at": isoformat_or_none(
                workspace.client_draft_updated_at
            ),
            "updated_at": isoformat_or_none(workspace.updated_at),
        },
        "client": {
            "id": client.id,
            "full_name": client.full_name(),
            "email": client.email,
            "company": client.company,
        }
        if client
        else None,
        "exhibition": {
            "id": exhibition.id,
            "name": exhibition.name,
            "city": exhibition.city,
            "venue": exhibition.venue,
        }
        if exhibition
        else None,
    }


def can_access_workspace(workspace, role, actor_id):
    if role == "project_manager":
        return workspace.project_manager_id == actor_id

    if role != "chief_manager":
        return False

    if workspace.project_manager and workspace.project_manager.chief_id == actor_id:
        return True

    exhibition_id = workspace.exhibition_id or (
        workspace.client.exhibition_id if workspace.client else None
    )
    if exhibition_id:
        exhibition = db.session.get(Exhibition, exhibition_id)
        return bool(exhibition and exhibition.created_by == actor_id)
    return False


def can_access_client_workspace(client, role, actor_id):
    if not client:
        return False

    if role == "project_manager":
        return client.project_manager_id == actor_id

    if role != "chief_manager":
        return False

    if client.project_manager and client.project_manager.chief_id == actor_id:
        return True

    exhibition_id = client.exhibition_id
    if exhibition_id:
        exhibition = db.session.get(Exhibition, exhibition_id)
        return bool(exhibition and exhibition.created_by == actor_id)
    return False


def workspace_shell_url(workspace_id, host=None):
    resolved_host = (host or request.host).split(":")[0]
    query = urlencode({"workspace": workspace_id})
    if resolved_host in LOCAL_HOSTS:
        return f"/admin/editor?{query}"
    return f"/editor?{query}"


def write_workspace_activity(workspace, action, *, role, actor_id):
    db.session.add(
        ActivityLog(
            workspace_id=workspace.id,
            client_id=workspace.client_id,
            actor_type=activity_actor_type(role),
            actor_id=actor_id,
            action=action,
        )
    )


def _normalized_workspace_target(target):
    target_kind = str(target or "auto").strip().lower()
    if target_kind not in {"auto", "workspace", "client"}:
        return "auto"
    return target_kind


def _latest_workspace_for_client(client_id):
    return (
        Workspace.query.filter_by(client_id=client_id)
        .order_by(Workspace.updated_at.desc(), Workspace.id.desc())
        .first()
    )


def _project_workspace_key(client_id):
    return f"client:{int(client_id)}"


def _project_workspace_for_client(client_id):
    return Workspace.query.filter_by(
        project_workspace_key=_project_workspace_key(client_id)
    ).first()


def _sync_project_workspace_identity(workspace, client):
    dirty = False
    expected_key = _project_workspace_key(client.id)
    if workspace.project_workspace_key != expected_key:
        workspace.project_workspace_key = expected_key
        dirty = True
    if workspace.project_manager_id != client.project_manager_id:
        workspace.project_manager_id = client.project_manager_id
        dirty = True
    if workspace.exhibition_id != client.exhibition_id:
        workspace.exhibition_id = client.exhibition_id
        dirty = True
    return dirty


def _claim_existing_project_workspace(workspace, client):
    if not _sync_project_workspace_identity(workspace, client):
        return workspace
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        claimed_workspace = _project_workspace_for_client(client.id)
        if claimed_workspace:
            return claimed_workspace
        raise
    return workspace


def resolve_project_workspace(project_id, role, actor_id, target="auto"):
    target_kind = _normalized_workspace_target(target)

    if target_kind != "client":
        workspace = db.session.get(Workspace, project_id)
        if workspace:
            if not can_access_workspace(workspace, role, actor_id):
                return None, "forbidden"
            return workspace, None
        if target_kind == "workspace":
            return None, "not_found"

    client = db.session.get(Client, project_id)
    if not client:
        return None, "not_found"
    if not can_access_client_workspace(client, role, actor_id):
        return None, "forbidden"

    workspace = _project_workspace_for_client(client.id) or _latest_workspace_for_client(
        client.id
    )
    if workspace:
        return workspace, None
    return None, "not_found"


def ensure_project_workspace(project_id, role, actor_id, target="auto"):
    target_kind = _normalized_workspace_target(target)

    workspace, error = resolve_project_workspace(
        project_id,
        role,
        actor_id,
        target=target_kind,
    )
    if workspace and target_kind != "client":
        return workspace, None, False
    if error and error != "not_found":
        return workspace, error, False

    if target_kind == "workspace":
        return None, "not_found", False

    client = db.session.get(Client, project_id)
    if not client:
        return None, "not_found", False
    if not can_access_client_workspace(client, role, actor_id):
        return None, "forbidden", False

    workspace = (
        workspace
        or _project_workspace_for_client(client.id)
        or _latest_workspace_for_client(client.id)
    )
    if workspace:
        workspace = _claim_existing_project_workspace(workspace, client)
        return workspace, None, False

    workspace = Workspace(
        name=f"{client.full_name()} Workspace",
        client_id=client.id,
        project_workspace_key=_project_workspace_key(client.id),
        project_manager_id=client.project_manager_id,
        exhibition_id=client.exhibition_id,
        status="draft",
    )
    try:
        db.session.add(workspace)
        db.session.flush()
        write_workspace_activity(
            workspace,
            "Workspace created from dashboard",
            role=role,
            actor_id=actor_id,
        )
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        existing_workspace = _project_workspace_for_client(client.id)
        if existing_workspace:
            return existing_workspace, None, False
        raise
    return workspace, None, True


def get_workspace_for_actor(ws_id, role, actor_id):
    workspace = db.session.get(Workspace, ws_id)
    if not workspace:
        return None, "not_found"
    if not can_access_workspace(workspace, role, actor_id):
        return None, "forbidden"
    return workspace, None


def serialize_workspace_asset(workspace, asset, content_url_template=None):
    payload = asset.to_dict()
    template = (
        content_url_template
        or "/api/admin/workspaces/{workspace_id}/assets/{asset_id}/content"
    )
    payload["url"] = template.format(workspace_id=workspace.id, asset_id=asset.id)
    return payload


def list_workspace_assets(workspace, kind=None, content_url_template=None):
    state = inspect(workspace)
    if "assets" not in state.unloaded:
        assets = list(workspace.assets or [])
        if kind:
            assets = [asset for asset in assets if asset.kind == kind]
    else:
        query = WorkspaceAsset.query.filter_by(workspace_id=workspace.id)
        if kind:
            query = query.filter_by(kind=kind)
        assets = query.order_by(WorkspaceAsset.created_at.desc()).all()
    return [
        serialize_workspace_asset(
            workspace, asset, content_url_template=content_url_template
        )
        for asset in assets
    ]


def workspace_asset_storage_dir(workspace_id):
    return get_workspace_storage_backend().asset_storage_dir(workspace_id)


def workspace_snapshot_storage_dir(workspace_id):
    return get_workspace_storage_backend().snapshot_storage_dir(workspace_id)


def resolve_asset_kind(value):
    raw = str(value or "").strip().lower()
    if raw in {"logo", "fascia-logo"}:
        raw = "fascia_logo"
    if raw in {"panel-design", "panel_design", "artwork"}:
        raw = "panel_artwork"
    return raw if raw in ALLOWED_ASSET_KINDS else ""


def version_payload(workspace, limit=10):
    state = inspect(workspace)
    if "versions" not in state.unloaded:
        versions = list(workspace.versions or [])[:limit]
    else:
        versions = (
            WorkspaceVersion.query.filter_by(workspace_id=workspace.id)
            .order_by(WorkspaceVersion.created_at.desc())
            .limit(limit)
            .all()
        )
    return [version.to_dict() for version in versions]


def is_workspace_asset_path_safe(workspace, file_path):
    return get_workspace_storage_backend().asset_reference_safe(workspace, file_path)


def store_workspace_asset_file(workspace, file_name, upload):
    return get_workspace_storage_backend().store_workspace_asset(
        workspace, file_name, upload
    )


def workspace_asset_exists(workspace, file_path):
    return get_workspace_storage_backend().asset_exists(workspace, file_path)


def delete_workspace_asset_file(workspace, file_path):
    return get_workspace_storage_backend().delete_workspace_asset(workspace, file_path)


def send_workspace_asset_file(workspace, asset):
    return get_workspace_storage_backend().send_workspace_asset(workspace, asset)


def store_workspace_snapshot_bytes(workspace, file_name, payload):
    return get_workspace_storage_backend().store_workspace_snapshot(
        workspace, file_name, payload
    )


def read_workspace_snapshot_bytes(workspace, snapshot_reference):
    return get_workspace_storage_backend().read_workspace_snapshot(
        workspace, snapshot_reference
    )


def workspace_snapshot_exists(workspace, snapshot_reference):
    return get_workspace_storage_backend().snapshot_exists(
        workspace, snapshot_reference
    )


def delete_workspace_snapshot_file(workspace, snapshot_reference):
    return get_workspace_storage_backend().delete_workspace_snapshot(
        workspace, snapshot_reference
    )
