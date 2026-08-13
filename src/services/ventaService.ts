import { apiRequest } from './api';
import type { FiltrosVentas, RegistrarVentaRequest, VentaResponse, VentasPaginadasResponse } from '../types/ventas';

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

export async function obtenerVentas(
  pagina: number,
  tamanoPagina: number,
  token: string | null,
  filtros?: FiltrosVentas
): Promise<VentasPaginadasResponse> {
  const params = new URLSearchParams({
    pagina: String(pagina),
    tamanoPagina: String(tamanoPagina),
  });
  if (filtros?.desde) {
    params.set('desde', filtros.desde);
  }
  if (filtros?.hasta) {
    params.set('hasta', filtros.hasta);
  }
  if (filtros?.estado) {
    params.set('estado', filtros.estado);
  }
  return apiRequest<VentasPaginadasResponse>(`/api/ventas?${params.toString()}`, { token });
}

export async function obtenerVentaPorId(id: number, token: string | null): Promise<VentaResponse> {
  return apiRequest<VentaResponse>(`/api/ventas/${id}`, { token });
}
