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
