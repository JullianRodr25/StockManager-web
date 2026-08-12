import { apiRequest } from './api';
import type { RegistrarVentaRequest, VentaResponse } from '../types/ventas';

export async function registrarVenta(
  data: RegistrarVentaRequest,
  token: string | null
): Promise<VentaResponse> {
  return apiRequest<VentaResponse>('/api/ventas', {
    method: 'POST',
    body: data,
    token,
  });
}
