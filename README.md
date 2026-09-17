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

## Base de datos en producción (Supabase o Neon, gratis)

En vez de depender de un disco persistente de pago en Render, usa una base de
datos Postgres gratuita externa:

1. Crea una cuenta y un proyecto nuevo en [supabase.com](https://supabase.com)
   o [neon.tech](https://neon.tech) (cualquiera de los dos sirve, ambos tienen
   plan gratuito permanente).
2. Copia la **connection string** que te dan (empieza con `postgresql://...`).
   - En Supabase: Project Settings → Database → Connection string → modo "URI".
   - En Neon: la ves directo en el dashboard del proyecto.
3. En Render, ve a tu servicio → **Environment** → agrega una variable:
   - Key: `DATABASE_URL`
   - Value: la connection string que copiaste
4. Vuelve a desplegar (Render lo hace solo al guardar la variable). Al arrancar,
   el backend crea las tablas automáticamente en esa base de datos — ya no
   depende del disco local, así que los datos sobreviven aunque la instancia
   se duerma o se redepliegue.

Con esto puedes quedarte tranquilamente en el plan Free de Render.


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
