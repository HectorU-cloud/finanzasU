# 💸 Control de Gastos

App de finanzas personales y familiares con soporte para cuentas, ingresos, tarjetas de crédito, grupos compartidos, presupuestos y pagos parciales.

**🌐 Demo en producción:** [frontend-psi-kohl-14.vercel.app](https://frontend-psi-kohl-14.vercel.app)

---

## ✨ Características

### Finanzas personales
- 📊 Dashboard con saldo neto, cuentas y tarjetas
- 💰 Registro de ingresos por cuenta
- 💳 Gastos categorizados con temas visuales por tarjeta
- 💳 Pagos parciales y totales de tarjetas con validación de saldo
- 📜 Historial de pagos con posibilidad de revertir
- 📥 Exportación a CSV filtrable por categoría

### Grupos compartidos
- 👥 Grupos con código de invitación
- 💵 División equitativa o personalizada de gastos
- 📈 Presupuesto mensual por grupo con alerta visual
- 🧾 Saldos individuales (quién debe a quién)
- 🏷️ Resumen de gastos del grupo por categoría

### Cuenta y seguridad
- 🔐 Autenticación con JWT (bcrypt para contraseñas)
- 🔑 Cambio de contraseña desde la app
- 📱 PWA instalable (iOS/Android)

---

## 🛠️ Stack

| Capa | Tecnología |
|------|------------|
| **Backend** | FastAPI, SQLAlchemy, Alembic, PostgreSQL, Pydantic |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Auth** | JWT + bcrypt |
| **DB** | PostgreSQL (Supabase) |
| **Hosting** | Railway (backend) + Vercel (frontend) |
| **CI/CD** | GitHub Actions |

---

## 🚀 Instalación local

### Requisitos
- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ (o cuenta en Supabase)
- Git

### 1. Clonar el repositorio

```bash
git clone https://github.com/HectorU-cloud/finanzasU.git
cd finanzasU