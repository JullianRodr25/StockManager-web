import { apiRequest } from './api';
import type { Cliente } from '../types/clientes';

export async function buscarClientes(busqueda: string, token: string | null): Promise<Cliente[]> {
  const params = new URLSearchParams();
  if (busqueda.trim()) {
    params.set('busqueda', busqueda.trim());
  }
  const query = params.toString();
  return apiRequest<Cliente[]>(`/api/clientes${query ? `?${query}` : ''}`, { token });
}

export async function obtenerClientePorId(id: number, token: string | null): Promise<Cliente> {
  return apiRequest<Cliente>(`/api/clientes/${id}`, { token });
}
