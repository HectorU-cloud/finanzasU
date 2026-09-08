from datetime import date
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UsuarioCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)


class UsuarioLogin(BaseModel):
    email: EmailStr
    password: str


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    email: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


class TarjetaBase(BaseModel):
    nombre: str
    dia_corte: int = Field(ge=1, le=31)
    red: str | None = None


class TarjetaCreate(TarjetaBase):
    pass


class TarjetaUpdate(BaseModel):
    nombre: str | None = None
    dia_corte: int | None = Field(default=None, ge=1, le=31)
    red: str | None = None


class Tarjeta(TarjetaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class GastoBase(BaseModel):
    tarjeta_id: int
    fecha: date
    monto: Decimal = Field(gt=0)
    descripcion: str | None = None


class GastoCreate(GastoBase):
    pass


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

# schemas.py (adiciones)

class GrupoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)


class GrupoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    codigo_invitacion: str
    creado_por_id: int
    miembros: list["MiembroGrupoOut"] = []


class MiembroGrupoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    usuario_id: int
    rol: str
    usuario: UsuarioOut  # reutilizas el existente


class GastoCompartidoCreate(BaseModel):
    grupo_id: int
    fecha: date
    monto: Decimal = Field(gt=0)
    descripcion: str | None = None
    categoria: str | None = None
    # Lista de usuarios y montos (opcional, si no se provee se divide en partes iguales)
    divisiones: list[tuple[int, Decimal]] | None = None  # (usuario_id, monto)


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
    usuario_id: int
    monto: Decimal
    pagado: bool


class SaldoUsuario(BaseModel):
    usuario_id: int
    nombre: str
    debe: Decimal  # positivo = debe a la caja común, negativo = le deben
