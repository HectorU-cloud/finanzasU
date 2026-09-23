export default function EmptyState({
  icon: Icon,
  titulo,
  mensaje,
  accion,
  onAccion,
  colorIcono = "coral",
}) {
  const colores = {
    coral: { bg: "bg-coral/10", text: "text-coral" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
    azul: { bg: "bg-blue-500/10", text: "text-blue-500" },
    morado: { bg: "bg-purple-500/10", text: "text-purple-500" },
    ambar: { bg: "bg-amber-500/10", text: "text-amber-500" },
  };
  const c = colores[colorIcono] || colores.coral;

  return (
    <div className="border-2 border-dashed rounded-2xl p-8 text-center"
      style={{ borderColor: "var(--border)" }}
    >
      {Icon && (
        <div className={`w-16 h-16 rounded-full ${c.bg} ${c.text} flex items-center justify-center mx-auto mb-4`}>
          <Icon size={28} />
        </div>
      )}
      <p className="text-base font-semibold text-carbon mb-1">{titulo}</p>
      {mensaje && <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">{mensaje}</p>}
      {accion && onAccion && (
        <button
          onClick={onAccion}
          className="px-5 py-2.5 rounded-full bg-coral text-white font-semibold text-sm hover:bg-coral-dark transition-colors"
        >
          {accion}
        </button>
      )}
    </div>
  );
}