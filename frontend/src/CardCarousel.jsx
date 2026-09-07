import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";

const CARD_THEMES = [
  {
    gradient: "linear-gradient(135deg, #635BFF 0%, #4338CA 100%)",
    accent: "#A5B4FC",
  },
  {
    gradient: "linear-gradient(135deg, #0F766E 0%, #134E4A 100%)",
    accent: "#5EEAD4",
  },
  {
    gradient: "linear-gradient(135deg, #BE123C 0%, #881337 100%)",
    accent: "#FDA4AF",
  },
  {
    gradient: "linear-gradient(135deg, #B45309 0%, #78350F 100%)",
    accent: "#FCD34D",
  },
];

const NETWORK_LABELS = {
  Visa: "VISA",
  Mastercard: "mastercard",
  "American Express": "AMEX",
  "Diners Club": "DINERS",
  Otra: "CARD",
};

export default function CardCarousel({ tarjetas }) {
  const scrollRef = useRef(null);
  const [activo, setActivo] = useState(0);

  if (!tarjetas || tarjetas.length === 0) {
    return (
      <section className="cards-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">TUS TARJETAS</p>
            <h2>No tienes tarjetas todavía</h2>
          </div>
        </div>

        <div className="cards-empty-state">
          <div className="cards-empty-icon">
            <CreditCard size={28} />
          </div>

          <h3>Comienza agregando una tarjeta</h3>

          <p>
            Registra tus tarjetas para empezar a controlar tus gastos
            mensuales.
          </p>
        </div>
      </section>
    );
  }

  function irA(index) {
    const container = scrollRef.current;

    if (!container) return;

    const width = container.clientWidth;

    container.scrollTo({
      left: index * width,
      behavior: "smooth",
    });

    setActivo(index);
  }

  function anterior() {
    const nuevoIndice =
      activo === 0 ? tarjetas.length - 1 : activo - 1;

    irA(nuevoIndice);
  }

  function siguiente() {
    const nuevoIndice =
      activo === tarjetas.length - 1 ? 0 : activo + 1;

    irA(nuevoIndice);
  }

  function onScroll() {
    const container = scrollRef.current;

    if (!container || container.clientWidth === 0) return;

    const index = Math.round(
      container.scrollLeft / container.clientWidth
    );

    setActivo(index);
  }

  return (
    <section className="cards-section">
      <div className="section-heading">
        <div>
          <p className="section-kicker">TUS TARJETAS</p>
          <h2>Resumen de tarjetas</h2>
        </div>

        {tarjetas.length > 1 && (
          <div className="cards-navigation">
            <button
              type="button"
              className="cards-nav-button"
              onClick={anterior}
              aria-label="Tarjeta anterior"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              className="cards-nav-button"
              onClick={siguiente}
              aria-label="Siguiente tarjeta"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      <div
        className="cards-carousel-track"
        ref={scrollRef}
        onScroll={onScroll}
      >
        {tarjetas.map((tarjeta, index) => {
          const theme =
            CARD_THEMES[index % CARD_THEMES.length];

          const gastado = Number(tarjeta.gastado_mes || 0);

          const limite = Number(
            tarjeta.limite ||
            tarjeta.limite_mensual ||
            350
          );

          const porcentaje =
            limite > 0
              ? Math.min((gastado / limite) * 100, 100)
              : 0;

          const disponible = Math.max(
            limite - gastado,
            0
          );

          const excedido =
            tarjeta.en_rojo || gastado > limite;

          return (
            <article
              key={tarjeta.id}
              className={`finance-card ${
                excedido ? "is-danger" : ""
              }`}
              style={{
                background: excedido
                  ? "linear-gradient(135deg, #EF4444 0%, #991B1B 100%)"
                  : theme.gradient,
              }}
            >
              <div className="finance-card-glow" />

              <div className="finance-card-content">

                <div className="finance-card-header">
                  <div className="finance-card-brand">
                    <div className="finance-card-brand-icon">
                      <CreditCard size={18} />
                    </div>

                    <span>FinanzasU</span>
                  </div>

                  <span className="finance-card-network">
                    {NETWORK_LABELS[tarjeta.red] ||
                      tarjeta.red ||
                      "CARD"}
                  </span>
                </div>

                <div className="finance-card-main">
                  <p className="finance-card-label">
                    {tarjeta.nombre}
                  </p>

                  <h3>
                    ${gastado.toFixed(2)}
                  </h3>

                  <p className="finance-card-description">
                    gastado en este ciclo
                  </p>
                </div>

                <div className="finance-card-progress-area">
                  <div className="finance-card-progress-info">
                    <span>Uso del límite</span>

                    <strong>
                      {porcentaje.toFixed(0)}%
                    </strong>
                  </div>

                  <div className="finance-card-progress">
                    <div
                      className="finance-card-progress-fill"
                      style={{
                        width: `${porcentaje}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="finance-card-footer">
                  <div className="finance-card-info">
                    <span>
                      <CalendarDays size={13} />
                      Corte
                    </span>

                    <strong>
                      Día {tarjeta.dia_corte}
                    </strong>
                  </div>

                  <div className="finance-card-info align-right">
                    <span>
                      {excedido && (
                        <AlertTriangle size={13} />
                      )}

                      Disponible
                    </span>

                    <strong>
                      ${disponible.toFixed(2)}
                    </strong>
                  </div>
                </div>

              </div>
            </article>
          );
        })}
      </div>

      {tarjetas.length > 1 && (
        <div className="cards-pagination">
          {tarjetas.map((tarjeta, index) => (
            <button
              key={tarjeta.id}
              type="button"
              className={`cards-pagination-dot ${
                index === activo ? "active" : ""
              }`}
              onClick={() => irA(index)}
              aria-label={`Ver tarjeta ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}