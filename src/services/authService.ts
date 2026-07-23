import { apiRequest } from './api';
import type { AuthRequest, AuthResponse } from '../types/auth';

export async function loginEmpleado(credenciales: AuthRequest): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/login/empleado', {
    method: 'POST',
    body: credenciales,
  });
}
