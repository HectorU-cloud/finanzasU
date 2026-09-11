import { useEffect, useState } from "react";
import { PieChart } from "lucide-react";
import { api } from "./api.js";

const COLORES = {
  Comida: "#a8461f",
  Transporte: "#52643c",
  Hogar: "#8c5a2a",
  Servicios: "#3f5b7a",
  Salud: "#8c2a20",
  Ocio: "#7a4d8c",
  Compras: "#b38c3c",
  Educación: "#2f6b5c",
  "Sin categoría": "#a89c86",
  Otros: "#6e6353",
};

export default function ResumenCategorias({ anio, mes }) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    api
      .getResumenCategorias(anio, mes)
      .then((d) => {
        if (!cancelado) setDatos(d);
      })
      .catch(() => {
        if (!cancelado) setDatos([]);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [anio, mes]);

  if (cargando) return null;
  if (datos.length === 0) return null;

  const maxTotal = Math.max(...datos.map((d) => Number(d.total)));

  return (
    <div className="panel resumen-categorias">
      <p className="titulo">
        <PieChart size={16} />
        Gastos por categoría
      </p>
      <ul className="categorias-lista">
        {datos.map((d) => {
          const color = COLORES[d.categoria] || COLORES.Otros;
          const porcentajeBarra = maxTotal > 0 ? (Number(d.total) / maxTotal) * 100 : 0;
          return (
            <li key={d.categoria}>
              <div className="categoria-fila">
                <span className="categoria-nombre">
                  <span className="categoria-punto" style={{ background: color }} />
                  {d.categoria}
                </span>
                <span className="categoria-monto">
                  ${Number(d.total).toFixed(2)}
                  <span className="categoria-porcentaje">{d.porcentaje}%</span>
                </span>
              </div>
              <div className="categoria-barra">
                <div
                  className="categoria-barra-fill"
                  style={{ width: `${porcentajeBarra}%`, background: color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}