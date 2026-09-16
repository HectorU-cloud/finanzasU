"""agregar tabla cuentas

Revision ID: 42e2d16b19cd
Revises: b8741ec01bbd
Create Date: 2026-09-14

"""
from alembic import op
import sqlalchemy as sa


revision = "42e2d16b19cd"
down_revision = "b8741ec01bbd"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cuentas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=80), nullable=False),
        sa.Column("tipo", sa.String(length=30), nullable=False, server_default="ahorros"),
        sa.Column("saldo_inicial", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("fijada", sa.Integer(), server_default="0"),
        sa.Column("creado_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cuentas_id"), "cuentas", ["id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_cuentas_id"), table_name="cuentas")
    op.drop_table("cuentas")