"""agregar tarjeta_id a gastos_compartidos

Revision ID: 91514082af7b
Revises: 06446662f38d
Create Date: 2026-09-12 00:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "91514082af7b"
down_revision = "06446662f38d"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE gastos_compartidos ADD COLUMN IF NOT EXISTS "
        "tarjeta_id INTEGER REFERENCES tarjetas(id)"
    )


def downgrade():
    op.execute(
        "ALTER TABLE gastos_compartidos DROP CONSTRAINT IF EXISTS "
        "gastos_compartidos_tarjeta_id_fkey"
    )
    op.execute("ALTER TABLE gastos_compartidos DROP COLUMN IF EXISTS tarjeta_id")