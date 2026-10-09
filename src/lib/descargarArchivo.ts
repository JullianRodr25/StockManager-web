// Dispara la descarga de un Blob en el navegador con el nombre indicado.
// Se crea un enlace temporal en lugar de abrir una URL porque el archivo se obtuvo con una
// petición autenticada (fetch con token) y no existe una dirección pública desde donde bajarlo.
export function descargarArchivo(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se libera en el siguiente ciclo para no cortar la descarga en navegadores que la inician de forma asíncrona.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
