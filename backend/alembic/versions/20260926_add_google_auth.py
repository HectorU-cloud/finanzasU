"""agregar autenticacion con Google a usuarios

Revision ID: 20260926google
Revises: 20260923cats
Create Date: 2026-09-26
"""
from alembic import op
import sqlalchemy as sa

revision = "20260926google"
down_revision = "20260923cats"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("usuarios", sa.Column("google_id", sa.String(length=255), nullable=True))
    op.alter_column("usuarios", "password_hash", existing_type=sa.String(length=200), nullable=True)
    op.create_index("ix_usuarios_google_id", "usuarios", ["google_id"], unique=True)


def downgrade():
    op.drop_index("ix_usuarios_google_id", table_name="usuarios")
    op.alter_column("usuarios", "password_hash", existing_type=sa.String(length=200), nullable=False)
    op.drop_column("usuarios", "google_id")
