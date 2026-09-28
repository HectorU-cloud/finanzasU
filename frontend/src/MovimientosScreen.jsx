import { useState } from "react";
import IngresosScreen from "./IngresosScreen.jsx";
import HistorialPagosScreen from "./HistorialPagosScreen.jsx";
import GastosTab from "./GastosTab.jsx";

export default function MovimientosScreen({
  tarjetas = [],
  tabInicial = "ingresos",
  anioInicial = null,
  mesInicial = null,
  onAbrirTarjeta,
  onEditarEgreso,
  onNuevoEgreso,
}) {
  const [tabActiva, setTabActiva] = useState(tabInicial);

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      {/* Header y Tabs */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-carbon mb-4">Movimientos</h1>

        <div className="flex bg-gray-100 p-1 rounded-2xl">
          {[
            { id: "ingresos", label: "Ingresos" },
            { id: "gastos", label: "Gastos" },
            { id: "pagos", label: "Pagos" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTabActiva(t.id)}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                tabActiva === t.id
                  ? "bg-white text-carbon shadow-sm"
                  : "text-gray-500 hover:text-carbon"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido de la pestaña activa */}
      <div>
        {tabActiva === "ingresos" && (
          <IngresosScreen
            ocultarHeader={true}
            anioInicial={anioInicial}
            mesInicial={mesInicial}
          />
        )}
        {tabActiva === "gastos" && (
          <GastosTab
            tarjetas={tarjetas}
            anioInicial={anioInicial}
            mesInicial={mesInicial}
            onAbrirTarjeta={onAbrirTarjeta}
            onEditarEgreso={onEditarEgreso}
            onNuevoEgreso={onNuevoEgreso}
          />
        )}
        {tabActiva === "pagos" && <HistorialPagosScreen ocultarHeader={true} />}
      </div>
    </div>
  );
}