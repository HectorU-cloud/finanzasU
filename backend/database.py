import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("Falta DATABASE_URL. Revisa las variables en Render.")

# psycopg (v3) requiere el prefijo postgresql+psycopg:// en la URL.
# Además, algunos proveedores (Render, Heroku, etc.) entregan "postgres://".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

connect_args = {}
if DATABASE_URL.startswith("postgresql"):
    # SSL solo cuando la variable DB_SSLMODE esté definida (por ejemplo, en Render = "require").
    # En local, no la definas y podrás conectar sin SSL.
    sslmode = os.getenv("DB_SSLMODE")
    if sslmode:
        connect_args["sslmode"] = sslmode

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # evita errores de "conexión muerta"
    pool_size=5,             # conexiones simultáneas por defecto
    max_overflow=10,         # conexiones extra en picos
    pool_recycle=1800,       # recicla conexiones cada 30 min
    connect_args=connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
