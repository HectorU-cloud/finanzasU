import { useRef, useState } from "react";
import { CreditCard, AlertTriangle } from "lucide-react";

const NETWORK_LABELS = {
  Visa: "VISA",
  Mastercard: "Mastercard",
  "American Express": "Amex",
  "Diners Club": "Diners",
  Otra: "",
};

export default function CardCarousel({ tarjetas }) {
  const scrollRef = useRef(null);
  const [activo, setActivo] = useState(0);

  function irA(i) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setActivo(i);
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setActivo(i);
  }

  if (!tarjetas || tarjetas.length === 0) {
    return (
      <div className="carousel-vacio">
        <CreditCard size={20} />
        <p>Todavía no tienes tarjetas. Agrega una en "Gestionar tarjetas".</p>
      </div>
    );
  }

  const limite = 350; // límite mensual compartido, definido en el backend

  return (
    <div className="carousel">
      <div className="carousel-track" ref={scrollRef} onScroll={onScroll}>
        {tarjetas.map((t) => {
          const gastado = Number(t.gastado_mes || 0);
          const porcentaje = Math.min((gastado / limite) * 100, 100);
          const disponible = Math.max(limite - gastado, 0);
          const red = NETWORK_LABELS[t.red] ?? t.red ?? "";

          return (
            <div key={t.id} className={"credit-card" + (t.en_rojo ? " rojo" : "")}>
              <div className="credit-card-top">
                <div>
                  <p className="cc-label">Gastado en este ciclo</p>
                  <p className="cc-monto">${gastado.toFixed(2)}</p>
                </div>
                <div className="cc-top-right">
                  <span className="cc-badge">
                    {t.en_rojo && <AlertTriangle size={11} />}
                    {t.en_rojo ? "Excedido" : "Al día"}
                  </span>
                  <div className="cc-chip" />
                </div>
              </div>

              <div className="cc-progreso">
                <div className="cc-progreso-info">
                  <span>Uso del límite</span>
                  <span>{porcentaje.toFixed(0)}%</span>
                </div>
                <div className="cc-progreso-barra">
                  <div className="cc-progreso-fill" style={{ width: `${porcentaje}%` }} />
                </div>
              </div>

              <div className="credit-card-bottom">
                <div>
                  <p className="cc-mini-label">Corte · disponible</p>
                  <p className="cc-mini-valor">
                    Día {t.dia_corte} · faltan {t.dias_para_corte}d · ${disponible.toFixed(2)}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="cc-mini-label">Tarjeta</p>
                  <p className="cc-nombre">{t.nombre}</p>
                  {red && <p className="cc-red">{red}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tarjetas.length > 1 && (
        <>
          <div className="carousel-dots">
            {tarjetas.map((_, i) => (
              <button
                key={i}
                className={"dot" + (i === activo ? " activo" : "")}
                onClick={() => irA(i)}
                aria-label={`Ir a tarjeta ${i + 1}`}
              />
            ))}
          </div>
          <p className="carousel-hint">Desliza para ver la siguiente tarjeta</p>
        </>
      )}
    </div>
  );
}
