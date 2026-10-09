import { apiRequest } from './api';
import type { ActualizarConfiguracionRequest, ConfiguracionGeneral } from '../types/configuracion';

export async function obtenerConfiguracion(token: string | null): Promise<ConfiguracionGeneral> {
  return apiRequest<ConfiguracionGeneral>('/api/configuracion', { token });
}

export async function actualizarConfiguracion(
  data: ActualizarConfiguracionRequest,
  token: string | null
): Promise<ConfiguracionGeneral> {
  return apiRequest<ConfiguracionGeneral>('/api/configuracion', {
    method: 'PUT',
    body: data,
    token,
  });
}

/**
 * El PUT reemplaza la fila completa de Configuracion, así que cada guardado parcial debe
 * reenviar los demás campos vigentes. Este helper los copia en un solo lugar (en vez de
 * repetir la lista en cada formulario) y quien guarda solo sobreescribe lo que edita:
 * `{ ...aRequest(configuracion), nitEmpresa: '…' }`.
 */
export function aRequest(config: ConfiguracionGeneral): ActualizarConfiguracionRequest {
  return { ...config };
}
