import calendar
from datetime import date
from decimal import Decimal

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

import models
import schemas
from database import Base, engine, get_db

LIMITE_MENSUAL = Decimal("350")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Finanzas Personales")

# En desarrollo permitimos cualquier origen local (Vite corre en 5173 por defecto).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def seed_tarjetas():
    db = next(get_db())
    if db.query(models.Tarjeta).count() == 0:
        db.add_all([
            models.Tarjeta(nombre="Tarjeta 1", dia_corte=31),
            models.Tarjeta(nombre="Tarjeta 2", dia_corte=4),
        ])
        db.commit()


def dias_para_corte(dia_corte: int, hoy: date) -> int:
    anio, mes = hoy.year, hoy.month
    ultimo_dia_mes = calendar.monthrange(anio, mes)[1]
    dia_valido = min(dia_corte, ultimo_dia_mes)
    corte = date(anio, mes, dia_valido)
    if corte < hoy:
        mes_sig = mes + 1 if mes < 12 else 1
        anio_sig = anio if mes < 12 else anio + 1
        ultimo_dia_sig = calendar.monthrange(anio_sig, mes_sig)[1]
        corte = date(anio_sig, mes_sig, min(dia_corte, ultimo_dia_sig))
    return (corte - hoy).days


# ---------- Tarjetas ----------

@app.get("/api/tarjetas", response_model=list[schemas.Tarjeta])
def listar_tarjetas(db: Session = Depends(get_db)):
    return db.query(models.Tarjeta).all()


@app.post("/api/tarjetas", response_model=schemas.Tarjeta)
def crear_tarjeta(tarjeta: schemas.TarjetaCreate, db: Session = Depends(get_db)):
    nueva = models.Tarjeta(**tarjeta.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@app.put("/api/tarjetas/{tarjeta_id}", response_model=schemas.Tarjeta)
def actualizar_tarjeta(tarjeta_id: int, payload: schemas.TarjetaUpdate, db: Session = Depends(get_db)):
    tarjeta = db.query(models.Tarjeta).get(tarjeta_id)
    if not tarjeta:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    if payload.nombre is not None:
        tarjeta.nombre = payload.nombre
    if payload.dia_corte is not None:
        tarjeta.dia_corte = payload.dia_corte
    db.commit()
    db.refresh(tarjeta)
    return tarjeta


@app.delete("/api/tarjetas/{tarjeta_id}", status_code=204)
def eliminar_tarjeta(tarjeta_id: int, db: Session = Depends(get_db)):
    tarjeta = db.query(models.Tarjeta).get(tarjeta_id)
    if not tarjeta:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    db.delete(tarjeta)
    db.commit()


# ---------- Gastos ----------

@app.get("/api/gastos", response_model=list[schemas.Gasto])
def listar_gastos(anio: int | None = None, mes: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Gasto)
    if anio is not None:
        query = query.filter(extract("year", models.Gasto.fecha) == anio)
    if mes is not None:
        query = query.filter(extract("month", models.Gasto.fecha) == mes)
    return query.order_by(models.Gasto.fecha.desc()).all()


@app.post("/api/gastos", response_model=schemas.Gasto)
def crear_gasto(gasto: schemas.GastoCreate, db: Session = Depends(get_db)):
    tarjeta = db.query(models.Tarjeta).get(gasto.tarjeta_id)
    if not tarjeta:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    nuevo = models.Gasto(**gasto.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.delete("/api/gastos/{gasto_id}", status_code=204)
def eliminar_gasto(gasto_id: int, db: Session = Depends(get_db)):
    gasto = db.query(models.Gasto).get(gasto_id)
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(gasto)
    db.commit()


# ---------- Resumen mensual ----------

@app.get("/api/resumen", response_model=schemas.Resumen)
def resumen_mensual(anio: int | None = None, mes: int | None = None, db: Session = Depends(get_db)):
    hoy = date.today()
    anio = anio or hoy.year
    mes = mes or hoy.month

    tarjetas = db.query(models.Tarjeta).all()

    total_mes = (
        db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
        .filter(extract("year", models.Gasto.fecha) == anio)
        .filter(extract("month", models.Gasto.fecha) == mes)
        .scalar()
    )
    total_mes = Decimal(total_mes)
    en_rojo = total_mes > LIMITE_MENSUAL

    resumen_tarjetas = []
    for t in tarjetas:
        gastado = (
            db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
            .filter(models.Gasto.tarjeta_id == t.id)
            .filter(extract("year", models.Gasto.fecha) == anio)
            .filter(extract("month", models.Gasto.fecha) == mes)
            .scalar()
        )
        resumen_tarjetas.append(schemas.ResumenTarjeta(
            id=t.id,
            nombre=t.nombre,
            dia_corte=t.dia_corte,
            dias_para_corte=dias_para_corte(t.dia_corte, hoy),
            gastado_mes=Decimal(gastado),
            en_rojo=en_rojo,
        ))

    return schemas.Resumen(
        anio=anio,
        mes=mes,
        total_mes=total_mes,
        limite=LIMITE_MENSUAL,
        en_rojo=en_rojo,
        tarjetas=resumen_tarjetas,
    )
