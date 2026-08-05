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
