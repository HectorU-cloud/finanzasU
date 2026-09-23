"""agregar categorias personalizadas por usuario

Revision ID: 20260923cats
Revises: 996db6251681
Create Date: 2026-09-23
"""
from alembic import op
import sqlalchemy as sa

revision = "20260923cats"
down_revision = "22472dcee729"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "categorias_personalizadas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column("tipo", sa.String(length=10), nullable=False, server_default="gasto"),
        sa.Column("creado_en", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_categorias_personalizadas_id", "categorias_personalizadas", ["id"])
    op.create_index("ix_categorias_personalizadas_usuario_id", "categorias_personalizadas", ["usuario_id"])
    op.create_unique_constraint(
        "uq_categoria_personalizada_usuario_tipo_nombre",
        "categorias_personalizadas",
        ["usuario_id", "tipo", "nombre"],
    )

def downgrade():
    op.drop_constraint("uq_categoria_personalizada_usuario_tipo_nombre", "categorias_personalizadas", type_="unique")
    op.drop_index("ix_categorias_personalizadas_usuario_id", table_name="categorias_personalizadas")
    op.drop_index("ix_categorias_personalizadas_id", table_name="categorias_personalizadas")
    op.drop_table("categorias_personalizadas")
