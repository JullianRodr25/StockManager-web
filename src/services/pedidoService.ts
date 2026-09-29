import { apiRequest } from './api';
import type { MarcarEntregadoRequest, PedidoResponse, PedidosPaginadosResponse } from '../types/pedidos';

export async function obtenerPedidos(
  pagina: number,
  tamanoPagina: number,
  token: string | null,
  estado?: string
): Promise<PedidosPaginadosResponse> {
  const params = new URLSearchParams({
    pagina: String(pagina),
    tamanoPagina: String(tamanoPagina),
  });
  if (estado) {
    params.set('estado', estado);
  }
  return apiRequest<PedidosPaginadosResponse>(`/api/pedidos?${params.toString()}`, { token });
}

export async function obtenerPedidoPorId(id: number, token: string | null): Promise<PedidoResponse> {
  return apiRequest<PedidoResponse>(`/api/pedidos/${id}`, { token });
}

export async function confirmarPedido(id: number, token: string | null): Promise<PedidoResponse> {
  return apiRequest<PedidoResponse>(`/api/pedidos/${id}/confirmar`, { method: 'PUT', token });
}

export async function iniciarPreparacionPedido(id: number, token: string | null): Promise<PedidoResponse> {
  return apiRequest<PedidoResponse>(`/api/pedidos/${id}/preparacion`, { method: 'PUT', token });
}

export async function enviarACaminoPedido(id: number, token: string | null): Promise<PedidoResponse> {
  return apiRequest<PedidoResponse>(`/api/pedidos/${id}/camino`, { method: 'PUT', token });
}

export async function marcarPedidoEntregado(
  id: number,
  data: MarcarEntregadoRequest,
  token: string | null
): Promise<PedidoResponse> {
  return apiRequest<PedidoResponse>(`/api/pedidos/${id}/entregado`, {
    method: 'PUT',
    body: data,
    token,
  });
}

export async function cancelarPedido(id: number, token: string | null): Promise<PedidoResponse> {
  return apiRequest<PedidoResponse>(`/api/pedidos/${id}`, {
    method: 'DELETE',
    token,
  });
}
