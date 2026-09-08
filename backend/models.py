from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), nullable=False)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    tarjetas = relationship("Tarjeta", back_populates="usuario", cascade="all, delete-orphan")


class Tarjeta(Base):
    __tablename__ = "tarjetas"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    nombre = Column(String(50), nullable=False)
    dia_corte = Column(Integer, nullable=False)  # día del mes, 1-31
    red = Column(String(20), nullable=True)  # Visa, Mastercard, American Express, Diners Club, etc.

    usuario = relationship("Usuario", back_populates="tarjetas")
    gastos = relationship("Gasto", back_populates="tarjeta", cascade="all, delete-orphan")


class Gasto(Base):
    __tablename__ = "gastos"

    id = Column(Integer, primary_key=True, index=True)
    tarjeta_id = Column(Integer, ForeignKey("tarjetas.id"), nullable=False)
    fecha = Column(Date, nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    descripcion = Column(String(150), nullable=True)

    tarjeta = relationship("Tarjeta", back_populates="gastos")

# models.py (nuevas clases)

class Grupo(Base):
    __tablename__ = "grupos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), nullable=False)
    creado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    codigo_invitacion = Column(String(20), unique=True, index=True)  # para unirse fácilmente

    creador = relationship("Usuario", foreign_keys=[creado_por_id])
    miembros = relationship("MiembroGrupo", back_populates="grupo", cascade="all, delete-orphan")
    gastos_compartidos = relationship("GastoCompartido", back_populates="grupo", cascade="all, delete-orphan")


class MiembroGrupo(Base):
    __tablename__ = "miembros_grupo"

    id = Column(Integer, primary_key=True, index=True)
    grupo_id = Column(Integer, ForeignKey("grupos.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    rol = Column(String(20), default="miembro")  # "admin" o "miembro"
    se_unio_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    grupo = relationship("Grupo", back_populates="miembros")
    usuario = relationship("Usuario")


class GastoCompartido(Base):
    __tablename__ = "gastos_compartidos"

    id = Column(Integer, primary_key=True, index=True)
    grupo_id = Column(Integer, ForeignKey("grupos.id"), nullable=False)
    pagado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    fecha = Column(Date, nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    descripcion = Column(String(150), nullable=True)
    categoria = Column(String(50), nullable=True)  # opcional

    grupo = relationship("Grupo", back_populates="gastos_compartidos")
    pagado_por = relationship("Usuario", foreign_keys=[pagado_por_id])
    divisiones = relationship("DivisionGasto", back_populates="gasto", cascade="all, delete-orphan")


class DivisionGasto(Base):
    __tablename__ = "divisiones_gasto"

    id = Column(Integer, primary_key=True, index=True)
    gasto_compartido_id = Column(Integer, ForeignKey("gastos_compartidos.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)  # lo que debe este usuario
    pagado = Column(Integer, default=0)  # booleano: 0=pendiente, 1=liquidado

    gasto = relationship("GastoCompartido", back_populates="divisiones")
    usuario = relationship("Usuario")
