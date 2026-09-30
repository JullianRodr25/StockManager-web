// Debe mantenerse sincronizado manualmente con StockManager.Application/DTOs/ProveedorDtos.cs
// en el backend.

export interface CrearProveedorRequest {
  nombre: string;
  numeroIdentificacion?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}

export type ActualizarProveedorRequest = CrearProveedorRequest;

export interface Proveedor {
  id: number;
  nombre: string;
  numeroIdentificacion: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
}

export interface ProveedoresPaginadosResponse {
  data: Proveedor[];
  pagina: number;
  tamanoPagina: number;
  total: number;
  totalPaginas: number;
}
