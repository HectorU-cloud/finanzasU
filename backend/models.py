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




class CategoriaPersonalizada(Base):
    __tablename__ = "categorias_personalizadas"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    nombre = Column(String(50), nullable=False)
    tipo = Column(String(10), nullable=False, default="gasto")  # gasto | ingreso
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")

class Tarjeta(Base):
    __tablename__ = "tarjetas"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    nombre = Column(String(50), nullable=False)
    tipo = Column(String(10), nullable=False, default="credito")
    dia_corte = Column(Integer, nullable=True)
    dia_pago = Column(Integer, nullable=True)
    red = Column(String(20), nullable=True)
    tema = Column(String(30), nullable=False, default="clasico")
    cuenta_id = Column(Integer, ForeignKey("cuentas.id"), nullable=True)  # <-- NUEVO

    usuario = relationship("Usuario", back_populates="tarjetas")
    cuenta = relationship("Cuenta")  # <-- NUEVO
    gastos = relationship("Gasto", back_populates="tarjeta", cascade="all, delete-orphan")


class Gasto(Base):
    __tablename__ = "gastos"

    id = Column(Integer, primary_key=True, index=True)
    tarjeta_id = Column(Integer, ForeignKey("tarjetas.id"), nullable=False)
    fecha = Column(Date, nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    descripcion = Column(String(150), nullable=True)
    categoria = Column(String(50), nullable=True)
    pago_id = Column(Integer, ForeignKey("pagos_tarjeta.id"), nullable=True)

    tarjeta = relationship("Tarjeta", back_populates="gastos")


class Grupo(Base):
    __tablename__ = "grupos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), nullable=False)
    creado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    codigo_invitacion = Column(String(20), unique=True, index=True)
    limite_mensual = Column(Numeric(10, 2), nullable=False, default=350)

    creador = relationship("Usuario", foreign_keys=[creado_por_id])
    miembros = relationship("MiembroGrupo", back_populates="grupo", cascade="all, delete-orphan")
    gastos_compartidos = relationship("GastoCompartido", back_populates="grupo", cascade="all, delete-orphan")


class MiembroGrupo(Base):
    __tablename__ = "miembros_grupo"

    id = Column(Integer, primary_key=True, index=True)
    grupo_id = Column(Integer, ForeignKey("grupos.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    rol = Column(String(20), default="miembro")
    se_unio_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    grupo = relationship("Grupo", back_populates="miembros")
    usuario = relationship("Usuario")


class GastoCompartido(Base):
    __tablename__ = "gastos_compartidos"

    id = Column(Integer, primary_key=True, index=True)
    grupo_id = Column(Integer, ForeignKey("grupos.id"), nullable=False)
    pagado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    tarjeta_id = Column(Integer, ForeignKey("tarjetas.id"), nullable=True)
    fecha = Column(Date, nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    descripcion = Column(String(150), nullable=True)
    categoria = Column(String(50), nullable=True)

    grupo = relationship("Grupo", back_populates="gastos_compartidos")
    pagado_por = relationship("Usuario", foreign_keys=[pagado_por_id])
    tarjeta = relationship("Tarjeta")
    divisiones = relationship("DivisionGasto", back_populates="gasto", cascade="all, delete-orphan")


class DivisionGasto(Base):
    __tablename__ = "divisiones_gasto"

    id = Column(Integer, primary_key=True, index=True)
    gasto_compartido_id = Column(Integer, ForeignKey("gastos_compartidos.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    pagado = Column(Integer, default=0)

    gasto = relationship("GastoCompartido", back_populates="divisiones")
    usuario = relationship("Usuario")

class Cuenta(Base):
    __tablename__ = "cuentas"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    nombre = Column(String(80), nullable=False)
    titular = Column(String(100), nullable=True)
    tipo = Column(String(30), nullable=False, default="ahorros")
    saldo_inicial = Column(Numeric(12, 2), nullable=False, default=0)
    fijada = Column(Integer, default=0)
    numero_cuenta = Column(String(10), nullable=True)  # <-- NUEVO
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")

class Ingreso(Base):
    __tablename__ = "ingresos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    cuenta_id = Column(Integer, ForeignKey("cuentas.id"), nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    fecha = Column(Date, nullable=False)
    descripcion = Column(String(150), nullable=True)
    categoria = Column(String(50), nullable=True)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")
    cuenta = relationship("Cuenta")

class PagoTarjeta(Base):
    __tablename__ = "pagos_tarjeta"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    tarjeta_id = Column(Integer, ForeignKey("tarjetas.id"), nullable=False)
    cuenta_id = Column(Integer, ForeignKey("cuentas.id"), nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    fecha_pago = Column(Date, nullable=False)
    mes_cerrado = Column(Integer, nullable=False)
    anio_cerrado = Column(Integer, nullable=False)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")
    tarjeta = relationship("Tarjeta")
    cuenta = relationship("Cuenta")

class Pote(Base):
    __tablename__ = "potes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    cuenta_id = Column(Integer, ForeignKey("cuentas.id"), nullable=False)
    nombre = Column(String(80), nullable=False)
    emoji = Column(String(10), nullable=False, default="🏺")
    meta = Column(Numeric(12, 2), nullable=False)
    saldo = Column(Numeric(12, 2), nullable=False, default=0)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")
    cuenta = relationship("Cuenta")
    movimientos = relationship("MovimientoPote", back_populates="pote", cascade="all, delete-orphan")


class MovimientoPote(Base):
    __tablename__ = "movimientos_pote"

    id = Column(Integer, primary_key=True, index=True)
    pote_id = Column(Integer, ForeignKey("potes.id"), nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)  # positivo = depósito, negativo = retiro
    descripcion = Column(String(150), nullable=True)
    fecha = Column(Date, nullable=False)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    pote = relationship("Pote", back_populates="movimientos")

class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    token = Column(String(100), unique=True, nullable=False, index=True)
    expira_en = Column(DateTime, nullable=False)
    usado = Column(Integer, default=0)  # 0=no usado, 1=usado
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Deuda(Base):
    __tablename__ = "deudas"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    persona = Column(String(80), nullable=False)  # a quién le debes, o quién te debe
    tipo = Column(String(10), nullable=False)  # "debo" | "me_deben"
    descripcion = Column(String(150), nullable=True)
    monto_original = Column(Numeric(12, 2), nullable=False)
    saldo_pendiente = Column(Numeric(12, 2), nullable=False)
    frecuencia_recordatorio_dias = Column(Integer, nullable=True)  # null = sin recordatorio
    pagada = Column(Integer, default=0)  # 0=activa, 1=saldada
    fecha_pagada = Column(Date, nullable=True)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")
    abonos = relationship("AbonoDeuda", back_populates="deuda", cascade="all, delete-orphan")


class AbonoDeuda(Base):
    __tablename__ = "abonos_deuda"

    id = Column(Integer, primary_key=True, index=True)
    deuda_id = Column(Integer, ForeignKey("deudas.id"), nullable=False)
    cuenta_id = Column(Integer, ForeignKey("cuentas.id"), nullable=True)  # <-- ESTA LÍNEA
    monto = Column(Numeric(12, 2), nullable=False)
    fecha = Column(Date, nullable=False)
    nota = Column(String(150), nullable=True)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    deuda = relationship("Deuda", back_populates="abonos")
    cuenta = relationship("Cuenta")  # <-- Y ESTA

class Nota(Base):
    __tablename__ = "notas"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    contenido = Column(String(500), nullable=False, default="")
    color = Column(String(20), nullable=False, default="rosa")  # <-- NUEVO
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    actualizado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")

class EgresoCuenta(Base):
    __tablename__ = "egresos_cuenta"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    cuenta_id = Column(Integer, ForeignKey("cuentas.id"), nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    fecha = Column(Date, nullable=False)
    categoria = Column(String(50), nullable=True)
    descripcion = Column(String(150), nullable=True)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")
    cuenta = relationship("Cuenta")
class TransaccionRecurrente(Base):
    __tablename__ = "transacciones_recurrentes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    nombre = Column(String(80), nullable=False)
    # tipo: "ingreso" | "gasto_cuenta" | "gasto_tarjeta"
    tipo = Column(String(20), nullable=False)
    cuenta_id = Column(Integer, ForeignKey("cuentas.id"), nullable=True)
    tarjeta_id = Column(Integer, ForeignKey("tarjetas.id"), nullable=True)
    monto_total = Column(Numeric(12, 2), nullable=False)
    # frecuencia: "mensual" | "semanal" | "anual"
    frecuencia = Column(String(20), nullable=False, default="mensual")
    categoria = Column(String(50), nullable=True)
    descripcion = Column(String(150), nullable=True)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=True)
    activa = Column(Integer, default=1)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    usuario = relationship("Usuario")
    cuenta = relationship("Cuenta")
    tarjeta = relationship("Tarjeta")
    pagos = relationship("RecurrentePago", back_populates="recurrente", cascade="all, delete-orphan")


class RecurrentePago(Base):
    __tablename__ = "recurrentes_pagos"

    id = Column(Integer, primary_key=True, index=True)
    recurrente_id = Column(Integer, ForeignKey("transacciones_recurrentes.id"), nullable=False)
    dia_del_mes = Column(Integer, nullable=False)  # 1-31, 0 = último día del mes
    porcentaje = Column(Numeric(5, 2), nullable=False)  # 40.00 = 40%
    etiqueta = Column(String(50), nullable=True)

    recurrente = relationship("TransaccionRecurrente", back_populates="pagos")


class RegistroRecurrente(Base):
    """Guarda los registros ya procesados para no duplicar."""
    __tablename__ = "registros_recurrentes"

    id = Column(Integer, primary_key=True, index=True)
    recurrente_id = Column(Integer, ForeignKey("transacciones_recurrentes.id"), nullable=False)
    pago_id = Column(Integer, ForeignKey("recurrentes_pagos.id"), nullable=False)
    fecha_procesado = Column(Date, nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    ingreso_id = Column(Integer, ForeignKey("ingresos.id"), nullable=True)
    gasto_id = Column(Integer, ForeignKey("gastos.id"), nullable=True)
    egreso_id = Column(Integer, ForeignKey("egresos_cuenta.id"), nullable=True)
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc))