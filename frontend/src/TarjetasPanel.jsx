import { useState } from "react";
import {
  CreditCard,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  CalendarDays,
  Building2,
  ChevronDown,
} from "lucide-react";
import { api } from "./api.js";

const REDES = [
  "Visa",
  "Mastercard",
  "American Express",
  "Diners Club",
  "Otra",
];

export default function TarjetasPanel({ tarjetas = [], onChange }) {
  const [abierto, setAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [borrador, setBorrador] = useState({
    nombre: "",
    dia_corte: "",
    red: REDES[0],
  });

  const [nueva, setNueva] = useState({
    nombre: "",
    dia_corte: "",
    red: REDES[0],
  });

  const [error, setError] = useState("");

  function empezarEdicion(tarjeta) {
    setEditandoId(tarjeta.id);

    setBorrador({
      nombre: tarjeta.nombre || "",
      dia_corte: tarjeta.dia_corte || "",
      red: tarjeta.red || REDES[0],
    });

    setError("");
  }

  function cancelarEdicion() {
    setEditandoId(null);

    setBorrador({
      nombre: "",
      dia_corte: "",
      red: REDES[0],
    });

    setError("");
  }

  async function guardarEdicion(id) {
    const dia = Number(borrador.dia_corte);

    if (
      !borrador.nombre.trim() ||
      !dia ||
      dia < 1 ||
      dia > 31
    ) {
      setError(
        "Nombre y día de corte (1-31) son obligatorios."
      );
      return;
    }

    try {
      setError("");

      await api.actualizarTarjeta(id, {
        nombre: borrador.nombre.trim(),
        dia_corte: dia,
        red: borrador.red,
      });

      cancelarEdicion();
      onChange();
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar la tarjeta.");
    }
  }

  async function eliminar(id, nombre) {
    const ok = window.confirm(
      `¿Eliminar "${nombre}"?\n\nEsto también borrará todos sus gastos registrados. Esta acción no se puede deshacer.`
    );

    if (!ok) return;

    try {
      setError("");

      await api.eliminarTarjeta(id);

      onChange();
    } catch (err) {
      console.error(err);
      setError("No se pudo eliminar la tarjeta.");
    }
  }

  async function agregar(e) {
    e.preventDefault();

    const dia = Number(nueva.dia_corte);

    if (
      !nueva.nombre.trim() ||
      !dia ||
      dia < 1 ||
      dia > 31
    ) {
      setError(
        "Nombre y día de corte (1-31) son obligatorios."
      );
      return;
    }

    try {
      setError("");

      await api.crearTarjeta({
        nombre: nueva.nombre.trim(),
        dia_corte: dia,
        red: nueva.red,
      });

      setNueva({
        nombre: "",
        dia_corte: "",
        red: REDES[0],
      });

      onChange();
    } catch (err) {
      console.error(err);
      setError("No se pudo crear la tarjeta.");
    }
  }

  return (
    <section className="manage-cards-section">

      {/* HEADER */}

      <div
        className="manage-cards-header clickable-header"
        onClick={() => setAbierto((actual) => !actual)}
      >
        <div>
          <p className="section-kicker">
            CONFIGURACIÓN
          </p>

          <h2>Administrar tarjetas</h2>

          <p className="manage-cards-description">
            Gestiona las tarjetas que utilizas para registrar
            tus gastos.
          </p>
        </div>

        <div className="manage-cards-header-right">

          <span className="cards-count">
            {tarjetas.length}{" "}
            {tarjetas.length === 1
              ? "tarjeta"
              : "tarjetas"}
          </span>

          <button
            type="button"
            className="manage-cards-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setAbierto((actual) => !actual);
            }}
            aria-label={
              abierto
                ? "Ocultar tarjetas"
                : "Mostrar tarjetas"
            }
          >
            <ChevronDown
              size={19}
              className={
                abierto
                  ? "manage-chevron-open"
                  : ""
              }
            />
          </button>
        </div>
      </div>


      {/* CONTENIDO */}

      {abierto && (
        <div className="manage-cards-content">

          {/* LISTA DE TARJETAS */}

          {tarjetas.length > 0 ? (
            <div className="managed-cards-list">

              {tarjetas.map((tarjeta, index) => (

                <article
                  className="managed-card-item"
                  key={tarjeta.id}
                >

                  {editandoId === tarjeta.id ? (

                    /* =========================
                       EDITAR TARJETA
                    ========================= */

                    <div className="managed-card-edit">

                      <div className="managed-card-edit-header">

                        <div className="managed-card-icon">
                          <CreditCard size={20} />
                        </div>

                        <div>
                          <span className="edit-label">
                            EDITANDO TARJETA
                          </span>

                          <h3>
                            {tarjeta.nombre}
                          </h3>
                        </div>

                      </div>


                      <div className="managed-card-edit-fields">

                        <div className="modern-field">

                          <label>
                            <Building2 size={14} />
                            Nombre
                          </label>

                          <input
                            type="text"
                            value={borrador.nombre}
                            onChange={(e) =>
                              setBorrador({
                                ...borrador,
                                nombre:
                                  e.target.value,
                              })
                            }
                          />

                        </div>


                        <div className="modern-field">

                          <label>
                            <CalendarDays size={14} />
                            Corte
                          </label>

                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={borrador.dia_corte}
                            onChange={(e) =>
                              setBorrador({
                                ...borrador,
                                dia_corte:
                                  e.target.value,
                              })
                            }
                          />

                        </div>


                        <div className="modern-field">

                          <label>
                            <CreditCard size={14} />
                            Red
                          </label>

                          <select
                            value={borrador.red}
                            onChange={(e) =>
                              setBorrador({
                                ...borrador,
                                red:
                                  e.target.value,
                              })
                            }
                          >
                            {REDES.map((red) => (
                              <option
                                key={red}
                                value={red}
                              >
                                {red}
                              </option>
                            ))}
                          </select>

                        </div>

                      </div>


                      <div className="managed-card-edit-actions">

                        <button
                          type="button"
                          className="secondary-action-button"
                          onClick={
                            cancelarEdicion
                          }
                        >
                          <X size={16} />
                          Cancelar
                        </button>

                        <button
                          type="button"
                          className="primary-action-button"
                          onClick={() =>
                            guardarEdicion(
                              tarjeta.id
                            )
                          }
                        >
                          <Check size={16} />
                          Guardar cambios
                        </button>

                      </div>

                    </div>

                  ) : (

                    /* =========================
                       TARJETA NORMAL
                    ========================= */

                    <>

                      <div
                        className={`managed-card-icon theme-${
                          (index % 4) + 1
                        }`}
                      >
                        <CreditCard size={21} />
                      </div>


                      <div className="managed-card-content">

                        <h3>
                          {tarjeta.nombre}
                        </h3>

                        <p>
                          {tarjeta.red ||
                            "Sin red"}

                          <span className="card-meta-separator">
                            •
                          </span>

                          Corte el día{" "}
                          <strong>
                            {tarjeta.dia_corte}
                          </strong>
                        </p>

                      </div>


                      <div className="managed-card-actions">

                        <button
                          type="button"
                          className="card-action-button edit"
                          onClick={() =>
                            empezarEdicion(
                              tarjeta
                            )
                          }
                          title="Editar tarjeta"
                          aria-label={`Editar ${tarjeta.nombre}`}
                        >
                          <Pencil size={16} />
                        </button>


                        <button
                          type="button"
                          className="card-action-button delete"
                          onClick={() =>
                            eliminar(
                              tarjeta.id,
                              tarjeta.nombre
                            )
                          }
                          title="Eliminar tarjeta"
                          aria-label={`Eliminar ${tarjeta.nombre}`}
                        >
                          <Trash2 size={16} />
                        </button>

                      </div>

                    </>
                  )}

                </article>

              ))}

            </div>

          ) : (

            /* =========================
               SIN TARJETAS
            ========================= */

            <div className="managed-cards-empty">

              <div className="managed-cards-empty-icon">
                <CreditCard size={27} />
              </div>

              <h3>
                Aún no tienes tarjetas
              </h3>

              <p>
                Agrega tu primera tarjeta para
                comenzar a organizar tus gastos.
              </p>

            </div>

          )}


          {/* =========================
             NUEVA TARJETA
          ========================= */}

          <div className="new-card-box">

            <div className="new-card-heading">

              <div className="new-card-icon">
                <Plus size={19} />
              </div>

              <div>
                <h3>
                  Agregar nueva tarjeta
                </h3>

                <p>
                  Registra una tarjeta para
                  comenzar a utilizarla.
                </p>
              </div>

            </div>


            <form
              className="new-card-form"
              onSubmit={agregar}
            >

              <div className="modern-field">

                <label>
                  <Building2 size={14} />
                  Nombre
                </label>

                <input
                  type="text"
                  placeholder="Ej. Banco Pichincha"
                  value={nueva.nombre}
                  onChange={(e) =>
                    setNueva({
                      ...nueva,
                      nombre:
                        e.target.value,
                    })
                  }
                />

              </div>


              <div className="modern-field">

                <label>
                  <CalendarDays size={14} />
                  Día de corte
                </label>

                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="15"
                  value={nueva.dia_corte}
                  onChange={(e) =>
                    setNueva({
                      ...nueva,
                      dia_corte:
                        e.target.value,
                    })
                  }
                />

              </div>


              <div className="modern-field">

                <label>
                  <CreditCard size={14} />
                  Red
                </label>

                <select
                  value={nueva.red}
                  onChange={(e) =>
                    setNueva({
                      ...nueva,
                      red: e.target.value,
                    })
                  }
                >
                  {REDES.map((red) => (
                    <option
                      key={red}
                      value={red}
                    >
                      {red}
                    </option>
                  ))}
                </select>

              </div>


              <button
                type="submit"
                className="primary-action-button new-card-submit"
              >
                <Plus size={17} />
                Agregar
              </button>

            </form>

          </div>


          {/* ERROR */}

          {error && (
            <div className="card-form-error">
              {error}
            </div>
          )}

        </div>
      )}

    </section>
  );
}