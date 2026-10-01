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
  email: string;
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
  email: string;
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
  email: string;
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
