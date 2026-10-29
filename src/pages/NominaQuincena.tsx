import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, Check, CheckCircle2, Info, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { PantallaCargaLogo } from '@/components/PantallaCargaLogo';
import { NominaTabs } from '@/components/nomina/NominaTabs';
import { Kpi } from '@/components/reportes/comun';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import {
  abrirPeriodo,
  actualizarParametrosNomina,
  agregarNovedad,
  aprobarPeriodo,
  cerrarPeriodo,
  eliminarNovedad,
  obtenerParametrosNomina,
  obtenerPeriodo,
  obtenerPeriodoActual,
  obtenerPeriodos,
  obtenerResumenNomina,
  pagarLiquidacion,
  pagarPeriodo,
  recalcularPeriodo,
} from '@/services/nominaService';
import type {
  AlertaNomina,
  EstadoPeriodo,
  FrecuenciaPago,
  LiquidacionNomina,
  NominaResumen,
  ParametrosNomina,
  PeriodoNomina,
  PeriodoNominaResumen,
} from '@/types/nomina';
import { ESTADOS_PERIODO, FRECUENCIAS_PAGO, NOMBRE_PERIODO, etiquetaQuincena } from '@/utils/nomina';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type AccionConfirmable = 'aprobar' | 'pagar' | 'cerrar';

const TEXTO_CONFIRMACION: Record<AccionConfirmable, { titulo: string; detalle: string; boton: string }> = {
  aprobar: {
    titulo: '¿Aprobar este período?',
    detalle:
      'Se congelan los valores: después de aprobar ya no se pueden cambiar sueldos, novedades ni cuotas en este período.',
    boton: 'Aprobar',
  },
  pagar: {
    titulo: '¿Registrar el pago de todos?',
    detalle:
      'Se marcan como pagados todos los trabajadores que falten. Lo pagado en efectivo sale de tu caja abierta (debes tener un turno abierto); lo transferido solo queda registrado.',
    boton: 'Registrar pagos',
  },
  cerrar: {
    titulo: '¿Cerrar el período?',
    detalle:
      'Se descuentan las cuotas de los préstamos, se crea en Cuentas por pagar lo retenido por salud y pensión, y el período ya no se puede modificar. Después podrás abrir el siguiente.',
    boton: 'Cerrar período',
  },
};

function IconoAlerta({ severidad }: { severidad: AlertaNomina['severidad'] }) {
  if (severidad === 'info') return <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />;
  return (
    <AlertTriangle
      className={cn('mt-0.5 h-4 w-4 shrink-0', severidad === 'critica' ? 'text-error-text' : 'text-gold-text')}
    />
  );
}

function PasosQuincena({ estado }: { estado: EstadoPeriodo }) {
  const actual = ESTADOS_PERIODO.indexOf(estado);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Avance de la quincena">
      {ESTADOS_PERIODO.map((paso, indice) => {
        const hecho = indice < actual || estado === 'Cerrada';
        const activo = indice === actual && estado !== 'Cerrada';
        return (
          <li key={paso} className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium',
                hecho && 'border-green/40 bg-green/10 text-green',
                activo && 'border-gold bg-gold/10 text-foreground',
                !hecho && !activo && 'border-border text-text-muted'
              )}
            >
              {hecho && <Check className="h-3 w-3" />}
              {paso}
            </span>
            {indice < ESTADOS_PERIODO.length - 1 && <span className="text-text-muted">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function NominaQuincena() {
  const { token } = useAuth();

  const [resumen, setResumen] = useState<NominaResumen | null>(null);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago>('Quincenal');
  const [todosPeriodos, setTodosPeriodos] = useState<PeriodoNominaResumen[]>([]);
  const [periodo, setPeriodo] = useState<PeriodoNomina | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const [confirmando, setConfirmando] = useState<AccionConfirmable | null>(null);
  const [detalleTrabajadorId, setDetalleTrabajadorId] = useState<number | null>(null);

  const [parametros, setParametros] = useState<ParametrosNomina | null>(null);
  const [paramsAbierto, setParamsAbierto] = useState(false);

  const refrescarContexto = useCallback(async () => {
    const [nuevoResumen, nuevosPeriodos] = await Promise.all([
      obtenerResumenNomina(token),
      obtenerPeriodos(token),
    ]);
    setResumen(nuevoResumen);
    setTodosPeriodos(nuevosPeriodos);
    return { nuevoResumen, nuevosPeriodos };
  }, [token]);

  const cargarInicial = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { nuevosPeriodos } = await refrescarContexto();
      // Por defecto: el período de hoy de esta frecuencia, o el más reciente que exista.
      const actual = await obtenerPeriodoActual(frecuencia, token);
      if (actual) {
        setPeriodo(actual);
      } else {
        const idInicial = nuevosPeriodos.find((p) => p.frecuencia === frecuencia)?.id ?? null;
        setPeriodo(idInicial ? await obtenerPeriodo(idInicial, token) : null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la nómina.');
    } finally {
      setCargando(false);
    }
  }, [refrescarContexto, frecuencia, token]);

  useEffect(() => {
    cargarInicial();
  }, [cargarInicial]);

  /** Ejecuta una acción sobre la quincena, muestra el resultado y actualiza resumen e historial. */
  async function ejecutar(accion: () => Promise<PeriodoNomina>, exito: string) {
    setTrabajando(true);
    try {
      setPeriodo(await accion());
      toast.success(exito);
      await refrescarContexto();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
    } finally {
      setTrabajando(false);
    }
  }

  async function seleccionarPeriodo(id: number) {
    setTrabajando(true);
    try {
      setPeriodo(await obtenerPeriodo(id, token));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo abrir la quincena.');
    } finally {
      setTrabajando(false);
    }
  }

  function confirmarAccion() {
    if (!periodo || !confirmando) return;
    const id = periodo.resumen.id;
    const accion = confirmando;
    setConfirmando(null);
    if (accion === 'aprobar') ejecutar(() => aprobarPeriodo(id, token), `${Nombre} aprobad${nombre.articulo === 'la' ? 'a' : 'o'}`);
    if (accion === 'pagar') ejecutar(() => pagarPeriodo(id, token), 'Pagos registrados');
    if (accion === 'cerrar') ejecutar(() => cerrarPeriodo(id, token), `${Nombre} cerrad${nombre.articulo === 'la' ? 'a' : 'o'}`);
  }

  async function abrirParametros() {
    try {
      setParametros(await obtenerParametrosNomina(token));
      setParamsAbierto(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudieron cargar los parámetros.');
    }
  }

  const estado = periodo?.resumen.estado;
  const periodos = todosPeriodos.filter((p) => p.frecuencia === frecuencia);
  const nombre = NOMBRE_PERIODO[frecuencia];
  const Nombre = nombre.singular.charAt(0).toUpperCase() + nombre.singular.slice(1);
  const hayQuincenaSinCerrar = periodos.some((p) => p.estado !== 'Cerrada');
  const detalle = periodo?.liquidaciones.find((l) => l.trabajadorId === detalleTrabajadorId) ?? null;

  if (cargando) {
    return (
      <div className="py-16 text-center">
        <PantallaCargaLogo variante="en-linea" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-navy">Nómina</h2>
          <p className="text-sm text-text-muted">Revisa, aprueba, paga y cierra cada período. Cada frecuencia de pago tiene el suyo.</p>
        </div>
        <Button variant="outline" onClick={abrirParametros}>
          <Settings2 className="h-4 w-4" />
          Parámetros
        </Button>
      </div>

      <NominaTabs />

      <div role="group" aria-label="Frecuencia de pago" className="flex flex-wrap gap-2">
        {FRECUENCIAS_PAGO.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={f === frecuencia ? 'default' : 'outline'}
            aria-pressed={f === frecuencia}
            disabled={trabajando}
            onClick={() => setFrecuencia(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
          {error}
        </div>
      )}

      {resumen && resumen.alertas.length > 0 && (
        <Card className="border-border">
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Pendientes y avisos</p>
            <ul className="space-y-2">
              {resumen.alertas.map((alerta, indice) => (
                <li key={`${alerta.tipo}-${alerta.trabajadorId ?? 'general'}-${indice}`} className="flex gap-2 text-sm">
                  <IconoAlerta severidad={alerta.severidad} />
                  <span>
                    <span className="font-medium text-navy">{alerta.titulo}.</span>{' '}
                    <span className="text-text-muted">{alerta.detalle}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!periodo ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-navy">Todavía no hay períodos {frecuencia.toLowerCase() === 'mensual' ? 'mensuales' : frecuencia.toLowerCase() === 'semanal' ? 'semanales' : 'quincenales'}. Ábrelo para calcular lo que le toca a cada trabajador que cobra así.</p>
            <Button
              variant="gold"
              disabled={trabajando}
              onClick={() => ejecutar(() => abrirPeriodo(null, frecuencia, token), 'Período abierto')}
            >
              <Plus className="h-4 w-4" />
              Abrir {nombre.singular}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-heading text-xl font-semibold text-navy">
                    {Nombre} {etiquetaQuincena(periodo.resumen.fechaInicio, periodo.resumen.fechaFin)}
                  </p>
                  <div className="mt-2">
                    <PasosQuincena estado={periodo.resumen.estado} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {estado === 'Borrador' && (
                    <>
                      <Button
                        variant="outline"
                        disabled={trabajando}
                        onClick={() => ejecutar(() => recalcularPeriodo(periodo.resumen.id, token), `${Nombre} recalculad${nombre.articulo === 'la' ? 'a' : 'o'}`)}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Recalcular
                      </Button>
                      <Button
                        variant="gold"
                        disabled={trabajando || periodo.liquidaciones.length === 0}
                        onClick={() => setConfirmando('aprobar')}
                      >
                        Aprobar {nombre.singular}
                      </Button>
                    </>
                  )}
                  {estado === 'Aprobada' && (
                    <Button variant="gold" disabled={trabajando} onClick={() => setConfirmando('pagar')}>
                      Registrar todos los pagos
                    </Button>
                  )}
                  {estado === 'Pagada' && (
                    <Button variant="gold" disabled={trabajando} onClick={() => setConfirmando('cerrar')}>
                      Cerrar {nombre.singular}
                    </Button>
                  )}
                  {estado === 'Cerrada' && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Cerrada
                    </Badge>
                  )}
                  {!hayQuincenaSinCerrar && (
                    <Button
                      variant="outline"
                      disabled={trabajando}
                      onClick={() => ejecutar(() => abrirPeriodo(null, frecuencia, token), 'Período abierto')}
                    >
                      <Plus className="h-4 w-4" />
                      Abrir {nombre.singular} siguiente
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi etiqueta="Trabajadores" valor={String(periodo.resumen.numeroTrabajadores)} />
            <Kpi etiqueta="Devengado" valor={formatoMoneda.format(periodo.resumen.totalDevengado)} ayuda="Sueldo + auxilio + novedades" />
            <Kpi
              etiqueta="Descuentos"
              valor={formatoMoneda.format(
                periodo.resumen.totalSeguridadSocial + periodo.resumen.totalPrestamos + periodo.resumen.totalOtrosDescuentos
              )}
              ayuda={`Seg. social ${formatoMoneda.format(periodo.resumen.totalSeguridadSocial)}`}
            />
            <Kpi etiqueta="Neto a pagar" valor={formatoMoneda.format(periodo.resumen.totalNeto)} destacado />
          </div>

          <Card className="border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trabajador</TableHead>
                    <TableHead className="text-right">Devengado</TableHead>
                    <TableHead className="text-right">Seg. social</TableHead>
                    <TableHead className="text-right">Préstamos</TableHead>
                    <TableHead className="text-right">Otros</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodo.liquidaciones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-text-muted">
                        No hay trabajadores con pago {frecuencia.toLowerCase()} en este período. Define la frecuencia de cada uno en la pestaña Trabajadores.
                      </TableCell>
                    </TableRow>
                  ) : (
                    periodo.liquidaciones.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => setDetalleTrabajadorId(l.trabajadorId)}
                            aria-label={`Ver detalle de ${l.nombreTrabajador}`}
                          >
                            <span className="block font-medium text-navy underline-offset-2 hover:underline">
                              {l.nombreTrabajador}
                            </span>
                            <span className="block text-xs text-text-muted">
                              {l.cargo} · {l.metodoPago}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="text-right text-navy">{formatoMoneda.format(l.devengado)}</TableCell>
                        <TableCell className="text-right text-navy">
                          {formatoMoneda.format(l.descuentoSalud + l.descuentoPension)}
                        </TableCell>
                        <TableCell className="text-right text-navy">{formatoMoneda.format(l.descuentoPrestamos)}</TableCell>
                        <TableCell className="text-right text-navy">{formatoMoneda.format(l.otrosDescuentos)}</TableCell>
                        <TableCell className={cn('text-right font-medium', l.neto < 0 ? 'text-error-text' : 'text-navy')}>
                          {formatoMoneda.format(l.neto)}
                        </TableCell>
                        <TableCell className="text-right">
                          {l.pagada ? (
                            <Badge variant="default">Pagado</Badge>
                          ) : estado === 'Aprobada' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={trabajando}
                              onClick={() =>
                                ejecutar(
                                  () => pagarLiquidacion(periodo.resumen.id, l.id, token),
                                  `Pago de ${l.nombreTrabajador} registrado`
                                )
                              }
                            >
                              Marcar pagado
                            </Button>
                          ) : (
                            <span className="text-xs text-text-muted">Pendiente</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {periodos.length > 1 && (
            <Card className="border-border">
              <CardContent className="space-y-3 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Períodos anteriores</p>
                <div className="flex flex-wrap gap-2">
                  {periodos.map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant={p.id === periodo.resumen.id ? 'default' : 'outline'}
                      disabled={trabajando}
                      onClick={() => seleccionarPeriodo(p.id)}
                    >
                      {etiquetaQuincena(p.fechaInicio, p.fechaFin)} · {p.estado}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <DetalleLiquidacionDialog
        liquidacion={detalle}
        editable={estado === 'Borrador'}
        periodoId={periodo?.resumen.id ?? null}
        trabajando={trabajando}
        onCerrar={() => setDetalleTrabajadorId(null)}
        onEjecutar={ejecutar}
        token={token}
      />

      <ParametrosDialog
        abierto={paramsAbierto}
        parametros={parametros}
        onCambiarAbierto={setParamsAbierto}
        onGuardado={async () => {
          // Los parámetros cambian el cálculo de las quincenas en borrador.
          if (periodo) setPeriodo(await obtenerPeriodo(periodo.resumen.id, token));
          await refrescarContexto();
        }}
        token={token}
      />

      <AlertDialog
        open={confirmando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setConfirmando(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmando ? TEXTO_CONFIRMACION[confirmando].titulo : ''}</AlertDialogTitle>
            <AlertDialogDescription>{confirmando ? TEXTO_CONFIRMACION[confirmando].detalle : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarAccion();
              }}
            >
              {confirmando ? TEXTO_CONFIRMACION[confirmando].boton : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- Detalle de un trabajador en la quincena ----------

interface DetalleLiquidacionDialogProps {
  liquidacion: LiquidacionNomina | null;
  editable: boolean;
  periodoId: number | null;
  trabajando: boolean;
  token: string | null;
  onCerrar: () => void;
  onEjecutar: (accion: () => Promise<PeriodoNomina>, exito: string) => Promise<void>;
}

function Fila({ etiqueta, valor, negativo, fuerte }: { etiqueta: string; valor: number; negativo?: boolean; fuerte?: boolean }) {
  if (valor === 0 && !fuerte) return null;
  return (
    <div className={cn('flex justify-between py-1 text-sm', fuerte && 'border-t border-border pt-2 font-semibold')}>
      <span className="text-text-muted">{etiqueta}</span>
      <span className="text-navy">
        {negativo ? '− ' : ''}
        {formatoMoneda.format(valor)}
      </span>
    </div>
  );
}

function DetalleLiquidacionDialog({
  liquidacion,
  editable,
  periodoId,
  trabajando,
  token,
  onCerrar,
  onEjecutar,
}: DetalleLiquidacionDialogProps) {
  const [tipo, setTipo] = useState<'Devengo' | 'Descuento'>('Devengo');
  const [concepto, setConcepto] = useState('');
  const [valor, setValor] = useState('');
  const [errorNovedad, setErrorNovedad] = useState<string | null>(null);

  async function handleAgregar(e: FormEvent) {
    e.preventDefault();
    if (!liquidacion || periodoId === null) return;
    setErrorNovedad(null);

    const valorNumero = Number(valor);
    if (!concepto.trim()) return setErrorNovedad('Escribe el concepto.');
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) return setErrorNovedad('El valor debe ser mayor que cero.');

    await onEjecutar(
      () => agregarNovedad(periodoId, { trabajadorId: liquidacion.trabajadorId, tipo, concepto: concepto.trim(), valor: valorNumero }, token),
      'Novedad agregada'
    );
    setConcepto('');
    setValor('');
  }

  return (
    <Dialog open={liquidacion !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {liquidacion && (
          <>
            <DialogHeader>
              <DialogTitle>{liquidacion.nombreTrabajador}</DialogTitle>
              <DialogDescription>
                {liquidacion.cargo} · Pago en {liquidacion.metodoPago.toLowerCase()}
              </DialogDescription>
            </DialogHeader>

            <div>
              <Fila etiqueta="Sueldo de la quincena" valor={liquidacion.salarioQuincena} fuerte />
              <Fila etiqueta="Auxilio de transporte" valor={liquidacion.auxilioTransporte} />
              <Fila etiqueta="Otros devengos" valor={liquidacion.otrosDevengos} />
              <Fila etiqueta="Devengado" valor={liquidacion.devengado} fuerte />
              <Fila etiqueta="Salud" valor={liquidacion.descuentoSalud} negativo />
              <Fila etiqueta="Pensión" valor={liquidacion.descuentoPension} negativo />
              <Fila etiqueta="Préstamos" valor={liquidacion.descuentoPrestamos} negativo />
              <Fila etiqueta="Otros descuentos" valor={liquidacion.otrosDescuentos} negativo />
              <Fila etiqueta="Neto a pagar" valor={liquidacion.neto} fuerte />
            </div>

            {liquidacion.cuotas.length > 0 && (
              <ul className="space-y-1 text-xs text-text-muted">
                {liquidacion.cuotas.map((c) => (
                  <li key={c.prestamoId}>
                    {c.tipo === 'Adelanto' ? 'Adelanto' : `Préstamo, cuota ${c.numero} de ${c.numeroCuotas}`}:{' '}
                    {formatoMoneda.format(c.valor)}
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Novedades de la quincena</p>
              {liquidacion.novedades.length === 0 ? (
                <p className="text-sm text-text-muted">Sin novedades.</p>
              ) : (
                <ul className="space-y-1">
                  {liquidacion.novedades.map((n) => (
                    <li key={n.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-navy">
                        {n.concepto}{' '}
                        <Badge variant="outline">{n.tipo === 'Devengo' ? 'Suma' : 'Resta'}</Badge>
                      </span>
                      <span className="flex items-center gap-1">
                        {formatoMoneda.format(n.valor)}
                        {editable && periodoId !== null && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={trabajando}
                            aria-label={`Quitar ${n.concepto}`}
                            onClick={() => onEjecutar(() => eliminarNovedad(periodoId, n.id, token), 'Novedad eliminada')}
                          >
                            <Trash2 className="h-4 w-4 text-error-text" />
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {editable && (
              <form onSubmit={handleAgregar} className="space-y-3 rounded-md border border-border p-3">
                <p className="text-sm font-medium text-navy">Agregar novedad</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="nov-tipo">Tipo</Label>
                    <Select value={tipo} onValueChange={(v) => setTipo(v as 'Devengo' | 'Descuento')}>
                      <SelectTrigger id="nov-tipo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Devengo">Suma (bono, horas extra)</SelectItem>
                        <SelectItem value="Descuento">Resta (falta, otro)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nov-concepto">Concepto</Label>
                    <Input id="nov-concepto" maxLength={100} value={concepto} onChange={(e) => setConcepto(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nov-valor">Valor</Label>
                    <Input
                      id="nov-valor"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                    />
                  </div>
                </div>
                {errorNovedad && (
                  <p className="text-sm text-error-text" role="alert">
                    {errorNovedad}
                  </p>
                )}
                <Button type="submit" size="sm" variant="gold" disabled={trabajando}>
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </form>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCerrar}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Parámetros ----------

interface ParametrosDialogProps {
  abierto: boolean;
  parametros: ParametrosNomina | null;
  token: string | null;
  onCambiarAbierto: (abierto: boolean) => void;
  onGuardado: () => Promise<void>;
}

function ParametrosDialog({ abierto, parametros, token, onCambiarAbierto, onGuardado }: ParametrosDialogProps) {
  const [valores, setValores] = useState({
    salarioMinimo: '',
    auxilioTransporte: '',
    limiteSalariosAuxilio: '',
    porcentajeSaludTrabajador: '',
    porcentajePensionTrabajador: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || !parametros) return;
    setValores({
      salarioMinimo: String(parametros.salarioMinimo),
      auxilioTransporte: String(parametros.auxilioTransporte),
      limiteSalariosAuxilio: String(parametros.limiteSalariosAuxilio),
      porcentajeSaludTrabajador: String(parametros.porcentajeSaludTrabajador),
      porcentajePensionTrabajador: String(parametros.porcentajePensionTrabajador),
    });
    setErrorForm(null);
  }, [abierto, parametros]);

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    setErrorForm(null);

    const numeros = {
      salarioMinimo: Number(valores.salarioMinimo),
      auxilioTransporte: Number(valores.auxilioTransporte),
      limiteSalariosAuxilio: Number(valores.limiteSalariosAuxilio),
      porcentajeSaludTrabajador: Number(valores.porcentajeSaludTrabajador),
      porcentajePensionTrabajador: Number(valores.porcentajePensionTrabajador),
    };
    if (Object.values(numeros).some((n) => !Number.isFinite(n) || n < 0)) {
      return setErrorForm('Revisa los valores: deben ser números y no pueden ser negativos.');
    }
    if (numeros.salarioMinimo <= 0) return setErrorForm('El salario mínimo debe ser mayor que cero.');

    setGuardando(true);
    try {
      await actualizarParametrosNomina(numeros, token);
      toast.success('Parámetros actualizados');
      onCambiarAbierto(false);
      await onGuardado();
    } catch (err) {
      setErrorForm(err instanceof ApiError ? err.message : 'No se pudieron guardar los parámetros.');
    } finally {
      setGuardando(false);
    }
  }

  const campos: { clave: keyof typeof valores; etiqueta: string; paso: number }[] = [
    { clave: 'salarioMinimo', etiqueta: 'Salario mínimo mensual', paso: 1 },
    { clave: 'auxilioTransporte', etiqueta: 'Auxilio de transporte mensual', paso: 1 },
    { clave: 'limiteSalariosAuxilio', etiqueta: 'Auxilio hasta (veces el salario mínimo)', paso: 0.5 },
    { clave: 'porcentajeSaludTrabajador', etiqueta: 'Salud del trabajador (%)', paso: 0.5 },
    { clave: 'porcentajePensionTrabajador', etiqueta: 'Pensión del trabajador (%)', paso: 0.5 },
  ];

  return (
    <Dialog open={abierto} onOpenChange={onCambiarAbierto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parámetros de nómina</DialogTitle>
          <DialogDescription>
            Cambian cada año. Confirma estos valores con tu contador; al guardar se recalculan las quincenas en borrador.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleGuardar} className="space-y-4">
          {campos.map((campo) => (
            <div key={campo.clave} className="space-y-1">
              <Label htmlFor={`par-${campo.clave}`}>{campo.etiqueta}</Label>
              <Input
                id={`par-${campo.clave}`}
                type="number"
                inputMode="decimal"
                min={0}
                step={campo.paso}
                value={valores[campo.clave]}
                onChange={(e) => setValores((previo) => ({ ...previo, [campo.clave]: e.target.value }))}
                required
              />
            </div>
          ))}

          {errorForm && (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {errorForm}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onCambiarAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
