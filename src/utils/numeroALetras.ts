// Convierte un monto entero en pesos a su expresión en letras ("sesenta y tres mil").
// Se usa en la línea "SON: ... PESOS" de la factura. Sin tildes (ASCII puro) porque va a la
// impresora térmica; cubre hasta miles de millones, de sobra para una ferretería.

const UNIDADES = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho',
  'diecinueve', 'veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco',
  'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve',
];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos',
  'setecientos', 'ochocientos', 'novecientos',
];

function menorDeMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena) partes.push(CENTENAS[centena]);
  if (resto) {
    if (resto < 30) {
      partes.push(UNIDADES[resto]);
    } else {
      const unidad = resto % 10;
      const decena = DECENAS[Math.floor(resto / 10)];
      partes.push(unidad ? `${decena} y ${UNIDADES[unidad]}` : decena);
    }
  }
  return partes.join(' ');
}

// "uno" delante de "mil"/"millones" se apocopa: "veintiun mil", "treinta y un millones".
const apocopar = (texto: string) => texto.replace(/uno$/, 'un');

function enteroALetras(n: number): string {
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) {
    partes.push(millones === 1 ? 'un millon' : `${apocopar(enteroALetras(millones))} millones`);
  }
  if (miles) {
    partes.push(miles === 1 ? 'mil' : `${apocopar(menorDeMil(miles))} mil`);
  }
  if (resto) partes.push(menorDeMil(resto));
  return partes.join(' ');
}

/** "SON: SESENTA Y TRES MIL PESOS" para un monto en pesos (se redondea al peso). */
export function montoEnLetras(monto: number): string {
  const entero = Math.round(Math.abs(monto));
  if (entero === 1) return 'SON: UN PESO';
  const texto = enteroALetras(entero);
  // "un millon de pesos", "dos millones de pesos": con millones exactos se usa "de".
  const conDe = entero >= 1_000_000 && entero % 1_000_000 === 0;
  return `SON: ${texto}${conDe ? ' de' : ''} pesos`.toUpperCase();
}
