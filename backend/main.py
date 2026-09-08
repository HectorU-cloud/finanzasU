import calendar
import csv
import io
from datetime import date
from decimal import Decimal

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import Base, engine, get_db

LIMITE_MENSUAL = Decimal("350")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Finanzas Personales")

# En desarrollo permitimos cualquier origen local (Vite corre en 5173 por defecto).
# En producción, cambia esto por la URL exacta de tu frontend en Vercel.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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


def tarjeta_del_usuario(db: Session, tarjeta_id: int, usuario: models.Usuario) -> models.Tarjeta:
    """Devuelve la tarjeta solo si pertenece al usuario actual; si no, 404."""
    tarjeta = (
        db.query(models.Tarjeta)
        .filter(models.Tarjeta.id == tarjeta_id, models.Tarjeta.usuario_id == usuario.id)
        .first()
    )
    if not tarjeta:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    return tarjeta


# ---------- Autenticación ----------

@app.post("/api/auth/registro", response_model=schemas.Token)
def registrar(datos: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    email = datos.email.lower()
    existe = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if existe:
        raise HTTPException(status_code=400, detail="Ya existe una cuenta con ese correo")

    usuario = models.Usuario(
        nombre=datos.nombre.strip(),
        email=email,
        password_hash=auth.hash_password(datos.password),
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    # Sembramos dos tarjetas de ejemplo para que la cuenta nueva no arranque vacía.
    db.add_all([
        models.Tarjeta(nombre="Tarjeta 1", dia_corte=31, usuario_id=usuario.id),
        models.Tarjeta(nombre="Tarjeta 2", dia_corte=4, usuario_id=usuario.id),
    ])
    db.commit()

    token = auth.crear_token(usuario.id)
    return schemas.Token(access_token=token, usuario=usuario)


@app.post("/api/auth/login", response_model=schemas.Token)
def login(datos: schemas.UsuarioLogin, db: Session = Depends(get_db)):
    email = datos.email.lower()
    usuario = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if not usuario or not auth.verificar_password(datos.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

    token = auth.crear_token(usuario.id)
    return schemas.Token(access_token=token, usuario=usuario)


@app.get("/api/auth/yo", response_model=schemas.UsuarioOut)
def yo(usuario: models.Usuario = Depends(auth.obtener_usuario_actual)):
    return usuario


# ---------- Tarjetas ----------

@app.get("/api/tarjetas", response_model=list[schemas.Tarjeta])
def listar_tarjetas(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    return db.query(models.Tarjeta).filter(models.Tarjeta.usuario_id == usuario.id).all()


@app.post("/api/tarjetas", response_model=schemas.Tarjeta)
def crear_tarjeta(
    tarjeta: schemas.TarjetaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    nueva = models.Tarjeta(**tarjeta.model_dump(), usuario_id=usuario.id)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@app.put("/api/tarjetas/{tarjeta_id}", response_model=schemas.Tarjeta)
def actualizar_tarjeta(
    tarjeta_id: int,
    payload: schemas.TarjetaUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    tarjeta = tarjeta_del_usuario(db, tarjeta_id, usuario)
    if payload.nombre is not None:
        tarjeta.nombre = payload.nombre
    if payload.dia_corte is not None:
        tarjeta.dia_corte = payload.dia_corte
    if payload.red is not None:
        tarjeta.red = payload.red
    db.commit()
    db.refresh(tarjeta)
    return tarjeta


@app.delete("/api/tarjetas/{tarjeta_id}", status_code=204)
def eliminar_tarjeta(
    tarjeta_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    tarjeta = tarjeta_del_usuario(db, tarjeta_id, usuario)
    db.delete(tarjeta)
    db.commit()


# ---------- Gastos ----------

@app.get("/api/gastos", response_model=list[schemas.Gasto])
def listar_gastos(
    anio: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    query = (
        db.query(models.Gasto)
        .join(models.Tarjeta)
        .filter(models.Tarjeta.usuario_id == usuario.id)
    )
    if anio is not None:
        query = query.filter(extract("year", models.Gasto.fecha) == anio)
    if mes is not None:
        query = query.filter(extract("month", models.Gasto.fecha) == mes)
    return query.order_by(models.Gasto.fecha.desc()).all()


@app.post("/api/gastos", response_model=schemas.Gasto)
def crear_gasto(
    gasto: schemas.GastoCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    tarjeta_del_usuario(db, gasto.tarjeta_id, usuario)  # valida que la tarjeta sea suya
    nuevo = models.Gasto(**gasto.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.delete("/api/gastos/{gasto_id}", status_code=204)
def eliminar_gasto(
    gasto_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    gasto = (
        db.query(models.Gasto)
        .join(models.Tarjeta)
        .filter(models.Gasto.id == gasto_id, models.Tarjeta.usuario_id == usuario.id)
        .first()
    )
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(gasto)
    db.commit()


@app.get("/api/gastos/export")
def exportar_gastos(
    desde: date,
    hasta: date,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    if hasta < desde:
        raise HTTPException(status_code=400, detail="El rango de fechas es inválido")

    gastos = (
        db.query(models.Gasto)
        .join(models.Tarjeta)
        .filter(
            models.Tarjeta.usuario_id == usuario.id,
            models.Gasto.fecha >= desde,
            models.Gasto.fecha <= hasta,
        )
        .order_by(models.Gasto.fecha)
        .all()
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Fecha", "Tarjeta", "Monto", "Descripción"])
    for g in gastos:
        writer.writerow([
            g.fecha.isoformat(),
            g.tarjeta.nombre if g.tarjeta else "",
            f"{g.monto:.2f}",
            g.descripcion or "",
        ])
    total = sum((g.monto for g in gastos), Decimal("0"))
    writer.writerow([])
    writer.writerow(["", "", "Total", f"{total:.2f}"])
    buffer.seek(0)

    nombre_archivo = f"gastos_{desde.isoformat()}_a_{hasta.isoformat()}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )


# ---------- Resumen mensual ----------

@app.get("/api/resumen", response_model=schemas.Resumen)
def resumen_mensual(
    anio: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    hoy = date.today()
    anio = anio or hoy.year
    mes = mes or hoy.month

    tarjetas = db.query(models.Tarjeta).filter(models.Tarjeta.usuario_id == usuario.id).all()

    total_mes = (
        db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
        .join(models.Tarjeta)
        .filter(models.Tarjeta.usuario_id == usuario.id)
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
            red=t.red,
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

import secrets

@app.post("/api/grupos", response_model=schemas.GrupoOut)
def crear_grupo(
    datos: schemas.GrupoCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    # Generar código único de 8 caracteres alfanuméricos
    codigo = secrets.token_urlsafe(6)  # ej: "aB3dEfG8"
    while db.query(models.Grupo).filter(models.Grupo.codigo_invitacion == codigo).first():
        codigo = secrets.token_urlsafe(6)

    nuevo_grupo = models.Grupo(
        nombre=datos.nombre,
        creado_por_id=usuario.id,
        codigo_invitacion=codigo,
    )
    db.add(nuevo_grupo)
    db.flush()  # para obtener el id

    # Agregar al creador como administrador
    miembro = models.MiembroGrupo(
        grupo_id=nuevo_grupo.id,
        usuario_id=usuario.id,
        rol="admin",
    )
    db.add(miembro)
    db.commit()
    db.refresh(nuevo_grupo)
    return nuevo_grupo
