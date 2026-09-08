import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Por defecto usa un archivo SQLite local (finanzas.db) para que no necesites
# instalar ni configurar un servidor de base de datos aparte.
#
# Si más adelante quieres usar PostgreSQL, define la variable de entorno
# DATABASE_URL, por ejemplo:
#   DATABASE_URL=postgresql://usuario:password@localhost:5432/finanzas
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./finanzas.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
