// Impresión física del tiquete de venta y apertura del cajón de dinero, a través de
// QZ Tray: un pequeño programa que Julian debe instalar una sola vez en el computador
// del mostrador (ver IMPRESION-TIQUETES.md en la raíz del repo). Un navegador no puede
// hablarle directamente al puerto/USB de una impresora térmica; QZ Tray abre un
// WebSocket local (normalmente wss://localhost:8181 o ws://localhost:8182) que este
// servicio usa para mandarle los comandos ESC/POS crudos.
import qz from 'qz-tray';
import { formatoFecha } from '@/components/DetalleFacturaDialog';
import type { VentaResponse } from '@/types/ventas';

const ESC = '\x1B';
const GS = '\x1D';
const ANCHO_TICKET = 32; // columnas para una impresora de 58mm; en 80mm sobra espacio pero se ve bien igual.

// La impresora térmica solo entiende una página de código de un solo byte (normalmente
// CP437), no UTF-8. Cualquier carácter fuera de ese rango (tildes, "ñ", o incluso el espacio
// especial que Intl.NumberFormat mete entre "$" y el número en modo moneda) llega como bytes
// sueltos que el firmware interpreta mal: a veces como símbolos basura, a veces como si
// fueran un comando suyo (por eso el salto de línea gigante antes de "Gracias por su
// compra"). En vez de adivinar la tabla de códigos exacta de esta impresora, la solución
// portable es nunca mandarle nada fuera de ASCII puro.
function paraImpresora(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes: á→a, é→e, ñ→n (ñ = n + tilde combinada), etc.
    .replace(/[  -​ ]/g, ' ') // espacios "raros" (el que Intl mete en "3:25 a. m." o en montos en moneda) → espacio normal
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\x7F]/g, '?'); // cualquier otro carácter no-ASCII que se cuele (emojis, comillas tipográficas, etc.)
}

// Formato de moneda propio para el tiquete (ASCII puro): "$700.000". A diferencis del
// formatoMoneda que usa la pantalla (Intl.NumberFormat en modo "currency"), este no inserta
// el espacio especial entre "$" y el número que rompía la impresión.
function formatoMonedaTicket(valor: number): string {
  return `$${Math.round(valor).toLocaleString('es-CO')}`;
}

// Comando estándar de apertura de cajón (ESC p m t1 t2), el mismo que usan casi todas
// las impresoras térmicas con puerto RJ11/RJ12 para el cajón de dinero.
const ABRIR_CAJON = ESC + 'p' + '\x00' + '\x19' + '\xFA';

// El cajón solo debe abrirse automáticamente cuando de verdad entra o sale efectivo físico:
// en Tarjeta o Transferencia el dinero nunca pasa por la caja, así que abrirla no tiene
// ningún propósito y solo deja el efectivo expuesto sin necesidad. En un pago "Mixto" se
// abre únicamente si el desglose incluye una línea en Efectivo.
export function debeAbrirCajon(venta: VentaResponse): boolean {
  if (venta.metodoPago === 'Efectivo') return true;
  if (venta.metodoPago === 'Mixto') {
    return (venta.detallesPago ?? []).some((linea) => linea.metodoPago === 'Efectivo');
  }
  return false;
}

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
  lineas.push(`${paraImpresora(datosEmpresa.nombreEmpresa || NOMBRE_EMPRESA_POR_DEFECTO)}\n`);
  lineas.push(ESC + '!' + '\x00'); // texto normal
  if (datosEmpresa.nitEmpresa) {
    lineas.push(`NIT ${paraImpresora(datosEmpresa.nitEmpresa)}\n`);
  }
  if (datosEmpresa.direccionEmpresa) {
    lineas.push(`${paraImpresora(datosEmpresa.direccionEmpresa)}\n`);
  }
  if (datosEmpresa.telefonoEmpresa) {
    lineas.push(`Tel. ${paraImpresora(datosEmpresa.telefonoEmpresa)}\n`);
  }
  if (datosEmpresa.emailEmpresa) {
    lineas.push(`${paraImpresora(datosEmpresa.emailEmpresa)}\n`);
  }
  lineas.push('-'.repeat(ANCHO_TICKET) + '\n');

  // --- Factura, fecha y cliente ---
  lineas.push(ESC + 'a' + '\x00'); // alinear a la izquierda
  lineas.push(`Factura ${venta.numeroFactura}\n`);
  lineas.push(`${paraImpresora(formatoFecha(venta.fecha))}\n`);
  if (venta.nombreComprador) {
    lineas.push(`Cliente: ${paraImpresora(venta.nombreComprador)}\n`);
  }
  if (venta.telefonoComprador) {
    lineas.push(`Tel: ${paraImpresora(venta.telefonoComprador)}\n`);
  }
  if (venta.emailComprador) {
    lineas.push(`${paraImpresora(venta.emailComprador)}\n`);
  }
  lineas.push('-'.repeat(ANCHO_TICKET) + '\n');

  // --- Productos ---
  for (const detalle of venta.detalles) {
    lineas.push(`${paraImpresora(detalle.productoNombre)}\n`);
    lineas.push(
      lineaDosColumnas(
        `  ${detalle.cantidad} x ${formatoMonedaTicket(detalle.precioUnitario)}`,
        formatoMonedaTicket(detalle.subtotalConIva)
      )
    );
  }

  lineas.push('-'.repeat(ANCHO_TICKET) + '\n');

  // --- Valor base, IVA y total segregados (igual que la factura digital) ---
  lineas.push(lineaDosColumnas('SUBTOTAL', formatoMonedaTicket(valorBase)));
  if (valorIva > 0) {
    lineas.push(lineaDosColumnas('IVA', formatoMonedaTicket(valorIva)));
  }
  lineas.push(ESC + '!' + '\x08'); // negrita
  lineas.push(lineaDosColumnas('TOTAL', formatoMonedaTicket(venta.total)));
  lineas.push(ESC + '!' + '\x00');

  if (venta.metodoPago === 'Efectivo' && venta.montoRecibido != null) {
    lineas.push(lineaDosColumnas('Recibido', formatoMonedaTicket(venta.montoRecibido)));
    lineas.push(lineaDosColumnas('Cambio', formatoMonedaTicket(venta.cambio ?? 0)));
  } else {
    lineas.push(`Metodo de pago: ${paraImpresora(venta.metodoPago)}\n`);
  }

  if (venta.requiereFacturaElectronica) {
    lineas.push('-'.repeat(ANCHO_TICKET) + '\n');
    lineas.push('Factura electronica solicitada\n');
    if (venta.estadoFacturaElectronica === 'Pendiente') {
      lineas.push('Pendiente de envio a la DIAN\n');
    }
  }

  lineas.push('\n');
  lineas.push(ESC + 'a' + '\x01');
  lineas.push('Gracias por su compra\n');
  lineas.push('\n\n\n');
  lineas.push(GS + 'V' + '\x00'); // corte de papel

  // La orden de apertura del cajón se envía junto con el tiquete, en el mismo trabajo de
  // impresión, pero solo cuando el pago fue (total o parcialmente) en efectivo: así, al
  // imprimir la factura, el cajón se abre automáticamente igual que en el sistema anterior
  // de Julian, pero ya no se abre para Tarjeta o Transferencia, donde no hay efectivo que
  // organizar.
  if (debeAbrirCajon(venta)) {
    lineas.push(ABRIR_CAJON);
  }

  return lineas;
}

/**
 * Imprime el tiquete físico de una venta (o cuenta fiada cerrada) en la impresora térmica
 * configurada. El cajón de dinero se abre como parte del mismo trabajo de impresión solo si
 * el pago incluyó efectivo (ver debeAbrirCajon); para Tarjeta o Transferencia solo se imprime
 * el tiquete.
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
