import calendar
import csv
import io
import os
from datetime import date
from decimal import Decimal

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

LIMITE_MENSUAL = Decimal("350")


app = FastAPI(title="API Finanzas Personales")


@app.exception_handler(RequestValidationError)
async def manejar_error_validacion(request: Request, exc: RequestValidationError):
    """Convierte los errores de validación de Pydantic en un mensaje simple y legible."""
    errores = exc.errors()
    if errores:
        primero = errores[0]
        campo = primero["loc"][-1] if primero["loc"] else "dato"
        mensaje = primero["msg"].removeprefix("Value error, ")
        detalle = f"{campo}: {mensaje}"
    else:
        detalle = "Datos inválidos"
    return JSONResponse(status_code=422, content={"detail": detalle})


# En desarrollo permitimos cualquier origen local (Vite corre en 5173 por defecto).
# En producción, cambia esto por la URL exacta de tu frontend en Vercel.
# Orígenes permitidos para llamar a esta API. En Render, define la variable de entorno
# ALLOWED_ORIGINS con tu(s) dominio(s) de Vercel separados por coma, por ejemplo:
#   ALLOWED_ORIGINS=https://finanzasu.vercel.app,https://frontend-psi-kohl-14.vercel.app
# Si no se define, solo se permite desarrollo local (Vite en el puerto 5173).
_origenes_env = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in _origenes_env.split(",") if o.strip()] or [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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

@app.post("/api/auth/cambiar-password", status_code=204)
def cambiar_password(
    datos: schemas.CambiarPassword,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    if not auth.verificar_password(datos.password_actual, usuario.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta")
    if datos.password_actual == datos.password_nueva:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe ser diferente")
    usuario.password_hash = auth.hash_password(datos.password_nueva)
    db.commit()

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
    existe = (
        db.query(models.Tarjeta)
        .filter(
            models.Tarjeta.usuario_id == usuario.id,
            func.lower(models.Tarjeta.nombre) == tarjeta.nombre.lower(),
        )
        .first()
    )
    if existe:
        raise HTTPException(status_code=400, detail="Ya tienes una tarjeta con ese nombre")

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
        existe = (
            db.query(models.Tarjeta)
            .filter(
                models.Tarjeta.usuario_id == usuario.id,
                models.Tarjeta.id != tarjeta_id,
                func.lower(models.Tarjeta.nombre) == payload.nombre.lower(),
            )
            .first()
        )
        if existe:
            raise HTTPException(status_code=400, detail="Ya tienes una tarjeta con ese nombre")
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
    categoria: str | None = None,
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
    if categoria is not None:
        query = query.filter(models.Gasto.categoria == categoria)
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
@app.put("/api/gastos/{gasto_id}", response_model=schemas.Gasto)
def actualizar_gasto(
    gasto_id: int,
    payload: schemas.GastoUpdate,
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

    # Si cambia la tarjeta, verificar que sea suya
    if payload.tarjeta_id is not None and payload.tarjeta_id != gasto.tarjeta_id:
        tarjeta_del_usuario(db, payload.tarjeta_id, usuario)
        gasto.tarjeta_id = payload.tarjeta_id

    if payload.fecha is not None:
        gasto.fecha = payload.fecha
    if payload.monto is not None:
        gasto.monto = payload.monto
    if payload.descripcion is not None:
        gasto.descripcion = payload.descripcion
    if payload.categoria is not None:
        gasto.categoria = payload.categoria

    db.commit()
    db.refresh(gasto)
    return gasto

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
    categoria: str | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    if hasta < desde:
        raise HTTPException(status_code=400, detail="El rango de fechas es inválido")

    query = (
        db.query(models.Gasto)
        .join(models.Tarjeta)
        .filter(
            models.Tarjeta.usuario_id == usuario.id,
            models.Gasto.fecha >= desde,
            models.Gasto.fecha <= hasta,
        )
    )
    if categoria is not None:
        query = query.filter(models.Gasto.categoria == categoria)

    gastos = query.order_by(models.Gasto.fecha).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Fecha", "Tarjeta", "Monto", "Categoria", "Descripcion"])
    for g in gastos:
        writer.writerow([
            g.fecha.isoformat(),
            g.tarjeta.nombre if g.tarjeta else "",
            f"{g.monto:.2f}",
            g.categoria or "",
            g.descripcion or "",
        ])
    total = sum((g.monto for g in gastos), Decimal("0"))
    writer.writerow([])
    writer.writerow(["Total", "", f"{total:.2f}", "", ""])
    buffer.seek(0)

    sufijo = f"_{categoria}" if categoria else ""
    nombre_archivo = f"gastos{sufijo}_{desde.isoformat()}_a_{hasta.isoformat()}.csv"
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

@app.post("/api/grupos/unirse", response_model=schemas.GrupoOut)
def unirse_grupo(
    codigo: str,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    codigo = codigo.strip()
    if not codigo:
        raise HTTPException(status_code=400, detail="Ingresa un código de invitación")

    grupo = db.query(models.Grupo).filter(models.Grupo.codigo_invitacion == codigo).first()
    if not grupo:
        raise HTTPException(status_code=404, detail="Código inválido")

    # Verificar que no sea ya miembro
    existe = db.query(models.MiembroGrupo).filter(
        models.MiembroGrupo.grupo_id == grupo.id,
        models.MiembroGrupo.usuario_id == usuario.id,
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail="Ya eres miembro de este grupo")

    nuevo_miembro = models.MiembroGrupo(
        grupo_id=grupo.id,
        usuario_id=usuario.id,
        rol="miembro",
    )
    db.add(nuevo_miembro)
    db.commit()
    db.refresh(grupo)
    return grupo

@app.get("/api/grupos", response_model=list[schemas.GrupoOut])
def listar_grupos(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    return db.query(models.Grupo).join(models.MiembroGrupo).filter(
        models.MiembroGrupo.usuario_id == usuario.id
    ).all()

@app.post("/api/gastos-compartidos", response_model=schemas.GastoCompartidoOut)
def crear_gasto_compartido(
    datos: schemas.GastoCompartidoCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    # Verificar que el usuario es miembro del grupo
    miembro = db.query(models.MiembroGrupo).filter(
        models.MiembroGrupo.grupo_id == datos.grupo_id,
        models.MiembroGrupo.usuario_id == usuario.id,
    ).first()
    if not miembro:
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")

    ids_miembros = {
        m[0] for m in db.query(models.MiembroGrupo.usuario_id).filter(
            models.MiembroGrupo.grupo_id == datos.grupo_id
        ).all()
    }

    # Si no se especifican divisiones, se reparte equitativamente entre todos los miembros,
    # repartiendo el resto en centavos para que la suma cuadre exacto con el monto total.
    if datos.divisiones is None:
        ids = sorted(ids_miembros)
        n = len(ids)
        total_centavos = int((datos.monto * 100).to_integral_value())
        base_centavos = total_centavos // n
        resto_centavos = total_centavos - base_centavos * n
        divisiones = [
            (uid, Decimal(base_centavos + (1 if i < resto_centavos else 0)) / 100)
            for i, uid in enumerate(ids)
        ]
    else:
        divisiones = datos.divisiones
        ids_division = {uid for uid, _ in divisiones}
        ids_ajenos = ids_division - ids_miembros
        if ids_ajenos:
            raise HTTPException(
                status_code=400,
                detail="Una o más divisiones incluyen usuarios que no son miembros de este grupo",
            )
        total_division = sum(m for _, m in divisiones)
        if total_division != datos.monto:
            raise HTTPException(status_code=400, detail="La suma de las divisiones no coincide con el monto total")

    # Crear el gasto
    nuevo_gasto = models.GastoCompartido(
        grupo_id=datos.grupo_id,
        pagado_por_id=usuario.id,
        fecha=datos.fecha,
        monto=datos.monto,
        descripcion=datos.descripcion,
        categoria=datos.categoria,
    )
    db.add(nuevo_gasto)
    db.flush()

    # Crear las divisiones
    for uid, monto in divisiones:
        div = models.DivisionGasto(
            gasto_compartido_id=nuevo_gasto.id,
            usuario_id=uid,
            monto=monto,
            pagado=0,
        )
        db.add(div)

    db.commit()
    db.refresh(nuevo_gasto)
    return nuevo_gasto

@app.get("/api/grupos/{grupo_id}/saldos", response_model=list[schemas.SaldoUsuario])
def saldos_grupo(
    grupo_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    # Verificar membresía
    miembro = db.query(models.MiembroGrupo).filter(
        models.MiembroGrupo.grupo_id == grupo_id,
        models.MiembroGrupo.usuario_id == usuario.id,
    ).first()
    if not miembro:
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")

    # Obtener todos los miembros del grupo
    miembros = db.query(models.Usuario).join(models.MiembroGrupo).filter(
        models.MiembroGrupo.grupo_id == grupo_id
    ).all()

    saldos = {}
    for m in miembros:
        # Total que ha pagado (crédito a favor)
        pagado = db.query(func.coalesce(func.sum(models.GastoCompartido.monto), 0)).filter(
            models.GastoCompartido.grupo_id == grupo_id,
            models.GastoCompartido.pagado_por_id == m.id,
        ).scalar()

        # Total que debe (sus divisiones)
        debe = db.query(func.coalesce(func.sum(models.DivisionGasto.monto), 0)).join(
            models.GastoCompartido
        ).filter(
            models.GastoCompartido.grupo_id == grupo_id,
            models.DivisionGasto.usuario_id == m.id,
        ).scalar()

        # Saldo = pagado - debe (positivo = le deben, negativo = debe)
        saldo = Decimal(pagado) - Decimal(debe)
        saldos[m.id] = {
            "usuario_id": m.id,
            "nombre": m.nombre,
            "debe": saldo,  # si es positivo, le deben; si es negativo, debe
        }

    return list(saldos.values())

@app.get("/api/grupos/{grupo_id}/resumen", response_model=schemas.GrupoResumenMensual)
def resumen_grupo(
    grupo_id: int,
    anio: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    verificar_miembro(db, grupo_id, usuario.id)

    grupo = db.query(models.Grupo).get(grupo_id)
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    hoy = date.today()
    anio = anio or hoy.year
    mes = mes or hoy.month

    total_mes = (
        db.query(func.coalesce(func.sum(models.GastoCompartido.monto), 0))
        .filter(models.GastoCompartido.grupo_id == grupo_id)
        .filter(extract("year", models.GastoCompartido.fecha) == anio)
        .filter(extract("month", models.GastoCompartido.fecha) == mes)
        .scalar()
    )
    total_mes = Decimal(total_mes)
    limite = Decimal(grupo.limite_mensual)
    porcentaje = float(total_mes / limite * 100) if limite > 0 else 0.0

    return schemas.GrupoResumenMensual(
        grupo_id=grupo_id,
        anio=anio,
        mes=mes,
        total_mes=total_mes,
        limite=limite,
        porcentaje=round(porcentaje, 1),
        en_rojo=total_mes > limite,
    )


@app.put("/api/grupos/{grupo_id}/limite", response_model=schemas.GrupoOut)
def actualizar_limite_grupo(
    grupo_id: int,
    payload: schemas.GrupoUpdateLimite,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    grupo = db.query(models.Grupo).get(grupo_id)
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    verificar_miembro(db, grupo_id, usuario.id)

    # Solo el creador puede cambiar el límite
    if grupo.creado_por_id != usuario.id:
        raise HTTPException(status_code=403, detail="Solo quien creó el grupo puede cambiar el límite")

    grupo.limite_mensual = payload.limite_mensual
    db.commit()
    db.refresh(grupo)
    return grupo

@app.get("/api/grupos/{grupo_id}/resumen-categorias", response_model=list[schemas.ResumenCategoria])
def resumen_categorias_grupo(
    grupo_id: int,
    anio: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    verificar_miembro(db, grupo_id, usuario.id)

    hoy = date.today()
    anio = anio or hoy.year
    mes = mes or hoy.month

    filas = (
        db.query(
            models.GastoCompartido.categoria,
            func.coalesce(func.sum(models.GastoCompartido.monto), 0).label("total"),
        )
        .filter(models.GastoCompartido.grupo_id == grupo_id)
        .filter(extract("year", models.GastoCompartido.fecha) == anio)
        .filter(extract("month", models.GastoCompartido.fecha) == mes)
        .group_by(models.GastoCompartido.categoria)
        .all()
    )

    total_general = sum((Decimal(t) for _, t in filas), Decimal("0")) or Decimal("1")

    resumen = [
        schemas.ResumenCategoria(
            categoria=cat or "Sin categoría",
            total=Decimal(t),
            porcentaje=round(float(Decimal(t) / total_general * 100), 1),
        )
        for cat, t in filas
    ]
    resumen.sort(key=lambda r: r.total, reverse=True)
    return resumen

def verificar_miembro(db: Session, grupo_id: int, usuario_id: int) -> models.MiembroGrupo:
    miembro = db.query(models.MiembroGrupo).filter(
        models.MiembroGrupo.grupo_id == grupo_id,
        models.MiembroGrupo.usuario_id == usuario_id,
    ).first()
    if not miembro:
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")
    return miembro

@app.get("/api/grupos/{grupo_id}/gastos", response_model=list[schemas.GastoCompartidoOut])
def listar_gastos_grupo(
    grupo_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    verificar_miembro(db, grupo_id, usuario.id)
    return (
        db.query(models.GastoCompartido)
        .filter(models.GastoCompartido.grupo_id == grupo_id)
        .order_by(models.GastoCompartido.fecha.desc())
        .all()
    )

@app.delete("/api/grupos/{grupo_id}/gastos/{gasto_id}", status_code=204)
def eliminar_gasto_compartido(
    grupo_id: int,
    gasto_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    verificar_miembro(db, grupo_id, usuario.id)

    gasto = (
        db.query(models.GastoCompartido)
        .filter(
            models.GastoCompartido.id == gasto_id,
            models.GastoCompartido.grupo_id == grupo_id,
        )
        .first()
    )
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    db.delete(gasto)  # cascade borra las divisiones
    db.commit()

@app.put("/api/grupos/{grupo_id}/gastos/{gasto_id}", response_model=schemas.GastoCompartidoOut)
def actualizar_gasto_compartido(
    grupo_id: int,
    gasto_id: int,
    payload: schemas.GastoCompartidoUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    verificar_miembro(db, grupo_id, usuario.id)

    gasto = (
        db.query(models.GastoCompartido)
        .filter(
            models.GastoCompartido.id == gasto_id,
            models.GastoCompartido.grupo_id == grupo_id,
        )
        .first()
    )
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    # Si cambia el monto, recalculamos las divisiones equitativamente
    if payload.monto is not None and payload.monto != gasto.monto:
        nuevo_monto = payload.monto
        divisiones = gasto.divisiones
        n = len(divisiones)
        if n == 0:
            raise HTTPException(status_code=400, detail="El gasto no tiene divisiones")

        total_centavos = int((nuevo_monto * 100).to_integral_value())
        base_centavos = total_centavos // n
        resto_centavos = total_centavos - base_centavos * n

        for i, div in enumerate(divisiones):
            centavos = base_centavos + (1 if i < resto_centavos else 0)
            div.monto = Decimal(centavos) / 100

        gasto.monto = nuevo_monto

    if payload.fecha is not None:
        gasto.fecha = payload.fecha
    if payload.descripcion is not None:
        gasto.descripcion = payload.descripcion
    if payload.categoria is not None:
        gasto.categoria = payload.categoria

    db.commit()
    db.refresh(gasto)
    return gasto

@app.patch("/api/divisiones/{division_id}/pagar", response_model=schemas.DivisionGastoOut)
def marcar_division_pagada(
    division_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    division = db.query(models.DivisionGasto).get(division_id)
    if not division:
        raise HTTPException(status_code=404, detail="División no encontrada")

    gasto = db.query(models.GastoCompartido).get(division.gasto_compartido_id)
    verificar_miembro(db, gasto.grupo_id, usuario.id)

    # Solo quien debe, o quien pagó el gasto originalmente, puede marcarlo como saldado.
    if usuario.id not in (division.usuario_id, gasto.pagado_por_id):
        raise HTTPException(status_code=403, detail="No puedes modificar esta división")

    division.pagado = 1
    db.commit()
    db.refresh(division)
    return division


@app.post("/api/grupos/{grupo_id}/salir", status_code=204)
def salir_de_grupo(
    grupo_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    grupo = db.query(models.Grupo).get(grupo_id)
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    miembro = verificar_miembro(db, grupo_id, usuario.id)

    if grupo.creado_por_id == usuario.id:
        raise HTTPException(
            status_code=400,
            detail="Eres quien creó el grupo; si ya no lo necesitas, elimínalo en vez de salir",
        )

    # Si tiene saldos pendientes (le deben o debe), avisamos antes de dejarlo salir.
    debe_o_le_deben = (
        db.query(models.DivisionGasto)
        .join(models.GastoCompartido)
        .filter(
            models.GastoCompartido.grupo_id == grupo_id,
            models.DivisionGasto.usuario_id == usuario.id,
            models.DivisionGasto.pagado == 0,
        )
        .first()
    )
    if debe_o_le_deben:
        raise HTTPException(
            status_code=400,
            detail="Tienes divisiones pendientes de pago en este grupo; salda tus cuentas antes de salir",
        )

    db.delete(miembro)
    db.commit()


@app.delete("/api/grupos/{grupo_id}", status_code=204)
def eliminar_grupo(
    grupo_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    grupo = db.query(models.Grupo).get(grupo_id)
    if not grupo:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if grupo.creado_por_id != usuario.id:
        raise HTTPException(status_code=403, detail="Solo quien creó el grupo puede eliminarlo")

    db.delete(grupo)  # cascada: borra miembros, gastos compartidos y sus divisiones
    db.commit()

# ---------- Resumen por categoría ----------

@app.get("/api/categorias", response_model=schemas.CategoriasDisponibles)
def listar_categorias():
    """Devuelve las categorías válidas para que el frontend las use."""
    return schemas.CategoriasDisponibles(categorias=schemas.CATEGORIAS_VALIDAS)


@app.get("/api/resumen/categorias", response_model=list[schemas.ResumenCategoria])
def resumen_por_categoria(
    anio: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    hoy = date.today()
    anio = anio or hoy.year
    mes = mes or hoy.month

    filas = (
        db.query(
            models.Gasto.categoria,
            func.coalesce(func.sum(models.Gasto.monto), 0).label("total"),
        )
        .join(models.Tarjeta)
        .filter(models.Tarjeta.usuario_id == usuario.id)
        .filter(extract("year", models.Gasto.fecha) == anio)
        .filter(extract("month", models.Gasto.fecha) == mes)
        .group_by(models.Gasto.categoria)
        .all()
    )

    total_general = sum((Decimal(t) for _, t in filas), Decimal("0")) or Decimal("1")

    resumen = [
        schemas.ResumenCategoria(
            categoria=cat or "Sin categoría",
            total=Decimal(t),
            porcentaje=round(float(Decimal(t) / total_general * 100), 1),
        )
        for cat, t in filas
    ]
    # Ordenar de mayor a menor
    resumen.sort(key=lambda r: r.total, reverse=True)
    return resumen
