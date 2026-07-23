// Estos tipos deben mantenerse sincronizados manualmente con los DTOs
// de StockManager.Application/DTOs/AuthDtos.cs en el backend.

export interface AuthRequest {
  identificador: string; // NumeroIdentificacion o Email
  password: string;
}

export interface AuthResponse {
  token: string;
}

export interface EmpleadoAutenticado {
  id: string;
  numeroIdentificacion: string;
  nombre: string;
  rol: 'Admin' | 'Empleado';
}

export interface ApiErrorResponse {
  message: string;
}
