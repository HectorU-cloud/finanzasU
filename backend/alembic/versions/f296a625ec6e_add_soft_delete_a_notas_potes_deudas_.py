"""add soft delete a notas potes deudas grupos

Revision ID: f296a625ec6e
Revises: 3ca1b23f4284
Create Date: 2026-09-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f296a625ec6e"
down_revision: Union[str, Sequence[str], None] = "3ca1b23f4284"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Añade columna eliminado a notas, potes, deudas y grupos."""
    tablas = ["notas", "potes", "deudas", "grupos"]
    for tabla in tablas:
        op.add_column(
            tabla,
            sa.Column("eliminado", sa.Integer(), nullable=False, server_default="0"),
        )
        op.create_index(f"ix_{tabla}_eliminado", tabla, ["eliminado"])


def downgrade() -> None:
    """Revierte la migración."""
    tablas = ["notas", "potes", "deudas", "grupos"]
    for tabla in tablas:
        op.drop_index(f"ix_{tabla}_eliminado", table_name=tabla)
        op.drop_column(tabla, "eliminado")