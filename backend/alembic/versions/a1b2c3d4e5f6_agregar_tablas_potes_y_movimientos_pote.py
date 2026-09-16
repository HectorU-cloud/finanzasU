"""agregar tablas potes y movimientos_pote

Revision ID: a1b2c3d4e5f6
Revises: 0076c780e22e
Create Date: 2026-09-16

"""
from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f6"
down_revision = "0076c780e22e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "potes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("cuenta_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=80), nullable=False),
        sa.Column("emoji", sa.String(length=10), nullable=False, server_default="🏺"),
        sa.Column("meta", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("saldo", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("creado_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_potes_id"), "potes", ["id"], unique=False)

    op.create_table(
        "movimientos_pote",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pote_id", sa.Integer(), nullable=False),
        sa.Column("monto", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["pote_id"], ["potes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_movimientos_pote_id"), "movimientos_pote", ["id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_movimientos_pote_id"), table_name="movimientos_pote")
    op.drop_table("movimientos_pote")
    op.drop_index(op.f("ix_potes_id"), table_name="potes")
    op.drop_table("potes")