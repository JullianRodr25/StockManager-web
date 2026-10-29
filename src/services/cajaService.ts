import { apiRequest } from './api';
import type {
  AbrirTurnoRequest,
  AperturaCaja,
  CerrarTurnoRequest,
  TurnoCaja,
  TurnosCajaPaginadosResponse,
} from '../types/caja';

/** Base con la que arrancaría la caja y datos de la última caja cerrada. */
export async function obtenerApertura(token: string | null): Promise<AperturaCaja> {
  return apiRequest<AperturaCaja>('/api/caja/apertura', { token });
}

/** Confirma la contraseña del usuario antes de abrir el cajón físico; falla si no coincide. */
export async function verificarContrasenaCajon(contrasena: string, token: string | null): Promise<void> {
  await apiRequest<void>('/api/caja/cajon/verificar', { method: 'POST', body: { contrasena }, token });
}

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
