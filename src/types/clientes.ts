// Estos tipos deben mantenerse sincronizados manualmente con
// StockManager.Application/DTOs/ClienteDtos.cs en el backend.

export interface Cliente {
  id: number;
  numeroIdentificacion: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  activo: boolean;
}

export interface CrearClienteRequest {
  numeroIdentificacion: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  password?: string | null;
}

export interface ActualizarClienteRequest {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
}

export interface ClienteCreadoResponse {
  cliente: Cliente;
  passwordTemporal: string | null;
}
