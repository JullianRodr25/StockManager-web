import { apiRequest } from './api';
import type { FacturaDocumento } from '../types/facturaDocumento';

export async function obtenerDocumentoFacturaDeVenta(
  ventaId: number,
  token: string | null
): Promise<FacturaDocumento> {
  return apiRequest<FacturaDocumento>(`/api/facturas/venta/${ventaId}/documento`, { token });
}
