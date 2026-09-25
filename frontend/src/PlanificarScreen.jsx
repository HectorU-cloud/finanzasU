import { useEffect, useState } from "react";
import { Target, Users, HandCoins, ChevronRight } from "lucide-react";
import { api } from "./api.js";

export default function PlanificarScreen({
  onIrAPotes,
  onIrAGrupos,
  onIrADeudas,
  tabInicial = "potes",
  onCambiarTab,
}) {
  const [tabActiva, setTabActiva] = useState(tabInicial);
  const [potes, setPotes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Sincronizar si el padre cambia el tab
  useEffect(() => {
    setTabActiva(tabInicial);
  }, [tabInicial]);

  useEffect(() => {
    Promise.all([
      api.getPotes().catch(() => []),
      api.getGrupos().catch(() => []),
      api.getDeudas().catch(() => []),
    ])
      .then(([p, g, d]) => {
        setPotes(p || []);
        setGrupos(g || []);
        setDeudas(d || []);
      })
      .finally(() => setCargando(false));
  }, []);

  function cambiarTab(tab) {
    setTabActiva(tab);
    onCambiarTab?.(tab);
  }

  const totalAhorrado = potes.reduce((acc, p) => acc + Number(p.saldo || 0), 0);
  const potesCompletados = potes.filter(
    (p) => Number(p.saldo) >= Number(p.meta)
  ).length;

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      <h1 className="text-3xl font-bold text-carbon mb-6">Planificar</h1>

      {/* Segmented Control */}
      <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
        {[
          { id: "potes", label: "Mis Pot" },
          { id: "grupos", label: "Grupos" },
          { id: "deudas", label: "Deudas" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => cambiarTab(t.id)}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
              tabActiva === t.id
                ? "bg-white text-coral shadow-sm"
                : "text-gray-500 hover:text-carbon"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400 text-center py-10">Cargando...</p>
      ) : tabActiva === "potes" ? (
        <>
          {/* ============ TAB POT ============ */}
          <button
            onClick={onIrAPotes}
            className="w-full rounded-2xl p-5 text-left shadow-sm hover:shadow-md transition-shadow mb-4"
            style={{
              background: "linear-gradient(135deg, #4a1d7a 0%, #7c3aed 100%)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
                <Target size={22} />
              </div>
              <span className="text-white text-3xl font-bold">
                ${totalAhorrado.toFixed(2)}
              </span>
            </div>
            <p className="text-white/80 text-xs uppercase tracking-wider mb-1">
              Total ahorrado
            </p>
            <p className="text-white text-sm">
              {potes.length === 0
                ? "Aún no tienes potes"
                : `${potes.length} pote${potes.length !== 1 ? "s" : ""} · ${potesCompletados} completado${potesCompletados !== 1 ? "s" : ""}`}
            </p>
          </button>

          <button
            onClick={onIrAPotes}
            className="w-full py-3 rounded-xl bg-coral text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-coral-dark transition-colors"
          >
            Ver todos mis Pot <ChevronRight size={16} />
          </button>

          {potes.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Tus potes recientes
              </p>
              {potes.slice(0, 3).map((p) => {
                const porcentaje = Math.min(
                  (Number(p.saldo) / Number(p.meta)) * 100,
                  100
                );
                const completado = Number(p.saldo) >= Number(p.meta);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl p-3 border"
                    style={{
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <span className="text-2xl">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-carbon truncate">
                        {p.nombre}
                      </p>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full transition-all ${
                            completado ? "bg-emerald-500" : "bg-coral"
                          }`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-carbon whitespace-nowrap">
                      ${Number(p.saldo).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : tabActiva === "grupos" ? (
        <>
          {/* ============ TAB GRUPOS ============ */}
          <button
            onClick={onIrAGrupos}
            className="w-full rounded-2xl p-5 text-left shadow-sm hover:shadow-md transition-shadow mb-4"
            style={{
              background: "linear-gradient(135deg, #0f2a5c 0%, #1e4a8a 100%)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
                <Users size={22} />
              </div>
              <span className="text-white text-3xl font-bold">
                {grupos.length}
              </span>
            </div>
            <p className="text-white/80 text-xs uppercase tracking-wider mb-1">
              Grupos activos
            </p>
            <p className="text-white text-sm">
              {grupos.length === 0
                ? "No perteneces a ningún grupo"
                : `Reparte gastos con ${grupos.length} grupo${grupos.length !== 1 ? "s" : ""}`}
            </p>
          </button>

          <button
            onClick={onIrAGrupos}
            className="w-full py-3 rounded-xl bg-coral text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-coral-dark transition-colors"
          >
            Ver todos mis Grupos <ChevronRight size={16} />
          </button>

          {grupos.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Tus grupos recientes
              </p>
              {grupos.slice(0, 3).map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 rounded-xl p-3 border"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Users size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-carbon truncate">
                      {g.nombre}
                    </p>
                    <p className="text-xs text-gray-500">
                      {g.miembros?.length || 0} miembro
                      {(g.miembros?.length || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* ============ TAB DEUDAS ============ */}
          {(() => {
            const activas = deudas.filter((d) => !d.pagada);
            const totalDebo = activas
              .filter((d) => d.tipo === "debo")
              .reduce((acc, d) => acc + Number(d.saldo_pendiente), 0);
            const totalMeDeben = activas
              .filter((d) => d.tipo === "me_deben")
              .reduce((acc, d) => acc + Number(d.saldo_pendiente), 0);
            return (
              <button
                onClick={onIrADeudas}
                className="w-full rounded-2xl p-5 text-left shadow-sm hover:shadow-md transition-shadow mb-4"
                style={{
                  background: "linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
                    <HandCoins size={22} />
                  </div>
                  <span className="text-white text-3xl font-bold">{activas.length}</span>
                </div>
                <p className="text-white/80 text-xs uppercase tracking-wider mb-1">
                  Deudas activas
                </p>
                <p className="text-white text-sm">
                  Debes ${totalDebo.toFixed(2)} · Te deben ${totalMeDeben.toFixed(2)}
                </p>
              </button>
            );
          })()}

          <button
            onClick={onIrADeudas}
            className="w-full py-3 rounded-xl bg-coral text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-coral-dark transition-colors"
          >
            Ver todas mis Deudas <ChevronRight size={16} />
          </button>

          {deudas.filter((d) => !d.pagada).length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Deudas recientes
              </p>
              {deudas
                .filter((d) => !d.pagada)
                .slice(0, 3)
                .map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-xl p-3 border"
                    style={{
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        d.tipo === "debo"
                          ? "bg-coral/10 text-coral"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      <HandCoins size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-carbon truncate">{d.persona}</p>
                      <p className="text-xs text-gray-500">
                        {d.tipo === "debo" ? "Le debes" : "Te debe"} $
                        {Number(d.saldo_pendiente).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}