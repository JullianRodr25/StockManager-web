import { apiRequest } from './api';
import type {
  AbrirTurnoRequest,
  AperturaCaja,
  CerrarTurnoRequest,
  ReporteRetiros,
  RetiroCaja,
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

/** Edita la nota de un turno cerrado; los montos del cierre no cambian. */
export async function actualizarNotaTurno(id: number, nota: string, token: string | null): Promise<TurnoCaja> {
  return apiRequest<TurnoCaja>(`/api/caja/${id}/nota`, { method: 'PUT', body: { nota }, token });
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

/** Saca efectivo de la caja del turno abierto (por ejemplo lo vendido, dejando solo la base). */
export async function registrarRetiro(monto: number, token: string | null): Promise<RetiroCaja> {
  return apiRequest<RetiroCaja>('/api/caja/retiros', { method: 'POST', body: { monto }, token });
}

/** Anula un retiro; solo Admin y solo mientras el turno sigue abierto. */
export async function anularRetiro(id: number, token: string | null): Promise<RetiroCaja> {
  return apiRequest<RetiroCaja>(`/api/caja/retiros/${id}/anular`, { method: 'POST', token });
}

export async function obtenerReporteRetiros(
  desde: string,
  hasta: string,
  token: string | null
): Promise<ReporteRetiros> {
  const params = new URLSearchParams({ desde, hasta });
  return apiRequest<ReporteRetiros>(`/api/caja/retiros?${params.toString()}`, { token });
}
