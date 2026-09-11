import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("Falta DATABASE_URL. Revisa las variables en Render.")

connect_args = {}
if DATABASE_URL.startswith("postgresql"):
    connect_args["sslmode"] = "require" # Render lo necesita

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Evita errores de "conexión muerta"
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
