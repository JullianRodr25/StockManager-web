// Utilidades de los datos fiscales que pide la DIAN. Deben mantenerse alineadas con
// StockManager.Domain/Fiscal en el backend (que es quien valida de verdad).

export type TipoPersona = 'Natural' | 'Juridica';

export const TIPOS_PERSONA: { valor: TipoPersona; etiqueta: string }[] = [
  { valor: 'Natural', etiqueta: 'Persona natural' },
  { valor: 'Juridica', etiqueta: 'Persona jurídica (empresa)' },
];

// Pesos de la DIAN, aplicados de derecha a izquierda sobre los dígitos del NIT.
const PESOS_NIT = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/**
 * Dígito de verificación de un NIT escrito como "900123456" o "900.123.456" (sin DV).
 * Devuelve null si no es calculable (vacío, no numérico o muy largo): la pantalla solo lo
 * muestra como ayuda, la validación real la hace el backend.
 */
export function digitoVerificacionNit(nit: string): number | null {
  const limpio = nit.replace(/[.\s]/g, '').split('-')[0] ?? '';
  if (limpio.length < 5 || limpio.length > PESOS_NIT.length || !/^\d+$/.test(limpio)) return null;

  let suma = 0;
  for (let i = 0; i < limpio.length; i++) {
    suma += Number(limpio[limpio.length - 1 - i]) * (PESOS_NIT[i] ?? 0);
  }
  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}

/** Tipo de persona más probable según el documento: una empresa siempre usa NIT. */
export function sugerirTipoPersona(tipoDocumento: string): TipoPersona | '' {
  if (tipoDocumento === 'NIT') return 'Juridica';
  if (tipoDocumento === 'CC' || tipoDocumento === 'CE' || tipoDocumento === 'Pasaporte') return 'Natural';
  return '';
}

/** Unidades de medida de uso común en una ferretería, con su código DIAN. */
export const UNIDADES_MEDIDA: { codigo: string; etiqueta: string }[] = [
  { codigo: '94', etiqueta: 'Unidad' },
  { codigo: 'KGM', etiqueta: 'Kilogramo' },
  { codigo: 'GRM', etiqueta: 'Gramo' },
  { codigo: 'LBR', etiqueta: 'Libra' },
  { codigo: 'MTR', etiqueta: 'Metro' },
  { codigo: 'CMT', etiqueta: 'Centímetro' },
  { codigo: 'MTK', etiqueta: 'Metro cuadrado' },
  { codigo: 'MTQ', etiqueta: 'Metro cúbico' },
  { codigo: 'LTR', etiqueta: 'Litro' },
  { codigo: 'GLL', etiqueta: 'Galón' },
  { codigo: 'BX', etiqueta: 'Caja' },
  { codigo: 'BG', etiqueta: 'Bolsa' },
  { codigo: 'DZN', etiqueta: 'Docena' },
  { codigo: 'PR', etiqueta: 'Par' },
];

/** Código DANE válido: exactamente 5 dígitos. */
export const esCodigoMunicipioValido = (codigo: string): boolean => /^\d{5}$/.test(codigo);
