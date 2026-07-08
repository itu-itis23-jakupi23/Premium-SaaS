"""add workspace project identity

Revision ID: f8a9c0d1e2f3
Revises: e7c4b6f1a2d9
Create Date: 2026-04-11 01:10:00.000000

"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "f8a9c0d1e2f3"
down_revision = "e7c4b6f1a2d9"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("workspaces", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("project_workspace_key", sa.String(length=64), nullable=True)
        )
        batch_op.create_index(
            "uq_workspaces_project_workspace_key",
            ["project_workspace_key"],
            unique=True,
        )


def downgrade():
    with op.batch_alter_table("workspaces", schema=None) as batch_op:
        batch_op.drop_index("uq_workspaces_project_workspace_key")
        batch_op.drop_column("project_workspace_key")
