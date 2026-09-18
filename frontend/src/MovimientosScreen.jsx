import { useState } from "react";
import IngresosScreen from "./IngresosScreen.jsx";
import HistorialPagosScreen from "./HistorialPagosScreen.jsx";

export default function MovimientosScreen() {
  const [tabActiva, setTabActiva] = useState("ingresos"); // "ingresos" | "pagos"

  return (
    <div className="max-w-md mx-auto px-4 pb-28 pt-6">
      {/* Header y Tabs */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-carbon mb-4">Movimientos</h1>
        
        <div className="flex bg-gray-100 p-1 rounded-2xl">
          <button
            onClick={() => setTabActiva("ingresos")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              tabActiva === "ingresos"
                ? "bg-white text-carbon shadow-sm"
                : "text-gray-500 hover:text-carbon"
            }`}
          >
            Ingresos
          </button>
          <button
            onClick={() => setTabActiva("pagos")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              tabActiva === "pagos"
                ? "bg-white text-carbon shadow-sm"
                : "text-gray-500 hover:text-carbon"
            }`}
          >
            Pagos
          </button>
        </div>
      </div>

      {/* Contenido de la pestaña activa */}
      <div>
        {tabActiva === "ingresos" && <IngresosScreen ocultarHeader={true} />}
        {tabActiva === "pagos" && <HistorialPagosScreen ocultarHeader={true} />}
      </div>
    </div>
  );
}