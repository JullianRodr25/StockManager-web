// Impresión física del tiquete de venta y apertura del cajón de dinero, a través de
// QZ Tray: un pequeño programa que Julian debe instalar una sola vez en el computador
// del mostrador (ver IMPRESION-TIQUETES.md en la raíz del repo). Un navegador no puede
// hablarle directamente al puerto/USB de una impresora térmica; QZ Tray abre un
// WebSocket local (normalmente wss://localhost:8181 o ws://localhost:8182) que este
// servicio usa para mandarle los comandos ESC/POS crudos.
import qz from 'qz-tray';
import { formatoFecha, formatoMoneda } from '@/components/DetalleFacturaDialog';
import type { VentaResponse } from '@/types/ventas';

const ESC = '\x1B';
const GS = '\x1D';
const ANCHO_TICKET = 32; // columnas para una impresora de 58mm; en 80mm sobra espacio pero se ve bien igual.

// Comando estándar de apertura de cajón (ESC p m t1 t2), el mismo que usan casi todas
// las impresoras térmicas con puerto RJ11/RJ12 para el cajón de dinero.
const ABRIR_CAJON = ESC + 'p' + '\x00' + '\x19' + '\xFA';

// Datos del emisor (negocio) configurables desde Configuración > "Datos de la empresa", que
// se imprimen en el encabezado del tiquete. Todos opcionales: el que no esté configurado
// simplemente no aparece en esa línea, en vez de imprimir "null" o dejar un hueco vacío.
export interface DatosEmpresaTiquete {
  nombreEmpresa: string | null;
  nitEmpresa: string | null;
  direccionEmpresa: string | null;
  telefonoEmpresa: string | null;
  emailEmpresa: string | null;
}

const NOMBRE_EMPRESA_POR_DEFECTO = 'FERRETERIA GOLD';

let conexionEnCurso: Promise<void> | null = null;

async function asegurarConexion(): Promise<void> {
  if (qz.websocket.isActive()) return;

  if (!conexionEnCurso) {
    conexionEnCurso = qz.websocket.connect().finally(() => {
      conexionEnCurso = null;
    });
  }

  try {
    await conexionEnCurso;
  } catch {
    throw new Error(
      'No se pudo conectar con QZ Tray. Verifica que esté instalado y abierto en este computador.'
    );
  }
}

function lineaDosColumnas(izquierda: string, derecha: string, ancho: number = ANCHO_TICKET): string {
  const espacio = Math.max(ancho - izquierda.length - derecha.length, 1);
  return izquierda + ' '.repeat(espacio) + derecha + '\n';
}

// Valor base (sin IVA) y valor del IVA del total de la venta, sumando el desglose por línea
// que ya trae cada detalle (ver VentaService) — el mismo cálculo que usa la vista digital en
// DetalleFacturaDialog, así el tiquete físico siempre coincide con lo que se ve en pantalla.
function calcularBaseEIva(venta: VentaResponse): { valorBase: number; valorIva: number } {
  return venta.detalles.reduce(
    (acumulado, linea) => ({
      valorBase: acumulado.valorBase + linea.subtotalSinIva,
      valorIva: acumulado.valorIva + linea.iva,
    }),
    { valorBase: 0, valorIva: 0 }
  );
}

function construirTiquete(venta: VentaResponse, datosEmpresa: DatosEmpresaTiquete): string[] {
  const lineas: string[] = [];
  const { valorBase, valorIva } = calcularBaseEIva(venta);

  // --- Encabezado: datos del emisor (negocio) ---
  lineas.push(ESC + '@'); // reset de la impresora
  lineas.push(ESC + 'a' + '\x01'); // centrar
  lineas.push(ESC + '!' + '\x18'); // negrita + doble alto/ancho
  lineas.push(`${datosEmpresa.nombreEmpresa || NOMBRE_EMPRESA_POR_DEFECTO}\n`);
  lineas.push(ESC + '!' + '\x00'); // texto normal
  if (datosEmpresa.nitEmpresa) {
    lineas.push(`NIT ${datosEmpresa.nitEmpresa}\n`);
  }
  if (datosEmpresa.direccionEmpresa) {
    lineas.push(`${datosEmpresa.direccionEmpresa}\n`);
  }
  if (datosEmpresa.telefonoEmpresa) {
    lineas.push(`Tel. ${datosEmpresa.telefonoEmpresa}\n`);
  }
  if (datosEmpresa.emailEmpresa) {
    lineas.push(`${datosEmpresa.emailEmpresa}\n`);
  }
  lineas.push('-'.repeat(ANCHO_TICKET) + '\n');

  // --- Factura, fecha y cliente ---
  lineas.push(ESC + 'a' + '\x00'); // alinear a la izquierda
  lineas.push(`Factura ${venta.numeroFactura}\n`);
  lineas.push(`${formatoFecha(venta.fecha)}\n`);
  if (venta.nombreComprador) {
    lineas.push(`Cliente: ${venta.nombreComprador}\n`);
  }
  if (venta.telefonoComprador) {
    lineas.push(`Tel: ${venta.telefonoComprador}\n`);
  }
  if (venta.emailComprador) {
    lineas.push(`${venta.emailComprador}\n`);
  }
  lineas.push('-'.repeat(ANCHO_TICKET) + '\n');

  // --- Productos ---
  for (const detalle of venta.detalles) {
    lineas.push(`${detalle.productoNombre}\n`);
    lineas.push(
      lineaDosColumnas(
        `  ${detalle.cantidad} x ${formatoMoneda.format(detalle.precioUnitario)}`,
        formatoMoneda.format(detalle.subtotalConIva)
      )
    );
  }

  lineas.push('-'.repeat(ANCHO_TICKET) + '\n');

  // --- Valor base, IVA y total segregados (igual que la factura digital) ---
  lineas.push(lineaDosColumnas('SUBTOTAL', formatoMoneda.format(valorBase)));
  if (valorIva > 0) {
    lineas.push(lineaDosColumnas('IVA', formatoMoneda.format(valorIva)));
  }
  lineas.push(ESC + '!' + '\x08'); // negrita
  lineas.push(lineaDosColumnas('TOTAL', formatoMoneda.format(venta.total)));
  lineas.push(ESC + '!' + '\x00');

  if (venta.metodoPago === 'Efectivo' && venta.montoRecibido != null) {
    lineas.push(lineaDosColumnas('Recibido', formatoMoneda.format(venta.montoRecibido)));
    lineas.push(lineaDosColumnas('Cambio', formatoMoneda.format(venta.cambio ?? 0)));
  } else {
    lineas.push(`Metodo de pago: ${venta.metodoPago}\n`);
  }

  lineas.push('\n');
  lineas.push(ESC + 'a' + '\x01');
  lineas.push('Gracias por su compra\n');
  lineas.push('\n\n\n');
  lineas.push(GS + 'V' + '\x00'); // corte de papel

  // La orden de apertura del cajón se envía junto con el tiquete, en el mismo trabajo de
  // impresión: así, al imprimir la factura, el cajón se abre automáticamente (igual que
  // en el sistema anterior de Julian).
  lineas.push(ABRIR_CAJON);

  return lineas;
}

/**
 * Imprime el tiquete físico de una venta (o cuenta fiada cerrada) en la impresora térmica
 * configurada, y abre el cajón de dinero como parte del mismo trabajo de impresión.
 */
export async function imprimirRecibo(
  venta: VentaResponse,
  nombreImpresora: string,
  datosEmpresa: DatosEmpresaTiquete
): Promise<void> {
  await asegurarConexion();
  const config = qz.configs.create(nombreImpresora);
  await qz.print(config, construirTiquete(venta, datosEmpresa));
}

/**
 * Abre el cajón de dinero sin imprimir nada, para cuando el cajero necesita sacar o
 * guardar efectivo fuera de una venta (por ejemplo, para dar cambio de un billete grande).
 */
export async function abrirCajon(nombreImpresora: string): Promise<void> {
  await asegurarConexion();
  const config = qz.configs.create(nombreImpresora);
  await qz.print(config, [ABRIR_CAJON]);
}
