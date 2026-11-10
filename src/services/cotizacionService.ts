import { apiDescargarArchivo, apiRequest } from './api';
import type {
  ConvertirCotizacionRequest,
  Cotizacion,
  CotizacionesPaginadas,
  GuardarCotizacionRequest,
  ReporteCotizaciones,
} from '../types/cotizaciones';
import type { VentaResponse } from '../types/ventas';

export interface FiltrosCotizaciones {
  pagina?: number;
  tamanoPagina?: number;
  estado?: string;
  busqueda?: string;
  desde?: string;
  hasta?: string;
}

export async function listarCotizaciones(
  filtros: FiltrosCotizaciones,
  token: string | null
): Promise<CotizacionesPaginadas> {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== '') params.set(clave, String(valor));
  });
  return apiRequest<CotizacionesPaginadas>(`/api/cotizaciones?${params.toString()}`, { token });
}

export async function obtenerCotizacion(id: number, token: string | null): Promise<Cotizacion> {
  return apiRequest<Cotizacion>(`/api/cotizaciones/${id}`, { token });
}

export async function crearCotizacion(data: GuardarCotizacionRequest, token: string | null): Promise<Cotizacion> {
  return apiRequest<Cotizacion>('/api/cotizaciones', { method: 'POST', body: data, token });
}

export async function actualizarCotizacion(
  id: number,
  data: GuardarCotizacionRequest,
  token: string | null
): Promise<Cotizacion> {
  return apiRequest<Cotizacion>(`/api/cotizaciones/${id}`, { method: 'PUT', body: data, token });
}

export async function anularCotizacion(id: number, token: string | null): Promise<Cotizacion> {
  return apiRequest<Cotizacion>(`/api/cotizaciones/${id}/anular`, { method: 'POST', token });
}

/** Convierte la cotización en una venta cobrada (precios cotizados, stock descontado). */
export async function convertirCotizacion(
  id: number,
  data: ConvertirCotizacionRequest,
  token: string | null
): Promise<VentaResponse> {
  return apiRequest<VentaResponse>(`/api/cotizaciones/${id}/convertir`, { method: 'POST', body: data, token });
}

export async function descargarPdfCotizacion(id: number, token: string | null): Promise<Blob> {
  return apiDescargarArchivo(`/api/cotizaciones/${id}/pdf`, token);
}

export async function obtenerReporteCotizaciones(
  desde: string,
  hasta: string,
  token: string | null
): Promise<ReporteCotizaciones> {
  const params = new URLSearchParams({ desde, hasta });
  return apiRequest<ReporteCotizaciones>(`/api/reportes/cotizaciones?${params.toString()}`, { token });
}
