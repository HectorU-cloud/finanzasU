import { useEffect, useState } from "react";
import { AlertTriangle, Clock, X } from "lucide-react";
import { api } from "./api.js";

function claveDescarte(alerta) {
  const hoy = new Date().toISOString().slice(0, 10);
  return `alerta_descartada:${hoy}:${alerta.tipo}:${alerta.tarjeta_id}`;
}

export default function AlertasBanner() {
  const [alertas, setAlertas] = useState([]);
  const [descartadas, setDescartadas] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("alertas_descartadas") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let cancelado = false;
    api
      .getAlertas()
      .then((data) => {
        if (!cancelado) setAlertas(data || []);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  function descartar(alerta) {
    const clave = claveDescarte(alerta);
    const nuevas = [...descartadas, clave];
    setDescartadas(nuevas);
    try {
      sessionStorage.setItem("alertas_descartadas", JSON.stringify(nuevas));
    } catch {
      // si sessionStorage falla, no es crítico: solo no se recordará el descarte
    }
  }

  const visibles = alertas.filter((a) => !descartadas.includes(claveDescarte(a)));

  if (visibles.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {visibles.map((a, i) => {
        const esPagoAtrasado = a.tipo === "pago_atrasado";
        return (
          <div
            key={`${a.tipo}-${a.tarjeta_id}-${i}`}
            className={
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm " +
              (esPagoAtrasado
                ? "bg-coral/10 text-coral border border-coral/30"
                : "bg-amber-50 text-amber-700 border border-amber-300")
            }
          >
            {esPagoAtrasado ? <AlertTriangle size={16} /> : <Clock size={16} />}
            <span className="flex-1 font-medium">{a.mensaje}</span>
            <button onClick={() => descartar(a)} className="opacity-60 hover:opacity-100">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
