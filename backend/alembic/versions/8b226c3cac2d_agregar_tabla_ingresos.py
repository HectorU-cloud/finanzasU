"""agregar tabla ingresos

Revision ID: 8b226c3cac2d
Revises: 42e2d16b19cd
Create Date: 2026-09-14 21:41:22.305271

"""
from alembic import op
import sqlalchemy as sa


revision = "8b226c3cac2d"
down_revision = "42e2d16b19cd"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ingresos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("cuenta_id", sa.Integer(), nullable=False),
        sa.Column("monto", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("descripcion", sa.String(length=150), nullable=True),
        sa.Column("categoria", sa.String(length=50), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ingresos_id"), "ingresos", ["id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_ingresos_id"), table_name="ingresos")
    op.drop_table("ingresos")
