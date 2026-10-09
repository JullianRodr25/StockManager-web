// Estos tipos deben mantenerse sincronizados manualmente con
// StockManager.Application/DTOs/ClienteDtos.cs en el backend.

/** "Pwa" (autoregistro público) o "Caja" (creado por un Empleado/Admin en el panel). */
export type OrigenCliente = 'Pwa' | 'Caja';

/** Catálogo simplificado de tipo de documento fiscal (para factura electrónica). */
export type TipoDocumentoFiscal = 'CC' | 'NIT' | 'CE' | 'Pasaporte' | 'Otro';

export interface Cliente {
  id: number;
  numeroIdentificacion: string;
  nombre: string;
  /** Opcional en clientes de caja; obligatorio en los de la PWA. */
  email: string | null;
  telefono: string;
  direccion: string;
  activo: boolean;
  origenRegistro: OrigenCliente;
  tipoDocumentoFiscal: TipoDocumentoFiscal | null;
  numeroDocumentoFiscal: string | null;
  razonSocialFiscal: string | null;
  direccionFiscal: string | null;
  emailFacturacion: string | null;
  /** true si tiene lo mínimo (tipo + número de documento fiscal y razón social) para pedir factura electrónica sin pasos extra. */
  tieneDatosFacturacionElectronicaCompletos: boolean;
}

export interface CrearClienteRequest {
  numeroIdentificacion: string;
  nombre: string;
  email?: string | null;
  telefono: string;
  direccion: string;
  password?: string | null;
  tipoDocumentoFiscal?: TipoDocumentoFiscal | null;
  numeroDocumentoFiscal?: string | null;
  razonSocialFiscal?: string | null;
  direccionFiscal?: string | null;
  emailFacturacion?: string | null;
}

export interface ActualizarClienteRequest {
  nombre: string;
  email?: string | null;
  telefono: string;
  direccion: string;
}

export interface ActualizarDatosFacturacionRequest {
  tipoDocumentoFiscal: TipoDocumentoFiscal | null;
  numeroDocumentoFiscal: string | null;
  razonSocialFiscal: string | null;
  direccionFiscal: string | null;
  emailFacturacion: string | null;
}

export interface ClienteCreadoResponse {
  cliente: Cliente;
  passwordTemporal: string | null;
}

export interface AvisoImportacionCliente {
  fila: number;
  mensaje: string;
}

export interface ImportarClientesResponse {
  totalFilas: number;
  creados: number;
  /** Identificaciones que ya existían: se dejan como están. */
  yaExistentes: number;
  /** Terceros de otra categoría (nómina, contabilidad...) que no son clientes. */
  otraCategoria: number;
  /** true solo si los clientes se guardaron; false en la vista previa o si hubo errores. */
  aplicado: boolean;
  avisos: AvisoImportacionCliente[];
  errores: AvisoImportacionCliente[];
}
