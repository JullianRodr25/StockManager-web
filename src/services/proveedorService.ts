import { apiRequest } from './api';
import type {
  ActualizarProveedorRequest,
  CrearProveedorRequest,
  Proveedor,
  ProveedoresPaginadosResponse,
} from '../types/proveedores';

export async function obtenerProveedores(
  pagina: number,
  tamanoPagina: number,
  token: string | null,
  activo?: boolean
): Promise<ProveedoresPaginadosResponse> {
  const params = new URLSearchParams({
    pagina: String(pagina),
    tamanoPagina: String(tamanoPagina),
  });
  if (activo !== undefined) {
    params.set('activo', String(activo));
  }
  return apiRequest<ProveedoresPaginadosResponse>(`/api/proveedores?${params.toString()}`, { token });
}

export async function obtenerProveedorPorId(id: number, token: string | null): Promise<Proveedor> {
  return apiRequest<Proveedor>(`/api/proveedores/${id}`, { token });
}

export async function crearProveedor(data: CrearProveedorRequest, token: string | null): Promise<Proveedor> {
  return apiRequest<Proveedor>('/api/proveedores', {
    method: 'POST',
    body: data,
    token,
  });
}

export async function actualizarProveedor(
  id: number,
  data: ActualizarProveedorRequest,
  token: string | null
): Promise<Proveedor> {
  return apiRequest<Proveedor>(`/api/proveedores/${id}`, {
    method: 'PUT',
    body: data,
    token,
  });
}

export async function desactivarProveedor(id: number, token: string | null): Promise<Proveedor> {
  return apiRequest<Proveedor>(`/api/proveedores/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function activarProveedor(id: number, token: string | null): Promise<Proveedor> {
  return apiRequest<Proveedor>(`/api/proveedores/${id}/activar`, {
    method: 'POST',
    token,
  });
}
