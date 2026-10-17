import { apiRequest } from './api';
import type {
  ReporteCartera,
  ReporteInventario,
  ReporteProductosVendidos,
  ReporteVentas,
} from '../types/reportes';

const rango = (desde: string, hasta: string) => `desde=${desde}&hasta=${hasta}`;

export const obtenerReporteVentas = (desde: string, hasta: string, token: string | null) =>
  apiRequest<ReporteVentas>(`/api/reportes/ventas?${rango(desde, hasta)}`, { token });

export const obtenerReporteProductosVendidos = (desde: string, hasta: string, token: string | null) =>
  apiRequest<ReporteProductosVendidos>(`/api/reportes/productos-vendidos?${rango(desde, hasta)}&top=30`, { token });

export const obtenerReporteInventario = (token: string | null) =>
  apiRequest<ReporteInventario>('/api/reportes/inventario', { token });

export const obtenerReporteCartera = (token: string | null) =>
  apiRequest<ReporteCartera>('/api/reportes/cartera', { token });
