export async function descargarArchivo(promesa) {
  try {
    const { blob, filename } = await promesa;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("No se pudo descargar: " + err.message);
  }
}