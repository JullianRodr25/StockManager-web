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
