import { useRef, useState } from "react";

const GRADIENTES = [
  "linear-gradient(135deg, #4a5fe0 0%, #23307f 100%)",
  "linear-gradient(135deg, #e05a4f 0%, #7f231f 100%)",
  "linear-gradient(135deg, #2fa88a 0%, #12523f 100%)",
  "linear-gradient(135deg, #9a5fe0 0%, #4a237f 100%)",
];

const COLOR_RED = {
  Visa: "#eab308",
  Mastercard: "#f97316",
  "American Express": "#7dd3fc",
  "Diners Club": "#e2e8f0",
  Otra: "rgba(255,255,255,0.75)",
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

  if (!tarjetas || tarjetas.length === 0) return null;

  return (
    <div className="carousel">
      <div className="carousel-track" ref={scrollRef} onScroll={onScroll}>
        {tarjetas.map((t, i) => (
          <div
            key={t.id}
            className={"credit-card" + (t.en_rojo ? " rojo" : "")}
            style={!t.en_rojo ? { background: GRADIENTES[i % GRADIENTES.length] } : undefined}
          >
            <div className="credit-card-top">
              <div>
                <p className="cc-label">Gastado este mes</p>
                <p className="cc-monto">${Number(t.gastado_mes).toFixed(2)}</p>
              </div>
              <div className="cc-top-right">
                <span className="cc-badge">{t.en_rojo ? "Excedido" : "Al día"}</span>
                <div className="cc-chip" />
              </div>
            </div>
            <div className="credit-card-bottom">
              <div>
                <p className="cc-mini-label">Corte</p>
                <p className="cc-mini-valor">
                  Día {t.dia_corte} · faltan {t.dias_para_corte}d
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p className="cc-mini-label">Tarjeta</p>
                <p className="cc-nombre">{t.nombre}</p>
                {t.red && (
                  <p
                    className="cc-red"
                    style={{ color: COLOR_RED[t.red] || "rgba(255,255,255,0.75)" }}
                  >
                    {t.red}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
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
