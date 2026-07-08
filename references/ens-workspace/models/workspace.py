import json
from datetime import datetime

from app.extensions import db
from app.time_utils import isoformat_or_none, utc_now_naive


def _scene_snapshot_summary(scene_data):
    try:
        parsed = json.loads(scene_data or "{}")
    except (TypeError, ValueError, json.JSONDecodeError):
        parsed = {}
    if not isinstance(parsed, dict):
        parsed = {}

    dims = parsed.get("dims") or {}
    width = float(dims.get("width") or 0)
    depth = float(dims.get("depth") or 0)
    height = float(dims.get("height") or 0)
    models = parsed.get("models") or []
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
    open_sides = parsed.get("openSides") or {}
    open_side_count = sum(1 for value in open_sides.values() if value)
    quote = parsed.get("quote") or {}

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
        "open_side_count": open_side_count,
        "booth_style": str((parsed.get("booth") or {}).get("boothStyle") or "").strip().lower()
        or "octanorm",
        "build_mode": str((parsed.get("booth") or {}).get("buildMode") or "").strip().lower()
        or "panel",
        "fascia_text": str((parsed.get("booth") or {}).get("fasciaText") or "").strip(),
        "quote_total": float(quote.get("grandTotal") or 0),
        "quote_currency": str(quote.get("currency") or "EUR").strip().upper() or "EUR",
    }


class Workspace(db.Model):
    __tablename__ = "workspaces"
    __table_args__ = (
        db.Index(
            "uq_workspaces_project_workspace_key",
            "project_workspace_key",
            unique=True,
        ),
        db.Index("ix_workspaces_client_updated_at", "client_id", "updated_at"),
        db.Index("ix_workspaces_booth_updated_at", "booth_id", "updated_at"),
        db.Index(
            "ix_workspaces_project_manager_updated_at",
            "project_manager_id",
            "updated_at",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200))
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False, index=True)
    booth_id = db.Column(db.Integer, db.ForeignKey("booths.id"), nullable=True, index=True)
    project_manager_id = db.Column(
        db.Integer, db.ForeignKey("project_managers.id"), index=True
    )
    exhibition_id = db.Column(db.Integer, db.ForeignKey("exhibitions.id"), index=True)
    status = db.Column(db.String(20), default="draft", index=True)
    scene_data = db.Column(db.Text)
    client_draft_scene_data = db.Column(db.Text)
    project_workspace_key = db.Column(db.String(64), nullable=True)
    version = db.Column(db.Integer, default=1)
    client_arrangement_rounds_used = db.Column(
        db.Integer, default=0, nullable=False
    )
    created_at = db.Column(db.DateTime, default=utc_now_naive, index=True)
    client_draft_updated_at = db.Column(db.DateTime, index=True)
    updated_at = db.Column(
        db.DateTime, default=utc_now_naive, onupdate=utc_now_naive, index=True
    )

    activities = db.relationship("ActivityLog", backref="workspace", lazy=True)
    versions = db.relationship(
        "WorkspaceVersion",
        backref="workspace",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="desc(WorkspaceVersion.created_at)",
    )
    assets = db.relationship(
        "WorkspaceAsset",
        backref="workspace",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="desc(WorkspaceAsset.created_at)",
    )
    feedback_requests = db.relationship(
        "WorkspaceFeedbackRequest",
        backref="workspace",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="desc(WorkspaceFeedbackRequest.created_at)",
    )

    def __init__(
        self,
        name=None,
        client_id=None,
        booth_id=None,
        project_manager_id=None,
        exhibition_id=None,
        status="draft",
        scene_data=None,
        client_draft_scene_data=None,
        project_workspace_key=None,
        version=1,
        client_arrangement_rounds_used=0,
        created_at=None,
        client_draft_updated_at=None,
        updated_at=None,
        **kwargs,
    ):
        super().__init__(
            name=name,
            client_id=client_id,
            booth_id=booth_id,
            project_manager_id=project_manager_id,
            exhibition_id=exhibition_id,
            status=status,
            scene_data=scene_data,
            client_draft_scene_data=client_draft_scene_data,
            project_workspace_key=project_workspace_key,
            version=version,
            client_arrangement_rounds_used=client_arrangement_rounds_used,
            created_at=created_at,
            client_draft_updated_at=client_draft_updated_at,
            updated_at=updated_at,
            **kwargs,
        )

    def to_dict(self, include_scene=False):
        data = {
            "id": self.id,
            "name": self.name,
            "client_id": self.client_id,
            "booth_id": self.booth_id,
            "project_manager_id": self.project_manager_id,
            "exhibition_id": self.exhibition_id,
            "status": self.status,
            "version": self.version,
            "client_arrangement_rounds_used": self.client_arrangement_rounds_used,
            "created_at": isoformat_or_none(self.created_at),
            "client_draft_updated_at": isoformat_or_none(self.client_draft_updated_at),
            "updated_at": isoformat_or_none(self.updated_at),
        }
        if include_scene:
            data["scene_data"] = self.scene_data
            data["client_draft_scene_data"] = self.client_draft_scene_data
        return data


class WorkspaceVersion(db.Model):
    __tablename__ = "workspace_versions"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(
        db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True
    )
    label = db.Column(db.String(200), nullable=False, default="Manual save")
    scene_data = db.Column(db.Text, nullable=False)
    version_kind = db.Column(db.String(30), nullable=False, default="manual", index=True)
    notes = db.Column(db.Text)
    submission_round = db.Column(db.Integer)
    actor_type = db.Column(db.String(30))
    actor_id = db.Column(db.Integer)
    created_at = db.Column(
        db.DateTime, default=utc_now_naive, nullable=False, index=True
    )

    def __init__(
        self,
        workspace_id=None,
        label="Manual save",
        scene_data=None,
        version_kind="manual",
        notes=None,
        submission_round=None,
        actor_type=None,
        actor_id=None,
        created_at=None,
        **kwargs,
    ):
        super().__init__(
            workspace_id=workspace_id,
            label=label,
            scene_data=scene_data,
            version_kind=version_kind,
            notes=notes,
            submission_round=submission_round,
            actor_type=actor_type,
            actor_id=actor_id,
            created_at=created_at,
            **kwargs,
        )

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "label": self.label,
            "version_kind": self.version_kind,
            "notes": self.notes,
            "submission_round": self.submission_round,
            "actor_type": self.actor_type,
            "actor_id": self.actor_id,
            "created_at": isoformat_or_none(self.created_at),
            "summary": _scene_snapshot_summary(self.scene_data),
        }


class WorkspaceAsset(db.Model):
    __tablename__ = "workspace_assets"

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(
        db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True
    )
    kind = db.Column(db.String(40), nullable=False, index=True)
    original_name = db.Column(db.String(255))
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    mime_type = db.Column(db.String(120))
    byte_size = db.Column(db.Integer, default=0)
    actor_type = db.Column(db.String(30))
    actor_id = db.Column(db.Integer)
    created_at = db.Column(
        db.DateTime, default=utc_now_naive, nullable=False, index=True
    )

    def __init__(
        self,
        workspace_id=None,
        kind=None,
        original_name=None,
        file_name=None,
        file_path=None,
        mime_type=None,
        byte_size=0,
        actor_type=None,
        actor_id=None,
        created_at=None,
        **kwargs,
    ):
        super().__init__(
            workspace_id=workspace_id,
            kind=kind,
            original_name=original_name,
            file_name=file_name,
            file_path=file_path,
            mime_type=mime_type,
            byte_size=byte_size,
            actor_type=actor_type,
            actor_id=actor_id,
            created_at=created_at,
            **kwargs,
        )

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "kind": self.kind,
            "original_name": self.original_name,
            "file_name": self.file_name,
            "mime_type": self.mime_type,
            "byte_size": self.byte_size,
            "created_at": isoformat_or_none(self.created_at),
        }


class WorkspaceFeedbackRequest(db.Model):
    __tablename__ = "workspace_feedback_requests"
    __table_args__ = (
        db.Index(
            "ix_workspace_feedback_requests_workspace_status_created_at",
            "workspace_id",
            "status",
            "created_at",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(
        db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True
    )
    target_version_id = db.Column(
        db.Integer, db.ForeignKey("workspace_versions.id"), nullable=True, index=True
    )
    summary = db.Column(db.String(255), nullable=False)
    items_json = db.Column(db.Text, nullable=False, default="[]")
    status = db.Column(db.String(20), nullable=False, default="open", index=True)
    created_by_type = db.Column(db.String(30))
    created_by_id = db.Column(db.Integer)
    created_at = db.Column(
        db.DateTime, default=utc_now_naive, nullable=False, index=True
    )
    updated_at = db.Column(
        db.DateTime,
        default=utc_now_naive,
        onupdate=utc_now_naive,
        nullable=False,
        index=True,
    )
    resolved_at = db.Column(db.DateTime, index=True)

    target_version = db.relationship("WorkspaceVersion", lazy="joined")

    def __init__(
        self,
        workspace_id=None,
        target_version_id=None,
        summary=None,
        items_json="[]",
        status="open",
        created_by_type=None,
        created_by_id=None,
        created_at=None,
        updated_at=None,
        resolved_at=None,
        **kwargs,
    ):
        super().__init__(
            workspace_id=workspace_id,
            target_version_id=target_version_id,
            summary=summary,
            items_json=items_json,
            status=status,
            created_by_type=created_by_type,
            created_by_id=created_by_id,
            created_at=created_at,
            updated_at=updated_at,
            resolved_at=resolved_at,
            **kwargs,
        )

    def items(self):
        try:
            parsed = json.loads(self.items_json or "[]")
        except (TypeError, ValueError, json.JSONDecodeError):
            parsed = []
        if not isinstance(parsed, list):
            return []
        return [str(item).strip() for item in parsed if str(item).strip()]

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "target_version_id": self.target_version_id,
            "target_version_label": (
                self.target_version.label if self.target_version else None
            ),
            "summary": self.summary,
            "items": self.items(),
            "status": self.status,
            "created_by_type": self.created_by_type,
            "created_by_id": self.created_by_id,
            "created_at": isoformat_or_none(self.created_at),
            "updated_at": isoformat_or_none(self.updated_at),
            "resolved_at": isoformat_or_none(self.resolved_at),
        }
