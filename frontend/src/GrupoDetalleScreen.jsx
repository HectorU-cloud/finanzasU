import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, Users, Copy, Check, ReceiptText, LogOut, Trash2,
  Pencil, X, MoreVertical, Wallet, TrendingUp, Plus,
} from "lucide-react";
import { api } from "./api.js";
import ConfirmModal from "./ConfirmModal.jsx";
import EditarGastoCompartidoModal from "./EditarGastoCompartidoModal.jsx";
import { SkeletonList } from "./Skeleton.jsx";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function GrupoDetalleScreen({ grupo, usuarioId, tarjetas = [], onVolver }) {
  const [saldos, setSaldos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [resumenGrupo, setResumenGrupo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [editandoLimite, setEditandoLimite] = useState(false);
  const [nuevoLimite, setNuevoLimite] = useState("");
  const [confirmarAccion, setConfirmarAccion] = useState(null);
  const [menuAbiertoId, setMenuAbiertoId] = useState(null);
  const [gastoAEliminar, setGastoAEliminar] = useState(null);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [form, setForm] = useState({
    fecha: todayISO(),
    monto: "",
    descripcion: "",
    categoria: "",
    tarjeta_id: "",
  });
  const [enviando, setEnviando] = useState(false);

  const esCreador = grupo.creado_por_id === usuarioId;
  const hoy = new Date();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [s, g, r] = await Promise.all([
        api.getSaldosGrupo(grupo.id),
        api.getGastosGrupo(grupo.id),
        api.getResumenGrupo(grupo.id, hoy.getFullYear(), hoy.getMonth() + 1),
      ]);
      setSaldos(s || []);
      setGastos(g || []);
      setResumenGrupo(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [grupo.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cargar();
    api.getCategorias().then((d) => setCategorias(d.categorias || [])).catch(() => {});
  }, [cargar]);

  useEffect(() => {
    function cerrarSiEsFuera(e) {
      if (!e.target.closest(".acciones-menu-grupo")) {
        setMenuAbiertoId(null);
      }
    }
    document.addEventListener("click", cerrarSiEsFuera);
    return () => document.removeEventListener("click", cerrarSiEsFuera);
  }, []);

  function nombreDe(id) {
    return grupo.miembros.find((m) => m.usuario_id === id)?.usuario.nombre || "—";
  }

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(grupo.codigo_invitacion);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {}
  }

  async function guardarLimite(e) {
    e.preventDefault();
    const valor = Number(nuevoLimite);
    if (!valor || valor <= 0) {
      setError("El límite debe ser mayor a 0");
      return;
    }
    try {
      await api.actualizarLimiteGrupo(grupo.id, valor);
      setEditandoLimite(false);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function agregarGasto(e) {
    e.preventDefault();
    if (enviando) return;
    const monto = Number(form.monto);
    if (!form.fecha || !monto || monto <= 0) {
      setError("Completa fecha y un monto válido.");
      return;
    }
    if (form.fecha > todayISO()) {
      setError("La fecha no puede ser futura.");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      await api.crearGastoCompartido({
        grupo_id: grupo.id,
        fecha: form.fecha,
        monto,
        descripcion: form.descripcion || null,
        categoria: form.categoria || null,
        tarjeta_id: form.tarjeta_id ? Number(form.tarjeta_id) : null,
      });
      setForm({
        fecha: todayISO(),
        monto: "",
        descripcion: "",
        categoria: "",
        tarjeta_id: "",
      });
      setFormAbierto(false);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarEliminarGasto() {
    if (!gastoAEliminar) return;
    try {
      await api.eliminarGastoCompartido(grupo.id, gastoAEliminar.id);
      setGastoAEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.message);
      setGastoAEliminar(null);
    }
  }

  async function confirmarSalir() {
    try {
      await api.salirDeGrupo(grupo.id);
      onVolver();
    } catch (err) {
      setError(err.message);
      setConfirmarAccion(null);
    }
  }

  async function confirmarEliminar() {
    try {
      await api.eliminarGrupo(grupo.id);
      onVolver();
    } catch (err) {
      setError(err.message);
      setConfirmarAccion(null);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onVolver}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-carbon"
        >
          <ArrowLeft size={16} /> Volver a grupos
        </button>
        {esCreador ? (
          <button
            onClick={() => setConfirmarAccion("eliminar")}
            className="w-9 h-9 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-600"
            title="Eliminar grupo"
          >
            <Trash2 size={16} />
          </button>
        ) : (
          <button
            onClick={() => setConfirmarAccion("salir")}
            className="w-9 h-9 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-600"
            title="Salir del grupo"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>

      <h1 className="text-3xl font-bold text-carbon mb-2">{grupo.nombre}</h1>

      {/* Código de invitación */}
      <button
        onClick={copiarCodigo}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl mb-5 transition-colors"
        style={{ background: "var(--surface-alt)" }}
      >
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
            Código de invitación
          </p>
          <p className="text-sm font-mono font-semibold text-carbon">
            {grupo.codigo_invitacion}
          </p>
        </div>
        <span className="flex items-center gap-1 text-coral font-semibold text-xs">
          {copiado ? (
            <>
              <Check size={14} /> Copiado
            </>
          ) : (
            <>
              <Copy size={14} /> Copiar
            </>
          )}
        </span>
      </button>

      {/* Miembros */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
          Miembros · {grupo.miembros.length}
        </p>
        <div className="flex flex-wrap gap-2">
          {grupo.miembros.map((m) => (
            <div
              key={m.usuario_id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: "var(--surface-alt)" }}
            >
              <div className="w-6 h-6 rounded-full bg-coral text-white flex items-center justify-center text-[10px] font-bold">
                {m.usuario.nombre[0]?.toUpperCase()}
              </div>
              <span className="text-xs text-carbon">{m.usuario.nombre}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Presupuesto del mes */}
      {resumenGrupo && (
        <div
          className={`rounded-2xl p-4 mb-5 ${resumenGrupo.en_rojo ? "border-red-200" : ""}`}
          style={{
            background: resumenGrupo.en_rojo ? "var(--danger-soft)" : "var(--surface)",
            border: `1px solid ${resumenGrupo.en_rojo ? "var(--danger)" : "var(--border)"}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">
              Presupuesto del mes
            </p>
            {esCreador && !editandoLimite && (
              <button
                onClick={() => {
                  setEditandoLimite(true);
                  setNuevoLimite(String(resumenGrupo.limite));
                }}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>

          {editandoLimite ? (
            <form onSubmit={guardarLimite} className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={nuevoLimite}
                onChange={(e) => setNuevoLimite(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                autoFocus
              />
              <button
                type="submit"
                className="w-9 h-9 rounded-lg bg-coral text-white flex items-center justify-center"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => setEditandoLimite(false)}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500"
              >
                <X size={14} />
              </button>
            </form>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-3">
                <span
                  className={`text-2xl font-bold ${
                    resumenGrupo.en_rojo ? "text-red-600" : "text-carbon"
                  }`}
                >
                  ${Number(resumenGrupo.total_mes).toFixed(2)}
                </span>
                <span className="text-sm text-gray-500">
                  / ${Number(resumenGrupo.limite).toFixed(2)}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all ${
                    resumenGrupo.en_rojo ? "bg-red-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(resumenGrupo.porcentaje, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {resumenGrupo.porcentaje}% usado
                {resumenGrupo.en_rojo && " · ¡Excedido!"}
              </p>
            </>
          )}
        </div>
      )}

      {/* Saldos */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
          Saldos
        </p>
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {saldos.map((s, i) => (
            <div
              key={s.usuario_id}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
            >
              <span className="text-sm text-carbon">{s.nombre}</span>
              <span
                className={`text-sm font-semibold ${
                  Number(s.debe) < 0 ? "text-coral" : "text-emerald-600"
                }`}
              >
                {Number(s.debe) < 0
                  ? `debe $${Math.abs(s.debe).toFixed(2)}`
                  : `le deben $${Number(s.debe).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Botón agregar gasto */}
      <button
        onClick={() => setFormAbierto((v) => !v)}
        className={`w-full font-semibold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 mb-4 active:scale-[0.98] ${
          formAbierto
            ? "bg-gray-200 text-carbon hover:bg-gray-300"
            : "bg-coral text-white hover:bg-coral-dark shadow-md"
        }`}
      >
        {formAbierto ? <X size={16} /> : <Plus size={16} />}
        {formAbierto ? "Cancelar" : "Agregar gasto compartido"}
      </button>

      {/* Formulario */}
      {formAbierto && (
        <div
          className="rounded-2xl p-4 mb-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <form onSubmit={agregarGasto} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  max={todayISO()}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Categoría (opcional)</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Descripción (opcional)</label>
              <input
                type="text"
                placeholder="ej. mercado"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-coral text-white font-semibold py-2.5 rounded-xl hover:bg-coral-dark transition-colors disabled:opacity-60"
            >
              {enviando ? "Agregando..." : "Agregar gasto"}
            </button>
          </form>
        </div>
      )}

      {/* Lista de gastos */}
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
        Gastos del grupo · {gastos.length}
      </p>

      {cargando ? (
        <SkeletonList count={3} variant="card" />
      ) : gastos.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center border-2 border-dashed"
          style={{ borderColor: "var(--border)" }}
        >
          <ReceiptText size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin gastos compartidos aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {gastos.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl p-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-carbon truncate">
                    {g.descripcion || g.categoria || "Gasto compartido"}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {g.fecha} · pagó {nombreDe(g.pagado_por_id)}
                  </p>
                </div>
                <div className="text-right flex items-center gap-1">
                  <p className="font-bold text-carbon text-sm">
                    ${Number(g.monto).toFixed(2)}
                  </p>
                  <div className="relative acciones-menu-grupo">
                    <button
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAbiertoId(menuAbiertoId === g.id ? null : g.id);
                      }}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuAbiertoId === g.id && (
                      <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[140px] overflow-hidden z-10">
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-carbon hover:bg-gray-50"
                          onClick={() => {
                            setGastoEditando(g);
                            setMenuAbiertoId(null);
                          }}
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setGastoAEliminar(g);
                            setMenuAbiertoId(null);
                          }}
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chips de divisiones */}
              <div className="flex flex-wrap gap-1.5">
                {g.divisiones.map((d) => (
                  <span
                    key={d.id}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: d.pagado ? "var(--accent-soft)" : "var(--surface-alt)",
                      color: d.pagado ? "var(--accent)" : "var(--ink-soft)",
                    }}
                  >
                    {nombreDe(d.usuario_id)}: ${Number(d.monto).toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !formAbierto && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-4">{error}</p>
      )}

      {/* Modales */}
      {gastoEditando && (
        <EditarGastoCompartidoModal
          grupoId={grupo.id}
          gasto={gastoEditando}
          categorias={categorias}
          tarjetas={tarjetas}
          onCerrar={() => setGastoEditando(null)}
          onGuardado={() => {
            setGastoEditando(null);
            cargar();
          }}
        />
      )}

      {gastoAEliminar && (
        <ConfirmModal
          titulo="Eliminar gasto compartido"
          mensaje={`¿Eliminar el gasto de $${Number(gastoAEliminar.monto).toFixed(2)}${gastoAEliminar.descripcion ? ` ("${gastoAEliminar.descripcion}")` : ""}?`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminarGasto}
          onCancelar={() => setGastoAEliminar(null)}
        />
      )}

      {confirmarAccion === "salir" && (
        <ConfirmModal
          titulo="Salir del grupo"
          mensaje={`¿Seguro que quieres salir de "${grupo.nombre}"?`}
          textoConfirmar="Sí, salir"
          onConfirmar={confirmarSalir}
          onCancelar={() => setConfirmarAccion(null)}
        />
      )}

      {confirmarAccion === "eliminar" && (
        <ConfirmModal
          titulo="Eliminar grupo"
          mensaje={`¿Eliminar "${grupo.nombre}"? Esto borra todos los gastos compartidos y saldos.`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setConfirmarAccion(null)}
        />
      )}
    </div>
  );
}