import calendar
import csv
import io
import os
import secrets as secrets_module
import resend
from datetime import date, datetime, timedelta, timezone
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

# --- Configuración de Resend (email) ---
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@vectoraec.app")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def enviar_email_reset(destinatario: str, nombre: str, token: str) -> bool:
    """Envía el email de recuperación. Devuelve True si se envió."""
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
def solicitar_reset(
    datos: schemas.SolicitarReset,
    db: Session = Depends(get_db),
):
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

    return {
        "ok": True,
        "mensaje": "Si el correo existe, te enviamos un enlace.",
        "email_enviado": enviado,
    }


@app.post("/api/auth/reset-password", status_code=204)
def reset_password(
    datos: schemas.ResetPassword,
    db: Session = Depends(get_db),
):
    reset = (
        db.query(models.PasswordReset)
        .filter(models.PasswordReset.token == datos.token)
        .filter(models.PasswordReset.usado == 0)
        .first()
    )
    if not reset:
        raise HTTPException(
            status_code=400,
            detail="Enlace inválido o ya utilizado. Solicita uno nuevo."
        )

    ahora = datetime.now(timezone.utc)
    expira = reset.expira_en
    if expira.tzinfo is None:
        expira = expira.replace(tzinfo=timezone.utc)
    if expira < ahora:
        raise HTTPException(
            status_code=400,
            detail="El enlace expiró. Solicita uno nuevo."
        )

    usuario = db.query(models.Usuario).get(reset.usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.password_hash = auth.hash_password(datos.password_nueva)
    reset.usado = 1
    db.commit()



@app.get("/api/auth/yo", response_model=schemas.UsuarioOut)
def yo(usuario: models.Usuario = Depends(auth.obtener_usuario_actual)):
    return usuario

# ---------- Cuentas ----------

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
    if payload.titular is not None:              # <-- NUEVA
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

    # Verificar que no tenga ingresos asociados
    tiene_ingresos = (
        db.query(models.Ingreso)
        .filter(models.Ingreso.cuenta_id == cuenta_id)
        .first()
    )
    if tiene_ingresos:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No puedes eliminar '{cuenta.nombre}' porque tiene ingresos registrados. "
                "Elimina primero los ingresos o muévelos a otra cuenta."
            ),
        )

    # Verificar que no tenga pagos asociados
    tiene_pagos = (
        db.query(models.PagoTarjeta)
        .filter(models.PagoTarjeta.cuenta_id == cuenta_id)
        .first()
    )
    if tiene_pagos:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No puedes eliminar '{cuenta.nombre}' porque tiene pagos de tarjeta registrados. "
                "Elimínalos primero desde la sección Pagos."
            ),
        )

    db.delete(cuenta)
    db.commit()


@app.get("/api/cuentas/resumen-total")
def resumen_total_cuentas(
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(auth.obtener_usuario_actual),
):
    cuentas = (
        db.query(models.Cuenta)
        .filter(models.Cuenta.usuario_id == usuario.id)
        .all()
    )
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
        total += Decimal(c.saldo_inicial) + Decimal(ingresos) - Decimal(pagos) + _abonos_netos_cuenta(db, c.id)
    return {
        "total": float(total),
        "cantidad_cuentas": len(cuentas),
    }

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

    # 1. Ingresos a la cuenta
    ingresos = (
        db.query(models.Ingreso)
        .filter(models.Ingreso.cuenta_id == cuenta_id)
        .all()
    )
    for i in ingresos:
        movimientos.append(schemas.MovimientoCuenta(
            tipo="ingreso",
            monto=Decimal(i.monto),
            fecha=i.fecha,
            descripcion=i.descripcion or i.categoria or "Ingreso",
            referencia_id=i.id,
        ))

    # 2. Pagos de tarjeta desde esta cuenta
    pagos = (
        db.query(models.PagoTarjeta)
        .filter(models.PagoTarjeta.cuenta_id == cuenta_id)
        .all()
    )
    for p in pagos:
        tarjeta = db.query(models.Tarjeta).get(p.tarjeta_id)
        movimientos.append(schemas.MovimientoCuenta(
            tipo="pago_tarjeta",
            monto=-Decimal(p.monto),
            fecha=p.fecha_pago,
            descripcion=f"Pago a {tarjeta.nombre if tarjeta else 'tarjeta'}",
            referencia_id=p.id,
            referencia_nombre=tarjeta.nombre if tarjeta else None,
        ))

    # 3. Movimientos de potes asociados a esta cuenta
    potes = (
        db.query(models.Pote)
        .filter(models.Pote.cuenta_id == cuenta_id)
        .all()
    )
    pote_ids = [p.id for p in potes]
    if pote_ids:
        movs_pote = (
            db.query(models.MovimientoPote)
            .filter(models.MovimientoPote.pote_id.in_(pote_ids))
            .all()
        )
        for mp in movs_pote:
            pote = next((p for p in potes if p.id == mp.pote_id), None)
            # Depósito al pote = RESTA a la cuenta (dinero sale)
            # Retiro del pote = SUMA a la cuenta (dinero entra)
            movimientos.append(schemas.MovimientoCuenta(
                tipo="deposito_pote" if Decimal(mp.monto) > 0 else "retiro_pote",
                monto=-Decimal(mp.monto),
                fecha=mp.fecha,
                descripcion=f"{'Depósito a' if Decimal(mp.monto) > 0 else 'Retiro de'} {pote.emoji} {pote.nombre}" if pote else "Movimiento de pote",
                referencia_id=mp.pote_id,
                referencia_nombre=pote.nombre if pote else None,
            ))

        # 4. Abonos de deudas ligados a esta cuenta
    abonos = (
        db.query(models.AbonoDeuda, models.Deuda)
        .join(models.Deuda, models.AbonoDeuda.deuda_id == models.Deuda.id)
        .filter(models.AbonoDeuda.cuenta_id == cuenta_id)
        .all()
    )
    for abono, deuda in abonos:
        es_salida = deuda.tipo == "debo"
        movimientos.append(schemas.MovimientoCuenta(
            tipo="abono_deuda",
            monto=-Decimal(abono.monto) if es_salida else Decimal(abono.monto),
            fecha=abono.fecha,
            descripcion=(
                f"Abono a {deuda.persona}" if es_salida
                else f"Cobro de {deuda.persona}"
            ),
            referencia_id=abono.id,
            referencia_nombre=deuda.persona,
        ))

    movimientos.sort(key=lambda m: m.fecha, reverse=True)
    return movimientos

# ---------- Pagos de tarjetas ----------

def _calcular_estado_pago(db: Session, tarjeta: models.Tarjeta, anio: int, mes: int):
    """Calcula el estado del pago de una tarjeta para un mes."""
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
    """Recordatorios: cortes próximos (siguientes 3 días) y pagos atrasados
    de meses anteriores que aún no se han marcado como pagados."""
    hoy = date.today()
    primer_dia_mes_actual = date(hoy.year, hoy.month, 1)
    tarjetas = db.query(models.Tarjeta).filter(models.Tarjeta.usuario_id == usuario.id).all()

    alertas = []
    for t in tarjetas:
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

    # Recordatorios de deudas activas, según la frecuencia que cada quien eligió
    deudas = (
        db.query(models.Deuda)
        .filter(models.Deuda.usuario_id == usuario.id, models.Deuda.pagada == 0)
        .all()
    )
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

    cuenta = (
        db.query(models.Cuenta)
        .filter(
            models.Cuenta.id == datos.cuenta_id,
            models.Cuenta.usuario_id == usuario.id,
        )
        .first()
    )
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    # --- Validar saldo suficiente en la cuenta ---
    ingresos_cuenta = (
        db.query(func.coalesce(func.sum(models.Ingreso.monto), 0))
        .filter(models.Ingreso.cuenta_id == cuenta.id)
        .scalar()
    )
    pagos_cuenta = (
        db.query(func.coalesce(func.sum(models.PagoTarjeta.monto), 0))
        .filter(models.PagoTarjeta.cuenta_id == cuenta.id)
        .scalar()
    )
    saldo_actual = (
        Decimal(cuenta.saldo_inicial) + Decimal(ingresos_cuenta) - Decimal(pagos_cuenta)
    )

    if datos.monto > saldo_actual:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Saldo insuficiente en '{cuenta.nombre}'. "
                f"Disponible: ${saldo_actual:.2f} · "
                f"Intentas pagar: ${datos.monto:.2f}"
            ),
        )

    # --- Validar monto del pago ---
    estado = _calcular_estado_pago(db, tarjeta, datos.anio, datos.mes)

    if estado["total_gastos"] == 0:
        raise HTTPException(
            status_code=400,
            detail="Esta tarjeta no tiene gastos en ese mes",
        )

    if estado["cerrado"]:
        raise HTTPException(
            status_code=400,
            detail="Esta tarjeta ya está pagada para ese mes",
        )

    if datos.monto > estado["pendiente"]:
        raise HTTPException(
            status_code=400,
            detail=f"El monto excede lo pendiente (${estado['pendiente']:.2f})",
        )

    # --- Registrar el pago ---
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

    # ¿Cerró el mes?
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
        .filter(
            models.PagoTarjeta.id == pago_id,
            models.PagoTarjeta.usuario_id == usuario.id,
        )
        .first()
    )
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    # Desmarcar los gastos que apuntaban a este pago
    db.query(models.Gasto).filter(models.Gasto.pago_id == pago.id).update(
        {models.Gasto.pago_id: None}
    )
    db.delete(pago)
    db.commit()

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
        .filter(
            models.Cuenta.id == datos.cuenta_id,
            models.Cuenta.usuario_id == usuario.id,
        )
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
        .filter(
            models.Ingreso.id == ingreso_id,
            models.Ingreso.usuario_id == usuario.id,
        )
        .first()
    )
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")

    if payload.cuenta_id is not None:
        cuenta = (
            db.query(models.Cuenta)
            .filter(
                models.Cuenta.id == payload.cuenta_id,
                models.Cuenta.usuario_id == usuario.id,
            )
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
        .filter(
            models.Ingreso.id == ingreso_id,
            models.Ingreso.usuario_id == usuario.id,
        )
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

# ---------- Pots (metas de ahorro) ----------

def _pote_del_usuario(db: Session, pote_id: int, usuario: models.Usuario) -> models.Pote:
    pote = (
        db.query(models.Pote)
        .filter(models.Pote.id == pote_id, models.Pote.usuario_id == usuario.id)
        .first()
    )
    if not pote:
        raise HTTPException(status_code=404, detail="Pote no encontrado")
    return pote


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
        + _abonos_netos_cuenta(db, cuenta.id)   # <-- NUEVO
    )


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
        .filter(
            models.Cuenta.id == datos.cuenta_id,
            models.Cuenta.usuario_id == usuario.id,
        )
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

    # Si tiene saldo, devolverlo a la cuenta antes de eliminar
    if Decimal(pote.saldo) > 0:
        cuenta = db.query(models.Cuenta).get(pote.cuenta_id)
        if cuenta:
            # No hay campo "saldo" persistido en cuentas; el saldo real es
            # calculado con ingresos + saldo_inicial - pagos. Cuando
            # eliminamos el pote, el dinero "vuelve" automáticamente porque
            # el saldo del pote ya no se descuenta en las próximas consultas.
            pass

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

    # Validar saldo disponible en la cuenta (ingresos + saldo_inicial - pagos - pots)
    saldo_cuenta = _calcular_saldo_cuenta(db, cuenta)

    # Restar lo que ya está en otros potes de esa cuenta
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
            detail=(
                f"Saldo insuficiente en '{cuenta.nombre}'. "
                f"Disponible: ${saldo_disponible:.2f} · "
                f"Intentas depositar: ${datos.monto:.2f}"
            ),
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
            detail=(
                f"El pote solo tiene ${float(pote.saldo):.2f}. "
                f"No puedes retirar ${datos.monto:.2f}"
            ),
        )

    pote.saldo = Decimal(pote.saldo) - datos.monto

    mov = models.MovimientoPote(
        pote_id=pote.id,
        monto=-datos.monto,  # negativo = retiro
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
    if payload.dia_pago is not None:        # <-- NUEVA
        tarjeta.dia_pago = payload.dia_pago
    if payload.red is not None:
        tarjeta.red = payload.red
    if payload.tema is not None:
        tarjeta.tema = payload.tema    
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
    tarjeta_del_usuario(db, gasto.tarjeta_id, usuario)
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
        .filter(models.Gasto.pago_id.is_(None))    # ← NUEVO: solo pendientes
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
            .filter(models.Gasto.pago_id.is_(None))    # ← NUEVO
            .filter(extract("year", models.Gasto.fecha) == anio)
            .filter(extract("month", models.Gasto.fecha) == mes)
            .scalar()
        )
        resumen_tarjetas.append(schemas.ResumenTarjeta(
            id=t.id,
            nombre=t.nombre,
            dia_corte=t.dia_corte,
            dia_pago=t.dia_pago,      # <-- NUEVO
            red=t.red,
            tema=t.tema,
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


# ---------- Grupos ----------


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
    miembro = db.query(models.MiembroGrupo).filter(
        models.MiembroGrupo.grupo_id == grupo_id,
        models.MiembroGrupo.usuario_id == usuario.id,
    ).first()
    if not miembro:
        raise HTTPException(status_code=403, detail="No eres miembro de este grupo")

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
        saldos[m.id] = {
            "usuario_id": m.id,
            "nombre": m.nombre,
            "debe": saldo,
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


# ---------- Notas ----------

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
    nueva = models.Nota(usuario_id=usuario.id, contenido=datos.contenido)
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
    resumen.sort(key=lambda r: r.total, reverse=True)
    return resumen

# ---------- Deudas ----------

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



def _abonos_netos_cuenta(db: Session, cuenta_id: int) -> Decimal:
    """Calcula el efecto neto de los abonos ligados a esta cuenta.
    - deudas 'debo' (pagos) → negativo (sale dinero)
    - deudas 'me_deben' (cobros) → positivo (entra dinero)
    """
    salidas = (
        db.query(func.coalesce(func.sum(models.AbonoDeuda.monto), 0))
        .join(models.Deuda, models.AbonoDeuda.deuda_id == models.Deuda.id)
        .filter(
            models.AbonoDeuda.cuenta_id == cuenta_id,
            models.Deuda.tipo == "debo",
        )
        .scalar()
    )
    entradas = (
        db.query(func.coalesce(func.sum(models.AbonoDeuda.monto), 0))
        .join(models.Deuda, models.AbonoDeuda.deuda_id == models.Deuda.id)
        .filter(
            models.AbonoDeuda.cuenta_id == cuenta_id,
            models.Deuda.tipo == "me_deben",
        )
        .scalar()
    )
    return Decimal(entradas) - Decimal(salidas)


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
            detail=(
                f"El abono (${datos.monto:.2f}) es mayor al saldo pendiente "
                f"(${deuda.saldo_pendiente:.2f})"
            ),
        )

    # Validar cuenta si se proporcionó
    if datos.cuenta_id is not None:
        cuenta = (
            db.query(models.Cuenta)
            .filter(
                models.Cuenta.id == datos.cuenta_id,
                models.Cuenta.usuario_id == usuario.id,
            )
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
