import { apiDescargarArchivo, apiRequest } from './api';
import type { FacturaDocumento } from '../types/facturaDocumento';

export async function obtenerDocumentoFacturaDeVenta(
  ventaId: number,
  token: string | null
): Promise<FacturaDocumento> {
  return apiRequest<FacturaDocumento>(`/api/facturas/venta/${ventaId}/documento`, { token });
}

/** PDF de la factura de una venta (formato de factura de Ferretería Gold), listo para imprimir. */
export async function descargarPdfFacturaDeVenta(ventaId: number, token: string | null): Promise<Blob> {
  return apiDescargarArchivo(`/api/facturas/venta/${ventaId}/pdf`, token);
}
