import { apiRequest } from './api';
import type {
  AuthRequest,
  AuthResponse,
  MensajeResponse,
  RestablecerContrasenaRequest,
  SolicitarRecuperacionRequest,
} from '../types/auth';

export async function loginEmpleado(credenciales: AuthRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/login/empleado', {
    method: 'POST',
    body: credenciales,
  });
}

// La respuesta es siempre el mismo mensaje genérico, exista o no el email (por diseño del
// backend, para no revelar qué correos están registrados).
export async function solicitarRecuperacion(datos: SolicitarRecuperacionRequest): Promise<MensajeResponse> {
  return apiRequest<MensajeResponse>('/api/auth/recuperar-contrasena', {
    method: 'POST',
    body: datos,
  });
}

export async function restablecerContrasena(datos: RestablecerContrasenaRequest): Promise<MensajeResponse> {
  return apiRequest<MensajeResponse>('/api/auth/restablecer-contrasena', {
    method: 'POST',
    body: datos,
  });
}
