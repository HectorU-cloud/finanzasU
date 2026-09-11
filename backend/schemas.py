from datetime import date
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator

FECHA_MINIMA = date(2000, 1, 1)
MONTO_MAXIMO = Decimal("100000")

# Categorías disponibles para clasificar los gastos personales y compartidos.
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


class TarjetaBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    dia_corte: int = Field(ge=1, le=31)
    red: str | None = Field(default=None, max_length=20)

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        return _validar_texto_no_vacio(v)

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
    dia_corte: int | None = Field(default=None, ge=1, le=31)
    red: str | None = Field(default=None, max_length=20)

    @field_validator("nombre")
    @classmethod
    def _nombre_valido(cls, v):
        if v is None:
            return v
        return _validar_texto_no_vacio(v)

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
    monto: Decimal = Field(gt=0, le=MONTO_MAXIMO)
    descripcion: str | None = Field(default=None, max_length=150)
    categoria: str | None = Field(default=None, max_length=50)

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


class GastoCreate(GastoBase):
    pass
class GastoUpdate(BaseModel):
    fecha: date | None = None
    monto: Decimal | None = Field(default=None, gt=0, le=MONTO_MAXIMO)
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
    dia_corte: int
    red: str | None = None
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
    limite_mensual : decimal
    miembros: list["MiembroGrupoOut"] = []


class MiembroGrupoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    usuario_id: int
    rol: str
    usuario: UsuarioOut


class GastoCompartidoCreate(BaseModel):
    grupo_id: int
    fecha: date
    monto: Decimal = Field(gt=0, le=MONTO_MAXIMO)
    descripcion: str | None = Field(default=None, max_length=150)
    categoria: str | None = Field(default=None, max_length=50)
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


class GastoCompartidoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    grupo_id: int
    pagado_por_id: int
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
