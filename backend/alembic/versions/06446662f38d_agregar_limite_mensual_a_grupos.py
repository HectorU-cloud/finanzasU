"""agregar limite_mensual a grupos

Revision ID: 06446662f38d
Revises: c05b619dfc74
Create Date: 2026-09-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "06446662f38d"
down_revision = "c05b619dfc74"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE grupos ADD COLUMN IF NOT EXISTS "
        "limite_mensual NUMERIC(10, 2) NOT NULL DEFAULT 350"
    )


def downgrade():
    op.execute("ALTER TABLE grupos DROP COLUMN IF EXISTS limite_mensual")