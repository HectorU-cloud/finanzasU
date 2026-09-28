import { useEffect, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { api } from "./api.js";

const GRUPOS = {
  gasto: { titulo: "Gastos", emoji: "💳", color: "text-coral" },
  ingreso: { titulo: "Ingresos", emoji: "💰", color: "text-emerald-600" },
  egreso: { titulo: "Gastos directos", emoji: "🧾", color: "text-amber-600" },
  pago_tarjeta: { titulo: "Pagos de tarjeta", emoji: "📄", color: "text-blue-600" },
  deuda: { titulo: "Deudas", emoji: "💸", color: "text-orange-500" },
  nota: { titulo: "Notas", emoji: "📝", color: "text-pink-500" },
  pote: { titulo: "Potes", emoji: "🏺", color: "text-purple-600" },
};

export default function BuscarScreen({ onVolver, onNavegar }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const termino = q.trim();
    if (termino.length < 2) {
      setResultados([]);
      setBuscando(false);
      setError("");
      return;
    }
    setBuscando(true);
    setError("");
    const timer = setTimeout(() => {
      api
        .buscar(termino)
        .then((d) => setResultados(d.resultados || []))
        .catch((e) => setError(e.message))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const porTipo = {};
  resultados.forEach((r) => {
    if (!porTipo[r.tipo]) porTipo[r.tipo] = [];
    porTipo[r.tipo].push(r);
  });

  const tieneResultados = resultados.length > 0;
  const terminoCorto = q.trim().length < 2;

  return (
    <div className="fixed inset-0 z-40 bg-cream overflow-y-auto">
      <div className="max-w-md mx-auto px-4 pb-28 pt-6">
        {/* Header con input */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={onVolver}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"
            title="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              autoFocus
              type="text"
              placeholder="Buscar en toda tu app..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 focus:border-coral focus:outline-none text-sm bg-white"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Estados */}
        {terminoCorto ? (
          <div className="text-center py-12">
            <Search size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              Busca en gastos, ingresos, deudas, notas y más
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Escribe al menos 2 letras
            </p>
          </div>
        ) : buscando ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 mx-auto rounded-full border-4 border-coral border-t-transparent animate-spin mb-3" />
            <p className="text-sm text-gray-500">Buscando...</p>
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
            {error}
          </p>
        ) : !tieneResultados ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm text-gray-500">
              No encontramos nada para "{q}"
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Prueba con otra palabra
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-gray-500">
              {resultados.length} resultado{resultados.length !== 1 ? "s" : ""}
            </p>
            {Object.keys(GRUPOS).map((tipo) => {
              const items = porTipo[tipo];
              if (!items || items.length === 0) return null;
              const grupo = GRUPOS[tipo];
              return (
                <div key={tipo}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${grupo.color}`}>
                    {grupo.emoji} {grupo.titulo} ({items.length})
                  </p>
                  <div className="space-y-2">
                    {items.map((r) => (
                      <button
                        key={`${r.tipo}-${r.id}`}
                        onClick={() => onNavegar?.(r)}
                        className="w-full bg-white rounded-2xl p-3 flex items-center gap-3 text-left hover:bg-gray-50 active:scale-[0.99] transition-transform"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-carbon truncate">
                            {r.titulo}
                          </p>
                          {r.subtitulo && (
                            <p className="text-xs text-gray-500 truncate">
                              {r.subtitulo}
                            </p>
                          )}
                        </div>
                        {r.monto !== undefined && (
                          <p
                            className={`text-sm font-bold shrink-0 ${
                              r.signo === "+"
                                ? "text-emerald-600"
                                : r.signo === "-"
                                ? "text-coral"
                                : "text-carbon"
                            }`}
                          >
                            {r.signo}${r.monto.toFixed(2)}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}