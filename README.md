# Control de gastos personal

App para registrar gastos diarios por tarjeta, con corte de tarjeta configurable
y alerta visual cuando el total del mes calendario supera $350.

## Estructura

```
finanzas-app/
  backend/     API en FastAPI + SQLite (base de datos en un archivo local)
  frontend/    Interfaz en React + Vite
```

## 1. Levantar el backend

Requiere Python 3.10+.

```bash
cd backend
python -m venv venv
source venv/bin/activate        # en Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Esto deja la API corriendo en `http://localhost:8000`. La primera vez que arranca
crea el archivo `finanzas.db` y siembra dos tarjetas: "Tarjeta 1" (corte día 31)
y "Tarjeta 2" (corte día 4). Puedes ver la documentación interactiva en
`http://localhost:8000/docs`.

## 2. Levantar el frontend

Requiere Node.js 18+.

```bash
cd frontend
npm install
npm run dev
```

Esto abre la app en `http://localhost:5173`. El frontend está configurado para
redirigir automáticamente las llamadas a `/api` hacia el backend en el puerto 8000
(ver `vite.config.js`), así que con ambos corriendo a la vez ya funciona todo junto.

## Cambiar los días de corte o agregar tarjetas

Por ahora los días de corte se definen al crear cada tarjeta. Puedes:
- Editar los valores sembrados en `backend/main.py` (función `seed_tarjetas`) antes
  del primer arranque.
- O crear tarjetas nuevas llamando a `POST /api/tarjetas` con `{"nombre": "...", "dia_corte": N}`
  desde `http://localhost:8000/docs`.

## Cambiar el límite mensual

Está definido como `LIMITE_MENSUAL` en `backend/main.py`.

## Pasar a PostgreSQL más adelante

Por defecto todo corre sobre un archivo SQLite (`finanzas.db`), que es suficiente
para uso personal. Si más adelante quieres PostgreSQL, solo necesitas:

1. Instalar `psycopg2-binary` (`pip install psycopg2-binary`).
2. Definir la variable de entorno `DATABASE_URL`, por ejemplo:
   ```
   DATABASE_URL=postgresql://usuario:password@localhost:5432/finanzas
   ```
3. Volver a levantar el backend — las tablas se crean solas al arrancar.

## Desplegarla para usarla desde el celular

1. Sube la carpeta `finanzas-app/` a un repositorio de GitHub (Render y Vercel
   despliegan directamente desde ahí).
2. **Backend en Render** (plan gratuito sirve): "New Web Service" → conecta el
   repo → root directory `backend` → build command `pip install -r requirements.txt`
   → start command `uvicorn main:app --host 0.0.0.0 --port $PORT`. Activa un
   "Persistent Disk" pequeño montado en `/opt/render/project/src` para que
   `finanzas.db` no se borre en cada redeploy.
3. **Frontend en Vercel**: "New Project" → conecta el repo → root directory
   `frontend` → framework Vite (se detecta solo). En "Environment Variables"
   agrega `VITE_API_URL` con la URL pública que te dio Render + `/api`
   (ej. `https://tu-backend.onrender.com/api`).
4. Despliega. Abre la URL de Vercel desde tu celular y ya deberías ver la app
   funcionando contra tu backend real.
