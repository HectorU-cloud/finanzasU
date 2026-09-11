// En local, deja esto vacío y el proxy de Vite (vite.config.js) redirige /api al backend.
// En producción, define VITE_API_URL apuntando a tu backend desplegado, por ejemplo:
//   VITE_API_URL=https://tu-backend.onrender.com/api
const BASE = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "finanzas_token";

function leerTokenGuardado() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let authToken = leerTokenGuardado();

export function setAuthToken(token) {
  authToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage puede fallar en navegación privada; no es crítico.
  }
}

export function hayTokenGuardado() {
  return Boolean(authToken);
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(BASE + path, { ...options, headers });

  if (res.status === 401) {
    setAuthToken(null);
    const err = new Error("Tu sesión expiró. Inicia sesión de nuevo.");
    err.unauthorized = true;
    throw err;
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  registro: (datos) => request("/auth/registro", { method: "POST", body: JSON.stringify(datos) }),
  login: (datos) => request("/auth/login", { method: "POST", body: JSON.stringify(datos) }),
  yo: () => request("/auth/yo"),

  getTarjetas: () => request("/tarjetas"),
  getGastos: (anio, mes, categoria = null) => {
    let url = `/gastos?anio=${anio}&mes=${mes}`;
    if (categoria) url += `&categoria=${encodeURIComponent(categoria)}`;
    return request(url);
  },
  getResumen: (anio, mes) => request(`/resumen?anio=${anio}&mes=${mes}`),
  getResumenCategorias: (anio, mes) =>
    request(`/resumen/categorias?anio=${anio}&mes=${mes}`),
  getCategorias: () => request("/categorias"),
  crearGasto: (gasto) =>
    request("/gastos", { method: "POST", body: JSON.stringify(gasto) }),
  eliminarGasto: (id) => request(`/gastos/${id}`, { method: "DELETE" }),
  crearTarjeta: (tarjeta) =>
    request("/tarjetas", { method: "POST", body: JSON.stringify(tarjeta) }),
  actualizarTarjeta: (id, cambios) =>
    request(`/tarjetas/${id}`, { method: "PUT", body: JSON.stringify(cambios) }),
  eliminarTarjeta: (id) => request(`/tarjetas/${id}`, { method: "DELETE" }),

  getGrupos: () => request("/grupos"),
  crearGrupo: (nombre) => request("/grupos", { method: "POST", body: JSON.stringify({ nombre }) }),
  unirseGrupo: (codigo) =>
    request(`/grupos/unirse?codigo=${encodeURIComponent(codigo)}`, { method: "POST" }),
  getGastosGrupo: (grupoId) => request(`/grupos/${grupoId}/gastos`),
  getSaldosGrupo: (grupoId) => request(`/grupos/${grupoId}/saldos`),
  crearGastoCompartido: (datos) =>
    request("/gastos-compartidos", { method: "POST", body: JSON.stringify(datos) }),
  marcarDivisionPagada: (divisionId) =>
    request(`/divisiones/${divisionId}/pagar`, { method: "PATCH" }),
  salirDeGrupo: (grupoId) => request(`/grupos/${grupoId}/salir`, { method: "POST" }),
  eliminarGrupo: (grupoId) => request(`/grupos/${grupoId}`, { method: "DELETE" }),

  exportarGastos: async (desde, hasta) => {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${BASE}/gastos/export?desde=${desde}&hasta=${hasta}`, { headers });
    if (res.status === 401) {
      setAuthToken(null);
      const err = new Error("Tu sesión expiró. Inicia sesión de nuevo.");
      err.unauthorized = true;
      throw err;
    }
    if (!res.ok) throw new Error("No se pudo generar el archivo.");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    return { blob, filename: match?.[1] || "gastos.csv" };
  },
};