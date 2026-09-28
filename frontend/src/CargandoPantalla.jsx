export default function CargandoPantalla() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-full border-4 border-coral border-t-transparent animate-spin mb-3" />
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          Cargando...
        </p>
      </div>
    </div>
  );
}