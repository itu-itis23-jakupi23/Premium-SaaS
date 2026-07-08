"""align booth workspace cardinality

Revision ID: e7c4b6f1a2d9
Revises: d4b6f8a2c1e0
Create Date: 2026-04-10 18:05:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "e7c4b6f1a2d9"
down_revision = "d4b6f8a2c1e0"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("workspaces", schema=None) as batch_op:
        batch_op.create_index(
            "ix_workspaces_booth_updated_at",
            ["booth_id", "updated_at"],
            unique=False,
        )


def downgrade():
    with op.batch_alter_table("workspaces", schema=None) as batch_op:
        batch_op.drop_index("ix_workspaces_booth_updated_at")
