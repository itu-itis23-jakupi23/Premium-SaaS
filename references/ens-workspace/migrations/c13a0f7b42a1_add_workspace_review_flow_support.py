"""add workspace review flow support

Revision ID: c13a0f7b42a1
Revises: b7f4d2e9c115
Create Date: 2026-04-02 20:45:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c13a0f7b42a1"
down_revision = "b7f4d2e9c115"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("workspaces", schema=None) as batch_op:
        batch_op.add_column(sa.Column("client_draft_scene_data", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("client_draft_updated_at", sa.DateTime(), nullable=True))
        batch_op.create_index(
            batch_op.f("ix_workspaces_client_draft_updated_at"),
            ["client_draft_updated_at"],
            unique=False,
        )

    with op.batch_alter_table("workspace_versions", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "version_kind",
                sa.String(length=30),
                nullable=False,
                server_default=sa.text("'manual'"),
            )
        )
        batch_op.add_column(sa.Column("notes", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("submission_round", sa.Integer(), nullable=True))
        batch_op.create_index(
            batch_op.f("ix_workspace_versions_version_kind"),
            ["version_kind"],
            unique=False,
        )

    op.create_table(
        "workspace_feedback_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("target_version_id", sa.Integer(), nullable=True),
        sa.Column("summary", sa.String(length=255), nullable=False),
        sa.Column("items_json", sa.Text(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'open'")),
        sa.Column("created_by_type", sa.String(length=30), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["target_version_id"], ["workspace_versions.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("workspace_feedback_requests", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_workspace_feedback_requests_created_at"),
            ["created_at"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_workspace_feedback_requests_resolved_at"),
            ["resolved_at"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_workspace_feedback_requests_status"),
            ["status"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_workspace_feedback_requests_target_version_id"),
            ["target_version_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_workspace_feedback_requests_updated_at"),
            ["updated_at"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_workspace_feedback_requests_workspace_id"),
            ["workspace_id"],
            unique=False,
        )
        batch_op.create_index(
            "ix_workspace_feedback_requests_workspace_status_created_at",
            ["workspace_id", "status", "created_at"],
            unique=False,
        )


def downgrade():
    with op.batch_alter_table("workspace_feedback_requests", schema=None) as batch_op:
        batch_op.drop_index("ix_workspace_feedback_requests_workspace_status_created_at")
        batch_op.drop_index(batch_op.f("ix_workspace_feedback_requests_workspace_id"))
        batch_op.drop_index(batch_op.f("ix_workspace_feedback_requests_updated_at"))
        batch_op.drop_index(batch_op.f("ix_workspace_feedback_requests_target_version_id"))
        batch_op.drop_index(batch_op.f("ix_workspace_feedback_requests_status"))
        batch_op.drop_index(batch_op.f("ix_workspace_feedback_requests_resolved_at"))
        batch_op.drop_index(batch_op.f("ix_workspace_feedback_requests_created_at"))
    op.drop_table("workspace_feedback_requests")

    with op.batch_alter_table("workspace_versions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_workspace_versions_version_kind"))
        batch_op.drop_column("submission_round")
        batch_op.drop_column("notes")
        batch_op.drop_column("version_kind")

    with op.batch_alter_table("workspaces", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_workspaces_client_draft_updated_at"))
        batch_op.drop_column("client_draft_updated_at")
        batch_op.drop_column("client_draft_scene_data")
