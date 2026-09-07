from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


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
