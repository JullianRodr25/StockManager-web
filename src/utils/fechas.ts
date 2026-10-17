/**
 * Fechas de la API. Regla: los instantes (fecha de una venta, factura, abono...) viajan en UTC.
 * El backend ya los envía con "Z", pero si algún día llega uno sin zona (p. ej. "2026-10-17T16:30:00"),
 * `new Date()` lo leería como hora LOCAL del navegador y la factura saldría corrida 5 horas.
 * Este parser lo trata siempre como UTC. NO usar para días de calendario (fecha de vencimiento),
 * que no tienen hora ni zona.
 */
const TIENE_ZONA = /(Z|[+-]\d{2}:?\d{2})$/i;

export function parseInstante(iso: string): Date {
  return new Date(TIENE_ZONA.test(iso) || !iso.includes('T') ? iso : `${iso}Z`);
}

export const ZONA_NEGOCIO = 'America/Bogota';

/** Día de calendario de hoy en Colombia ("yyyy-MM-dd"), sin depender de la zona del navegador. */
export function hoyColombia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_NEGOCIO }).format(new Date());
}

/** Suma días a un "yyyy-MM-dd" (aritmética de calendario, sin horas ni zonas). */
export function sumarDias(dia: string, dias: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function primerDiaDelMes(dia: string, mesesAtras = 0): string {
  const [a, m] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 - mesesAtras, 1)).toISOString().slice(0, 10);
}

export function ultimoDiaDelMes(dia: string, mesesAtras = 0): string {
  const [a, m] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - mesesAtras, 0)).toISOString().slice(0, 10);
}

/** "2026-10-17" -> "17 oct" (formato de día sin hora, no se pasa por Date local). */
export function etiquetaDia(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(a, m - 1, d))
  );
}

export interface RangoFechas {
  desde: string;
  hasta: string;
}

/** Del primer día del mes en curso a hoy (hora de Colombia). */
export function rangoMesActual(): RangoFechas {
  const hoy = hoyColombia();
  return { desde: primerDiaDelMes(hoy), hasta: hoy };
}
