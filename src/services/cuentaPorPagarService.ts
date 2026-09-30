import { apiRequest } from './api';
import type {
  CrearCuentaPorPagarRequest,
  CuentaPorPagarResponse,
  CuentaPorPagarResumenResponse,
  CuentasPorPagarPaginadasResponse,
  RegistrarAbonoCuentaPorPagarRequest,
} from '../types/cuentasPorPagar';

export async function obtenerCuentasPorPagar(
  pagina: number,
  tamanoPagina: number,
  token: string | null,
  filtros?: { estado?: string; proveedorId?: number }
): Promise<CuentasPorPagarPaginadasResponse> {
  const params = new URLSearchParams({
    pagina: String(pagina),
    tamanoPagina: String(tamanoPagina),
  });
  if (filtros?.estado) {
    params.set('estado', filtros.estado);
  }
  if (filtros?.proveedorId) {
    params.set('proveedorId', String(filtros.proveedorId));
  }
  return apiRequest<CuentasPorPagarPaginadasResponse>(`/api/cuentas-por-pagar?${params.toString()}`, { token });
}

export async function obtenerCuentaPorPagarPorId(id: number, token: string | null): Promise<CuentaPorPagarResponse> {
  return apiRequest<CuentaPorPagarResponse>(`/api/cuentas-por-pagar/${id}`, { token });
}

export async function crearCuentaPorPagar(
  data: CrearCuentaPorPagarRequest,
  token: string | null
): Promise<CuentaPorPagarResponse> {
  return apiRequest<CuentaPorPagarResponse>('/api/cuentas-por-pagar', {
    method: 'POST',
    body: data,
    token,
  });
}

export async function registrarAbonoCuentaPorPagar(
  cuentaId: number,
  data: RegistrarAbonoCuentaPorPagarRequest,
  token: string | null
): Promise<CuentaPorPagarResponse> {
  return apiRequest<CuentaPorPagarResponse>(`/api/cuentas-por-pagar/${cuentaId}/abonos`, {
    method: 'POST',
    body: data,
    token,
  });
}

export async function cancelarCuentaPorPagar(id: number, token: string | null): Promise<CuentaPorPagarResponse> {
  return apiRequest<CuentaPorPagarResponse>(`/api/cuentas-por-pagar/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function obtenerCuentasPorPagarProximasAVencer(
  token: string | null,
  dias = 7
): Promise<CuentaPorPagarResumenResponse[]> {
  return apiRequest<CuentaPorPagarResumenResponse[]>(`/api/cuentas-por-pagar/proximas-a-vencer?dias=${dias}`, {
    token,
  });
}
