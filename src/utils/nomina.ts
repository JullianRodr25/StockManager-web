import type { EstadoPeriodo, EstadoPrestamo, FrecuenciaPago, MetodoPagoNomina, TipoContrato } from '@/types/nomina';

/** "2026-10-01T00:00:00" -> "2026-10-01" (los días de nómina son de calendario, sin zona). */
export function soloDia(iso: string): string {
  return iso.slice(0, 10);
}

/** "2026-10-01T00:00:00" -> "01/10/2026". No pasa por Date: un día no tiene zona horaria. */
export function formatearDia(iso: string): string {
  const [a, m, d] = soloDia(iso).split('-');
  return `${d}/${m}/${a}`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "1 – 15 oct 2026", o "26 oct – 1 nov 2026" si el período cruza de mes. */
export function etiquetaQuincena(inicio: string, fin: string): string {
  const [a, m1, d1] = soloDia(inicio).split('-').map(Number);
  const [, m2, d2] = soloDia(fin).split('-').map(Number);
  return m1 === m2
    ? `${d1} – ${d2} ${MESES[m1 - 1]} ${a}`
    : `${d1} ${MESES[m1 - 1]} – ${d2} ${MESES[m2 - 1]} ${a}`;
}

export const FRECUENCIAS_PAGO: FrecuenciaPago[] = ['Semanal', 'Quincenal', 'Mensual'];

/** Cómo se llama el período de cada frecuencia, para los textos de la pantalla. */
export const NOMBRE_PERIODO: Record<FrecuenciaPago, { singular: string; articulo: 'la' | 'el'; siguiente: string }> = {
  Semanal: { singular: 'semana', articulo: 'la', siguiente: 'siguiente' },
  Quincenal: { singular: 'quincena', articulo: 'la', siguiente: 'siguiente' },
  Mensual: { singular: 'mes', articulo: 'el', siguiente: 'siguiente' },
};

export const ETIQUETA_CONTRATO: Record<TipoContrato, string> = {
  Indefinido: 'Término indefinido',
  Fijo: 'Término fijo',
  ObraLabor: 'Obra o labor',
  PrestacionServicios: 'Prestación de servicios',
};

export const TIPOS_CONTRATO: TipoContrato[] = ['Indefinido', 'Fijo', 'ObraLabor', 'PrestacionServicios'];

/** Estos contratos necesitan fecha de cierre. */
export function contratoRequiereFin(tipo: TipoContrato): boolean {
  return tipo === 'Fijo' || tipo === 'ObraLabor';
}

export const METODOS_PAGO: MetodoPagoNomina[] = ['Efectivo', 'Transferencia'];

export const ETIQUETA_ESTADO_PERIODO: Record<EstadoPeriodo, string> = {
  Borrador: 'Borrador',
  Aprobada: 'Aprobada',
  Pagada: 'Pagada',
  Cerrada: 'Cerrada',
};

export const ESTADOS_PERIODO: EstadoPeriodo[] = ['Borrador', 'Aprobada', 'Pagada', 'Cerrada'];

export const ETIQUETA_ESTADO_PRESTAMO: Record<EstadoPrestamo, string> = {
  Activo: 'Activo',
  Saldado: 'Saldado',
  Cancelado: 'Cancelado',
};

/** Quincena que contiene un "yyyy-MM-dd": devuelve el primer día. */
export function inicioDeQuincena(dia: string): string {
  const [a, m, d] = dia.split('-');
  return `${a}-${m}-${Number(d) <= 15 ? '01' : '16'}`;
}
