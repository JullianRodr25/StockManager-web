import { apiRequest } from './api';
import type {
  AbrirTurnoRequest,
  CerrarTurnoRequest,
  TurnoCaja,
  TurnosCajaPaginadosResponse,
} from '../types/caja';

export async function abrirTurno(data: AbrirTurnoRequest, token: string | null): Promise<TurnoCaja> {
  return apiRequest<TurnoCaja>('/api/caja/abrir', { method: 'POST', body: data, token });
}

/** El backend responde 204 (sin body) cuando el usuario no tiene un turno abierto. */
export async function obtenerTurnoActual(token: string | null): Promise<TurnoCaja | null> {
  const turno = await apiRequest<TurnoCaja | undefined>('/api/caja/turno-actual', { token });
  return turno ?? null;
}

export async function cerrarTurno(data: CerrarTurnoRequest, token: string | null): Promise<TurnoCaja> {
  return apiRequest<TurnoCaja>('/api/caja/cerrar', { method: 'POST', body: data, token });
}

export async function forzarCierreTurno(
  id: number,
  data: CerrarTurnoRequest,
  token: string | null
): Promise<TurnoCaja> {
  return apiRequest<TurnoCaja>(`/api/caja/${id}/forzar-cierre`, { method: 'POST', body: data, token });
}

export async function obtenerTurno(id: number, token: string | null): Promise<TurnoCaja> {
  return apiRequest<TurnoCaja>(`/api/caja/${id}`, { token });
}

export async function obtenerHistorialTurnos(
  pagina: number,
  tamanoPagina: number,
  token: string | null
): Promise<TurnosCajaPaginadosResponse> {
  const params = new URLSearchParams({ pagina: String(pagina), tamanoPagina: String(tamanoPagina) });
  return apiRequest<TurnosCajaPaginadosResponse>(`/api/caja?${params.toString()}`, { token });
}
