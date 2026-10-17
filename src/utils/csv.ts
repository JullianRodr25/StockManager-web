/**
 * Descarga una tabla como CSV listo para Excel en español: separador ";" (el de la configuración
 * regional de Colombia), comillas escapadas y BOM UTF-8 para que las tildes no se dañen.
 */
export function descargarCsv(nombreArchivo: string, encabezados: string[], filas: (string | number)[][]): void {
  const celda = (valor: string | number) => `"${String(valor).replace(/"/g, '""')}"`;
  const contenido = [encabezados, ...filas].map((fila) => fila.map(celda).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
