import calendar
import csv
import io
import os
import secrets as secrets_module
import resend
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import FastAPI, Depends, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

import auth
import models
import schemas
import zipfile
from database import get_db


LIMITE_MENSUAL = Decimal("350")

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@vectoraec.app")
CRON_API_KEY = os.getenv("CRON_API_KEY")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def enviar_email_reset(destinatario: str, nombre: str, token: str) -> bool:
    if not RESEND_API_KEY:
        print("⚠️ RESEND_API_KEY no configurada. No se envía email.")
        return False

    enlace = f"{FRONTEND_URL}/reset?token={token}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px;">
      <h2 style="color: #FF4F40;">Restablece tu contraseña</h2>
      <p>Hola {nombre},</p>
      <p>Recibimos una solicitud para restablecer tu contraseña en <strong>Control de gastos</strong>.</p>
      <p>Haz clic en el siguiente botón para crear una nueva contraseña:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{enlace}" 
           style="background: #FF4F40; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 8px; font-weight: bold;">
          Restablecer contraseña
        </a>
      </p>
      <p style="font-size: 13px; color: #666;">
        O copia este enlace en tu navegador:<br>
        <a href="{enlace}">{enlace}</a>
      </p>
      <p style="font-size: 13px; color: #666;">
        Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="font-size: 11px; color: #999; text-align: center;">
        Control de gastos · Tus finanzas, sin depender de nadie más.
      </p>
    </div>
    """

    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": [destinatario],
            "subject": "Restablece tu contraseña - Control de gastos",
            "html": html,
        })
        return True
    except Exception as e:
        print(f"✗ Error enviando email: {e}")
        return False

app = FastAPI(title="API Finanzas Personales")


@app.exception_handler(RequestValidationError)
async def manejar_error_validacion(request: Request, exc: RequestValidationError):
    errores = exc.errors()
    if errores:
        primero = errores[0]
        campo = primero["loc"][-1] if primero["loc"] else "dato"
        mensaje = primero["msg"].removeprefix("Value error, ")
        detalle = f"{campo}: {mensaje}"
    else:
        detalle = "Datos inválidos"
    return JSONResponse(status_code=422, content={"detail": detalle})


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
    tarjeta = (
        db.query(models.Tarjeta)
        .filter(models.Tarjeta.id == tarjeta_id, models.Tarjeta.usuario_id == usuario.id)
        .first()
    )
    if not tarjeta:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    return tarjeta


# ============================================================
# HELPERS DE SALDO
# ============================================================

def _abonos_netos_cuenta(db: Session, cuenta_id: int) -> Decimal:
    salidas = (
        db.query(func.coalesce(func.sum(models.AbonoDeuda.monto), 0))
        .join(models.Deuda, models.AbonoDeuda.deuda_id == models.Deuda.id)
        .filter(models.AbonoDeuda.cuenta_id == cuenta_id, models.Deuda.tipo == "debo")
        .scalar()
    )
    entradas = (
        db.query(func.coalesce(func.sum(models.AbonoDeuda.monto), 0))
        .join(models.Deuda, models.AbonoDeuda.deuda_id == models.Deuda.id)
        .filter(models.AbonoDeuda.cuenta_id == cuenta_id, models.Deuda.tipo == "me_deben")
        .scalar()
    )
    return Decimal(entradas) - Decimal(salidas)


def _egresos_directos_cuenta(db: Session, cuenta_id: int) -> Decimal:
    total = (
        db.query(func.coalesce(func.sum(models.EgresoCuenta.monto), 0))
        .filter(models.EgresoCuenta.cuenta_id == cuenta_id)
        .scalar()
    )
    return Decimal(total)


def _gastos_debito_cuenta(db: Session, cuenta_id: int) -> Decimal:
    total = (
        db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
        .join(models.Tarjeta, models.Gasto.tarjeta_id == models.Tarjeta.id)
        .filter(
            models.Tarjeta.cuenta_id == cuenta_id,
            models.Tarjeta.tipo == "debito",
        )
        .scalar()
    )
    return Decimal(total)


def _calcular_saldo_cuenta(db: Session, cuenta: models.Cuenta) -> Decimal:
    ingresos = (
        db.query(func.coalesce(func.sum(models.Ingreso.monto), 0))
        .filter(models.Ingreso.cuenta_id == cuenta.id)
        .scalar()
    )
    pagos = (
        db.query(func.coalesce(func.sum(models.PagoTarjeta.monto), 0))
        .filter(models.PagoTarjeta.cuenta_id == cuenta.id)
        .scalar()
    )
    return (
        Decimal(cuenta.saldo_inicial)
        + Decimal(ingresos)
        - Decimal(pagos)
        + _abonos_netos_cuenta(db, cuenta.id)
        - _egresos_directos_cuenta(db, cuenta.id)
        - _gastos_debito_cuenta(db, cuenta.id)
    )


# ============================================================
# AUTENTICACIÓN
# ============================================================

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


@app.post("/api/auth/solicitar-reset")
def solicitar_reset(datos: schemas.SolicitarReset, db: Session = Depends(get_db)):
    email = datos.email.lower()
    usuario = db.query(models.Usuario).filter(models.Usuario.email == email).first()

    if not usuario:
        return {"ok": True, "mensaje": "Si el correo existe, te enviamos un enlace."}

    db.query(models.PasswordReset).filter(
        models.PasswordReset.usuario_id == usuario.id,
        models.PasswordReset.usado == 0,
    ).update({models.PasswordReset.usado: 1})

    token = secrets_module.token_urlsafe(32)
    expira = datetime.now(timezone.utc) + timedelta(hours=1)

    nuevo = models.PasswordReset(
        usuario_id=usuario.id,
        token=token,
        expira_en=expira,
        usado=0,
    )
    db.add(nuevo)
    db.commit()

    enviado = enviar_email_reset(usuario.email, usuario.nombre, token)

    return {"ok": True, "mensaje": "Si el correo existe, te enviamos un enlace.", "email_enviado": enviado}


@app.post("/api/auth/reset-password", status_code=204)
def reset_password(datos: schemas.ResetPassword, db: Session = Depends(get_db)):
    reset = (
        db.query(models.PasswordReset)
        .filter(models.PasswordReset.token == datos.token)
        .filter(models.PasswordReset.usado == 0)
        .first()
    )
    if not reset:
        raise HTTPException(status_code=400, detail="Enlace inválido o ya utilizado. Solicita uno nuevo.")

    ahora = datetime.now(timezone.utc)
    expira = reset.expira_en
    if expira.tzinfo is None:
        expira = expira.replace(tzinfo=timezone.utc)
    if expira < ahora:
        raise HTTPException(status_code=400, detail="El enlace expiró. Solicita uno nuevo.")

    usuario = db.query(models.Usuario).get(reset.usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.password_hash = auth.hash_password(datos.password_nueva)
    reset.usado = 1
    db.commit()


@app.get("/api/auth/yo", response_model=schemas.UsuarioOut)
def yo(usuario: models.Usuario = Depends(auth.obtener_usuario_actual)):
    return usuario


# ============================================================
# CUENTAS
# ============================================================

@app.get("/api/cuentas", response_model=list[schemas.Cuenta])
def listar_cuentas(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    cuentas = (
        db.query(models.Cuenta)
        .filter(models.Cuenta.usuario_id == usuario.id)
        .order_by(models.Cuenta.fijada.desc(), models.Cuenta.id.asc())
        .all()
    )
    resultado = []
    for c in cuentas:
        ingresos = (
            db.query(func.coalesce(func.sum(models.Ingreso.monto), 0))
            .filter(models.Ingreso.cuenta_id == c.id)
            .scalar()
        )
        pagos = (
            db.query(func.coalesce(func.sum(models.PagoTarjeta.monto), 0))
            .filter(models.PagoTarjeta.cuenta_id == c.id)
            .scalar()
        )
        saldo_actual = (
            Decimal(c.saldo_inicial)
            + Decimal(ingresos)
            - Decimal(pagos)
            + _abonos_netos_cuenta(db, c.id)
            - _egresos_directos_cuenta(db, c.id)
            - _gastos_debito_cuenta(db, c.id)
        )
        c.total_ingresos = Decimal(ingresos)
        c.saldo_actual = saldo_actual
        resultado.append(c)
    return resultado


@app.post("/api/cuentas", response_model=schemas.Cuenta)
def crear_cuenta(
    cuenta: schemas.CuentaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    existe = (
        db.query(models.Cuenta)
        .filter(
            models.Cuenta.usuario_id == usuario.id,
            func.lower(models.Cuenta.nombre) == cuenta.nombre.lower(),
        )
        .first()
    )
    if existe:
        raise HTTPException(status_code=400, detail="Ya tienes una cuenta con ese nombre")

    nueva = models.Cuenta(**cuenta.model_dump(), usuario_id=usuario.id)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@app.put("/api/cuentas/{cuenta_id}", response_model=schemas.Cuenta)
def actualizar_cuenta(
    cuenta_id: int,
    payload: schemas.CuentaUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    cuenta = (
        db.query(models.Cuenta)
        .filter(models.Cuenta.id == cuenta_id, models.Cuenta.usuario_id == usuario.id)
        .first()
    )
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    if payload.nombre is not None:
        cuenta.nombre = payload.nombre
    if payload.titular is not None:
        cuenta.titular = payload.titular
    if payload.tipo is not None:
        cuenta.tipo = payload.tipo
    if payload.saldo_inicial is not None:
        cuenta.saldo_inicial = payload.saldo_inicial
    if payload.fijada is not None:
        cuenta.fijada = 1 if payload.fijada else 0
    if payload.numero_cuenta is not None:
        cuenta.numero_cuenta = payload.numero_cuenta

    db.commit()
    db.refresh(cuenta)
    return cuenta


@app.delete("/api/cuentas/{cuenta_id}", status_code=204)
def eliminar_cuenta(
    cuenta_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    cuenta = (
        db.query(models.Cuenta)
        .filter(models.Cuenta.id == cuenta_id, models.Cuenta.usuario_id == usuario.id)
        .first()
    )
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    if db.query(models.Ingreso).filter(models.Ingreso.cuenta_id == cuenta_id).first():
        raise HTTPException(
            status_code=400,
            detail=f"No puedes eliminar '{cuenta.nombre}' porque tiene ingresos registrados. Elimina primero los ingresos o muévelos a otra cuenta.",
        )

    if db.query(models.PagoTarjeta).filter(models.PagoTarjeta.cuenta_id == cuenta_id).first():
        raise HTTPException(
            status_code=400,
            detail=f"No puedes eliminar '{cuenta.nombre}' porque tiene pagos de tarjeta registrados. Elimínalos primero desde la sección Pagos.",
        )

    if db.query(models.Tarjeta).filter(models.Tarjeta.cuenta_id == cuenta_id).first():
        raise HTTPException(
            status_code=400,
            detail=f"No puedes eliminar '{cuenta.nombre}' porque tiene tarjetas de débito asociadas.",
        )

    db.delete(cuenta)
    db.commit()


@app.get("/api/cuentas/resumen-total")
def resumen_total_cuentas(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    cuentas = db.query(models.Cuenta).filter(models.Cuenta.usuario_id == usuario.id).all()
    total = Decimal("0")
    for c in cuentas:
        ingresos = (
            db.query(func.coalesce(func.sum(models.Ingreso.monto), 0))
            .filter(models.Ingreso.cuenta_id == c.id)
            .scalar()
        )
        pagos = (
            db.query(func.coalesce(func.sum(models.PagoTarjeta.monto), 0))
            .filter(models.PagoTarjeta.cuenta_id == c.id)
            .scalar()
        )
        total += (
            Decimal(c.saldo_inicial)
            + Decimal(ingresos)
            - Decimal(pagos)
            + _abonos_netos_cuenta(db, c.id)
            - _egresos_directos_cuenta(db, c.id)
            - _gastos_debito_cuenta(db, c.id)
        )
    return {"total": float(total), "cantidad_cuentas": len(cuentas)}


@app.get("/api/cuentas/{cuenta_id}/movimientos", response_model=list[schemas.MovimientoCuenta])
def movimientos_cuenta(
    cuenta_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    cuenta = (
        db.query(models.Cuenta)
        .filter(models.Cuenta.id == cuenta_id, models.Cuenta.usuario_id == usuario.id)
        .first()
    )
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    movimientos = []

    # 1. Ingresos
    for i in db.query(models.Ingreso).filter(models.Ingreso.cuenta_id == cuenta_id).all():
        movimientos.append(schemas.MovimientoCuenta(
            tipo="ingreso",
            monto=Decimal(i.monto),
            fecha=i.fecha,
            descripcion=i.descripcion or i.categoria or "Ingreso",
            referencia_id=i.id,
        ))

    # 2. Pagos de tarjeta de crédito
    for p in db.query(models.PagoTarjeta).filter(models.PagoTarjeta.cuenta_id == cuenta_id).all():
        tarjeta = db.query(models.Tarjeta).get(p.tarjeta_id)
        movimientos.append(schemas.MovimientoCuenta(
            tipo="pago_tarjeta",
            monto=-Decimal(p.monto),
            fecha=p.fecha_pago,
            descripcion=f"Pago a {tarjeta.nombre if tarjeta else 'tarjeta'}",
            referencia_id=p.id,
            referencia_nombre=tarjeta.nombre if tarjeta else None,
        ))

    # 3. Movimientos de potes
    potes = db.query(models.Pote).filter(models.Pote.cuenta_id == cuenta_id).all()
    pote_ids = [p.id for p in potes]
    if pote_ids:
        for mp in db.query(models.MovimientoPote).filter(models.MovimientoPote.pote_id.in_(pote_ids)).all():
            pote = next((p for p in potes if p.id == mp.pote_id), None)
            movimientos.append(schemas.MovimientoCuenta(
                tipo="deposito_pote" if Decimal(mp.monto) > 0 else "retiro_pote",
                monto=-Decimal(mp.monto),
                fecha=mp.fecha,
                descripcion=f"{'Depósito a' if Decimal(mp.monto) > 0 else 'Retiro de'} {pote.emoji} {pote.nombre}" if pote else "Movimiento de pote",
                referencia_id=mp.pote_id,
                referencia_nombre=pote.nombre if pote else None,
            ))

    # 4. Abonos de deudas
    for abono, deuda in (
        db.query(models.AbonoDeuda, models.Deuda)
        .join(models.Deuda, models.AbonoDeuda.deuda_id == models.Deuda.id)
        .filter(models.AbonoDeuda.cuenta_id == cuenta_id)
        .all()
    ):
        es_salida = deuda.tipo == "debo"
        movimientos.append(schemas.MovimientoCuenta(
            tipo="abono_deuda",
            monto=-Decimal(abono.monto) if es_salida else Decimal(abono.monto),
            fecha=abono.fecha,
            descripcion=f"Abono a {deuda.persona}" if es_salida else f"Cobro de {deuda.persona}",
            referencia_id=abono.id,
            referencia_nombre=deuda.persona,
        ))

    # 5. Egresos directos
    for e in db.query(models.EgresoCuenta).filter(models.EgresoCuenta.cuenta_id == cuenta_id).all():
        movimientos.append(schemas.MovimientoCuenta(
            tipo="egreso_cuenta",
            monto=-Decimal(e.monto),
            fecha=e.fecha,
            descripcion=e.descripcion or e.categoria or "Gasto directo",
            referencia_id=e.id,
        ))

    # 6. Gastos con tarjetas de débito asociadas a esta cuenta
    for gasto, tarjeta in (
        db.query(models.Gasto, models.Tarjeta)
        .join(models.Tarjeta, models.Gasto.tarjeta_id == models.Tarjeta.id)
        .filter(
            models.Tarjeta.cuenta_id == cuenta_id,
            models.Tarjeta.tipo == "debito",
        )
        .all()
    ):
        movimientos.append(schemas.MovimientoCuenta(
            tipo="gasto_debito",
            monto=-Decimal(gasto.monto),
            fecha=gasto.fecha,
            descripcion=gasto.descripcion or f"Gasto con {tarjeta.nombre}",
            referencia_id=gasto.id,
            referencia_nombre=tarjeta.nombre,
        ))

    movimientos.sort(key=lambda m: m.fecha, reverse=True)
    return movimientos


# ============================================================
# PAGOS DE TARJETAS
# ============================================================

def _calcular_estado_pago(db: Session, tarjeta: models.Tarjeta, anio: int, mes: int):
    total_gastos = (
        db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
        .filter(models.Gasto.tarjeta_id == tarjeta.id)
        .filter(extract("year", models.Gasto.fecha) == anio)
        .filter(extract("month", models.Gasto.fecha) == mes)
        .scalar()
    )
    total_gastos = Decimal(total_gastos)

    total_pagado = (
        db.query(func.coalesce(func.sum(models.PagoTarjeta.monto), 0))
        .filter(models.PagoTarjeta.tarjeta_id == tarjeta.id)
        .filter(models.PagoTarjeta.anio_cerrado == anio)
        .filter(models.PagoTarjeta.mes_cerrado == mes)
        .scalar()
    )
    total_pagado = Decimal(total_pagado)

    pendiente = total_gastos - total_pagado
    if pendiente < 0:
        pendiente = Decimal("0")

    cerrado = total_gastos > 0 and total_pagado >= total_gastos
    porcentaje = float(total_pagado / total_gastos * 100) if total_gastos > 0 else 0.0

    return {
        "total_gastos": total_gastos,
        "total_pagado": total_pagado,
        "pendiente": pendiente,
        "cerrado": cerrado,
        "porcentaje": round(porcentaje, 1),
    }


@app.get("/api/tarjetas/{tarjeta_id}/estado-pago", response_model=schemas.EstadoPagoTarjeta)
def estado_pago_tarjeta(
    tarjeta_id: int,
    anio: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    tarjeta = tarjeta_del_usuario(db, tarjeta_id, usuario)
    hoy = date.today()
    anio = anio or hoy.year
    mes = mes or hoy.month
    estado = _calcular_estado_pago(db, tarjeta, anio, mes)
    return schemas.EstadoPagoTarjeta(
        tarjeta_id=tarjeta.id,
        tarjeta_nombre=tarjeta.nombre,
        anio=anio,
        mes=mes,
        total_gastos=estado["total_gastos"],
        total_pagado=estado["total_pagado"],
        pendiente=estado["pendiente"],
        cerrado=estado["cerrado"],
        porcentaje_pagado=estado["porcentaje"],
    )


@app.get("/api/alertas", response_model=list[schemas.Alerta])
def obtener_alertas(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    hoy = date.today()
    primer_dia_mes_actual = date(hoy.year, hoy.month, 1)
    tarjetas = db.query(models.Tarjeta).filter(models.Tarjeta.usuario_id == usuario.id).all()

    alertas = []
    for t in tarjetas:
        # Saltar tarjetas de débito (no tienen corte)
        if t.tipo == "debito":
            continue

        dias = dias_para_corte(t.dia_corte, hoy)
        if 0 <= dias <= 3:
            texto_dias = "hoy" if dias == 0 else f"en {dias} día{'s' if dias != 1 else ''}"
            alertas.append(schemas.Alerta(
                tipo="corte_proximo",
                tarjeta_id=t.id,
                tarjeta_nombre=t.nombre,
                dias=dias,
                monto=None,
                mensaje=f"{t.nombre} cierra {texto_dias}",
            ))

        pendiente_atrasado = (
            db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
            .filter(
                models.Gasto.tarjeta_id == t.id,
                models.Gasto.pago_id.is_(None),
                models.Gasto.fecha < primer_dia_mes_actual,
            )
            .scalar()
        )
        pendiente_atrasado = Decimal(pendiente_atrasado)
        if pendiente_atrasado > 0:
            alertas.append(schemas.Alerta(
                tipo="pago_atrasado",
                tarjeta_id=t.id,
                tarjeta_nombre=t.nombre,
                dias=None,
                monto=pendiente_atrasado,
                mensaje=f"{t.nombre} tiene ${pendiente_atrasado:.2f} pendiente de meses anteriores",
            ))

    deudas = db.query(models.Deuda).filter(models.Deuda.usuario_id == usuario.id, models.Deuda.pagada == 0).all()
    for d in deudas:
        if not d.frecuencia_recordatorio_dias:
            continue
        ultimo_abono = (
            db.query(models.AbonoDeuda)
            .filter(models.AbonoDeuda.deuda_id == d.id)
            .order_by(models.AbonoDeuda.fecha.desc())
            .first()
        )
        fecha_referencia = ultimo_abono.fecha if ultimo_abono else d.creado_en.date()
        dias_desde = (hoy - fecha_referencia).days
        if dias_desde >= d.frecuencia_recordatorio_dias:
            if d.tipo == "debo":
                mensaje = f"No olvides: le debes a {d.persona} ${Decimal(d.saldo_pendiente):.2f}"
            else:
                mensaje = f"No olvides: {d.persona} te debe ${Decimal(d.saldo_pendiente):.2f}"
            alertas.append(schemas.Alerta(
                tipo="recordatorio_deuda",
                deuda_id=d.id,
                dias=dias_desde,
                monto=Decimal(d.saldo_pendiente),
                mensaje=mensaje,
            ))

    return alertas


@app.post("/api/pagos-tarjeta", response_model=schemas.PagoTarjetaOut)
def crear_pago_tarjeta(
    datos: schemas.PagoTarjetaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    tarjeta = tarjeta_del_usuario(db, datos.tarjeta_id, usuario)
    if tarjeta.tipo == "debito":
        raise HTTPException(status_code=400, detail="Las tarjetas de débito no se pagan")

    cuenta = (
        db.query(models.Cuenta)
        .filter(models.Cuenta.id == datos.cuenta_id, models.Cuenta.usuario_id == usuario.id)
        .first()
    )
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    saldo_actual = _calcular_saldo_cuenta(db, cuenta)
    if datos.monto > saldo_actual:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente en '{cuenta.nombre}'. Disponible: ${saldo_actual:.2f} · Intentas pagar: ${datos.monto:.2f}",
        )

    estado = _calcular_estado_pago(db, tarjeta, datos.anio, datos.mes)

    if estado["total_gastos"] == 0:
        raise HTTPException(status_code=400, detail="Esta tarjeta no tiene gastos en ese mes")
    if estado["cerrado"]:
        raise HTTPException(status_code=400, detail="Esta tarjeta ya está pagada para ese mes")
    if datos.monto > estado["pendiente"]:
        raise HTTPException(status_code=400, detail=f"El monto excede lo pendiente (${estado['pendiente']:.2f})")

    nuevo_pago = models.PagoTarjeta(
        usuario_id=usuario.id,
        tarjeta_id=tarjeta.id,
        cuenta_id=cuenta.id,
        monto=datos.monto,
        fecha_pago=datos.fecha_pago,
        mes_cerrado=datos.mes,
        anio_cerrado=datos.anio,
    )
    db.add(nuevo_pago)
    db.flush()

    nuevo_total_pagado = estado["total_pagado"] + datos.monto
    if nuevo_total_pagado >= estado["total_gastos"]:
        gastos_pendientes = (
            db.query(models.Gasto)
            .filter(models.Gasto.tarjeta_id == tarjeta.id)
            .filter(extract("year", models.Gasto.fecha) == datos.anio)
            .filter(extract("month", models.Gasto.fecha) == datos.mes)
            .filter(models.Gasto.pago_id.is_(None))
            .all()
        )
        for g in gastos_pendientes:
            g.pago_id = nuevo_pago.id

    db.commit()
    db.refresh(nuevo_pago)
    return nuevo_pago


@app.get("/api/pagos-tarjeta", response_model=list[schemas.PagoTarjetaOut])
def listar_pagos_tarjeta(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    return (
        db.query(models.PagoTarjeta)
        .filter(models.PagoTarjeta.usuario_id == usuario.id)
        .order_by(models.PagoTarjeta.fecha_pago.desc())
        .all()
    )


@app.delete("/api/pagos-tarjeta/{pago_id}", status_code=204)
def eliminar_pago_tarjeta(
    pago_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    pago = (
        db.query(models.PagoTarjeta)
        .filter(models.PagoTarjeta.id == pago_id, models.PagoTarjeta.usuario_id == usuario.id)
        .first()
    )
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    db.query(models.Gasto).filter(models.Gasto.pago_id == pago.id).update({models.Gasto.pago_id: None})
    db.delete(pago)
    db.commit()


# ============================================================
# INGRESOS
# ============================================================

@app.get("/api/ingresos", response_model=list[schemas.IngresoOut])
def listar_ingresos(
    anio: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    query = db.query(models.Ingreso).filter(models.Ingreso.usuario_id == usuario.id)
    if anio is not None:
        query = query.filter(extract("year", models.Ingreso.fecha) == anio)
    if mes is not None:
        query = query.filter(extract("month", models.Ingreso.fecha) == mes)
    return query.order_by(models.Ingreso.fecha.desc()).all()


@app.post("/api/ingresos", response_model=schemas.IngresoOut)
def crear_ingreso(
    datos: schemas.IngresoCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    cuenta = (
        db.query(models.Cuenta)
        .filter(models.Cuenta.id == datos.cuenta_id, models.Cuenta.usuario_id == usuario.id)
        .first()
    )
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    nuevo = models.Ingreso(**datos.model_dump(), usuario_id=usuario.id)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.put("/api/ingresos/{ingreso_id}", response_model=schemas.IngresoOut)
def actualizar_ingreso(
    ingreso_id: int,
    payload: schemas.IngresoUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    ingreso = (
        db.query(models.Ingreso)
        .filter(models.Ingreso.id == ingreso_id, models.Ingreso.usuario_id == usuario.id)
        .first()
    )
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")

    if payload.cuenta_id is not None:
        cuenta = (
            db.query(models.Cuenta)
            .filter(models.Cuenta.id == payload.cuenta_id, models.Cuenta.usuario_id == usuario.id)
            .first()
        )
        if not cuenta:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        ingreso.cuenta_id = payload.cuenta_id

    if payload.fecha is not None:
        ingreso.fecha = payload.fecha
    if payload.monto is not None:
        ingreso.monto = payload.monto
    if payload.descripcion is not None:
        ingreso.descripcion = payload.descripcion
    if payload.categoria is not None:
        ingreso.categoria = payload.categoria

    db.commit()
    db.refresh(ingreso)
    return ingreso


@app.delete("/api/ingresos/{ingreso_id}", status_code=204)
def eliminar_ingreso(
    ingreso_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    ingreso = (
        db.query(models.Ingreso)
        .filter(models.Ingreso.id == ingreso_id, models.Ingreso.usuario_id == usuario.id)
        .first()
    )
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")
    db.delete(ingreso)
    db.commit()


@app.get("/api/ingresos/resumen")
def resumen_ingresos(
    anio: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    hoy = date.today()
    anio = anio or hoy.year
    mes = mes or hoy.month
    total = (
        db.query(func.coalesce(func.sum(models.Ingreso.monto), 0))
        .filter(models.Ingreso.usuario_id == usuario.id)
        .filter(extract("year", models.Ingreso.fecha) == anio)
        .filter(extract("month", models.Ingreso.fecha) == mes)
        .scalar()
    )
    return {"anio": anio, "mes": mes, "total": float(Decimal(total))}


@app.get("/api/categorias-ingreso", response_model=schemas.CategoriasDisponibles)
def listar_categorias_ingreso():
    return schemas.CategoriasDisponibles(categorias=schemas.CATEGORIAS_INGRESO)


# ============================================================
# POTES
# ============================================================

def _pote_del_usuario(db: Session, pote_id: int, usuario: models.Usuario) -> models.Pote:
    pote = (
        db.query(models.Pote)
        .filter(models.Pote.id == pote_id, models.Pote.usuario_id == usuario.id)
        .first()
    )
    if not pote:
        raise HTTPException(status_code=404, detail="Pote no encontrado")
    return pote


@app.get("/api/emojis-pote", response_model=schemas.EmojisPoteDisponibles)
def listar_emojis_pote():
    return schemas.EmojisPoteDisponibles(emojis=schemas.EMOJIS_POTE_SUGERIDOS)


@app.get("/api/potes", response_model=list[schemas.PoteOut])
def listar_potes(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    return (
        db.query(models.Pote)
        .filter(models.Pote.usuario_id == usuario.id)
        .order_by(models.Pote.creado_en.desc())
        .all()
    )


@app.post("/api/potes", response_model=schemas.PoteOut)
def crear_pote(
    datos: schemas.PoteCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    cuenta = (
        db.query(models.Cuenta)
        .filter(models.Cuenta.id == datos.cuenta_id, models.Cuenta.usuario_id == usuario.id)
        .first()
    )
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    nuevo = models.Pote(
        usuario_id=usuario.id,
        cuenta_id=datos.cuenta_id,
        nombre=datos.nombre.strip(),
        emoji=datos.emoji,
        meta=datos.meta,
        saldo=Decimal("0"),
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.put("/api/potes/{pote_id}", response_model=schemas.PoteOut)
def actualizar_pote(
    pote_id: int,
    payload: schemas.PoteUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    pote = _pote_del_usuario(db, pote_id, usuario)
    if payload.nombre is not None:
        pote.nombre = payload.nombre.strip()
    if payload.emoji is not None:
        pote.emoji = payload.emoji
    if payload.meta is not None:
        pote.meta = payload.meta
    db.commit()
    db.refresh(pote)
    return pote


@app.delete("/api/potes/{pote_id}", status_code=204)
def eliminar_pote(
    pote_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    pote = _pote_del_usuario(db, pote_id, usuario)
    db.delete(pote)
    db.commit()


@app.post("/api/potes/{pote_id}/depositar", response_model=schemas.PoteOut)
def depositar_pote(
    pote_id: int,
    datos: schemas.MovimientoPoteCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    pote = _pote_del_usuario(db, pote_id, usuario)
    cuenta = db.query(models.Cuenta).get(pote.cuenta_id)
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta asociada no encontrada")

    saldo_cuenta = _calcular_saldo_cuenta(db, cuenta)
    total_en_potes = (
        db.query(func.coalesce(func.sum(models.Pote.saldo), 0))
        .filter(models.Pote.cuenta_id == cuenta.id)
        .filter(models.Pote.id != pote.id)
        .scalar()
    )
    saldo_disponible = saldo_cuenta - Decimal(total_en_potes)

    if datos.monto > saldo_disponible:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente en '{cuenta.nombre}'. Disponible: ${saldo_disponible:.2f} · Intentas depositar: ${datos.monto:.2f}",
        )

    pote.saldo = Decimal(pote.saldo) + datos.monto
    mov = models.MovimientoPote(
        pote_id=pote.id,
        monto=datos.monto,
        descripcion=datos.descripcion,
        fecha=datos.fecha,
    )
    db.add(mov)
    db.commit()
    db.refresh(pote)
    return pote


@app.post("/api/potes/{pote_id}/retirar", response_model=schemas.PoteOut)
def retirar_pote(
    pote_id: int,
    datos: schemas.MovimientoPoteCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    pote = _pote_del_usuario(db, pote_id, usuario)
    if datos.monto > Decimal(pote.saldo):
        raise HTTPException(
            status_code=400,
            detail=f"El pote solo tiene ${float(pote.saldo):.2f}. No puedes retirar ${datos.monto:.2f}",
        )
    pote.saldo = Decimal(pote.saldo) - datos.monto
    mov = models.MovimientoPote(
        pote_id=pote.id,
        monto=-datos.monto,
        descripcion=datos.descripcion,
        fecha=datos.fecha,
    )
    db.add(mov)
    db.commit()
    db.refresh(pote)
    return pote


@app.get("/api/potes/{pote_id}/movimientos", response_model=list[schemas.MovimientoPoteOut])
def listar_movimientos_pote(
    pote_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    _pote_del_usuario(db, pote_id, usuario)
    return (
        db.query(models.MovimientoPote)
        .filter(models.MovimientoPote.pote_id == pote_id)
        .order_by(models.MovimientoPote.fecha.desc(), models.MovimientoPote.id.desc())
        .all()
    )


# ============================================================
# TARJETAS
# ============================================================

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
    # Validaciones
    if tarjeta.tipo == "debito":
        if not tarjeta.cuenta_id:
            raise HTTPException(status_code=400, detail="Las tarjetas de débito necesitan una cuenta asociada")
        cuenta = (
            db.query(models.Cuenta)
            .filter(models.Cuenta.id == tarjeta.cuenta_id, models.Cuenta.usuario_id == usuario.id)
            .first()
        )
        if not cuenta:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    if tarjeta.tipo == "credito" and tarjeta.dia_corte is None:
        raise HTTPException(status_code=400, detail="Las tarjetas de crédito requieren día de corte")

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

    if payload.tipo is not None:
        tarjeta.tipo = payload.tipo
    if payload.dia_corte is not None:
        tarjeta.dia_corte = payload.dia_corte
    if payload.dia_pago is not None:
        tarjeta.dia_pago = payload.dia_pago
    if payload.red is not None:
        tarjeta.red = payload.red
    if payload.tema is not None:
        tarjeta.tema = payload.tema

    if payload.cuenta_id is not None:
        if payload.cuenta_id == 0:
            tarjeta.cuenta_id = None
        else:
            cuenta = (
                db.query(models.Cuenta)
                .filter(models.Cuenta.id == payload.cuenta_id, models.Cuenta.usuario_id == usuario.id)
                .first()
            )
            if not cuenta:
                raise HTTPException(status_code=404, detail="Cuenta no encontrada")
            tarjeta.cuenta_id = payload.cuenta_id

    # Validaciones finales
    if tarjeta.tipo == "credito" and tarjeta.dia_corte is None:
        raise HTTPException(status_code=400, detail="Las tarjetas de crédito requieren día de corte")
    if tarjeta.tipo == "debito" and not tarjeta.cuenta_id:
        raise HTTPException(status_code=400, detail="Las tarjetas de débito necesitan una cuenta asociada")

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


# ============================================================
# GASTOS
# ============================================================

@app.get("/api/gastos", response_model=list[schemas.Gasto])
def listar_gastos(
    anio: int | None = None,
    mes: int | None = None,
    categoria: str | None = None,
    tarjeta_id: int | None = None,
    incluir_pagados: bool = False,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    query = (
        db.query(models.Gasto)
        .join(models.Tarjeta)
        .filter(models.Tarjeta.usuario_id == usuario.id)
    )
    if not incluir_pagados:
        query = query.filter(models.Gasto.pago_id.is_(None))
    if anio is not None:
        query = query.filter(extract("year", models.Gasto.fecha) == anio)
    if mes is not None:
        query = query.filter(extract("month", models.Gasto.fecha) == mes)
    if categoria is not None:
        query = query.filter(models.Gasto.categoria == categoria)
    if tarjeta_id is not None:
        query = query.filter(models.Gasto.tarjeta_id == tarjeta_id)
    return query.order_by(models.Gasto.fecha.desc()).all()


@app.post("/api/gastos", response_model=schemas.Gasto)
def crear_gasto(
    gasto: schemas.GastoCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    tarjeta = tarjeta_del_usuario(db, gasto.tarjeta_id, usuario)

    # Si es tarjeta de débito, validar saldo de la cuenta asociada
    if tarjeta.tipo == "debito":
        if not tarjeta.cuenta_id:
            raise HTTPException(status_code=400, detail="Esta tarjeta de débito no tiene cuenta asociada")
        cuenta = db.query(models.Cuenta).get(tarjeta.cuenta_id)
        if cuenta:
            saldo_cuenta = _calcular_saldo_cuenta(db, cuenta)
            if gasto.monto > saldo_cuenta:
                raise HTTPException(
                    status_code=400,
                    detail=f"Saldo insuficiente en '{cuenta.nombre}'. Disponible: ${saldo_cuenta:.2f} · Intentas gastar: ${gasto.monto:.2f}",
                )

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


# ============================================================
# RESUMEN MENSUAL
# ============================================================

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

    # Solo contamos gastos de tarjetas de crédito en el resumen general
    total_mes = (
        db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
        .join(models.Tarjeta)
        .filter(models.Tarjeta.usuario_id == usuario.id)
        .filter(models.Tarjeta.tipo == "credito")
        .filter(models.Gasto.pago_id.is_(None))
        .filter(extract("year", models.Gasto.fecha) == anio)
        .filter(extract("month", models.Gasto.fecha) == mes)
        .scalar()
    )
    total_mes = Decimal(total_mes)
    en_rojo = total_mes > LIMITE_MENSUAL

    resumen_tarjetas = []
    for t in tarjetas:
        if t.tipo == "debito":
            resumen_tarjetas.append(schemas.ResumenTarjeta(
                id=t.id,
                nombre=t.nombre,
                tipo="debito",
                dia_corte=None,
                dia_pago=None,
                red=t.red,
                tema=t.tema,
                cuenta_id=t.cuenta_id,
                dias_para_corte=0,
                gastado_mes=Decimal("0"),
                en_rojo=False,
            ))
            continue

        gastado = (
            db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
            .filter(models.Gasto.tarjeta_id == t.id)
            .filter(models.Gasto.pago_id.is_(None))
            .filter(extract("year", models.Gasto.fecha) == anio)
            .filter(extract("month", models.Gasto.fecha) == mes)
            .scalar()
        )
        resumen_tarjetas.append(schemas.ResumenTarjeta(
            id=t.id,
            nombre=t.nombre,
            tipo="credito",
            dia_corte=t.dia_corte,
            dia_pago=t.dia_pago,
            red=t.red,
            tema=t.tema,
            cuenta_id=t.cuenta_id,
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


# ============================================================
# GRUPOS
# ============================================================

@app.post("/api/grupos", response_model=schemas.GrupoOut)
def crear_grupo(
    datos: schemas.GrupoCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    codigo = secrets_module.token_urlsafe(6)
    while db.query(models.Grupo).filter(models.Grupo.codigo_invitacion == codigo).first():
        codigo = secrets_module.token_urlsafe(6)

    nuevo_grupo = models.Grupo(
        nombre=datos.nombre,
        creado_por_id=usuario.id,
        codigo_invitacion=codigo,
    )
    db.add(nuevo_grupo)
    db.flush()

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


def verificar_miembro(db: Session, grupo_id: int, usuario_id: int) -> models.MiembroGrupo:
    miembro = db.query(models.MiembroGrupo).filter(
        models.MiembroGrupo.grupo_id == grupo_id,
        models.MiembroGrupo.usuario_id == usuario_id,
    ).first()
    if not miembro:
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")
    return miembro


@app.post("/api/gastos-compartidos", response_model=schemas.GastoCompartidoOut)
def crear_gasto_compartido(
    datos: schemas.GastoCompartidoCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    miembro = db.query(models.MiembroGrupo).filter(
        models.MiembroGrupo.grupo_id == datos.grupo_id,
        models.MiembroGrupo.usuario_id == usuario.id,
    ).first()
    if not miembro:
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")

    if datos.tarjeta_id is not None:
        tarjeta_del_usuario(db, datos.tarjeta_id, usuario)

    ids_miembros = {
        m[0] for m in db.query(models.MiembroGrupo.usuario_id).filter(
            models.MiembroGrupo.grupo_id == datos.grupo_id
        ).all()
    }

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

    nuevo_gasto = models.GastoCompartido(
        grupo_id=datos.grupo_id,
        pagado_por_id=usuario.id,
        tarjeta_id=datos.tarjeta_id,
        fecha=datos.fecha,
        monto=datos.monto,
        descripcion=datos.descripcion,
        categoria=datos.categoria,
    )
    db.add(nuevo_gasto)
    db.flush()

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
    verificar_miembro(db, grupo_id, usuario.id)

    miembros = db.query(models.Usuario).join(models.MiembroGrupo).filter(
        models.MiembroGrupo.grupo_id == grupo_id
    ).all()

    saldos = {}
    for m in miembros:
        pagado = db.query(func.coalesce(func.sum(models.GastoCompartido.monto), 0)).filter(
            models.GastoCompartido.grupo_id == grupo_id,
            models.GastoCompartido.pagado_por_id == m.id,
        ).scalar()

        debe = db.query(func.coalesce(func.sum(models.DivisionGasto.monto), 0)).join(
            models.GastoCompartido
        ).filter(
            models.GastoCompartido.grupo_id == grupo_id,
            models.DivisionGasto.usuario_id == m.id,
        ).scalar()

        saldo = Decimal(pagado) - Decimal(debe)
        saldos[m.id] = {"usuario_id": m.id, "nombre": m.nombre, "debe": saldo}

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
    db.delete(gasto)
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
    if payload.tarjeta_id is not None:
        tarjeta_del_usuario(db, payload.tarjeta_id, usuario)
        gasto.tarjeta_id = payload.tarjeta_id

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
    db.delete(grupo)
    db.commit()


# ============================================================
# NOTAS
# ============================================================

@app.get("/api/notas", response_model=list[schemas.NotaOut])
def listar_notas(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    return (
        db.query(models.Nota)
        .filter(models.Nota.usuario_id == usuario.id)
        .order_by(models.Nota.actualizado_en.desc())
        .all()
    )


@app.post("/api/notas", response_model=schemas.NotaOut)
def crear_nota(
    datos: schemas.NotaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    nueva = models.Nota(usuario_id=usuario.id, contenido=datos.contenido, color=datos.color)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@app.put("/api/notas/{nota_id}", response_model=schemas.NotaOut)
def actualizar_nota(
    nota_id: int,
    datos: schemas.NotaUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    nota = (
        db.query(models.Nota)
        .filter(models.Nota.id == nota_id, models.Nota.usuario_id == usuario.id)
        .first()
    )
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    if datos.contenido is not None:
        nota.contenido = datos.contenido
    if datos.color is not None:
        nota.color = datos.color
    db.commit()
    db.refresh(nota)
    return nota


@app.delete("/api/notas/{nota_id}", status_code=204)
def eliminar_nota(
    nota_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    nota = (
        db.query(models.Nota)
        .filter(models.Nota.id == nota_id, models.Nota.usuario_id == usuario.id)
        .first()
    )
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    db.delete(nota)
    db.commit()


# ============================================================
# CATEGORÍAS Y RESÚMENES
# ============================================================

@app.get("/api/categorias", response_model=schemas.CategoriasDisponibles)
def listar_categorias():
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
    resumen.sort(key=lambda r: r.total, reverse=True)
    return resumen


# ============================================================
# DEUDAS
# ============================================================

def _deuda_del_usuario(db: Session, deuda_id: int, usuario: models.Usuario) -> models.Deuda:
    deuda = (
        db.query(models.Deuda)
        .filter(models.Deuda.id == deuda_id, models.Deuda.usuario_id == usuario.id)
        .first()
    )
    if not deuda:
        raise HTTPException(status_code=404, detail="Deuda no encontrada")
    return deuda


@app.get("/api/deudas", response_model=list[schemas.DeudaOut])
def listar_deudas(
    incluir_pagadas: bool = False,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    query = db.query(models.Deuda).filter(models.Deuda.usuario_id == usuario.id)
    if not incluir_pagadas:
        query = query.filter(models.Deuda.pagada == 0)
    return query.order_by(models.Deuda.creado_en.desc()).all()


@app.post("/api/deudas", response_model=schemas.DeudaOut)
def crear_deuda(
    datos: schemas.DeudaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    nueva = models.Deuda(
        usuario_id=usuario.id,
        persona=datos.persona.strip(),
        tipo=datos.tipo,
        descripcion=datos.descripcion,
        monto_original=datos.monto,
        saldo_pendiente=datos.monto,
        frecuencia_recordatorio_dias=datos.frecuencia_recordatorio_dias,
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@app.put("/api/deudas/{deuda_id}", response_model=schemas.DeudaOut)
def actualizar_deuda(
    deuda_id: int,
    payload: schemas.DeudaUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    deuda = _deuda_del_usuario(db, deuda_id, usuario)
    if payload.persona is not None:
        deuda.persona = payload.persona
    if payload.descripcion is not None:
        deuda.descripcion = payload.descripcion
    if payload.frecuencia_recordatorio_dias is not None:
        deuda.frecuencia_recordatorio_dias = payload.frecuencia_recordatorio_dias
    db.commit()
    db.refresh(deuda)
    return deuda


@app.delete("/api/deudas/{deuda_id}", status_code=204)
def eliminar_deuda(
    deuda_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    deuda = _deuda_del_usuario(db, deuda_id, usuario)
    db.delete(deuda)
    db.commit()


@app.get("/api/deudas/{deuda_id}/abonos", response_model=list[schemas.AbonoDeudaOut])
def listar_abonos_deuda(
    deuda_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    deuda = _deuda_del_usuario(db, deuda_id, usuario)
    return (
        db.query(models.AbonoDeuda)
        .filter(models.AbonoDeuda.deuda_id == deuda.id)
        .order_by(models.AbonoDeuda.fecha.desc())
        .all()
    )


@app.post("/api/deudas/{deuda_id}/abonar", response_model=schemas.AbonarDeudaResultado)
def abonar_deuda(
    deuda_id: int,
    datos: schemas.AbonoDeudaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    deuda = _deuda_del_usuario(db, deuda_id, usuario)
    if deuda.pagada:
        raise HTTPException(status_code=400, detail="Esta deuda ya está saldada")
    if datos.monto > deuda.saldo_pendiente:
        raise HTTPException(
            status_code=400,
            detail=f"El abono (${datos.monto:.2f}) es mayor al saldo pendiente (${deuda.saldo_pendiente:.2f})",
        )

    if datos.cuenta_id is not None:
        cuenta = (
            db.query(models.Cuenta)
            .filter(models.Cuenta.id == datos.cuenta_id, models.Cuenta.usuario_id == usuario.id)
            .first()
        )
        if not cuenta:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    nuevo_abono = models.AbonoDeuda(
        deuda_id=deuda.id,
        cuenta_id=datos.cuenta_id,
        monto=datos.monto,
        fecha=datos.fecha,
        nota=datos.nota,
    )
    db.add(nuevo_abono)

    deuda.saldo_pendiente = Decimal(deuda.saldo_pendiente) - datos.monto
    quedo_saldada = deuda.saldo_pendiente <= 0
    if quedo_saldada:
        deuda.saldo_pendiente = Decimal("0")
        deuda.pagada = 1
        deuda.fecha_pagada = datos.fecha

    db.commit()
    db.refresh(deuda)
    return schemas.AbonarDeudaResultado(deuda=deuda, quedo_saldada=quedo_saldada)


# ============================================================
# EGRESOS DE CUENTA (GASTOS DIRECTOS)
# ============================================================

def _egreso_del_usuario(db: Session, egreso_id: int, usuario: models.Usuario) -> models.EgresoCuenta:
    egreso = (
        db.query(models.EgresoCuenta)
        .filter(models.EgresoCuenta.id == egreso_id, models.EgresoCuenta.usuario_id == usuario.id)
        .first()
    )
    if not egreso:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    return egreso


@app.get("/api/egresos-cuenta", response_model=list[schemas.EgresoCuentaOut])
def listar_egresos_cuenta(
    anio: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    query = db.query(models.EgresoCuenta).filter(models.EgresoCuenta.usuario_id == usuario.id)
    if anio is not None:
        query = query.filter(extract("year", models.EgresoCuenta.fecha) == anio)
    if mes is not None:
        query = query.filter(extract("month", models.EgresoCuenta.fecha) == mes)
    return query.order_by(models.EgresoCuenta.fecha.desc()).all()


@app.post("/api/egresos-cuenta", response_model=schemas.EgresoCuentaOut)
def crear_egreso_cuenta(
    datos: schemas.EgresoCuentaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    cuenta = (
        db.query(models.Cuenta)
        .filter(models.Cuenta.id == datos.cuenta_id, models.Cuenta.usuario_id == usuario.id)
        .first()
    )
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    saldo_cuenta = _calcular_saldo_cuenta(db, cuenta)
    if datos.monto > saldo_cuenta:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente en '{cuenta.nombre}'. Disponible: ${saldo_cuenta:.2f} · Intentas gastar: ${datos.monto:.2f}",
        )

    nuevo = models.EgresoCuenta(
        usuario_id=usuario.id,
        cuenta_id=datos.cuenta_id,
        monto=datos.monto,
        fecha=datos.fecha,
        categoria=datos.categoria,
        descripcion=datos.descripcion,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.put("/api/egresos-cuenta/{egreso_id}", response_model=schemas.EgresoCuentaOut)
def actualizar_egreso_cuenta(
    egreso_id: int,
    payload: schemas.EgresoCuentaUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    egreso = _egreso_del_usuario(db, egreso_id, usuario)

    if payload.cuenta_id is not None and payload.cuenta_id != egreso.cuenta_id:
        cuenta = (
            db.query(models.Cuenta)
            .filter(models.Cuenta.id == payload.cuenta_id, models.Cuenta.usuario_id == usuario.id)
            .first()
        )
        if not cuenta:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        egreso.cuenta_id = payload.cuenta_id

    if payload.monto is not None:
        egreso.monto = payload.monto
    if payload.fecha is not None:
        egreso.fecha = payload.fecha
    if payload.categoria is not None:
        egreso.categoria = payload.categoria
    if payload.descripcion is not None:
        egreso.descripcion = payload.descripcion

    db.commit()
    db.refresh(egreso)
    return egreso


@app.delete("/api/egresos-cuenta/{egreso_id}", status_code=204)
def eliminar_egreso_cuenta(
    egreso_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    egreso = _egreso_del_usuario(db, egreso_id, usuario)
    db.delete(egreso)
    db.commit()

# ============================================================
# EXPORTACIÓN COMPLETA (ZIP con múltiples CSVs)
# ============================================================

def _csv_gastos(db: Session, usuario: models.Usuario, desde: date, hasta: date) -> str:
    """Genera el CSV de gastos (con tarjetas)."""
    query = (
        db.query(models.Gasto)
        .join(models.Tarjeta)
        .filter(
            models.Tarjeta.usuario_id == usuario.id,
            models.Gasto.fecha >= desde,
            models.Gasto.fecha <= hasta,
        )
    )
    gastos = query.order_by(models.Gasto.fecha).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Fecha", "Tarjeta", "Tipo", "Monto", "Categoria", "Descripcion"])
    for g in gastos:
        tarjeta = g.tarjeta
        writer.writerow([
            g.fecha.isoformat(),
            tarjeta.nombre if tarjeta else "",
            tarjeta.tipo if tarjeta else "",
            f"{g.monto:.2f}",
            g.categoria or "",
            g.descripcion or "",
        ])
    total = sum((g.monto for g in gastos), Decimal("0"))
    writer.writerow([])
    writer.writerow(["Total", "", "", f"{total:.2f}", "", ""])
    return buffer.getvalue()


def _csv_ingresos(db: Session, usuario: models.Usuario, desde: date, hasta: date) -> str:
    """Genera el CSV de ingresos."""
    query = db.query(models.Ingreso).filter(
        models.Ingreso.usuario_id == usuario.id,
        models.Ingreso.fecha >= desde,
        models.Ingreso.fecha <= hasta,
    )
    ingresos = query.order_by(models.Ingreso.fecha).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Fecha", "Cuenta", "Monto", "Categoria", "Descripcion"])
    for i in ingresos:
        cuenta = db.query(models.Cuenta).get(i.cuenta_id)
        writer.writerow([
            i.fecha.isoformat(),
            cuenta.nombre if cuenta else "",
            f"{i.monto:.2f}",
            i.categoria or "",
            i.descripcion or "",
        ])
    total = sum((i.monto for i in ingresos), Decimal("0"))
    writer.writerow([])
    writer.writerow(["Total", "", f"{total:.2f}", "", ""])
    return buffer.getvalue()


def _csv_egresos(db: Session, usuario: models.Usuario, desde: date, hasta: date) -> str:
    """Genera el CSV de gastos directos desde cuentas."""
    query = db.query(models.EgresoCuenta).filter(
        models.EgresoCuenta.usuario_id == usuario.id,
        models.EgresoCuenta.fecha >= desde,
        models.EgresoCuenta.fecha <= hasta,
    )
    egresos = query.order_by(models.EgresoCuenta.fecha).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Fecha", "Cuenta", "Monto", "Categoria", "Descripcion"])
    for e in egresos:
        cuenta = db.query(models.Cuenta).get(e.cuenta_id)
        writer.writerow([
            e.fecha.isoformat(),
            cuenta.nombre if cuenta else "",
            f"{e.monto:.2f}",
            e.categoria or "",
            e.descripcion or "",
        ])
    total = sum((e.monto for e in egresos), Decimal("0"))
    writer.writerow([])
    writer.writerow(["Total", "", f"{total:.2f}", "", ""])
    return buffer.getvalue()


def _csv_deudas(db: Session, usuario: models.Usuario) -> str:
    """Genera el CSV de deudas con sus abonos."""
    deudas = (
        db.query(models.Deuda)
        .filter(models.Deuda.usuario_id == usuario.id)
        .order_by(models.Deuda.creado_en.desc())
        .all()
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["ID", "Persona", "Tipo", "Monto original", "Saldo pendiente", "Pagada", "Descripcion", "Frecuencia recordatorio"])
    for d in deudas:
        writer.writerow([
            d.id,
            d.persona,
            d.tipo,
            f"{d.monto_original:.2f}",
            f"{d.saldo_pendiente:.2f}",
            "Sí" if d.pagada else "No",
            d.descripcion or "",
            d.frecuencia_recordatorio_dias or "",
        ])

    writer.writerow([])
    writer.writerow(["--- ABONOS ---"])
    writer.writerow(["Fecha", "Deuda con", "Monto", "Cuenta", "Nota"])

    abonos = (
        db.query(models.AbonoDeuda)
        .join(models.Deuda)
        .filter(models.Deuda.usuario_id == usuario.id)
        .order_by(models.AbonoDeuda.fecha)
        .all()
    )
    for a in abonos:
        deuda = db.query(models.Deuda).get(a.deuda_id)
        cuenta = db.query(models.Cuenta).get(a.cuenta_id) if a.cuenta_id else None
        writer.writerow([
            a.fecha.isoformat(),
            deuda.persona if deuda else "",
            f"{a.monto:.2f}",
            cuenta.nombre if cuenta else "",
            a.nota or "",
        ])
    return buffer.getvalue()


def _csv_pagos_tarjeta(db: Session, usuario: models.Usuario, desde: date, hasta: date) -> str:
    """Genera el CSV de pagos de tarjeta de crédito."""
    pagos = (
        db.query(models.PagoTarjeta)
        .filter(
            models.PagoTarjeta.usuario_id == usuario.id,
            models.PagoTarjeta.fecha_pago >= desde,
            models.PagoTarjeta.fecha_pago <= hasta,
        )
        .order_by(models.PagoTarjeta.fecha_pago)
        .all()
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Fecha", "Tarjeta", "Cuenta origen", "Mes cerrado", "Año cerrado", "Monto"])
    for p in pagos:
        tarjeta = db.query(models.Tarjeta).get(p.tarjeta_id)
        cuenta = db.query(models.Cuenta).get(p.cuenta_id)
        writer.writerow([
            p.fecha_pago.isoformat(),
            tarjeta.nombre if tarjeta else "",
            cuenta.nombre if cuenta else "",
            p.mes_cerrado,
            p.anio_cerrado,
            f"{p.monto:.2f}",
        ])
    total = sum((p.monto for p in pagos), Decimal("0"))
    writer.writerow([])
    writer.writerow(["Total", "", "", "", "", f"{total:.2f}"])
    return buffer.getvalue()


@app.get("/api/export/todo")
def exportar_todo(
    desde: date,
    hasta: date,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    """
    Exporta todo en un ZIP con varios CSVs dentro.
    Incluye: gastos, ingresos, egresos directos, pagos de tarjeta, deudas, y un resumen.
    """
    if hasta < desde:
        raise HTTPException(status_code=400, detail="El rango de fechas es inválido")

    # Crear el ZIP en memoria
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("gastos.csv", _csv_gastos(db, usuario, desde, hasta))
        zf.writestr("ingresos.csv", _csv_ingresos(db, usuario, desde, hasta))
        zf.writestr("egresos_directos.csv", _csv_egresos(db, usuario, desde, hasta))
        zf.writestr("pagos_tarjeta.csv", _csv_pagos_tarjeta(db, usuario, desde, hasta))
        zf.writestr("deudas.csv", _csv_deudas(db, usuario))

        # Resumen general
        resumen_buffer = io.StringIO()
        writer = csv.writer(resumen_buffer)
        writer.writerow(["RESUMEN GENERAL"])
        writer.writerow(["Usuario", usuario.nombre])
        writer.writerow(["Email", usuario.email])
        writer.writerow(["Desde", desde.isoformat()])
        writer.writerow(["Hasta", hasta.isoformat()])
        writer.writerow([])

        total_gastos = sum(
            (g.monto for g in db.query(models.Gasto).join(models.Tarjeta).filter(
                models.Tarjeta.usuario_id == usuario.id,
                models.Gasto.fecha >= desde,
                models.Gasto.fecha <= hasta,
            ).all()),
            Decimal("0")
        )
        total_ingresos = sum(
            (i.monto for i in db.query(models.Ingreso).filter(
                models.Ingreso.usuario_id == usuario.id,
                models.Ingreso.fecha >= desde,
                models.Ingreso.fecha <= hasta,
            ).all()),
            Decimal("0")
        )
        total_egresos = sum(
            (e.monto for e in db.query(models.EgresoCuenta).filter(
                models.EgresoCuenta.usuario_id == usuario.id,
                models.EgresoCuenta.fecha >= desde,
                models.EgresoCuenta.fecha <= hasta,
            ).all()),
            Decimal("0")
        )
        total_pagos = sum(
            (p.monto for p in db.query(models.PagoTarjeta).filter(
                models.PagoTarjeta.usuario_id == usuario.id,
                models.PagoTarjeta.fecha_pago >= desde,
                models.PagoTarjeta.fecha_pago <= hasta,
            ).all()),
            Decimal("0")
        )

        writer.writerow(["Total gastos (tarjetas)", f"{total_gastos:.2f}"])
        writer.writerow(["Total ingresos", f"{total_ingresos:.2f}"])
        writer.writerow(["Total egresos directos", f"{total_egresos:.2f}"])
        writer.writerow(["Total pagos de tarjeta", f"{total_pagos:.2f}"])
        writer.writerow([])
        writer.writerow(["Balance (ingresos - gastos - egresos)", f"{total_ingresos - total_gastos - total_egresos:.2f}"])

        zf.writestr("resumen.csv", resumen_buffer.getvalue())

    zip_buffer.seek(0)
    nombre_archivo = f"finanzas_{desde.isoformat()}_a_{hasta.isoformat()}.zip"
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )

# ============================================================
# EXPORTACIONES ESPECÍFICAS POR SECCIÓN
# ============================================================

@app.get("/api/export/ingresos")
def exportar_ingresos(
    desde: date,
    hasta: date,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    if hasta < desde:
        raise HTTPException(status_code=400, detail="El rango de fechas es inválido")

    ingresos = (
        db.query(models.Ingreso)
        .filter(
            models.Ingreso.usuario_id == usuario.id,
            models.Ingreso.fecha >= desde,
            models.Ingreso.fecha <= hasta,
        )
        .order_by(models.Ingreso.fecha)
        .all()
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Fecha", "Cuenta", "Monto", "Categoria", "Descripcion"])
    for i in ingresos:
        cuenta = db.query(models.Cuenta).get(i.cuenta_id)
        writer.writerow([
            i.fecha.isoformat(),
            cuenta.nombre if cuenta else "",
            f"{i.monto:.2f}",
            i.categoria or "",
            i.descripcion or "",
        ])
    total = sum((i.monto for i in ingresos), Decimal("0"))
    writer.writerow([])
    writer.writerow(["Total", "", f"{total:.2f}", "", ""])
    buffer.seek(0)

    nombre = f"ingresos_{desde.isoformat()}_a_{hasta.isoformat()}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


@app.get("/api/export/pagos")
def exportar_pagos(
    desde: date,
    hasta: date,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    if hasta < desde:
        raise HTTPException(status_code=400, detail="El rango de fechas es inválido")

    buffer = io.StringIO()
    writer = csv.writer(buffer)

    # Pagos de tarjeta
    writer.writerow(["=== PAGOS DE TARJETA ==="])
    writer.writerow(["Fecha", "Tarjeta", "Cuenta origen", "Mes cerrado", "Año cerrado", "Monto"])
    pagos = (
        db.query(models.PagoTarjeta)
        .filter(
            models.PagoTarjeta.usuario_id == usuario.id,
            models.PagoTarjeta.fecha_pago >= desde,
            models.PagoTarjeta.fecha_pago <= hasta,
        )
        .order_by(models.PagoTarjeta.fecha_pago)
        .all()
    )
    for p in pagos:
        tarjeta = db.query(models.Tarjeta).get(p.tarjeta_id)
        cuenta = db.query(models.Cuenta).get(p.cuenta_id)
        writer.writerow([
            p.fecha_pago.isoformat(),
            tarjeta.nombre if tarjeta else "",
            cuenta.nombre if cuenta else "",
            p.mes_cerrado,
            p.anio_cerrado,
            f"{p.monto:.2f}",
        ])

    writer.writerow([])
    writer.writerow(["=== GASTOS DIRECTOS ==="])
    writer.writerow(["Fecha", "Cuenta", "Monto", "Categoria", "Descripcion"])
    egresos = (
        db.query(models.EgresoCuenta)
        .filter(
            models.EgresoCuenta.usuario_id == usuario.id,
            models.EgresoCuenta.fecha >= desde,
            models.EgresoCuenta.fecha <= hasta,
        )
        .order_by(models.EgresoCuenta.fecha)
        .all()
    )
    for e in egresos:
        cuenta = db.query(models.Cuenta).get(e.cuenta_id)
        writer.writerow([
            e.fecha.isoformat(),
            cuenta.nombre if cuenta else "",
            f"{e.monto:.2f}",
            e.categoria or "",
            e.descripcion or "",
        ])

    buffer.seek(0)
    nombre = f"pagos_{desde.isoformat()}_a_{hasta.isoformat()}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


@app.get("/api/export/deudas")
def exportar_deudas(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["DEUDAS"])
    writer.writerow(["ID", "Persona", "Tipo", "Monto original", "Saldo pendiente", "Pagada", "Descripcion"])
    deudas = (
        db.query(models.Deuda)
        .filter(models.Deuda.usuario_id == usuario.id)
        .order_by(models.Deuda.creado_en.desc())
        .all()
    )
    for d in deudas:
        writer.writerow([
            d.id,
            d.persona,
            d.tipo,
            f"{d.monto_original:.2f}",
            f"{d.saldo_pendiente:.2f}",
            "Sí" if d.pagada else "No",
            d.descripcion or "",
        ])

    writer.writerow([])
    writer.writerow(["=== ABONOS ==="])
    writer.writerow(["Fecha", "Deuda con", "Monto", "Cuenta", "Nota"])
    abonos = (
        db.query(models.AbonoDeuda)
        .join(models.Deuda)
        .filter(models.Deuda.usuario_id == usuario.id)
        .order_by(models.AbonoDeuda.fecha)
        .all()
    )
    for a in abonos:
        deuda = db.query(models.Deuda).get(a.deuda_id)
        cuenta = db.query(models.Cuenta).get(a.cuenta_id) if a.cuenta_id else None
        writer.writerow([
            a.fecha.isoformat(),
            deuda.persona if deuda else "",
            f"{a.monto:.2f}",
            cuenta.nombre if cuenta else "",
            a.nota or "",
        ])
    buffer.seek(0)
    nombre = "deudas.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


@app.get("/api/export/cuenta/{cuenta_id}")
def exportar_cuenta(
    cuenta_id: int,
    desde: date,
    hasta: date,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    cuenta = (
        db.query(models.Cuenta)
        .filter(models.Cuenta.id == cuenta_id, models.Cuenta.usuario_id == usuario.id)
        .first()
    )
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    if hasta < desde:
        raise HTTPException(status_code=400, detail="El rango de fechas es inválido")

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Fecha", "Tipo", "Descripcion", "Monto"])

    # Reutilizamos la lógica de movimientos_cuenta
    # (la dejamos como llamada interna para no duplicar)
    movimientos = movimientos_cuenta(cuenta_id, db, usuario)
    movimientos_filtrados = [
        m for m in movimientos if desde <= m.fecha <= hasta
    ]

    for m in movimientos_filtrados:
        writer.writerow([
            m.fecha.isoformat(),
            m.tipo,
            m.descripcion or "",
            f"{m.monto:.2f}",
        ])

    total = sum((m.monto for m in movimientos_filtrados), Decimal("0"))
    writer.writerow([])
    writer.writerow(["Total neto", "", "", f"{total:.2f}"])
    buffer.seek(0)

    nombre_limpio = cuenta.nombre.replace(" ", "_").replace("/", "-")
    nombre = f"cuenta_{nombre_limpio}_{desde.isoformat()}_a_{hasta.isoformat()}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


@app.get("/api/export/tarjeta/{tarjeta_id}")
def exportar_tarjeta(
    tarjeta_id: int,
    desde: date,
    hasta: date,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    tarjeta = tarjeta_del_usuario(db, tarjeta_id, usuario)
    if hasta < desde:
        raise HTTPException(status_code=400, detail="El rango de fechas es inválido")

    gastos = (
        db.query(models.Gasto)
        .filter(
            models.Gasto.tarjeta_id == tarjeta.id,
            models.Gasto.fecha >= desde,
            models.Gasto.fecha <= hasta,
        )
        .order_by(models.Gasto.fecha)
        .all()
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Fecha", "Monto", "Categoria", "Descripcion"])
    for g in gastos:
        writer.writerow([
            g.fecha.isoformat(),
            f"{g.monto:.2f}",
            g.categoria or "",
            g.descripcion or "",
        ])
    total = sum((g.monto for g in gastos), Decimal("0"))
    writer.writerow([])
    writer.writerow(["Total", f"{total:.2f}", "", ""])
    buffer.seek(0)

    nombre_limpio = tarjeta.nombre.replace(" ", "_").replace("/", "-")
    nombre = f"tarjeta_{nombre_limpio}_{desde.isoformat()}_a_{hasta.isoformat()}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )

# ============================================================
# REPORTES MENSUALES
# ============================================================

@app.get("/api/reportes/mensual")
def reporte_mensual(
    anio: int | None = None,
    mes: int | None = None,
    meses: int = 6,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    """
    Devuelve los totales de ingresos, gastos y balance para los últimos N meses.
    Si no se pasa anio/mes, se usa el mes actual como referencia.
    """
    hoy = date.today()
    anio = anio or hoy.year
    mes = mes or hoy.month

    # Limitar a un máximo razonable
    meses = max(1, min(meses, 24))

    resultado = []

    for i in range(meses - 1, -1, -1):
        # Retroceder i meses desde la referencia
        mes_ref = mes - i
        anio_ref = anio
        while mes_ref < 1:
            mes_ref += 12
            anio_ref -= 1

        ingresos = (
            db.query(func.coalesce(func.sum(models.Ingreso.monto), 0))
            .filter(models.Ingreso.usuario_id == usuario.id)
            .filter(extract("year", models.Ingreso.fecha) == anio_ref)
            .filter(extract("month", models.Ingreso.fecha) == mes_ref)
            .scalar()
        )
        ingresos = Decimal(ingresos)

        # Gastos de tarjetas (crédito y débito)
        gastos_tarjetas = (
            db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
            .join(models.Tarjeta)
            .filter(models.Tarjeta.usuario_id == usuario.id)
            .filter(extract("year", models.Gasto.fecha) == anio_ref)
            .filter(extract("month", models.Gasto.fecha) == mes_ref)
            .scalar()
        )
        gastos_tarjetas = Decimal(gastos_tarjetas)

        egresos_directos = (
            db.query(func.coalesce(func.sum(models.EgresoCuenta.monto), 0))
            .filter(models.EgresoCuenta.usuario_id == usuario.id)
            .filter(extract("year", models.EgresoCuenta.fecha) == anio_ref)
            .filter(extract("month", models.EgresoCuenta.fecha) == mes_ref)
            .scalar()
        )
        egresos_directos = Decimal(egresos_directos)

        total_gastos = gastos_tarjetas + egresos_directos
        balance = ingresos - total_gastos

        resultado.append({
            "anio": anio_ref,
            "mes": mes_ref,
            "nombre_mes": _nombre_mes(mes_ref),
            "ingresos": float(ingresos),
            "gastos_tarjetas": float(gastos_tarjetas),
            "egresos_directos": float(egresos_directos),
            "total_gastos": float(total_gastos),
            "balance": float(balance),
        })

    total_ingresos = sum(m["ingresos"] for m in resultado)
    total_gastos = sum(m["total_gastos"] for m in resultado)
    total_balance = total_ingresos - total_gastos

    # Mes con más gasto
    mes_max = max(resultado, key=lambda m: m["total_gastos"]) if resultado else None

    return {
        "meses": resultado,
        "total_ingresos": round(total_ingresos, 2),
        "total_gastos": round(total_gastos, 2),
        "total_balance": round(total_balance, 2),
        "mes_mayor_gasto": mes_max,
    }


def _nombre_mes(mes: int) -> str:
    nombres = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ]
    return nombres[mes] if 1 <= mes <= 12 else ""

# ============================================================
# INSIGHTS PARA LA PESTAÑA "PARA TI"
# ============================================================

@app.get("/api/insights")
def obtener_insights(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    """
    Genera insights personalizados basados en los datos del usuario.
    Devuelve una lista de tarjetas con tip, título, mensaje y datos extra.
    """
    hoy = date.today()
    anio_actual = hoy.year
    mes_actual = hoy.month

    # Mes anterior
    if mes_actual == 1:
        anio_anterior = anio_actual - 1
        mes_anterior = 12
    else:
        anio_anterior = anio_actual
        mes_anterior = mes_actual - 1

    insights = []

    # --- 1. Comparación gasto mes actual vs anterior ---
    gasto_actual = (
        db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
        .join(models.Tarjeta)
        .filter(models.Tarjeta.usuario_id == usuario.id)
        .filter(extract("year", models.Gasto.fecha) == anio_actual)
        .filter(extract("month", models.Gasto.fecha) == mes_actual)
        .scalar()
    )
    gasto_actual = Decimal(gasto_actual)

    gasto_anterior = (
        db.query(func.coalesce(func.sum(models.Gasto.monto), 0))
        .join(models.Tarjeta)
        .filter(models.Tarjeta.usuario_id == usuario.id)
        .filter(extract("year", models.Gasto.fecha) == anio_anterior)
        .filter(extract("month", models.Gasto.fecha) == mes_anterior)
        .scalar()
    )
    gasto_anterior = Decimal(gasto_anterior)

    if gasto_anterior > 0:
        diferencia_pct = float((gasto_actual - gasto_anterior) / gasto_anterior * 100)
        if diferencia_pct > 10:
            insights.append({
                "tipo": "alerta",
                "titulo": "Gastaste más que el mes pasado",
                "mensaje": f"Este mes llevas ${gasto_actual:.2f}, un {abs(diferencia_pct):.0f}% más que el mes pasado.",
                "color": "rojo",
                "icono": "trending-up",
            })
        elif diferencia_pct < -10:
            insights.append({
                "tipo": "logro",
                "titulo": "¡Buen control!",
                "mensaje": f"Este mes llevas ${gasto_actual:.2f}, un {abs(diferencia_pct):.0f}% menos que el mes pasado.",
                "color": "verde",
                "icono": "trending-down",
            })
    elif gasto_actual > 0:
        insights.append({
            "tipo": "info",
            "titulo": "Primer mes con gastos",
            "mensaje": f"Llevas ${gasto_actual:.2f} este mes. ¡Sigue registrando para ver tendencias!",
            "color": "azul",
            "icono": "sparkles",
        })

    # --- 2. Categoría top del mes ---
    categoria_top = (
        db.query(
            models.Gasto.categoria,
            func.sum(models.Gasto.monto).label("total"),
        )
        .join(models.Tarjeta)
        .filter(models.Tarjeta.usuario_id == usuario.id)
        .filter(extract("year", models.Gasto.fecha) == anio_actual)
        .filter(extract("month", models.Gasto.fecha) == mes_actual)
        .filter(models.Gasto.categoria.isnot(None))
        .group_by(models.Gasto.categoria)
        .order_by(func.sum(models.Gasto.monto).desc())
        .first()
    )
    if categoria_top and categoria_top[1] > 0:
        insights.append({
            "tipo": "estadistica",
            "titulo": f"Tu categoría top: {categoria_top[0]}",
            "mensaje": f"Has gastado ${Decimal(categoria_top[1]):.2f} en {categoria_top[0]} este mes.",
            "color": "morado",
            "icono": "pie-chart",
        })

    # --- 3. Próximo corte de tarjeta ---
    tarjetas = db.query(models.Tarjeta).filter(
        models.Tarjeta.usuario_id == usuario.id,
        models.Tarjeta.tipo == "credito",
    ).all()
    corte_proximo = None
    menor_dias = 999
    for t in tarjetas:
        if t.dia_corte is None:
            continue
        dias = dias_para_corte(t.dia_corte, hoy)
        if 0 <= dias < menor_dias:
            menor_dias = dias
            corte_proximo = t
    if corte_proximo:
        texto = "hoy" if menor_dias == 0 else f"en {menor_dias} día{'s' if menor_dias != 1 else ''}"
        insights.append({
            "tipo": "recordatorio",
            "titulo": f"Corte de {corte_proximo.nombre}",
            "mensaje": f"Tu tarjeta {corte_proximo.nombre} cierra {texto}.",
            "color": "amarillo" if menor_dias <= 3 else "azul",
            "icono": "calendar",
        })

    # --- 4. Deudas pendientes ---
    deudas = (
        db.query(models.Deuda)
        .filter(models.Deuda.usuario_id == usuario.id, models.Deuda.pagada == 0)
        .all()
    )
    total_debo = sum(
        (Decimal(d.saldo_pendiente) for d in deudas if d.tipo == "debo"),
        Decimal("0"),
    )
    total_me_deben = sum(
        (Decimal(d.saldo_pendiente) for d in deudas if d.tipo == "me_deben"),
        Decimal("0"),
    )
    if total_debo > 0:
        insights.append({
            "tipo": "alerta",
            "titulo": "Tienes deudas activas",
            "mensaje": f"Debes ${total_debo:.2f} en total.",
            "color": "rojo",
            "icono": "hand-coins",
        })
    if total_me_deben > 0:
        insights.append({
            "tipo": "info",
            "titulo": "Te deben dinero",
            "mensaje": f"Tienes ${total_me_deben:.2f} por cobrar.",
            "color": "verde",
            "icono": "hand-coins",
        })

    # --- 5. Pote más cerca de completarse ---
    potes = db.query(models.Pote).filter(models.Pote.usuario_id == usuario.id).all()
    pote_cerca = None
    mejor_pct = 0
    for p in potes:
        if p.meta and float(p.meta) > 0:
            pct = float(p.saldo) / float(p.meta) * 100
            if pct >= mejor_pct and pct < 100:
                mejor_pct = pct
                pote_cerca = p
    if pote_cerca and mejor_pct > 30:
        insights.append({
            "tipo": "logro",
            "titulo": f"{pote_cerca.emoji} {pote_cerca.nombre}",
            "mensaje": f"Está al {mejor_pct:.0f}% de tu meta. ¡Ya casi!",
            "color": "verde",
            "icono": "target",
        })

    # --- 6. Cuenta con más saldo ---
    cuentas = db.query(models.Cuenta).filter(models.Cuenta.usuario_id == usuario.id).all()
    cuenta_top = None
    mejor_saldo = Decimal("0")
    for c in cuentas:
        saldo = _calcular_saldo_cuenta(db, c)
        if saldo > mejor_saldo:
            mejor_saldo = saldo
            cuenta_top = c
    if cuenta_top and mejor_saldo > 0:
        insights.append({
            "tipo": "estadistica",
            "titulo": "Tu cuenta más fuerte",
            "mensaje": f"{cuenta_top.nombre} tiene ${mejor_saldo:.2f} disponibles.",
            "color": "azul",
            "icono": "wallet",
        })

    # --- 7. Consejo si no hay nada ---
    if not insights:
        insights.append({
            "tipo": "info",
            "titulo": "¡Bienvenido!",
            "mensaje": "Registra tus gastos y deudas para ver insights personalizados aquí.",
            "color": "azul",
            "icono": "sparkles",
        })

    return {"insights": insights}

# ============================================================
# TRANSACCIONES RECURRENTES
# ============================================================

def _recurrente_del_usuario(db: Session, rec_id: int, usuario: models.Usuario) -> models.TransaccionRecurrente:
    rec = (
        db.query(models.TransaccionRecurrente)
        .filter(
            models.TransaccionRecurrente.id == rec_id,
            models.TransaccionRecurrente.usuario_id == usuario.id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Recurrente no encontrada")
    return rec


@app.get("/api/recurrentes", response_model=list[schemas.TransaccionRecurrenteOut])
def listar_recurrentes(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    return (
        db.query(models.TransaccionRecurrente)
        .filter(models.TransaccionRecurrente.usuario_id == usuario.id)
        .order_by(models.TransaccionRecurrente.creado_en.desc())
        .all()
    )


@app.post("/api/recurrentes", response_model=schemas.TransaccionRecurrenteOut)
def crear_recurrente(
    datos: schemas.TransaccionRecurrenteCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    # Validar según el tipo
    if datos.tipo == "ingreso":
        if not datos.cuenta_id:
            raise HTTPException(status_code=400, detail="Los ingresos necesitan una cuenta")
        cuenta = (
            db.query(models.Cuenta)
            .filter(models.Cuenta.id == datos.cuenta_id, models.Cuenta.usuario_id == usuario.id)
            .first()
        )
        if not cuenta:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    elif datos.tipo == "gasto_cuenta":
        if not datos.cuenta_id:
            raise HTTPException(status_code=400, detail="Los gastos de cuenta necesitan una cuenta")
        cuenta = (
            db.query(models.Cuenta)
            .filter(models.Cuenta.id == datos.cuenta_id, models.Cuenta.usuario_id == usuario.id)
            .first()
        )
        if not cuenta:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    elif datos.tipo == "gasto_tarjeta":
        if not datos.tarjeta_id:
            raise HTTPException(status_code=400, detail="Los gastos de tarjeta necesitan una tarjeta")
        tarjeta = tarjeta_del_usuario(db, datos.tarjeta_id, usuario)

    # Validar los pagos
    if not datos.pagos:
        raise HTTPException(status_code=400, detail="Debes agregar al menos un pago")
    
    suma_porcentajes = sum((p.porcentaje for p in datos.pagos), Decimal("0"))
    if abs(suma_porcentajes - Decimal("100")) > Decimal("0.01"):
        raise HTTPException(
            status_code=400,
            detail=f"Los porcentajes deben sumar 100%. Actual: {suma_porcentajes}%",
        )

    # Crear la recurrente
    nueva = models.TransaccionRecurrente(
        usuario_id=usuario.id,
        nombre=datos.nombre.strip(),
        tipo=datos.tipo,
        cuenta_id=datos.cuenta_id,
        tarjeta_id=datos.tarjeta_id,
        monto_total=datos.monto_total,
        frecuencia=datos.frecuencia,
        categoria=datos.categoria,
        descripcion=datos.descripcion,
        fecha_inicio=datos.fecha_inicio,
        fecha_fin=datos.fecha_fin,
        activa=1,
    )
    db.add(nueva)
    db.flush()

    for p in datos.pagos:
        pago = models.RecurrentePago(
            recurrente_id=nueva.id,
            dia_del_mes=p.dia_del_mes,
            porcentaje=p.porcentaje,
            etiqueta=p.etiqueta,
        )
        db.add(pago)

    db.commit()
    db.refresh(nueva)
    return nueva


@app.put("/api/recurrentes/{rec_id}", response_model=schemas.TransaccionRecurrenteOut)
def actualizar_recurrente(
    rec_id: int,
    payload: schemas.TransaccionRecurrenteUpdate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    rec = _recurrente_del_usuario(db, rec_id, usuario)

    if payload.nombre is not None:
        rec.nombre = payload.nombre.strip()
    if payload.monto_total is not None:
        rec.monto_total = payload.monto_total
    if payload.categoria is not None:
        rec.categoria = payload.categoria
    if payload.descripcion is not None:
        rec.descripcion = payload.descripcion
    if payload.activa is not None:
        rec.activa = 1 if payload.activa else 0
    if payload.fecha_fin is not None:
        rec.fecha_fin = payload.fecha_fin

    db.commit()
    db.refresh(rec)
    return rec


@app.delete("/api/recurrentes/{rec_id}", status_code=204)
def eliminar_recurrente(
    rec_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    rec = _recurrente_del_usuario(db, rec_id, usuario)
    db.delete(rec)
    db.commit()



def _ultimo_dia_mes(anio: int, mes: int) -> int:
    """Devuelve el último día del mes."""
    return calendar.monthrange(anio, mes)[1]


def _pago_aplica_hoy(
    pago: models.RecurrentePago,
    hoy: date,
    rec: models.TransaccionRecurrente,
) -> bool:
    """Verifica si un pago específico cae hoy."""
    if rec.frecuencia == "mensual":
        # dia_del_mes = 0 significa "último día del mes"
        if pago.dia_del_mes == 0:
            return hoy.day == _ultimo_dia_mes(hoy.year, hoy.month)

        ultimo_dia = _ultimo_dia_mes(hoy.year, hoy.month)
        if pago.dia_del_mes > ultimo_dia:
            # Si pide día 31 y el mes tiene 30, cae en el último día
            return hoy.day == ultimo_dia
        return hoy.day == pago.dia_del_mes

    elif rec.frecuencia == "anual":
        if hoy.month != rec.fecha_inicio.month:
            return False
        if pago.dia_del_mes == 0:
            return hoy.day == _ultimo_dia_mes(hoy.year, hoy.month)
        ultimo_dia = _ultimo_dia_mes(hoy.year, hoy.month)
        dia_valido = min(pago.dia_del_mes, ultimo_dia)
        return hoy.day == dia_valido

    return False

def _procesar_recurrentes_de_usuario(
    db: Session,
    usuario: models.Usuario,
    hoy: date,
) -> dict:
    """Procesa las recurrentes de UN usuario. Devuelve el resumen."""
    procesadas = []
    errores = []

    recurrentes = (
        db.query(models.TransaccionRecurrente)
        .filter(
            models.TransaccionRecurrente.usuario_id == usuario.id,
            models.TransaccionRecurrente.activa == 1,
        )
        .all()
    )

    for rec in recurrentes:
        if rec.fecha_inicio > hoy:
            continue
        if rec.fecha_fin and rec.fecha_fin < hoy:
            continue

        for pago in rec.pagos:
            if not _pago_aplica_hoy(pago, hoy, rec):
                continue

            ya_existe = (
                db.query(models.RegistroRecurrente)
                .filter(
                    models.RegistroRecurrente.recurrente_id == rec.id,
                    models.RegistroRecurrente.pago_id == pago.id,
                    extract("year", models.RegistroRecurrente.fecha_procesado) == hoy.year,
                    extract("month", models.RegistroRecurrente.fecha_procesado) == hoy.month,
                )
                .first()
            )
            if ya_existe:
                continue

            monto_pago = (
                Decimal(rec.monto_total) * Decimal(pago.porcentaje) / Decimal("100")
            ).quantize(Decimal("0.01"))

            ingreso_id = None
            gasto_id = None
            egreso_id = None

            try:
                if rec.tipo == "ingreso":
                    nuevo = models.Ingreso(
                        usuario_id=usuario.id,
                        cuenta_id=rec.cuenta_id,
                        fecha=hoy,
                        monto=monto_pago,
                        descripcion=rec.descripcion or rec.nombre,
                        categoria=rec.categoria,
                    )
                    db.add(nuevo)
                    db.flush()
                    ingreso_id = nuevo.id

                elif rec.tipo == "gasto_cuenta":
                    cuenta = db.query(models.Cuenta).get(rec.cuenta_id)
                    if cuenta:
                        saldo = _calcular_saldo_cuenta(db, cuenta)
                        if monto_pago > saldo:
                            errores.append(
                                f"{rec.nombre}: saldo insuficiente en '{cuenta.nombre}' "
                                f"(disponible ${saldo:.2f}, requiere ${monto_pago:.2f})"
                            )
                            continue

                    nuevo = models.EgresoCuenta(
                        usuario_id=usuario.id,
                        cuenta_id=rec.cuenta_id,
                        monto=monto_pago,
                        fecha=hoy,
                        categoria=rec.categoria,
                        descripcion=rec.descripcion or rec.nombre,
                    )
                    db.add(nuevo)
                    db.flush()
                    egreso_id = nuevo.id

                elif rec.tipo == "gasto_tarjeta":
                    nuevo = models.Gasto(
                        tarjeta_id=rec.tarjeta_id,
                        fecha=hoy,
                        monto=monto_pago,
                        descripcion=rec.descripcion or rec.nombre,
                        categoria=rec.categoria,
                    )
                    db.add(nuevo)
                    db.flush()
                    gasto_id = nuevo.id

                registro = models.RegistroRecurrente(
                    recurrente_id=rec.id,
                    pago_id=pago.id,
                    fecha_procesado=hoy,
                    monto=monto_pago,
                    ingreso_id=ingreso_id,
                    gasto_id=gasto_id,
                    egreso_id=egreso_id,
                )
                db.add(registro)

                procesadas.append({
                    "recurrente": rec.nombre,
                    "pago": pago.etiqueta or f"Día {pago.dia_del_mes}",
                    "monto": float(monto_pago),
                    "tipo": rec.tipo,
                })
            except Exception as e:
                errores.append(f"{rec.nombre}: {str(e)}")
                continue

    return {"procesadas": procesadas, "errores": errores}


@app.post("/api/recurrentes/procesar")
def procesar_recurrentes(
    fecha: date | None = None,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    """Procesa las recurrentes del usuario actual (para pruebas o desde la app)."""
    hoy = fecha or date.today()
    resultado = _procesar_recurrentes_de_usuario(db, usuario, hoy)
    db.commit()

    return {
        "fecha": hoy.isoformat(),
        "procesadas": resultado["procesadas"],
        "cantidad": len(resultado["procesadas"]),
        "errores": resultado["errores"],
    }


@app.post("/api/recurrentes/procesar-todos")
def procesar_recurrentes_todos(
    x_cron_key: str | None = Header(default=None),
    fecha: date | None = None,
    db: Session = Depends(get_db),
):
    """
    Procesa las recurrentes de TODOS los usuarios.
    Requiere el header X-Cron-Key con la clave secreta.
    """
    try:
        if not CRON_API_KEY:
            raise HTTPException(status_code=500, detail="CRON_API_KEY no configurada")

        if x_cron_key != CRON_API_KEY:
            raise HTTPException(status_code=403, detail="API key inválida")

        hoy = fecha or date.today()
        usuarios = db.query(models.Usuario).all()

        resumen = {
            "fecha": hoy.isoformat(),
            "usuarios_totales": len(usuarios),
            "usuarios_con_procesos": 0,
            "transacciones_creadas": 0,
            "errores": [],
        }

        for usuario in usuarios:
            try:
                resultado = _procesar_recurrentes_de_usuario(db, usuario, hoy)
                if resultado["procesadas"]:
                    resumen["usuarios_con_procesos"] += 1
                    resumen["transacciones_creadas"] += len(resultado["procesadas"])
                for err in resultado["errores"]:
                    resumen["errores"].append(f"{usuario.email}: {err}")
            except Exception as e:
                resumen["errores"].append(f"{usuario.email}: {str(e)}")
                continue

        db.commit()
        return resumen

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error interno: {type(e).__name__}: {str(e)}\n\nTraceback:\n{tb[:1500]}",
        )

@app.get("/api/recurrentes/{rec_id}/historial")
def historial_recurrente(
    rec_id: int,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    """Devuelve los últimos procesamientos de una recurrente."""
    rec = _recurrente_del_usuario(db, rec_id, usuario)

    registros = (
        db.query(models.RegistroRecurrente)
        .filter(models.RegistroRecurrente.recurrente_id == rec.id)
        .order_by(models.RegistroRecurrente.fecha_procesado.desc())
        .limit(50)
        .all()
    )

    return [
        {
            "id": r.id,
            "fecha_procesado": r.fecha_procesado.isoformat(),
            "monto": float(r.monto),
            "pago_id": r.pago_id,
        }
        for r in registros
    ]