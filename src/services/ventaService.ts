import { apiRequest } from './api';
import type {
  AbonoResponse,
  FiltrosVentas,
  LineaVentaRequest,
  RegistrarAbonoRequest,
  RegistrarVentaRequest,
  VentaResponse,
  VentasPaginadasResponse,
} from '../types/ventas';

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

export async function abrirFiado(clienteId: number, token: string | null): Promise<VentaResponse> {
  return apiRequest<VentaResponse>('/api/ventas/fiado', {
    method: 'POST',
    body: { clienteId },
    token,
  });
}

export async function agregarLineaFiado(
  ventaId: number,
  linea: LineaVentaRequest,
  token: string | null
): Promise<VentaResponse> {
  return apiRequest<VentaResponse>(`/api/ventas/${ventaId}/lineas`, {
    method: 'POST',
    body: linea,
    token,
  });
}

export async function registrarAbono(
  ventaId: number,
  data: RegistrarAbonoRequest,
  token: string | null
): Promise<VentaResponse> {
  return apiRequest<VentaResponse>(`/api/ventas/${ventaId}/abonos`, {
    method: 'POST',
    body: data,
    token,
  });
}

export async function obtenerAbonos(ventaId: number, token: string | null): Promise<AbonoResponse[]> {
  return apiRequest<AbonoResponse[]>(`/api/ventas/${ventaId}/abonos`, { token });
}

export async function editarCantidadLinea(
  ventaId: number,
  detalleId: number,
  cantidad: number,
  token: string | null
): Promise<VentaResponse> {
  return apiRequest<VentaResponse>(`/api/ventas/${ventaId}/lineas/${detalleId}`, {
    method: 'PUT',
    body: { cantidad },
    token,
  });
}

export async function quitarLinea(
  ventaId: number,
  detalleId: number,
  token: string | null
): Promise<VentaResponse> {
  return apiRequest<VentaResponse>(`/api/ventas/${ventaId}/lineas/${detalleId}`, {
    method: 'DELETE',
    token,
  });
}
