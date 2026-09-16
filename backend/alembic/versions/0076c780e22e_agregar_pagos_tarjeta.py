"""agregar pagos tarjeta

Revision ID: 0076c780e22e
Revises: 8b226c3cac2d
Create Date: 2026-09-14 22:04:46.811347

"""

from alembic import op
import sqlalchemy as sa


revision = "0076c780e22e"
down_revision = "8b226c3cac2d"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Crear tabla pagos_tarjeta
    op.create_table(
        "pagos_tarjeta",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("tarjeta_id", sa.Integer(), nullable=False),
        sa.Column("cuenta_id", sa.Integer(), nullable=False),
        sa.Column("monto", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("fecha_pago", sa.Date(), nullable=False),
        sa.Column("mes_cerrado", sa.Integer(), nullable=False),
        sa.Column("anio_cerrado", sa.Integer(), nullable=False),
        sa.Column("creado_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["tarjeta_id"], ["tarjetas.id"]),
        sa.ForeignKeyConstraint(["cuenta_id"], ["cuentas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pagos_tarjeta_id"), "pagos_tarjeta", ["id"], unique=False)

    # 2. Agregar columna pago_id a gastos
    op.execute(
        "ALTER TABLE gastos ADD COLUMN IF NOT EXISTS "
        "pago_id INTEGER REFERENCES pagos_tarjeta(id)"
    )


def downgrade():
    op.execute("ALTER TABLE gastos DROP COLUMN IF EXISTS pago_id")
    op.drop_index(op.f("ix_pagos_tarjeta_id"), table_name="pagos_tarjeta")
    op.drop_table("pagos_tarjeta")