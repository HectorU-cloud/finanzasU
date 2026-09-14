"""agregar tema a tarjetas

Revision ID: b8741ec01bbd
Revises: 91514082af7b
Create Date: 2026-09-14 01:10:26.210184

"""
from alembic import op
import sqlalchemy as sa


revision = "b8741ec01bbd"   # ← reemplaza XXXXX con el ID que Alembic generó
down_revision = "91514082af7b"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE tarjetas ADD COLUMN IF NOT EXISTS "
        "tema VARCHAR(30) NOT NULL DEFAULT 'clasico'"
    )


def downgrade():
    op.execute("ALTER TABLE tarjetas DROP COLUMN IF EXISTS tema")