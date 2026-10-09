// Impresión física del tiquete de venta y apertura del cajón de dinero, a través de
// QZ Tray: un pequeño programa que Julian debe instalar una sola vez en el computador
// del mostrador (ver IMPRESION-TIQUETES.md en la raíz del repo). Un navegador no puede
// hablarle directamente al puerto/USB de una impresora térmica; QZ Tray abre un
// WebSocket local (normalmente wss://localhost:8181 o ws://localhost:8182) que este
// servicio usa para mandarle los comandos ESC/POS crudos.
import qz from 'qz-tray';
import { montoEnLetras } from '@/utils/numeroALetras';
import type { FacturaDocumento } from '@/types/facturaDocumento';
import type { VentaResponse } from '@/types/ventas';

const ESC = '\x1B';
const GS = '\x1D';
// Columnas del tiquete. Papel de 80 mm: el área imprimible es ~72 mm (576 puntos) y con la
// fuente A (12 puntos por carácter) caben 48 columnas, es decir ~90 % del ancho del papel.
// Si alguna impresora cortara el borde derecho (hay modelos de 512 puntos = 42 columnas),
// bajar este valor es lo único que hay que tocar: todo el diseño se calcula a partir de él.
const ANCHO_TICKET = 48;

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
const NOMBRE_SISTEMA = 'StockManager POS';

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
  // Una "palabra" más larga que el ancho (códigos, nombres sin espacios) se parte a la fuerza
  // para que nunca rompa un recuadro ni se desborde a la línea siguiente de la impresora.
  return renglones.flatMap((renglon) => {
    const trozos: string[] = [];
    for (let i = 0; i < renglon.length; i += ancho) trozos.push(renglon.slice(i, i + ancho));
    return trozos.length ? trozos : [''];
  });
}

// ---------------------------------------------------------------------------------------
// Diseño del tiquete (80 mm, ANCHO_TICKET columnas). Recuadros y tablas con ASCII puro
// (+ - |) porque la impresora no garantiza una página de código con caracteres de línea.
// ---------------------------------------------------------------------------------------
const NORMAL = ESC + '!' + '\x00';
const NEGRITA = ESC + '!' + '\x08';
const GRANDE = ESC + '!' + '\x18'; // negrita + doble alto (el ancho en columnas no cambia)

// Anchos de las columnas de la tabla de productos (suman ANCHO_TICKET con las 5 barras).
const COL_CANT = 5;
const COL_VALOR = 10;
const COL_TOTAL = 10;
const COL_DESC = ANCHO_TICKET - 5 - COL_CANT - COL_VALOR - COL_TOTAL;

// Medios de pago: dos columnas (3 barras).
const COL_PAGO_VALOR = 16;
const COL_PAGO_MEDIO = ANCHO_TICKET - 3 - COL_PAGO_VALOR;

const numero = (valor: number) =>
  valor.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const centrarEn = (texto: string, ancho: number) => {
  const sobra = Math.max(ancho - texto.length, 0);
  const izquierda = Math.floor(sobra / 2);
  return ' '.repeat(izquierda) + texto + ' '.repeat(sobra - izquierda);
};

const derechaEn = (texto: string, ancho: number) => texto.slice(-ancho).padStart(ancho);

const bordeCaja = () => '+' + '-'.repeat(ANCHO_TICKET - 2) + '+\n';

const separadorColumnas = (...anchos: number[]) => '+' + anchos.map((a) => '-'.repeat(a)).join('+') + '+\n';

function filaCaja(texto: string): string {
  return '| ' + texto.padEnd(ANCHO_TICKET - 4) + ' |\n';
}

function filaCajaDos(izquierda: string, derecha: string): string {
  const espacio = Math.max(ANCHO_TICKET - 4 - izquierda.length - derecha.length, 1);
  return '| ' + izquierda + ' '.repeat(espacio) + derecha + ' |\n';
}

// Fila de totales fuera de recuadro: etiqueta a la izquierda, "$" fijo y el monto pegado a la derecha.
function filaMonto(etiqueta: string, valor: number): string {
  const ancho = ANCHO_TICKET - 18;
  return etiqueta.slice(0, ancho).padEnd(ancho) + '$' + derechaEn(numero(valor), 17);
}

function fechaHoraTiquete(fechaIso: string): { fecha: string; hora: string } {
  const fecha = new Date(fechaIso);
  const zona = 'America/Bogota';
  return {
    fecha: fecha.toLocaleDateString('es-CO', { timeZone: zona, day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: fecha.toLocaleTimeString('es-CO', { timeZone: zona, hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

function construirTiquete(venta: VentaResponse, doc: FacturaDocumento): string[] {
  const lineas: string[] = [];
  const texto = (t: string) => lineas.push(t);
  const centrados = (t: string) =>
    envolverTexto(t).forEach((r) => texto(centrarEn(r, ANCHO_TICKET).trimEnd() + '\n'));
  const { emisor, comprador } = doc;
  const { fecha, hora } = fechaHoraTiquete(doc.fecha);

  texto(ESC + '@'); // reset de la impresora
  texto(ESC + 'a' + '\x00'); // todo el diseño ocupa el ancho completo: alineado a la izquierda

  // --- Recuadro con el nombre del negocio (Configuración) ---
  texto(bordeCaja());
  texto(GRANDE);
  for (const r of envolverTexto(emisor.nombre || NOMBRE_EMPRESA_POR_DEFECTO, ANCHO_TICKET - 4)) {
    texto('| ' + centrarEn(r, ANCHO_TICKET - 4) + ' |\n');
  }
  texto(NORMAL);
  texto(bordeCaja());

  // --- Datos fiscales del emisor, centrados ---
  if (emisor.nit) centrados(`NIT: ${emisor.nit}`);
  if (emisor.responsabilidadIva) centrados(emisor.responsabilidadIva);
  if (emisor.actividadEconomica) centrados(`Act. economica: ${emisor.actividadEconomica}`);
  if (emisor.direccion) centrados(emisor.direccion);
  if (emisor.barrio) centrados(emisor.barrio);
  if (emisor.ciudad) centrados(emisor.ciudad);
  if (emisor.telefono) centrados(`TELEFONO: ${emisor.telefono}`);
  if (emisor.email) centrados(emisor.email);
  if (emisor.resolucionDianTexto) centrados(emisor.resolucionDianTexto);
  texto('\n');

  // --- Recuadro: factura, fecha/hora y forma de pago ---
  texto(bordeCaja());
  texto(NEGRITA);
  texto(filaCajaDos('FACTURA POS', paraImpresora(doc.numero)));
  texto(NORMAL);
  texto(filaCajaDos(`FECHA: ${fecha}`, paraImpresora(`HORA: ${hora}`)));
  const formaPago = doc.pagos.map((p) => p.metodoPago.toUpperCase()).join(' / ');
  if (formaPago) texto(filaCaja(paraImpresora(`FORMA PAGO: ${formaPago}`).slice(0, ANCHO_TICKET - 4)));
  texto(bordeCaja());

  // --- Cliente: sin recuadro, centrado entre dos líneas finas para no recargar el tiquete ---
  texto('-'.repeat(ANCHO_TICKET) + '\n');
  texto(NEGRITA);
  centrados('CLIENTE');
  texto(NORMAL);
  const datosCliente = [
    comprador.nombre,
    comprador.documento ? `${comprador.tipoDocumento ?? 'Doc.'}: ${comprador.documento}` : null,
    comprador.direccion ? `Dir: ${comprador.direccion}` : null,
    comprador.telefono ? `Tel: ${comprador.telefono}` : null,
  ].filter((d): d is string => !!d);
  datosCliente.forEach((dato) => centrados(dato));
  texto('-'.repeat(ANCHO_TICKET) + '\n');
  texto('\n');

  // --- Tabla de productos ---
  const anchos = [COL_DESC, COL_CANT, COL_VALOR, COL_TOTAL];
  texto(separadorColumnas(...anchos));
  texto(NEGRITA);
  texto(
    '|' + centrarEn('DESCRIPCION', COL_DESC) + '|' + centrarEn('CANT', COL_CANT) + '|' +
      centrarEn('VALOR', COL_VALOR) + '|' + centrarEn('TOTAL', COL_TOTAL) + '|\n'
  );
  texto(NORMAL);
  texto(separadorColumnas(...anchos));
  for (const linea of doc.lineas) {
    const descripcion = envolverTexto(linea.producto, COL_DESC);
    descripcion.forEach((parte, i) => {
      const primera = i === 0;
      texto(
        '|' + parte.padEnd(COL_DESC) + '|' +
          (primera ? derechaEn(numero(linea.cantidad), COL_CANT - 1) + ' ' : ' '.repeat(COL_CANT)) + '|' +
          (primera ? derechaEn(numero(linea.precioUnitario), COL_VALOR - 1) + ' ' : ' '.repeat(COL_VALOR)) + '|' +
          (primera ? derechaEn(numero(linea.total), COL_TOTAL - 1) + ' ' : ' '.repeat(COL_TOTAL)) + '|\n'
      );
    });
  }
  texto(separadorColumnas(...anchos));
  texto('\n');

  // --- Subtotal, IVA y total ---
  texto(NEGRITA);
  texto(filaMonto('SUBTOTAL', doc.subtotalBase) + '\n');
  const conIva = doc.resumenIva.filter((r) => r.tarifa > 0);
  if (conIva.length === 0) {
    texto(filaMonto('IMPUESTO - IVA', 0) + '\n');
  } else {
    for (const fila of conIva) {
      // Con una sola tarifa la base es el SUBTOTAL; solo se detalla cuando hay varias.
      if (conIva.length > 1) texto(filaMonto(`BASE IVA ${fila.tarifa}%`, fila.base) + '\n');
      texto(filaMonto(`IMPUESTO - IVA ${fila.tarifa}%`, fila.iva) + '\n');
    }
  }
  texto(GRANDE);
  texto(filaMonto('TOTAL', doc.total) + '\n');
  texto(NORMAL);
  envolverTexto(montoEnLetras(doc.total)).forEach((r) => texto(r + '\n'));
  texto('\n');

  if (doc.montoRecibido != null) {
    texto(NEGRITA);
    texto(filaMonto('RECIBIDO', doc.montoRecibido) + '\n');
    texto(filaMonto('VUELTOS', doc.cambio ?? 0) + '\n');
    texto(NORMAL);
    texto('\n');
  }

  // --- Medios de pago ---
  texto(bordeCaja());
  texto(NEGRITA);
  texto(filaCaja(centrarEn('MEDIOS DE PAGO', ANCHO_TICKET - 4)));
  texto(separadorColumnas(COL_PAGO_MEDIO, COL_PAGO_VALOR));
  texto('|' + centrarEn('MEDIO DE PAGO', COL_PAGO_MEDIO) + '|' + centrarEn('VALOR', COL_PAGO_VALOR) + '|\n');
  texto(NORMAL);
  texto(separadorColumnas(COL_PAGO_MEDIO, COL_PAGO_VALOR));
  for (const pago of doc.pagos) {
    texto(
      '|' + (' ' + paraImpresora(pago.metodoPago).toUpperCase()).slice(0, COL_PAGO_MEDIO).padEnd(COL_PAGO_MEDIO) + '|' +
        derechaEn(numero(pago.monto), COL_PAGO_VALOR - 1) + ' |\n'
    );
  }
  texto(separadorColumnas(COL_PAGO_MEDIO, COL_PAGO_VALOR));
  texto('\n');

  if (venta.requiereFacturaElectronica) {
    centrados('Factura electronica solicitada');
    if (venta.estadoFacturaElectronica === 'Pendiente') centrados('Pendiente de envio a la DIAN');
    texto('\n');
  }

  // --- Vendedor y cierre ---
  if (doc.vendedor) {
    centrados('ATENDIDO POR');
    texto(NEGRITA);
    centrados(doc.vendedor);
    texto(NORMAL);
    texto('\n');
  }
  texto(NEGRITA);
  centrados('GRACIAS POR SU COMPRA');
  texto(NORMAL);

  // --- Pie: textos legales y política de cambios (configurables) ---
  if (doc.textoLegal || doc.politicaCambios) {
    texto('\n');
    if (doc.textoLegal) centrados(doc.textoLegal);
    if (doc.politicaCambios) centrados(doc.politicaCambios);
  }

  // Firma del sistema, al final de todo.
  texto('\n');
  texto(NEGRITA);
  centrados(NOMBRE_SISTEMA);
  texto(NORMAL);

  texto('\n');
  // Corte de papel: GS V 66 n ("función B") hace que la propia impresora avance hasta la
  // cuchilla (más n puntos de margen) y recién ahí corte, sin depender del modelo. n = 24
  // puntos (~3 mm) deja un pequeño margen bajo la última línea. Si una impresora no soportara
  // la función B, el síntoma sería que no corta; el plan B es ESC d con ~5 líneas + GS V 0.
  texto(GS + 'V' + String.fromCharCode(66) + String.fromCharCode(24));

  // La orden de apertura del cajón va en el mismo trabajo de impresión, solo cuando el pago
  // fue (total o parcialmente) en efectivo.
  if (debeAbrirCajon(venta)) {
    texto(ABRIR_CAJON);
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
