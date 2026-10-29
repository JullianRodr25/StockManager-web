import type {
  FrecuenciaPago,
  LiquidacionNomina,
  ParametrosNomina,
  PeriodoNominaResumen,
  TipoContrato,
  Trabajador,
} from '@/types/nomina';
import { etiquetaQuincena, soloDia } from '@/utils/nomina';
import { hoyColombia } from '@/utils/fechas';

/** Datos de la empresa que salen en el encabezado de los documentos. Todo opcional. */
export interface EmpresaDocumento {
  nombre: string | null;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  ciudad: string | null;
}

const NOMBRE_POR_DEFECTO = 'Ferretería Gold';
const MARGEN = 54; // 0,75 in
const ANCHO_PAGINA = 612; // Carta, en puntos
const ALTO_PAGINA = 792;
const TINTA = 17;
const TENUE = 89; // #595959: se lee bien en blanco y negro

const dinero = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** "$ 879.965": mismo formato que el diseño (símbolo, espacio, miles con punto). */
function pesos(valor: number): string {
  return dinero.format(valor).replace(/ /g, ' ').replace('$', '$ ').replace(/\s+/g, ' ');
}

const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function diaLargo(iso: string): string {
  const [a, m, d] = soloDia(iso).split('-').map(Number);
  return `${d} de ${MESES_LARGOS[m - 1]} de ${a}`;
}

function diaCorto(iso: string): string {
  const [a, m, d] = soloDia(iso).split('-').map(Number);
  return `${d} ${MESES_LARGOS[m - 1].slice(0, 3)} ${a}`;
}

function nombreArchivo(prefijo: string, nombre: string, sufijo: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${prefijo}-${limpio}-${sufijo}.pdf`;
}

async function nuevoDocumento() {
  // jsPDF pesa bastante: se carga solo cuando alguien descarga un PDF.
  const { jsPDF } = await import('jspdf');
  return new jsPDF({ unit: 'pt', format: 'letter' });
}

type Doc = Awaited<ReturnType<typeof nuevoDocumento>>;

function encabezado(doc: Doc, empresa: EmpresaDocumento, derecha: { etiqueta: string; titulo?: string }): number {
  doc.setTextColor(TINTA);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(empresa.nombre?.trim() || NOMBRE_POR_DEFECTO, MARGEN, MARGEN + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(TENUE);
  if (empresa.nit) doc.text(`NIT ${empresa.nit}`, MARGEN, MARGEN + 28);

  doc.setFont('helvetica', 'bold');
  doc.text(derecha.etiqueta.toUpperCase(), ANCHO_PAGINA - MARGEN, MARGEN + 6, { align: 'right', charSpace: 0.6 });
  if (derecha.titulo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(TINTA);
    doc.text(derecha.titulo, ANCHO_PAGINA - MARGEN, MARGEN + 24, { align: 'right' });
  }

  const y = MARGEN + 42;
  doc.setDrawColor(TINTA);
  doc.setLineWidth(1.5);
  doc.line(MARGEN, y, ANCHO_PAGINA - MARGEN, y);
  return y;
}

function etiquetaSeccion(doc: Doc, texto: string, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(TENUE);
  doc.text(texto.toUpperCase(), MARGEN, y, { charSpace: 0.6 });
  doc.setDrawColor(TINTA);
  doc.setLineWidth(0.75);
  doc.line(MARGEN, y + 5, ANCHO_PAGINA - MARGEN, y + 5);
  return y + 5;
}

function fila(doc: Doc, etiqueta: string, valor: string, y: number): number {
  const alto = 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TINTA);
  doc.text(etiqueta, MARGEN, y + 15);
  doc.text(valor, ANCHO_PAGINA - MARGEN, y + 15, { align: 'right' });
  doc.setDrawColor(227);
  doc.setLineWidth(0.75);
  doc.line(MARGEN, y + alto, ANCHO_PAGINA - MARGEN, y + alto);
  return y + alto;
}

function subtotal(doc: Doc, etiqueta: string, valor: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(TINTA);
  doc.text(etiqueta, MARGEN, y + 17);
  doc.text(valor, ANCHO_PAGINA - MARGEN, y + 17, { align: 'right' });
  return y + 17;
}

function campo(doc: Doc, etiqueta: string, valor: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(TENUE);
  doc.text(etiqueta.toUpperCase(), x, y, { charSpace: 0.6 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(TINTA);
  doc.text(valor, x, y + 15);
}

function pie(doc: Doc, empresa: EmpresaDocumento, etiquetaFirma: string, derecha: string) {
  const y = ALTO_PAGINA - MARGEN - 8;
  doc.setDrawColor(TINTA);
  doc.setLineWidth(0.75);
  doc.line(MARGEN, y - 12, MARGEN + 190, y - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(TENUE);
  doc.text(etiquetaFirma, MARGEN, y);
  doc.text(derecha, ANCHO_PAGINA - MARGEN, y, { align: 'right' });
  void empresa;
}

const ETIQUETA_FRECUENCIA: Record<FrecuenciaPago, string> = {
  Semanal: 'Semana',
  Quincenal: 'Quincena',
  Mensual: 'Mes',
};

/** Desprendible de pago de un trabajador en un período (una hoja carta, minimalista). */
export async function descargarDesprendible(
  liquidacion: LiquidacionNomina,
  periodo: PeriodoNominaResumen,
  trabajador: Pick<Trabajador, 'numeroIdentificacion' | 'frecuenciaPago'>,
  empresa: EmpresaDocumento
): Promise<void> {
  const doc = await nuevoDocumento();
  const rango = etiquetaQuincena(periodo.fechaInicio, periodo.fechaFin);

  let y = encabezado(doc, empresa, {
    etiqueta: 'Desprendible de pago',
    titulo: `${ETIQUETA_FRECUENCIA[periodo.frecuencia]} ${rango}`,
  });

  y += 30;
  const mitad = MARGEN + (ANCHO_PAGINA - 2 * MARGEN) / 2;
  campo(doc, 'Trabajador', liquidacion.nombreTrabajador, MARGEN, y);
  campo(doc, 'Cédula', trabajador.numeroIdentificacion, mitad, y);
  y += 38;
  campo(doc, 'Cargo', liquidacion.cargo, MARGEN, y);
  campo(doc, 'Pago', `${trabajador.frecuenciaPago} · ${liquidacion.metodoPago}`, mitad, y);

  // Devengado
  y = etiquetaSeccion(doc, 'Devengado', y + 54);
  y = fila(doc, 'Sueldo del período', pesos(liquidacion.salarioQuincena), y);
  if (liquidacion.auxilioTransporte > 0) y = fila(doc, 'Auxilio de transporte', pesos(liquidacion.auxilioTransporte), y);
  for (const n of liquidacion.novedades.filter((x) => x.tipo === 'Devengo'))
    y = fila(doc, n.concepto, pesos(n.valor), y);
  y = subtotal(doc, 'Total devengado', pesos(liquidacion.devengado), y);

  // Deducciones
  y = etiquetaSeccion(doc, 'Deducciones', y + 26);
  if (liquidacion.descuentoSalud > 0) y = fila(doc, 'Salud', `- ${pesos(liquidacion.descuentoSalud)}`, y);
  if (liquidacion.descuentoPension > 0) y = fila(doc, 'Pensión', `- ${pesos(liquidacion.descuentoPension)}`, y);
  for (const c of liquidacion.cuotas) {
    const tipo = c.tipo === 'Adelanto' ? 'Adelanto' : 'Préstamo';
    y = fila(doc, `Cuota de ${tipo.toLowerCase()} (${c.numero} de ${c.numeroCuotas})`, `- ${pesos(c.valor)}`, y);
  }
  for (const n of liquidacion.novedades.filter((x) => x.tipo === 'Descuento'))
    y = fila(doc, n.concepto, `- ${pesos(n.valor)}`, y);
  if (liquidacion.totalDescuentos === 0) y = fila(doc, 'Sin deducciones', pesos(0), y);
  y = subtotal(doc, 'Total deducciones', `- ${pesos(liquidacion.totalDescuentos)}`, y);

  // Neto
  y += 26;
  doc.setDrawColor(TINTA);
  doc.setLineWidth(1.5);
  doc.line(MARGEN, y, ANCHO_PAGINA - MARGEN, y);
  doc.line(MARGEN, y + 54, ANCHO_PAGINA - MARGEN, y + 54);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(TINTA);
  doc.text('Neto a pagar', MARGEN, y + 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(pesos(liquidacion.neto), ANCHO_PAGINA - MARGEN, y + 36, { align: 'right' });

  if (liquidacion.pagada && liquidacion.pagadaEn) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TENUE);
    const fecha = new Date(liquidacion.pagadaEn).toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    doc.text(`Pagado el ${fecha}`, MARGEN, y + 72);
  }

  pie(doc, empresa, 'Firma del trabajador', `Documento generado el ${diaCorto(hoyColombia())}`);
  doc.save(nombreArchivo('desprendible', liquidacion.nombreTrabajador, soloDia(periodo.fechaInicio)));
}

const TEXTO_CONTRATO: Record<TipoContrato, string> = {
  Indefinido: 'contrato a término indefinido',
  Fijo: 'contrato a término fijo',
  ObraLabor: 'contrato por obra o labor',
  PrestacionServicios: 'contrato de prestación de servicios',
};

/** Certificado de trabajo de un trabajador (una hoja carta). */
export async function descargarCertificadoTrabajo(
  trabajador: Trabajador,
  parametros: ParametrosNomina | null,
  empresa: EmpresaDocumento
): Promise<void> {
  const doc = await nuevoDocumento();
  const nombreEmpresa = empresa.nombre?.trim() || NOMBRE_POR_DEFECTO;

  let y = encabezado(doc, empresa, { etiqueta: 'Certificado laboral' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(TENUE);
  const contacto = [empresa.direccion, empresa.telefono].filter(Boolean) as string[];
  contacto.forEach((linea, i) => doc.text(linea, ANCHO_PAGINA - MARGEN, MARGEN + 24 + i * 12, { align: 'right' }));

  const ancho = ANCHO_PAGINA - 2 * MARGEN;
  y += 70;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(TINTA);
  doc.text('Certificado de trabajo', ANCHO_PAGINA / 2, y, { align: 'center' });

  y += 50;
  doc.setFontSize(11);
  doc.text('HACE CONSTAR QUE', ANCHO_PAGINA / 2, y, { align: 'center', charSpace: 1 });

  const recibeAuxilio =
    parametros !== null &&
    trabajador.tipoContrato !== 'PrestacionServicios' &&
    trabajador.salarioMensual <= parametros.limiteSalariosAuxilio * parametros.salarioMinimo;

  const parrafos: string[] = [
    `${trabajador.nombre}, identificado(a) con cédula de ciudadanía número ${trabajador.numeroIdentificacion}, ` +
      `presta sus servicios en ${nombreEmpresa} desde el ${diaLargo(trabajador.fechaIngreso)}, ` +
      `desempeñando el cargo de ${trabajador.cargo}, con ${TEXTO_CONTRATO[trabajador.tipoContrato]}` +
      (trabajador.fechaFinContrato ? ` con vigencia hasta el ${diaLargo(trabajador.fechaFinContrato)}.` : '.'),
    `Devenga un sueldo mensual de ${pesos(trabajador.salarioMensual)}` +
      (recibeAuxilio && parametros
        ? ` y un auxilio de transporte de ${pesos(parametros.auxilioTransporte)}.`
        : '.'),
    `Se expide a solicitud del interesado${empresa.ciudad ? `, en ${empresa.ciudad}` : ''}, ` +
      `el ${diaLargo(hoyColombia())}.`,
  ];

  y += 36;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  for (const p of parrafos) {
    const lineas = doc.splitTextToSize(p, ancho) as string[];
    doc.text(lineas, MARGEN, y, { lineHeightFactor: 1.6, align: 'left' });
    y += lineas.length * 12 * 1.6 + 14;
  }

  // Firma
  const yFirma = ALTO_PAGINA - MARGEN - 40;
  doc.setDrawColor(TINTA);
  doc.setLineWidth(0.75);
  doc.line(MARGEN, yFirma, MARGEN + 210, yFirma);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(TINTA);
  doc.text('Representante legal', MARGEN, yFirma + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(TENUE);
  doc.text(nombreEmpresa, MARGEN, yFirma + 27);

  doc.save(nombreArchivo('certificado-trabajo', trabajador.nombre, soloDia(hoyColombia())));
}
