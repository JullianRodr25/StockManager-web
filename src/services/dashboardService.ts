import { apiRequest } from './api';
import type { DashboardResumen } from '../types/dashboard';

export async function obtenerResumenDashboard(token: string | null): Promise<DashboardResumen> {
  return apiRequest<DashboardResumen>('/api/dashboard/resumen', { token });
}
