from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator

FECHA_MINIMA = date(2000, 1, 1)
MONTO_MAXIMO = Decimal("100000")

CATEGORIAS_VALIDAS = [
    "Comida",
    "Transporte",
    "Hogar",
    "Servicios",
    "Salud",
    "Ocio",
    "Compras",
    "Educación",
    "Otros",
]


def _validar_fecha(v: date) -> date:
    if v > date.today():
        raise ValueError("la fecha no puede ser futura")
    if v < FECHA_MINIMA:
        raise ValueError("la fecha no es válida")
    return v


def _validar_texto_no_vacio(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("no puede estar vacío")
    return v


class UsuarioCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        return _validar_texto_no_vacio(v)


class UsuarioLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class CambiarPassword(BaseModel):
    password_actual: str = Field(min_length=1)
    password_nueva: str = Field(min_length=6, max_length=72)


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    email: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


REDES_VALIDAS = {"Visa", "Mastercard", "American Express", "Diners Club", "Otra"}

TIPOS_TARJETA_VALIDOS = {"credito", "debito"}


class TarjetaBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    tipo: str = Field(default="credito", max_length=10)  # <-- NUEVO
    dia_corte: int | None = Field(default=None, ge=1, le=31)  # <-- Opcional
    dia_pago: int | None = Field(default=None, ge=1, le=31)  # <-- Opcional
    red: str | None = Field(default=None, max_length=20)
    tema: str | None = Field(default="clasico", max_length=30)
    cuenta_id: int | None = None  # <-- NUEVO

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        return _validar_texto_no_vacio(v)

    @field_validator("tipo")  # <-- NUEVO
    @classmethod
    def _tipo_valido(cls, v):
        if v not in TIPOS_TARJETA_VALIDOS:
            raise ValueError("el tipo debe ser 'credito' o 'debito'")
        return v

    @field_validator("red")
    @classmethod
    def _red_valida(cls, v):
        if v is not None and v not in REDES_VALIDAS:
            raise ValueError("la red debe ser una de: " + ", ".join(sorted(REDES_VALIDAS)))
        return v


class TarjetaCreate(TarjetaBase):
    pass


class TarjetaUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=50)
    tipo: str | None = Field(default=None, max_length=10)  # <-- NUEVO
    dia_corte: int | None = Field(default=None, ge=1, le=31)
    dia_pago: int | None = Field(default=None, ge=1, le=31)
    red: str | None = Field(default=None, max_length=20)
    tema: str | None = Field(default=None, max_length=30)
    cuenta_id: int | None = None  # <-- NUEVO

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        if v is None:
            return v
        return _validar_texto_no_vacio(v)

    @field_validator("tipo")  # <-- NUEVO
    @classmethod
    def _tipo_valido(cls, v):
        if v is not None and v not in TIPOS_TARJETA_VALIDOS:
            raise ValueError("el tipo debe ser 'credito' o 'debito'")
        return v

    @field_validator("red")
    @classmethod
    def _red_valida(cls, v):
        if v is not None and v not in REDES_VALIDAS:
            raise ValueError("la red debe ser una de: " + ", ".join(sorted(REDES_VALIDAS)))
        return v


class Tarjeta(TarjetaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class GastoBase(BaseModel):
    tarjeta_id: int
    fecha: date
    monto: Decimal = Field(gt=0, le=MONTO_MAXIMO, decimal_places=2)
    descripcion: str | None = Field(default=None, max_length=150)
    categoria: str | None = Field(default=None, max_length=50)

    @field_validator("categoria")
    @classmethod
    def _categoria_valida(cls, v):
        if v is not None and v not in CATEGORIAS_VALIDAS:
            raise ValueError("la categoría no es válida")
        return v


class GastoCreate(GastoBase):
    @field_validator("fecha")
    @classmethod
    def _fecha_valida(cls, v):
        return _validar_fecha(v)


class GastoUpdate(BaseModel):
    fecha: date | None = None
    monto: Decimal | None = Field(default=None, gt=0, le=MONTO_MAXIMO, decimal_places=2)
    descripcion: str | None = Field(default=None, max_length=150)
    categoria: str | None = Field(default=None, max_length=50)
    tarjeta_id: int | None = None

    @field_validator("fecha")
    @classmethod
    def _fecha_valida(cls, v):
        if v is None:
            return v
        return _validar_fecha(v)

    @field_validator("categoria")
    @classmethod
    def _categoria_valida(cls, v):
        if v is not None and v not in CATEGORIAS_VALIDAS:
            raise ValueError("la categoría no es válida")
        return v


class Gasto(GastoBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ResumenTarjeta(BaseModel):
    id: int
    nombre: str
    tipo: str = "credito"  # <-- NUEVO
    dia_corte: int | None = None  # <-- Opcional
    dia_pago: int | None = None
    red: str | None = None
    tema: str | None = None
    cuenta_id: int | None = None 
    dias_para_corte: int
    gastado_mes: Decimal
    en_rojo: bool


class Resumen(BaseModel):
    anio: int
    mes: int
    total_mes: Decimal
    limite: Decimal
    en_rojo: bool
    tarjetas: list[ResumenTarjeta]


class ResumenCategoria(BaseModel):
    categoria: str
    total: Decimal
    porcentaje: float


class CategoriasDisponibles(BaseModel):
    categorias: list[str]


class GrupoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        return _validar_texto_no_vacio(v)


class GrupoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    codigo_invitacion: str
    creado_por_id: int
    limite_mensual: Decimal
    miembros: list["MiembroGrupoOut"] = []


class MiembroGrupoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    usuario_id: int
    rol: str
    usuario: UsuarioOut


class GastoCompartidoCreate(BaseModel):
    grupo_id: int
    fecha: date
    monto: Decimal = Field(gt=0, le=MONTO_MAXIMO, decimal_places=2)
    descripcion: str | None = Field(default=None, max_length=150)
    categoria: str | None = Field(default=None, max_length=50)
    tarjeta_id: int | None = None
    divisiones: list[tuple[int, Decimal]] | None = None

    @field_validator("fecha")
    @classmethod
    def _fecha_valida(cls, v):
        return _validar_fecha(v)

    @field_validator("categoria")
    @classmethod
    def _categoria_valida(cls, v):
        if v is not None and v not in CATEGORIAS_VALIDAS:
            raise ValueError("la categoría no es válida")
        return v

    @field_validator("divisiones")
    @classmethod
    def _divisiones_validas(cls, v):
        if v is None:
            return v
        if len(v) == 0:
            raise ValueError("debes incluir al menos una división")
        for _, monto in v:
            if monto <= 0:
                raise ValueError("cada división debe ser un monto mayor a 0")
        return v


class GastoCompartidoUpdate(BaseModel):
    fecha: date | None = None
    monto: Decimal | None = Field(default=None, gt=0, le=MONTO_MAXIMO, decimal_places=2)
    descripcion: str | None = Field(default=None, max_length=150)
    categoria: str | None = Field(default=None, max_length=50)
    tarjeta_id: int | None = None

    @field_validator("fecha")
    @classmethod
    def _fecha_valida(cls, v):
        if v is None:
            return v
        return _validar_fecha(v)

    @field_validator("categoria")
    @classmethod
    def _categoria_valida(cls, v):
        if v is not None and v not in CATEGORIAS_VALIDAS:
            raise ValueError("la categoría no es válida")
        return v


class GastoCompartidoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    grupo_id: int
    pagado_por_id: int
    tarjeta_id: int | None
    fecha: date
    monto: Decimal
    descripcion: str | None
    categoria: str | None
    divisiones: list["DivisionGastoOut"]


class DivisionGastoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    usuario_id: int
    monto: Decimal
    pagado: bool


class SaldoUsuario(BaseModel):
    usuario_id: int
    nombre: str
    debe: Decimal


class GrupoResumenMensual(BaseModel):
    grupo_id: int
    anio: int
    mes: int
    total_mes: Decimal
    limite: Decimal
    porcentaje: float
    en_rojo: bool


class GrupoUpdateLimite(BaseModel):
    limite_mensual: Decimal = Field(gt=0, le=1000000)

TIPOS_CUENTA_VALIDOS = {"efectivo", "ahorros", "corriente", "inversion", "otra"}


class CuentaBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    titular: str | None = Field(default=None, max_length=100)   # <-- NUEVO
    tipo: str = Field(default="ahorros", max_length=30)
    saldo_inicial: Decimal = Field(default=Decimal("0"), ge=0)
    fijada: bool = False
    numero_cuenta: str | None = Field(default=None, max_length=10) # <-- NUEVO

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        return _validar_texto_no_vacio(v)

    @field_validator("tipo")
    @classmethod
    def _tipo_valido(cls, v):
        if v not in TIPOS_CUENTA_VALIDOS:
            raise ValueError("tipo inválido")
        return v

    @field_validator("numero_cuenta") # <-- NUEVA VALIDACIÓN
    @classmethod
    def _numero_cuenta_valido(cls, v):
        if v is not None and v.strip():
            v = v.strip()
            if not v.isdigit():
                raise ValueError("El número de cuenta solo debe contener números")
            if len(v) != 10:
                raise ValueError("El número de cuenta debe tener exactamente 10 dígitos")
            return v
        return None


class CuentaCreate(CuentaBase):
    pass


class CuentaUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=80)
    titular: str | None = Field(default=None, max_length=100)   # <-- NUEVO
    tipo: str | None = Field(default=None, max_length=30)
    saldo_inicial: Decimal | None = Field(default=None, ge=0)
    fijada: bool | None = None
    numero_cuenta: str | None = Field(default=None, max_length=10)

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        if v is None:
            return v
        return _validar_texto_no_vacio(v)

    @field_validator("tipo")
    @classmethod
    def _tipo_valido(cls, v):
        if v is not None and v not in TIPOS_CUENTA_VALIDOS:
            raise ValueError("tipo inválido")
        return v

    @field_validator("numero_cuenta")
    @classmethod
    def _numero_cuenta_valido(cls, v):
        if v is not None and v.strip():
            v = v.strip()
            if not v.isdigit():
                raise ValueError("El número de cuenta solo debe contener números")
            if len(v) != 10:
                raise ValueError("El número de cuenta debe tener exactamente 10 dígitos")
            return v
        return None

class Cuenta(CuentaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    creado_en: datetime | None = None
    total_ingresos: Decimal = Decimal("0")
    total_egresos: Decimal = Decimal("0")
    saldo_actual: Decimal | None = None

CATEGORIAS_INGRESO = [
    "Sueldo",
    "Freelance",
    "Negocio",
    "Inversión",
    "Bono",
    "Regalo",
    "Otros",
]


class IngresoBase(BaseModel):
    cuenta_id: int
    fecha: date
    monto: Decimal = Field(gt=0, le=MONTO_MAXIMO, decimal_places=2)
    descripcion: str | None = Field(default=None, max_length=150)
    categoria: str | None = Field(default=None, max_length=50)

    @field_validator("fecha")
    @classmethod
    def _fecha_valida(cls, v):
        return _validar_fecha(v)

    @field_validator("categoria")
    @classmethod
    def _categoria_valida(cls, v):
        if v is not None and v not in CATEGORIAS_INGRESO:
            raise ValueError("la categoría no es válida")
        return v


class IngresoCreate(IngresoBase):
    pass


class IngresoUpdate(BaseModel):
    cuenta_id: int | None = None
    fecha: date | None = None
    monto: Decimal | None = Field(default=None, gt=0, le=MONTO_MAXIMO, decimal_places=2)
    descripcion: str | None = Field(default=None, max_length=150)
    categoria: str | None = Field(default=None, max_length=50)

    @field_validator("fecha")
    @classmethod
    def _fecha_valida(cls, v):
        if v is None:
            return v
        return _validar_fecha(v)

    @field_validator("categoria")
    @classmethod
    def _categoria_valida(cls, v):
        if v is not None and v not in CATEGORIAS_INGRESO:
            raise ValueError("la categoría no es válida")
        return v


class IngresoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cuenta_id: int
    fecha: date
    monto: Decimal
    descripcion: str | None
    categoria: str | None


class ResumenTotalCuenta(BaseModel):
    cuenta_id: int
    nombre: str
    tipo: str
    saldo_inicial: Decimal
    total_ingresos: Decimal
    total_egresos: Decimal
    saldo_actual: Decimal

class PagoTarjetaCreate(BaseModel):
    tarjeta_id: int
    cuenta_id: int
    monto: Decimal = Field(gt=0, le=MONTO_MAXIMO, decimal_places=2)
    anio: int
    mes: int = Field(ge=1, le=12)
    fecha_pago: date


class PagoTarjetaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tarjeta_id: int
    cuenta_id: int
    monto: Decimal
    fecha_pago: date
    mes_cerrado: int
    anio_cerrado: int


class EstadoPagoTarjeta(BaseModel):
    tarjeta_id: int
    tarjeta_nombre: str
    anio: int
    mes: int
    total_gastos: Decimal
    total_pagado: Decimal
    pendiente: Decimal
    cerrado: bool
    porcentaje_pagado: float


class Alerta(BaseModel):
    tipo: str  # "corte_proximo" | "pago_atrasado" | "recordatorio_deuda"
    tarjeta_id: int | None = None
    tarjeta_nombre: str | None = None
    deuda_id: int | None = None
    dias: int | None = None
    monto: Decimal | None = None
    mensaje: str

EMOJIS_POTE_SUGERIDOS = [
    "🏺", "🏖️", "🎓", "🎁", "🚗", "🏠", "💍", "🎉",
    "🏥", "💻", "📱", "✈️", "🎮", "🛒", "🍔", "☕",
]


class PoteBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    emoji: str = Field(default="🏺", max_length=10)
    meta: Decimal = Field(gt=0, le=MONTO_MAXIMO, decimal_places=2)
    cuenta_id: int

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        return _validar_texto_no_vacio(v)


class PoteCreate(PoteBase):
    pass


class PoteUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=80)
    emoji: str | None = Field(default=None, max_length=10)
    meta: Decimal | None = Field(default=None, gt=0, le=MONTO_MAXIMO, decimal_places=2)

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        if v is None:
            return v
        return _validar_texto_no_vacio(v)


class PoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cuenta_id: int
    nombre: str
    emoji: str
    meta: Decimal
    saldo: Decimal
    creado_en: datetime | None = None


class MovimientoPoteCreate(BaseModel):
    monto: Decimal = Field(gt=0, le=MONTO_MAXIMO, decimal_places=2)
    descripcion: str | None = Field(default=None, max_length=150)
    fecha: date

    @field_validator("fecha")
    @classmethod
    def _fecha_valida(cls, v):
        return _validar_fecha(v)


class MovimientoPoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pote_id: int
    monto: Decimal
    descripcion: str | None
    fecha: date
    creado_en: datetime | None = None


class EmojisPoteDisponibles(BaseModel):
    emojis: list[str]

class SolicitarReset(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str = Field(min_length=10, max_length=100)
    password_nueva: str = Field(min_length=6, max_length=72)

class MovimientoCuenta(BaseModel):
    tipo: str  # "ingreso" | "pago_tarjeta" | "deposito_pote" | "retiro_pote" | "abono_deuda" | "egreso_cuenta"
    monto: Decimal
    fecha: date
    descripcion: str | None = None
    referencia_id: int | None = None
    referencia_nombre: str | None = None

class NotaCreate(BaseModel):
    contenido: str = Field(default="", max_length=500)
    color: str = Field(default="rosa", max_length=20)


class NotaUpdate(BaseModel):
    contenido: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=20)


class NotaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    contenido: str
    color: str = "rosa"
    creado_en: datetime | None = None
    actualizado_en: datetime | None = None


TIPOS_DEUDA = {"debo", "me_deben"}


class DeudaCreate(BaseModel):
    persona: str = Field(min_length=1, max_length=80)
    tipo: str
    descripcion: str | None = Field(default=None, max_length=150)
    monto: Decimal = Field(gt=0, le=MONTO_MAXIMO, decimal_places=2)
    frecuencia_recordatorio_dias: int | None = Field(default=None, ge=1, le=365)

    @field_validator("persona")
    @classmethod
    def _persona_valida(cls, v):
        return _validar_texto_no_vacio(v)

    @field_validator("tipo")
    @classmethod
    def _tipo_valido(cls, v):
        if v not in TIPOS_DEUDA:
            raise ValueError("el tipo debe ser 'debo' o 'me_deben'")
        return v


class DeudaUpdate(BaseModel):
    persona: str | None = Field(default=None, max_length=80)
    descripcion: str | None = Field(default=None, max_length=150)
    frecuencia_recordatorio_dias: int | None = Field(default=None, ge=1, le=365)

    @field_validator("persona")
    @classmethod
    def _persona_valida(cls, v):
        if v is None:
            return v
        return _validar_texto_no_vacio(v)


class AbonoDeudaCreate(BaseModel):
    monto: Decimal = Field(gt=0, le=MONTO_MAXIMO, decimal_places=2)
    fecha: date
    nota: str | None = Field(default=None, max_length=150)
    cuenta_id: int | None = None  # <-- NUEVO

    @field_validator("fecha")
    @classmethod
    def _fecha_valida(cls, v):
        return _validar_fecha(v)


class AbonoDeudaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    monto: Decimal
    fecha: date
    nota: str | None
    cuenta_id: int | None = None  # <-- NUEVO


class DeudaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    persona: str
    tipo: str
    descripcion: str | None
    monto_original: Decimal
    saldo_pendiente: Decimal
    frecuencia_recordatorio_dias: int | None
    pagada: bool
    fecha_pagada: date | None
    creado_en: datetime | None = None

    @field_validator("pagada", mode="before")
    @classmethod
    def _pagada_bool(cls, v):
        return bool(v)


class AbonarDeudaResultado(BaseModel):
    deuda: DeudaOut
    quedo_saldada: bool

class EgresoCuentaCreate(BaseModel):
    cuenta_id: int
    monto: Decimal = Field(gt=0, le=MONTO_MAXIMO, decimal_places=2)
    fecha: date
    categoria: str | None = Field(default=None, max_length=50)
    descripcion: str | None = Field(default=None, max_length=150)

    @field_validator("fecha")
    @classmethod
    def _fecha_valida(cls, v):
        return _validar_fecha(v)

    @field_validator("categoria")
    @classmethod
    def _categoria_valida(cls, v):
        if v is not None and v not in CATEGORIAS_VALIDAS:
            raise ValueError("la categoría no es válida")
        return v


class EgresoCuentaUpdate(BaseModel):
    cuenta_id: int | None = None
    monto: Decimal | None = Field(default=None, gt=0, le=MONTO_MAXIMO, decimal_places=2)
    fecha: date | None = None
    categoria: str | None = Field(default=None, max_length=50)
    descripcion: str | None = Field(default=None, max_length=150)

    @field_validator("fecha")
    @classmethod
    def _fecha_valida(cls, v):
        if v is None:
            return v
        return _validar_fecha(v)

    @field_validator("categoria")
    @classmethod
    def _categoria_valida(cls, v):
        if v is not None and v not in CATEGORIAS_VALIDAS:
            raise ValueError("la categoría no es válida")
        return v


class EgresoCuentaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cuenta_id: int
    monto: Decimal
    fecha: date
    categoria: str | None
    descripcion: str | None

# ============================================================
# TRANSACCIONES RECURRENTES
# ============================================================

TIPOS_RECURRENTE = {"ingreso", "gasto_cuenta", "gasto_tarjeta"}
FRECUENCIAS_RECURRENTE = {"mensual", "semanal", "anual"}


class RecurrentePagoBase(BaseModel):
    dia_del_mes: int = Field(ge=0, le=31)  # 0 = último día
    porcentaje: Decimal = Field(gt=0, le=100, decimal_places=2)
    etiqueta: str | None = Field(default=None, max_length=50)


class RecurrentePagoCreate(RecurrentePagoBase):
    pass


class RecurrentePagoOut(RecurrentePagoBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class TransaccionRecurrenteBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    tipo: str
    cuenta_id: int | None = None
    tarjeta_id: int | None = None
    monto_total: Decimal = Field(gt=0, le=MONTO_MAXIMO, decimal_places=2)
    frecuencia: str = "mensual"
    categoria: str | None = Field(default=None, max_length=50)
    descripcion: str | None = Field(default=None, max_length=150)
    fecha_inicio: date
    fecha_fin: date | None = None

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        return _validar_texto_no_vacio(v)

    @field_validator("tipo")
    @classmethod
    def _tipo_valido(cls, v):
        if v not in TIPOS_RECURRENTE:
            raise ValueError("tipo inválido")
        return v

    @field_validator("frecuencia")
    @classmethod
    def _frecuencia_valida(cls, v):
        if v not in FRECUENCIAS_RECURRENTE:
            raise ValueError("frecuencia inválida")
        return v

    @field_validator("categoria")
    @classmethod
    def _categoria_valida(cls, v):
        if v is not None and v not in CATEGORIAS_VALIDAS:
            raise ValueError("la categoría no es válida")
        return v

    @field_validator("fecha_inicio")
    @classmethod
    def _fecha_inicio_valida(cls, v):
        return _validar_fecha(v)


class TransaccionRecurrenteCreate(TransaccionRecurrenteBase):
    pagos: list[RecurrentePagoCreate]


class TransaccionRecurrenteUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=80)
    monto_total: Decimal | None = Field(default=None, gt=0, le=MONTO_MAXIMO, decimal_places=2)
    categoria: str | None = Field(default=None, max_length=50)
    descripcion: str | None = Field(default=None, max_length=150)
    activa: bool | None = None
    fecha_fin: date | None = None

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        if v is None:
            return v
        return _validar_texto_no_vacio(v)


class TransaccionRecurrenteOut(TransaccionRecurrenteBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    activa: bool
    creado_en: datetime | None = None
    pagos: list[RecurrentePagoOut] = []

    @field_validator("activa", mode="before")
    @classmethod
    def _activa_bool(cls, v):
        return bool(v)