// En local, deja esto vacío y el proxy de Vite (vite.config.js) redirige /api al backend.
// En producción, define VITE_API_URL apuntando a tu backend desplegado, por ejemplo:
//   VITE_API_URL=https://tu-backend.onrender.com/api
const BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getTarjetas: () => request("/tarjetas"),
  getGastos: (anio, mes) => request(`/gastos?anio=${anio}&mes=${mes}`),
  getResumen: (anio, mes) => request(`/resumen?anio=${anio}&mes=${mes}`),
  crearGasto: (gasto) =>
    request("/gastos", { method: "POST", body: JSON.stringify(gasto) }),
  eliminarGasto: (id) => request(`/gastos/${id}`, { method: "DELETE" }),
};
