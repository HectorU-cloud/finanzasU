"""add eliminado_en a notas potes deudas grupos

Revision ID: dada5957551f
Revises: f296a625ec6e
Create Date: 2026-09-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "dada5957551f"
down_revision: Union[str, Sequence[str], None] = "f296a625ec6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Añade columna eliminado_en (timestamp) a las tablas con soft delete."""
    tablas = ["notas", "potes", "deudas", "grupos"]
    for tabla in tablas:
        op.add_column(
            tabla,
            sa.Column("eliminado_en", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    """Revierte la migración."""
    tablas = ["notas", "potes", "deudas", "grupos"]
    for tabla in tablas:
        op.drop_column(tabla, "eliminado_en")