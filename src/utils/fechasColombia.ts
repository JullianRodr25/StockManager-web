const ZONA_COLOMBIA = 'America/Bogota';

// 'en-CA' formatea como AAAA-MM-DD, comparable como texto.
const formatoDiaColombia = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_COLOMBIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Indica si un instante (ISO, UTC) cae en el mismo día calendario de Colombia que hoy.
 * Espeja la regla del backend (HoraColombia): los instantes se guardan en UTC y el "día" se
 * calcula siempre en hora de Colombia, no en la del navegador. El servidor es quien manda;
 * esto solo evita ofrecer una acción que va a ser rechazada.
 */
export function esHoyEnColombia(fechaIso: string): boolean {
  // Las fechas del backend vienen sin sufijo de zona; se interpretan como UTC.
  const iso = /[zZ]|[+-]\d{2}:\d{2}$/.test(fechaIso) ? fechaIso : `${fechaIso}Z`;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return false;
  return formatoDiaColombia.format(fecha) === formatoDiaColombia.format(new Date());
}
