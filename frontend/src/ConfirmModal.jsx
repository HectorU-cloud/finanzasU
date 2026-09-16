import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({
  titulo = "¿Estás seguro?",
  mensaje,
  textoConfirmar = "Sí, eliminar",
  onConfirmar,
  onCancelar,
}) {
  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <AlertTriangle size={16} /> {titulo}
          </h3>
          <button className="mini-btn" onClick={onCancelar} title="Cerrar">
            <X size={16} />
          </button>
        </div>

        <p className="confirm-mensaje">{mensaje}</p>

        <div className="confirm-acciones">
          <button
            className="secondary-action-button"
            onClick={onCancelar}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="danger-action-button"
            onClick={onConfirmar}
            type="button"
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
