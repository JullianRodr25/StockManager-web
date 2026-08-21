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
