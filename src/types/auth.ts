// Estos tipos deben mantenerse sincronizados manualmente con los DTOs
// de StockManager.Application/DTOs/AuthDtos.cs en el backend.

export interface AuthRequest {
  identificador: string; // NumeroIdentificacion o Email
  password: string;
}

export interface AuthResponse {
  token: string;
}

/**
 * Roles de un empleado. Debe coincidir con StockManager.Domain.Constants.Roles del backend:
 * - Admin: acceso completo.
 * - Empleado: opera el negocio (ventas, pedidos, clientes, proveedores).
 * - Inventario: gestiona el inventario (crear, editar, stock, Excel); sin ventas ni otros módulos.
 */
export type RolUsuario = 'Admin' | 'Empleado' | 'Inventario';

export interface EmpleadoAutenticado {
  id: string;
  numeroIdentificacion: string;
  nombre: string;
  rol: RolUsuario;
}

export interface ApiErrorResponse {
  message: string;
}

export interface SolicitarRecuperacionRequest {
  email: string;
}

export interface RestablecerContrasenaRequest {
  token: string;
  nuevaPassword: string;
}

export interface MensajeResponse {
  message: string;
}

// Debe coincidir con RegistrarEmpleadoRequest / RegistrarResponse de AuthDtos.cs.
export interface RegistrarEmpleadoRequest {
  numeroIdentificacion: string;
  nombre: string;
  email: string;
  password: string;
  rol: RolUsuario;
}

export interface RegistrarResponse {
  id: number;
  message: string;
}
