"""add es_demo to usuarios

Revision ID: 3ca1b23f4284
Revises: 20260926google
Create Date: 2026-09-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3ca1b23f4284"
down_revision: Union[str, Sequence[str], None] = "20260926google"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Añade la columna es_demo a usuarios (0=normal, 1=demo)."""
    op.add_column(
        "usuarios",
        sa.Column("es_demo", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_usuarios_es_demo", "usuarios", ["es_demo"])


def downgrade() -> None:
    """Revierte la migración."""
    op.drop_index("ix_usuarios_es_demo", table_name="usuarios")
    op.drop_column("usuarios", "es_demo")