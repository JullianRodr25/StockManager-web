import type { VentaResumenResponse } from '@/types/ventas';

/** Días sin cerrarse a partir de los cuales una cuenta abierta se considera vencida. */
export const DIAS_CUENTA_VENCIDA = 15;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function diasAbierta(fechaApertura: string, ahora: Date = new Date()): number {
  const dias = Math.floor((ahora.getTime() - new Date(fechaApertura).getTime()) / MS_POR_DIA);
  return Math.max(dias, 0);
}

export function estaVencida(cuenta: Pick<VentaResumenResponse, 'fecha'>, ahora: Date = new Date()): boolean {
  return diasAbierta(cuenta.fecha, ahora) >= DIAS_CUENTA_VENCIDA;
}

export function saldoPendiente(cuenta: Pick<VentaResumenResponse, 'total' | 'totalAbonado'>): number {
  return Math.max(cuenta.total - cuenta.totalAbonado, 0);
}

export function textoAntiguedad(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'hace 1 día';
  return `hace ${dias} días`;
}

export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';
  const primera = palabras[0][0] ?? '';
  const segunda = palabras.length > 1 ? (palabras[1][0] ?? '') : '';
  return (primera + segunda).toUpperCase();
}
