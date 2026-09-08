import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db

# En producción, define la variable de entorno SECRET_KEY en Render con un
# valor largo y aleatorio (por ejemplo, generado con `openssl rand -hex 32`).
SECRET_KEY = os.getenv("SECRET_KEY", "cambia-esta-clave-en-produccion")
ALGORITMO = "HS256"
HORAS_EXPIRACION = 24 * 30  # el token dura 30 días


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def crear_token(usuario_id: int) -> str:
    expira = datetime.now(timezone.utc) + timedelta(hours=HORAS_EXPIRACION)
    payload = {"sub": str(usuario_id), "exp": expira}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITMO)


def obtener_usuario_actual(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.Usuario:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No has iniciado sesión")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITMO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Tu sesión expiró, inicia sesión de nuevo")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Sesión inválida")

    usuario = db.query(models.Usuario).get(int(payload["sub"]))
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return usuario
