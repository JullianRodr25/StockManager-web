// Denominaciones que se cuentan al cerrar la caja. Deben coincidir con
// TurnoCajaService.DenominacionesValidas del backend (que rechaza cualquier otra).

export interface GrupoDenominaciones {
  titulo: string;
  denominaciones: { valor: number; etiqueta: string }[];
}

export const GRUPOS_DENOMINACIONES: GrupoDenominaciones[] = [
  {
    titulo: 'Billetes',
    denominaciones: [
      { valor: 100000, etiqueta: '$ 100.000' },
      { valor: 50000, etiqueta: '$ 50.000' },
      { valor: 20000, etiqueta: '$ 20.000' },
      { valor: 10000, etiqueta: '$ 10.000' },
      { valor: 5000, etiqueta: '$ 5.000' },
      { valor: 2000, etiqueta: '$ 2.000' },
    ],
  },
  {
    titulo: 'Monedas',
    denominaciones: [
      { valor: 1000, etiqueta: '$ 1.000' },
      { valor: 500, etiqueta: '$ 500' },
      // Las monedas más pequeñas se cuentan juntas, valoradas a 200 cada una.
      { valor: 200, etiqueta: '$ 200 y menos' },
    ],
  },
];

/** Cantidades tal como las escribe el usuario (texto), por valor de denominación. */
export type CantidadesPorDenominacion = Record<number, string>;

export function cantidadNumerica(texto: string | undefined): number {
  const n = Number(texto);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function calcularContado(cantidades: CantidadesPorDenominacion): number {
  return GRUPOS_DENOMINACIONES.flatMap((g) => g.denominaciones).reduce(
    (suma, { valor }) => suma + valor * cantidadNumerica(cantidades[valor]),
    0
  );
}
