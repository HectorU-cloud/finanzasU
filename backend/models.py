from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Tarjeta(Base):
    __tablename__ = "tarjetas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), nullable=False)
    dia_corte = Column(Integer, nullable=False)  # día del mes, 1-31

    gastos = relationship("Gasto", back_populates="tarjeta", cascade="all, delete-orphan")


class Gasto(Base):
    __tablename__ = "gastos"

    id = Column(Integer, primary_key=True, index=True)
    tarjeta_id = Column(Integer, ForeignKey("tarjetas.id"), nullable=False)
    fecha = Column(Date, nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    descripcion = Column(String(150), nullable=True)

    tarjeta = relationship("Tarjeta", back_populates="gastos")
