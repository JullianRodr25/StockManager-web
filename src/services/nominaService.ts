import { apiRequest } from './api';
import type {
  ActualizarParametrosNominaRequest,
  AgregarNovedadRequest,
  CrearPrestamoRequest,
  EstadoPrestamo,
  GuardarTrabajadorRequest,
  NominaResumen,
  ParametrosNomina,
  PeriodoNomina,
  PeriodoNominaResumen,
  Prestamo,
  Trabajador,
} from '../types/nomina';

const BASE = '/api/nomina';

export const obtenerResumenNomina = (token: string | null) =>
  apiRequest<NominaResumen>(`${BASE}/resumen`, { token });

// ---------- Trabajadores ----------

export const obtenerTrabajadores = (incluirInactivos: boolean, token: string | null) =>
  apiRequest<Trabajador[]>(`${BASE}/trabajadores?incluirInactivos=${incluirInactivos}`, { token });

export const crearTrabajador = (data: GuardarTrabajadorRequest, token: string | null) =>
  apiRequest<Trabajador>(`${BASE}/trabajadores`, { method: 'POST', body: data, token });

export const actualizarTrabajador = (id: number, data: GuardarTrabajadorRequest, token: string | null) =>
  apiRequest<Trabajador>(`${BASE}/trabajadores/${id}`, { method: 'PUT', body: data, token });

export const activarTrabajador = (id: number, token: string | null) =>
  apiRequest<Trabajador>(`${BASE}/trabajadores/${id}/activar`, { method: 'POST', token });

export const desactivarTrabajador = (id: number, token: string | null) =>
  apiRequest<Trabajador>(`${BASE}/trabajadores/${id}/desactivar`, { method: 'POST', token });

// ---------- Parámetros ----------

export const obtenerParametrosNomina = (token: string | null) =>
  apiRequest<ParametrosNomina>(`${BASE}/parametros`, { token });

export const actualizarParametrosNomina = (data: ActualizarParametrosNominaRequest, token: string | null) =>
  apiRequest<ParametrosNomina>(`${BASE}/parametros`, { method: 'PUT', body: data, token });

// ---------- Préstamos ----------

export function obtenerPrestamos(estado: EstadoPrestamo | null, token: string | null) {
  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  const consulta = params.toString();
  return apiRequest<Prestamo[]>(`${BASE}/prestamos${consulta ? `?${consulta}` : ''}`, { token });
}

export const crearPrestamo = (data: CrearPrestamoRequest, token: string | null) =>
  apiRequest<Prestamo>(`${BASE}/prestamos`, { method: 'POST', body: data, token });

export const cancelarPrestamo = (id: number, token: string | null) =>
  apiRequest<Prestamo>(`${BASE}/prestamos/${id}/cancelar`, { method: 'POST', token });

// ---------- Quincenas ----------

export const obtenerPeriodos = (token: string | null) =>
  apiRequest<PeriodoNominaResumen[]>(`${BASE}/periodos`, { token });

/** La quincena de hoy; null si todavía no se abrió (el backend responde 204). */
export const obtenerPeriodoActual = (token: string | null) =>
  apiRequest<PeriodoNomina | null>(`${BASE}/periodos/actual`, { token });

export const obtenerPeriodo = (id: number, token: string | null) =>
  apiRequest<PeriodoNomina>(`${BASE}/periodos/${id}`, { token });

export const abrirPeriodo = (fechaInicio: string | null, token: string | null) =>
  apiRequest<PeriodoNomina>(`${BASE}/periodos`, { method: 'POST', body: { fechaInicio }, token });

const accionPeriodo = (id: number, accion: string, token: string | null) =>
  apiRequest<PeriodoNomina>(`${BASE}/periodos/${id}/${accion}`, { method: 'POST', token });

export const recalcularPeriodo = (id: number, token: string | null) => accionPeriodo(id, 'recalcular', token);
export const aprobarPeriodo = (id: number, token: string | null) => accionPeriodo(id, 'aprobar', token);
export const pagarPeriodo = (id: number, token: string | null) => accionPeriodo(id, 'pagar', token);
export const cerrarPeriodo = (id: number, token: string | null) => accionPeriodo(id, 'cerrar', token);

export const pagarLiquidacion = (id: number, liquidacionId: number, token: string | null) =>
  apiRequest<PeriodoNomina>(`${BASE}/periodos/${id}/liquidaciones/${liquidacionId}/pagar`, {
    method: 'POST',
    token,
  });

export const agregarNovedad = (id: number, data: AgregarNovedadRequest, token: string | null) =>
  apiRequest<PeriodoNomina>(`${BASE}/periodos/${id}/novedades`, { method: 'POST', body: data, token });

export const eliminarNovedad = (id: number, novedadId: number, token: string | null) =>
  apiRequest<PeriodoNomina>(`${BASE}/periodos/${id}/novedades/${novedadId}`, { method: 'DELETE', token });
