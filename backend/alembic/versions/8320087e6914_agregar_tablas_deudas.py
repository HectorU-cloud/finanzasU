"""agregar tablas deudas y abonos_deuda

Revision ID: 8320087e6914
Revises: 088604e8f5db
Create Date: 2026-09-19

"""
from alembic import op
import sqlalchemy as sa


revision = "8320087e6914"
down_revision = "088604e8f5db"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "deudas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("persona", sa.String(length=80), nullable=False),
        sa.Column("tipo", sa.String(length=10), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=True),
        sa.Column("monto_original", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("saldo_pendiente", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("frecuencia_recordatorio_dias", sa.Integer(), nullable=True),
        sa.Column("pagada", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("fecha_pagada", sa.Date(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_deudas_id"), "deudas", ["id"], unique=False)

    op.create_table(
        "abonos_deuda",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("deuda_id", sa.Integer(), nullable=False),
        sa.Column("monto", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("nota", sa.String(length=150), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["deuda_id"], ["deudas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_abonos_deuda_id"), "abonos_deuda", ["id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_abonos_deuda_id"), table_name="abonos_deuda")
    op.drop_table("abonos_deuda")
    op.drop_index(op.f("ix_deudas_id"), table_name="deudas")
    op.drop_table("deudas")
