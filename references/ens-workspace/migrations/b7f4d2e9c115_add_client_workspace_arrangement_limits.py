"""add client workspace arrangement limits

Revision ID: b7f4d2e9c115
Revises: 8e2c4a5a8c3f
Create Date: 2026-04-01 11:10:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b7f4d2e9c115"
down_revision = "8e2c4a5a8c3f"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("clients", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "workspace_editor_subscription_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )

    with op.batch_alter_table("workspaces", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "client_arrangement_rounds_used",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            )
        )


def downgrade():
    with op.batch_alter_table("workspaces", schema=None) as batch_op:
        batch_op.drop_column("client_arrangement_rounds_used")

    with op.batch_alter_table("clients", schema=None) as batch_op:
        batch_op.drop_column("workspace_editor_subscription_active")
