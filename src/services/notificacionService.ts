import { apiRequest } from './api';
import type { NotificacionInterna } from '../types/notificaciones';

export async function obtenerNotificaciones(
  token: string | null,
  soloNoLeidas = true,
  limite = 50
): Promise<NotificacionInterna[]> {
  const params = new URLSearchParams({ soloNoLeidas: String(soloNoLeidas), limite: String(limite) });
  return apiRequest<NotificacionInterna[]>(`/api/notificaciones?${params.toString()}`, { token });
}

export async function obtenerConteoNoLeidas(token: string | null): Promise<number> {
  const { conteo } = await apiRequest<{ conteo: number }>('/api/notificaciones/conteo-no-leidas', { token });
  return conteo;
}

export async function marcarNotificacionLeida(id: number, token: string | null): Promise<void> {
  await apiRequest<void>(`/api/notificaciones/${id}/marcar-leida`, { method: 'PATCH', token });
}

export async function marcarTodasLeidas(token: string | null): Promise<void> {
  await apiRequest<void>('/api/notificaciones/marcar-todas-leidas', { method: 'PATCH', token });
}
