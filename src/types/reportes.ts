export interface VentasPorDia { dia: string; cantidad: number; total: number }
export interface VentasPorMetodo { metodo: string; cantidad: number; total: number }

export interface ReporteVentas {
  desde: string;
  hasta: string;
  totalVendido: number;
  cantidadVentas: number;
  ticketPromedio: number;
  abonosRecibidos: number;
  porDia: VentasPorDia[];
  porMetodo: VentasPorMetodo[];
}

export interface ProductoVendido {
  productoId: number;
  nombre: string;
  categoria: string;
  unidades: number;
  ingresos: number;
  utilidadEstimada: number;
}
export interface ReporteProductosVendidos { desde: string; hasta: string; productos: ProductoVendido[] }

export interface InventarioCategoria { categoria: string; productos: number; unidades: number; valorCosto: number; valorVenta: number }
export interface ProductoStockBajo { productoId: number; nombre: string; categoria: string; stockActual: number; stockMinimo: number; faltante: number }
export interface ReporteInventario {
  productosActivos: number;
  agotados: number;
  stockBajo: number;
  valorCosto: number;
  valorVenta: number;
  porCategoria: InventarioCategoria[];
  productosStockBajo: ProductoStockBajo[];
}

export interface CuentaPorCobrar { ventaId: number; cliente: string; fecha: string; diasAbierta: number; total: number; saldo: number }
export interface RangoAntiguedad { rango: string; cuentas: number; saldo: number }
export interface SaldoProveedor { proveedorId: number; proveedor: string; cuentas: number; saldo: number; saldoVencido: number; proximoVencimiento: string | null }
export interface ReporteCartera {
  totalPorCobrar: number;
  antiguedadPorCobrar: RangoAntiguedad[];
  porCobrar: CuentaPorCobrar[];
  totalPorPagar: number;
  totalVencidoPorPagar: number;
  porPagar: SaldoProveedor[];
}
