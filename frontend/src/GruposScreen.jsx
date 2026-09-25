import { useEffect, useState, useCallback } from "react";
import { Users, Plus, ChevronRight, Copy, Check, ArrowLeft } from "lucide-react";
import { api } from "./api.js";
import { SkeletonList } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";
import GrupoModal from "./GrupoModal.jsx";
import GrupoDetalleScreen from "./GrupoDetalleScreen.jsx";

export default function GruposScreen({ usuarioId, tarjetas, onVolver }) {
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [copiadoId, setCopiadoId] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const d = await api.getGrupos();
      setGrupos(Array.isArray(d) ? d : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function copiarCodigo(grupo) {
    try {
      await navigator.clipboard.writeText(grupo.codigo_invitacion);
      setCopiadoId(grupo.id);
      setTimeout(() => setCopiadoId(null), 1500);
    } catch {}
  }

  if (grupoSeleccionado) {
    return (
      <GrupoDetalleScreen
        grupo={grupoSeleccionado}
        usuarioId={usuarioId}
        tarjetas={tarjetas}
        onVolver={() => {
          setGrupoSeleccionado(null);
          cargar();
        }}
      />
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {onVolver && (
            <button
              onClick={onVolver}
              className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-carbon">Grupos</h1>
            <p className="text-sm text-gray-500">
              {grupos.length === 0
                ? "Sin grupos aún"
                : `${grupos.length} ${grupos.length === 1 ? "grupo activo" : "grupos activos"}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="w-11 h-11 rounded-full bg-coral text-white flex items-center justify-center shadow-lg hover:bg-coral-dark transition-colors"
          title="Nuevo grupo"
        >
          <Plus size={20} />
        </button>
      </div>

      {cargando ? (
        <SkeletonList count={3} variant="card" />
      ) : grupos.length === 0 ? (
        <EmptyState
          icon={Users}
          titulo="Sin grupos todavía"
          mensaje="Crea un grupo para compartir gastos con tu familia, pareja o amigos."
          accion="+ Crear mi primer grupo"
          onAccion={() => setModalAbierto(true)}
          colorIcono="azul"
        />
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl p-4 shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
              onClick={() => setGrupoSeleccionado(g)}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
                  <Users size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-carbon text-base truncate">
                    {g.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    {g.miembros.length} miembro{g.miembros.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronRight size={18} className="text-gray-400 shrink-0 mt-2" />
              </div>

              <div className="flex items-center -space-x-2 mb-3">
                {g.miembros.slice(0, 5).map((m) => (
                  <div
                    key={m.usuario_id}
                    className="w-8 h-8 rounded-full bg-coral text-white flex items-center justify-center text-[10px] font-bold ring-2 transition-transform hover:scale-110 hover:z-10 relative"
                    style={{ 
                      borderColor: "var(--surface)",
                      borderWidth: 2,
                    }}
                    title={m.usuario.nombre}
                  >
                    {m.usuario.nombre[0]?.toUpperCase()}
                  </div>
                ))}
                {g.miembros.length > 5 && (
                  <div
                    className="w-8 h-8 rounded-full text-gray-600 flex items-center justify-center text-[10px] font-bold ring-2 relative"
                    style={{ 
                      background: "var(--surface-alt)",
                      borderColor: "var(--surface)",
                      borderWidth: 2,
                    }}
                  >
                    +{g.miembros.length - 5}
                  </div>
                )}
              </div>

              {/* Código de invitación */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copiarCodigo(g);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs"
                style={{ background: "var(--surface-alt)" }}
              >
                <span className="text-gray-500 font-mono">
                  {g.codigo_invitacion}
                </span>
                <span className="flex items-center gap-1 text-coral font-semibold">
                  {copiadoId === g.id ? (
                    <>
                      <Check size={12} /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copiar
                    </>
                  )}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mt-4">
          {error}
        </p>
      )}

      {modalAbierto && (
        <GrupoModal
          onCerrar={() => setModalAbierto(false)}
          onCreado={(grupo) => {
            setModalAbierto(false);
            setGrupoSeleccionado(grupo);
          }}
        />
      )}
    </div>
  );
}