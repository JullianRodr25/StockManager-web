import { apiRequest } from './api';
import type { DevolucionResponse, RegistrarDevolucionRequest } from '../types/devoluciones';

export async function registrarDevolucion(
  ventaId: number,
  data: RegistrarDevolucionRequest,
  token: string | null
): Promise<DevolucionResponse> {
  return apiRequest<DevolucionResponse>(`/api/ventas/${ventaId}/devoluciones`, {
    method: 'POST',
    body: data,
    token,
  });
}

export async function obtenerDevolucionesDeVenta(ventaId: number, token: string | null): Promise<DevolucionResponse[]> {
  return apiRequest<DevolucionResponse[]>(`/api/ventas/${ventaId}/devoluciones`, { token });
}
