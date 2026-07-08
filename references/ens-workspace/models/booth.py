from app.extensions import db
from app.time_utils import isoformat_or_none, utc_now_naive


def _booth_workspaces_order_by():
    from app.models.workspace import Workspace

    return (
        Workspace.updated_at.desc(),
        Workspace.id.desc(),
    )


class Booth(db.Model):
    __tablename__ = "booths"

    id = db.Column(db.Integer, primary_key=True)
    exhibition_id = db.Column(
        db.Integer, db.ForeignKey("exhibitions.id"), nullable=False, index=True
    )
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=True, index=True)
    name = db.Column(db.String(200))
    width = db.Column(db.Float)
    depth = db.Column(db.Float)
    height = db.Column(db.Float, default=2.5)
    open_sides = db.Column(db.Integer, default=1)
    system_type = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=utc_now_naive, index=True)

    workspaces = db.relationship(
        "Workspace",
        backref="booth",
        lazy=True,
        order_by=_booth_workspaces_order_by,
    )

    @property
    def latest_workspace(self):
        return self.workspaces[0] if self.workspaces else None

    def to_dict(self):
        latest_workspace = self.latest_workspace
        return {
            "id": self.id,
            "exhibition_id": self.exhibition_id,
            "client_id": self.client_id,
            "name": self.name,
            "width": self.width,
            "depth": self.depth,
            "height": self.height,
            "open_sides": self.open_sides,
            "system_type": self.system_type,
            "workspace_status": latest_workspace.status if latest_workspace else None,
            "created_at": isoformat_or_none(self.created_at),
        }
