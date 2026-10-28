// Deben mantenerse sincronizados manualmente con StockManager.Application/DTOs/CajaDtos.cs.

export type EstadoTurnoCaja = 'Abierto' | 'Cerrado';

export interface TotalesCaja {
  ventasEfectivo: number;
  abonosFiadoEfectivo: number;
  pagosProveedorEfectivo: number;
  pagosNominaEfectivo: number;
  /** Solo para conciliar con el banco: no entra en el efectivo esperado. */
  transferencias: number;
  /** Solo para conciliar con el datáfono: no entra en el efectivo esperado. */
  tarjeta: number;
}

export interface ConteoDenominacion {
  denominacion: number;
  cantidad: number;
  valor: number;
}

export interface TurnoCaja {
  id: number;
  empleadoId: number;
  empleadoNombre: string;
  fechaApertura: string;
  baseInicial: number;
  estado: EstadoTurnoCaja;
  /** Configuración: el empleado cuenta sin ver el esperado. */
  conteoCiego: boolean;
  /** false cuando el turno está abierto y el conteo a ciegas oculta totales y esperado. */
  esperadoVisible: boolean;
  totales: TotalesCaja | null;
  efectivoEsperado: number | null;
  fechaCierre: string | null;
  cerradoPorNombre: string | null;
  efectivoContado: number | null;
  diferencia: number | null;
  notaCierre: string | null;
  conteo: ConteoDenominacion[] | null;
}

export interface TurnoCajaResumen {
  id: number;
  empleadoId: number;
  empleadoNombre: string;
  fechaApertura: string;
  fechaCierre: string | null;
  estado: EstadoTurnoCaja;
  baseInicial: number;
  efectivoEsperado: number | null;
  efectivoContado: number | null;
  diferencia: number | null;
}

export interface TurnosCajaPaginadosResponse {
  data: TurnoCajaResumen[];
  pagina: number;
  tamanoPagina: number;
  total: number;
  totalPaginas: number;
}

export interface AbrirTurnoRequest {
  baseInicial: number;
}

export interface ConteoDenominacionRequest {
  denominacion: number;
  cantidad: number;
}

export interface CerrarTurnoRequest {
  conteo: ConteoDenominacionRequest[];
  nota: string | null;
}
