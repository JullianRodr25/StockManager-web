// Los días de calendario (ingreso, fin de contrato, quincenas) llegan como "2026-10-01T00:00:00"
// SIN zona: son un día, no un instante. Usar utils/nomina.ts para mostrarlos y no `new Date()`.

export type TipoContrato = 'Indefinido' | 'Fijo' | 'ObraLabor' | 'PrestacionServicios';
export type MetodoPagoNomina = 'Efectivo' | 'Transferencia';

export interface Trabajador {
  id: number;
  nombre: string;
  numeroIdentificacion: string;
  telefono: string | null;
  cargo: string;
  tipoContrato: TipoContrato;
  fechaIngreso: string;
  fechaFinContrato: string | null;
  salarioMensual: number;
  aplicaSeguridadSocial: boolean;
  metodoPago: MetodoPagoNomina;
  activo: boolean;
  saldoPrestamos: number;
  diasParaFinContrato: number | null;
}

export interface GuardarTrabajadorRequest {
  nombre: string;
  numeroIdentificacion: string;
  telefono: string | null;
  cargo: string;
  tipoContrato: TipoContrato;
  fechaIngreso: string;
  fechaFinContrato: string | null;
  salarioMensual: number;
  aplicaSeguridadSocial: boolean;
  metodoPago: MetodoPagoNomina;
}

export interface ParametrosNomina {
  salarioMinimo: number;
  auxilioTransporte: number;
  limiteSalariosAuxilio: number;
  porcentajeSaludTrabajador: number;
  porcentajePensionTrabajador: number;
  fechaActualizacion: string;
}

export type ActualizarParametrosNominaRequest = Omit<ParametrosNomina, 'fechaActualizacion'>;

export type TipoPrestamo = 'Prestamo' | 'Adelanto';
export type EstadoPrestamo = 'Activo' | 'Saldado' | 'Cancelado';

export interface Prestamo {
  id: number;
  trabajadorId: number;
  nombreTrabajador: string;
  tipo: TipoPrestamo;
  monto: number;
  numeroCuotas: number;
  valorCuota: number;
  primeraCuotaDesde: string;
  cuotasDescontadas: number;
  saldoPendiente: number;
  estado: EstadoPrestamo;
  nota: string | null;
  fechaCreacion: string;
  proximaCuota: number;
}

export interface CrearPrestamoRequest {
  trabajadorId: number;
  tipo: TipoPrestamo;
  monto: number;
  numeroCuotas: number;
  primeraCuotaDesde: string;
  nota: string | null;
}

export type EstadoPeriodo = 'Borrador' | 'Aprobada' | 'Pagada' | 'Cerrada';

export interface NovedadNomina {
  id: number;
  trabajadorId: number;
  tipo: 'Devengo' | 'Descuento';
  concepto: string;
  valor: number;
}

export interface CuotaNomina {
  prestamoId: number;
  tipo: TipoPrestamo;
  numero: number;
  numeroCuotas: number;
  valor: number;
}

export interface LiquidacionNomina {
  id: number;
  trabajadorId: number;
  nombreTrabajador: string;
  cargo: string;
  metodoPago: MetodoPagoNomina;
  salarioQuincena: number;
  auxilioTransporte: number;
  otrosDevengos: number;
  devengado: number;
  descuentoSalud: number;
  descuentoPension: number;
  otrosDescuentos: number;
  descuentoPrestamos: number;
  totalDescuentos: number;
  neto: number;
  pagada: boolean;
  pagadaEn: string | null;
  novedades: NovedadNomina[];
  cuotas: CuotaNomina[];
}

export interface PeriodoNominaResumen {
  id: number;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoPeriodo;
  numeroTrabajadores: number;
  totalDevengado: number;
  totalSeguridadSocial: number;
  totalPrestamos: number;
  totalOtrosDescuentos: number;
  totalNeto: number;
  aprobadaEn: string | null;
  pagadaEn: string | null;
  cerradaEn: string | null;
}

export interface PeriodoNomina {
  resumen: PeriodoNominaResumen;
  liquidaciones: LiquidacionNomina[];
}

export interface AgregarNovedadRequest {
  trabajadorId: number;
  tipo: 'Devengo' | 'Descuento';
  concepto: string;
  valor: number;
}

export interface AlertaNomina {
  tipo: 'contrato_vencido' | 'contrato_por_vencer' | 'cuotas_proximas' | 'prima' | 'quincena_sin_abrir';
  severidad: 'info' | 'advertencia' | 'critica';
  titulo: string;
  detalle: string;
  trabajadorId: number | null;
}

export interface NominaResumen {
  trabajadoresActivos: number;
  nominaMensualEstimada: number;
  saldoPrestamosPendiente: number;
  prestamosActivos: number;
  periodoActual: PeriodoNominaResumen | null;
  alertas: AlertaNomina[];
}
