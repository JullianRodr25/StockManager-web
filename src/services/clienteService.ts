import { apiRequest } from './api';
import type {
  ActualizarClienteRequest,
  ActualizarDatosFacturacionRequest,
  Cliente,
  ClienteCreadoResponse,
  CrearClienteRequest,
  ImportarClientesResponse,
} from '../types/clientes';

// Sin "activo", el backend trae todos (activos e inactivos) — pensado para el panel de
// administración de Clientes. Cualquier otro lugar que busque un cliente para asociarlo a
// algo nuevo (ej. abrir una Cuenta Abierta) debe pasar activo=true explícitamente.
export async function buscarClientes(
  busqueda: string,
  token: string | null,
  activo?: boolean
): Promise<Cliente[]> {
  const params = new URLSearchParams();
  if (busqueda.trim()) {
    params.set('busqueda', busqueda.trim());
  }
  if (activo !== undefined) {
    params.set('activo', String(activo));
  }
  const query = params.toString();
  return apiRequest<Cliente[]>(`/api/clientes${query ? `?${query}` : ''}`, { token });
}

export async function obtenerClientePorId(id: number, token: string | null): Promise<Cliente> {
  return apiRequest<Cliente>(`/api/clientes/${id}`, { token });
}

export async function crearCliente(
  data: CrearClienteRequest,
  token: string | null
): Promise<ClienteCreadoResponse> {
  return apiRequest<ClienteCreadoResponse>('/api/clientes', {
    method: 'POST',
    body: data,
    token,
  });
}

export async function actualizarCliente(
  id: number,
  data: ActualizarClienteRequest,
  token: string | null
): Promise<Cliente> {
  return apiRequest<Cliente>(`/api/clientes/${id}`, {
    method: 'PUT',
    body: data,
    token,
  });
}

export async function actualizarDatosFacturacion(
  id: number,
  data: ActualizarDatosFacturacionRequest,
  token: string | null
): Promise<Cliente> {
  return apiRequest<Cliente>(`/api/clientes/${id}/datos-facturacion`, {
    method: 'PUT',
    body: data,
    token,
  });
}

export async function desactivarCliente(id: number, token: string | null): Promise<Cliente> {
  return apiRequest<Cliente>(`/api/clientes/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function activarCliente(id: number, token: string | null): Promise<Cliente> {
  return apiRequest<Cliente>(`/api/clientes/${id}/activar`, {
    method: 'POST',
    token,
  });
}

/**
 * Importa el Excel de terceros del programa contable anterior. Con `soloValidar` el backend
 * devuelve la vista previa sin guardar nada; sin él crea los clientes, pero solo si todas las
 * filas son válidas (todo o nada).
 */
export async function importarClientes(
  archivo: File,
  token: string | null,
  soloValidar = false
): Promise<ImportarClientesResponse> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  return apiRequest<ImportarClientesResponse>(`/api/clientes/importar?soloValidar=${soloValidar}`, {
    method: 'POST',
    body: formData,
    token,
  });
}
