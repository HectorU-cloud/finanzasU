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

  let res;
  try {
    res = await fetch(BASE + path, { ...options, headers });
  } catch (err) {
    throw new Error(
      "No se pudo conectar con el servidor. Revisa tu conexión, o el servidor podría estar iniciando (intenta de nuevo en unos segundos)."
    );
  }

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
  const data = await res.json().catch(() => null);
  return data;
}

export const api = {
  registro: (datos) => request("/auth/registro", { method: "POST", body: JSON.stringify(datos) }),
  login: (datos) => request("/auth/login", { method: "POST", body: JSON.stringify(datos) }),
  yo: () => request("/auth/yo"),

  cambiarPassword: (datos) =>
  request("/auth/cambiar-password", { method: "POST", body: JSON.stringify(datos) }),

  
  // Ingresos
  getIngresos: (anio, mes) => {
    let url = "/ingresos";
    const params = [];
    if (anio) params.push(`anio=${anio}`);
    if (mes) params.push(`mes=${mes}`);
    if (params.length) url += `?${params.join("&")}`;
    return request(url);
  },
  // Pagos de tarjeta
  getEstadoPagoTarjeta: (tarjetaId, anio, mes) =>
    request(`/tarjetas/${tarjetaId}/estado-pago?anio=${anio}&mes=${mes}`),
  crearPagoTarjeta: (datos) =>
    request("/pagos-tarjeta", { method: "POST", body: JSON.stringify(datos) }),
  getPagosTarjeta: () => request("/pagos-tarjeta"),
  eliminarPagoTarjeta: (id) => request(`/pagos-tarjeta/${id}`, { method: "DELETE" }),

  // Recuperar contraseña
  solicitarReset: (email) =>
    request("/auth/solicitar-reset", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token, passwordNueva) =>
    request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password_nueva: passwordNueva }),
    }),

  // Cuentas
  crearIngreso: (ingreso) =>
    request("/ingresos", { method: "POST", body: JSON.stringify(ingreso) }),
  actualizarIngreso: (id, cambios) =>
    request(`/ingresos/${id}`, { method: "PUT", body: JSON.stringify(cambios) }),
  eliminarIngreso: (id) => request(`/ingresos/${id}`, { method: "DELETE" }),
  getResumenIngresos: (anio, mes) =>
    request(`/ingresos/resumen?anio=${anio}&mes=${mes}`),
  getCategoriasIngreso: () => request("/categorias-ingreso"),
  getCuentas: () => request("/cuentas"),
  getMovimientosCuenta: (cuentaId) => request(`/cuentas/${cuentaId}/movimientos`),
  crearCuenta: (cuenta) =>
    request("/cuentas", { method: "POST", body: JSON.stringify(cuenta) }),
  actualizarCuenta: (id, cambios) =>
    request(`/cuentas/${id}`, { method: "PUT", body: JSON.stringify(cambios) }),
  eliminarCuenta: (id) => request(`/cuentas/${id}`, { method: "DELETE" }),
  getResumenTotalCuentas: () => request("/cuentas/resumen-total"),

  // Deudas (debo / me deben)
  getDeudas: (incluirPagadas = false) =>
    request(`/deudas?incluir_pagadas=${incluirPagadas}`),
  crearDeuda: (deuda) =>
    request("/deudas", { method: "POST", body: JSON.stringify(deuda) }),
  actualizarDeuda: (id, cambios) =>
    request(`/deudas/${id}`, { method: "PUT", body: JSON.stringify(cambios) }),
  eliminarDeuda: (id) => request(`/deudas/${id}`, { method: "DELETE" }),
  abonarDeuda: (id, datos) =>
    request(`/deudas/${id}/abonar`, { method: "POST", body: JSON.stringify(datos) }),
  getAbonosDeuda: (id) => request(`/deudas/${id}/abonos`),

  // Notas
  getNotas: () => request("/notas"),
  crearNota: (contenido, color = "rosa") =>
    request("/notas", { method: "POST", body: JSON.stringify({ contenido, color }) }),
  actualizarNota: (id, contenido, color = null) =>
    request(`/notas/${id}`, {
      method: "PUT",
      body: JSON.stringify(color ? { contenido, color } : { contenido }),
    }),
  eliminarNota: (id) => request(`/notas/${id}`, { method: "DELETE" }),

  // Egresos directos de cuenta
  getEgresosCuenta: (anio, mes) => {
    const params = [];
    if (anio) params.push(`anio=${anio}`);
    if (mes) params.push(`mes=${mes}`);
    const qs = params.length ? `?${params.join("&")}` : "";
    return request(`/egresos-cuenta${qs}`);
  },
  crearEgresoCuenta: (datos) =>
    request("/egresos-cuenta", { method: "POST", body: JSON.stringify(datos) }),
  actualizarEgresoCuenta: (id, cambios) =>
    request(`/egresos-cuenta/${id}`, { method: "PUT", body: JSON.stringify(cambios) }),
  eliminarEgresoCuenta: (id) =>
    request(`/egresos-cuenta/${id}`, { method: "DELETE" }),

  // Pots (metas de ahorro)
  getPotes: () => request("/potes"),
  crearPote: (pote) =>
    request("/potes", { method: "POST", body: JSON.stringify(pote) }),
  actualizarPote: (id, cambios) =>
    request(`/potes/${id}`, { method: "PUT", body: JSON.stringify(cambios) }),
  eliminarPote: (id) => request(`/potes/${id}`, { method: "DELETE" }),
  depositarPote: (id, datos) =>
    request(`/potes/${id}/depositar`, { method: "POST", body: JSON.stringify(datos) }),
  retirarPote: (id, datos) =>
    request(`/potes/${id}/retirar`, { method: "POST", body: JSON.stringify(datos) }),
  getMovimientosPote: (id) => request(`/potes/${id}/movimientos`),
  getEmojisPote: () => request("/emojis-pote"),

    // Notas
  getNotas: () => request("/notas"),
  crearNota: (contenido) =>
    request("/notas", { method: "POST", body: JSON.stringify({ contenido }) }),
  actualizarNota: (id, contenido) =>
    request(`/notas/${id}`, { method: "PUT", body: JSON.stringify({ contenido }) }),
  eliminarNota: (id) => request(`/notas/${id}`, { method: "DELETE" }),

  getTarjetas: () => request("/tarjetas"),
    getGastos: (anio, mes, categoria = null, tarjetaId = null) => {
    const params = [];
    if (anio) params.push(`anio=${anio}`);
    if (mes) params.push(`mes=${mes}`);
    if (categoria) params.push(`categoria=${encodeURIComponent(categoria)}`);
    if (tarjetaId) params.push(`tarjeta_id=${tarjetaId}`);
    return request(`/gastos?${params.join("&")}`);
  },
  getResumen: (anio, mes) => request(`/resumen?anio=${anio}&mes=${mes}`),
  getResumenCategorias: (anio, mes) =>
    request(`/resumen/categorias?anio=${anio}&mes=${mes}`),
  getCategorias: () => request("/categorias"),
  getResumenCategoriasGrupo: (grupoId, anio, mes) =>
    request(`/grupos/${grupoId}/resumen-categorias?anio=${anio}&mes=${mes}`),
  crearGasto: (gasto) =>
    request("/gastos", { method: "POST", body: JSON.stringify(gasto) }),
  actualizarGasto: (id, cambios) =>
    request(`/gastos/${id}`, { method: "PUT", body: JSON.stringify(cambios) }),
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
  getAlertas: () => request("/alertas"),
  eliminarGastoCompartido: (grupoId, gastoId) =>
    request(`/grupos/${grupoId}/gastos/${gastoId}`, { method: "DELETE" }),
  actualizarGastoCompartido: (grupoId, gastoId, cambios) =>
    request(`/grupos/${grupoId}/gastos/${gastoId}`, {
      method: "PUT",
      body: JSON.stringify(cambios),
    }),
  getSaldosGrupo: (grupoId) => request(`/grupos/${grupoId}/saldos`),
  getResumenGrupo: (grupoId, anio, mes) =>
    request(`/grupos/${grupoId}/resumen?anio=${anio}&mes=${mes}`),
  actualizarLimiteGrupo: (grupoId, limite) =>
    request(`/grupos/${grupoId}/limite`, {
      method: "PUT",
      body: JSON.stringify({ limite_mensual: limite }),
    }),
  crearGastoCompartido: (datos) =>
    request("/gastos-compartidos", { method: "POST", body: JSON.stringify(datos) }),
  marcarDivisionPagada: (divisionId) =>
    request(`/divisiones/${divisionId}/pagar`, { method: "PATCH" }),
  salirDeGrupo: (grupoId) => request(`/grupos/${grupoId}/salir`, { method: "POST" }),
  eliminarGrupo: (grupoId) => request(`/grupos/${grupoId}`, { method: "DELETE" }),
  getReporteMensual: (anio, mes, meses = 6) =>
    request(`/reportes/mensual?anio=${anio}&mes=${mes}&meses=${meses}`),
  getInsights: () => request("/insights"),
  exportarGastos: async (desde, hasta, categoria = null) => {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    let url = `${BASE}/gastos/export?desde=${desde}&hasta=${hasta}`;
    if (categoria) url += `&categoria=${encodeURIComponent(categoria)}`;
    const res = await fetch(url, { headers });
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
  exportarTodo: async (desde, hasta) => {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const url = `${BASE}/export/todo?desde=${desde}&hasta=${hasta}`;
    const res = await fetch(url, { headers });
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
    return { blob, filename: match?.[1] || "finanzas.zip" };
  },

  exportarIngresos: async (desde, hasta) => {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const url = `${BASE}/export/ingresos?desde=${desde}&hasta=${hasta}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("No se pudo generar el archivo.");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    return { blob, filename: match?.[1] || "ingresos.csv" };
  },

  exportarPagos: async (desde, hasta) => {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const url = `${BASE}/export/pagos?desde=${desde}&hasta=${hasta}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("No se pudo generar el archivo.");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    return { blob, filename: match?.[1] || "pagos.csv" };
  },

  exportarDeudas: async () => {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const url = `${BASE}/export/deudas`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("No se pudo generar el archivo.");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    return { blob, filename: match?.[1] || "deudas.csv" };
  },

  exportarCuenta: async (cuentaId, desde, hasta) => {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const url = `${BASE}/export/cuenta/${cuentaId}?desde=${desde}&hasta=${hasta}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("No se pudo generar el archivo.");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    return { blob, filename: match?.[1] || "cuenta.csv" };
  },

  exportarTarjeta: async (tarjetaId, desde, hasta) => {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const url = `${BASE}/export/tarjeta/${tarjetaId}?desde=${desde}&hasta=${hasta}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("No se pudo generar el archivo.");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    return { blob, filename: match?.[1] || "tarjeta.csv" };
  },

};


