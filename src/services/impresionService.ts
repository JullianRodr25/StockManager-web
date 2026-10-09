// Impresión física del tiquete de venta y apertura del cajón de dinero, a través de
// QZ Tray: un pequeño programa que Julian debe instalar una sola vez en el computador
// del mostrador (ver IMPRESION-TIQUETES.md en la raíz del repo). Un navegador no puede
// hablarle directamente al puerto/USB de una impresora térmica; QZ Tray abre un
// WebSocket local (normalmente wss://localhost:8181 o ws://localhost:8182) que este
// servicio usa para mandarle los comandos ESC/POS crudos.
import qz from 'qz-tray';
import { formatoFecha } from '@/components/DetalleFacturaDialog';
import type { FacturaDocumento } from '@/types/facturaDocumento';
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

// Parte un texto largo (resolución DIAN, texto legal) en renglones del ancho del tiquete,
// cortando por palabras para no partirlas a la mitad.
function envolverTexto(texto: string, ancho: number = ANCHO_TICKET): string[] {
  const renglones: string[] = [];
  let actual = '';
  for (const palabra of paraImpresora(texto).split(/\s+/).filter(Boolean)) {
    if (actual && (actual + ' ' + palabra).length > ancho) {
      renglones.push(actual);
      actual = palabra;
    } else {
      actual = actual ? `${actual} ${palabra}` : palabra;
    }
  }
  if (actual) renglones.push(actual);
  return renglones;
}

function construirTiquete(venta: VentaResponse, doc: FacturaDocumento): string[] {
  const lineas: string[] = [];
  const centrado = (texto: string) => envolverTexto(texto).forEach((r) => lineas.push(`${r}\n`));
  const separador = () => lineas.push('-'.repeat(ANCHO_TICKET) + '\n');
  const { emisor, comprador } = doc;

  // --- Encabezado: datos del emisor (negocio), todo tomado de Configuración ---
  lineas.push(ESC + '@'); // reset de la impresora
  lineas.push(ESC + 'a' + '\x01'); // centrar
  lineas.push(ESC + '!' + '\x18'); // negrita + doble alto/ancho
  lineas.push(`${paraImpresora(emisor.nombre || NOMBRE_EMPRESA_POR_DEFECTO)}\n`);
  lineas.push(ESC + '!' + '\x00'); // texto normal
  if (emisor.nit) centrado(`NIT ${emisor.nit}`);
  if (emisor.responsabilidadIva) centrado(emisor.responsabilidadIva);
  if (emisor.actividadEconomica) centrado(`Act. economica: ${emisor.actividadEconomica}`);
  if (emisor.direccion) centrado(emisor.direccion);
  if (emisor.barrio) centrado(emisor.barrio);
  if (emisor.ciudad) centrado(emisor.ciudad);
  if (emisor.telefono) centrado(`Tel. ${emisor.telefono}`);
  if (emisor.email) centrado(emisor.email);
  if (emisor.resolucionDianTexto) centrado(emisor.resolucionDianTexto);
  separador();

  // --- Factura, fecha, vendedor y cliente ---
  lineas.push(ESC + 'a' + '\x00'); // alinear a la izquierda
  lineas.push(`Factura ${paraImpresora(doc.numero)}\n`);
  lineas.push(`${paraImpresora(formatoFecha(doc.fecha))}\n`);
  if (doc.vendedor) lineas.push(`Vendedor: ${paraImpresora(doc.vendedor)}\n`);
  lineas.push(`Cliente: ${paraImpresora(comprador.nombre)}\n`);
  if (comprador.documento) {
    lineas.push(`${paraImpresora(comprador.tipoDocumento ?? 'Doc.')}: ${paraImpresora(comprador.documento)}\n`);
  }
  if (comprador.direccion) lineas.push(`Dir: ${paraImpresora(comprador.direccion)}\n`);
  if (comprador.telefono) lineas.push(`Tel: ${paraImpresora(comprador.telefono)}\n`);
  separador();

  // --- Productos ---
  for (const linea of doc.lineas) {
    lineas.push(`${paraImpresora(linea.producto)}\n`);
    lineas.push(
      lineaDosColumnas(
        `  ${linea.cantidad} x ${formatoMonedaTicket(linea.precioUnitario)}`,
        formatoMonedaTicket(linea.total)
      )
    );
  }

  separador();

  // --- Base e IVA por tarifa, y total ---
  lineas.push(lineaDosColumnas('SUBTOTAL', formatoMonedaTicket(doc.subtotalBase)));
  for (const fila of doc.resumenIva.filter((r) => r.tarifa > 0)) {
    lineas.push(lineaDosColumnas(`Base IVA ${fila.tarifa}%`, formatoMonedaTicket(fila.base)));
    lineas.push(lineaDosColumnas(`IVA ${fila.tarifa}%`, formatoMonedaTicket(fila.iva)));
  }
  lineas.push(ESC + '!' + '\x08'); // negrita
  lineas.push(lineaDosColumnas('TOTAL', formatoMonedaTicket(doc.total)));
  lineas.push(ESC + '!' + '\x00');

  // --- Pago ---
  for (const pago of doc.pagos) {
    lineas.push(lineaDosColumnas(paraImpresora(pago.metodoPago), formatoMonedaTicket(pago.monto)));
  }
  if (doc.montoRecibido != null) {
    lineas.push(lineaDosColumnas('Recibido', formatoMonedaTicket(doc.montoRecibido)));
    lineas.push(lineaDosColumnas('Cambio', formatoMonedaTicket(doc.cambio ?? 0)));
  }

  if (venta.requiereFacturaElectronica) {
    separador();
    lineas.push('Factura electronica solicitada\n');
    if (venta.estadoFacturaElectronica === 'Pendiente') {
      lineas.push('Pendiente de envio a la DIAN\n');
    }
  }

  // --- Pie: textos legales y política de cambios (configurables) ---
  if (doc.textoLegal || doc.politicaCambios) {
    separador();
    if (doc.textoLegal) envolverTexto(doc.textoLegal).forEach((r) => lineas.push(`${r}\n`));
    if (doc.politicaCambios) envolverTexto(doc.politicaCambios).forEach((r) => lineas.push(`${r}\n`));
  }

  lineas.push('\n');
  lineas.push(ESC + 'a' + '\x01');
  lineas.push('Gracias por su compra\n');
  // Corte de papel: GS V 66 n ("función B") es el comando que le dice a la propia impresora
  // "avanza el papel hasta la posición de la cuchilla (más n puntos de margen) y recién ahí
  // corta". Antes se avanzaba un número fijo de líneas (ESC d) y se cortaba con GS V 0, pero
  // la distancia real entre el cabezal de impresión y la cuchilla depende del modelo, así que
  // ningún número de líneas servía de forma confiable: con pocas la cuchilla cortaba encima de
  // las últimas líneas (el tiquete salía sin "Gracias por su compra" y con el total pegado al
  // borde), con muchas sobraba papel en blanco. Con la función B la impresora hace ese cálculo
  // sola, para cualquier modelo. n = 24 puntos (~3 mm) deja un pequeño margen bajo la última
  // línea. Si esta impresora no soportara la función B (poco común en las compatibles con
  // ESC/POS), el síntoma sería que no corta o imprime caracteres sueltos; el plan B es volver a
  // ESC d con unas 5 líneas + GS V 0.
  lineas.push(GS + 'V' + String.fromCharCode(66) + String.fromCharCode(24));

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
  documento: FacturaDocumento,
  nombreImpresora: string
): Promise<void> {
  await asegurarConexion();
  const config = qz.configs.create(nombreImpresora);
  await qz.print(config, construirTiquete(venta, documento));
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
