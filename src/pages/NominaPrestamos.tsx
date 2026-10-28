import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { PantallaCargaLogo } from '@/components/PantallaCargaLogo';
import { NominaTabs } from '@/components/nomina/NominaTabs';
import { Kpi } from '@/components/reportes/comun';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { cancelarPrestamo, crearPrestamo, obtenerPrestamos, obtenerTrabajadores } from '@/services/nominaService';
import type { EstadoPrestamo, Prestamo, TipoPrestamo, Trabajador } from '@/types/nomina';
import { ETIQUETA_ESTADO_PRESTAMO, formatearDia } from '@/utils/nomina';
import { hoyColombia } from '@/utils/fechas';
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

const MAXIMO_CUOTAS = 24;

type FiltroEstado = 'Activo' | 'todos' | EstadoPrestamo;

interface PrestamoForm {
  trabajadorId: string;
  tipo: TipoPrestamo;
  monto: string;
  numeroCuotas: string;
  primeraCuotaDesde: string;
  nota: string;
}

function formularioVacio(): PrestamoForm {
  return {
    trabajadorId: '',
    tipo: 'Prestamo',
    monto: '',
    numeroCuotas: '4',
    primeraCuotaDesde: hoyColombia(),
    nota: '',
  };
}

function variantePorEstado(estado: EstadoPrestamo): 'default' | 'outline' | 'destructive' {
  if (estado === 'Activo') return 'default';
  return estado === 'Cancelado' ? 'destructive' : 'outline';
}

export function NominaPrestamos() {
  const { token } = useAuth();

  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>('Activo');

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [formulario, setFormulario] = useState<PrestamoForm>(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const [paraCancelar, setParaCancelar] = useState<Prestamo | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [listaPrestamos, listaTrabajadores] = await Promise.all([
        obtenerPrestamos(null, token),
        obtenerTrabajadores(false, token),
      ]);
      setPrestamos(listaPrestamos);
      setTrabajadores(listaTrabajadores);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los préstamos.');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = filtro === 'todos' ? prestamos : prestamos.filter((p) => p.estado === filtro);

  const resumen = useMemo(() => {
    const activos = prestamos.filter((p) => p.estado === 'Activo');
    return {
      cantidad: activos.length,
      saldo: activos.reduce((suma, p) => suma + p.saldoPendiente, 0),
      proximaQuincena: activos.reduce((suma, p) => suma + p.proximaCuota, 0),
    };
  }, [prestamos]);

  const esAdelanto = formulario.tipo === 'Adelanto';
  const montoNumero = Number(formulario.monto);
  const cuotasNumero = esAdelanto ? 1 : Number(formulario.numeroCuotas);
  const cuotaEstimada =
    Number.isFinite(montoNumero) && montoNumero > 0 && Number.isInteger(cuotasNumero) && cuotasNumero > 0
      ? Math.ceil(montoNumero / cuotasNumero)
      : null;

  function actualizarCampo<K extends keyof PrestamoForm>(campo: K, valor: PrestamoForm[K]) {
    setFormulario((previo) => ({ ...previo, [campo]: valor }));
  }

  function abrirNuevo() {
    setFormulario(formularioVacio());
    setErrorFormulario(null);
    setDialogAbierto(true);
  }

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    setErrorFormulario(null);

    if (!formulario.trabajadorId) return setErrorFormulario('Elige el trabajador.');
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) return setErrorFormulario('El monto debe ser mayor que cero.');
    if (!esAdelanto && (!Number.isInteger(cuotasNumero) || cuotasNumero < 1 || cuotasNumero > MAXIMO_CUOTAS))
      return setErrorFormulario(`Las cuotas deben ser entre 1 y ${MAXIMO_CUOTAS}.`);
    if (!formulario.primeraCuotaDesde) return setErrorFormulario('Indica desde cuándo se descuenta.');

    setGuardando(true);
    try {
      await crearPrestamo(
        {
          trabajadorId: Number(formulario.trabajadorId),
          tipo: formulario.tipo,
          monto: montoNumero,
          numeroCuotas: cuotasNumero,
          primeraCuotaDesde: formulario.primeraCuotaDesde,
          nota: formulario.nota.trim() || null,
        },
        token
      );
      toast.success(esAdelanto ? 'Adelanto registrado' : 'Préstamo registrado');
      setDialogAbierto(false);
      await cargar();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo registrar el préstamo.';
      setErrorFormulario(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  async function handleCancelar() {
    if (!paraCancelar) return;
    setCancelando(true);
    try {
      await cancelarPrestamo(paraCancelar.id, token);
      toast.success('Préstamo cancelado');
      setParaCancelar(null);
      await cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cancelar el préstamo.');
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-navy">Nómina</h2>
          <p className="text-sm text-text-muted">Préstamos y adelantos que se descuentan por quincena.</p>
        </div>
        <Button variant="gold" onClick={abrirNuevo} disabled={trabajadores.length === 0}>
          <Plus className="h-4 w-4" />
          Nuevo préstamo
        </Button>
      </div>

      <NominaTabs />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi etiqueta="Préstamos activos" valor={String(resumen.cantidad)} />
        <Kpi etiqueta="Saldo pendiente" valor={formatoMoneda.format(resumen.saldo)} ayuda="Lo que falta por descontar" />
        <Kpi
          etiqueta="Se descuenta en la próxima quincena"
          valor={formatoMoneda.format(resumen.proximaQuincena)}
          ayuda="Si el neto alcanza"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroEstado)}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Activo">Activos</SelectItem>
            <SelectItem value="Saldado">Saldados</SelectItem>
            <SelectItem value="Cancelado">Cancelados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
          {error}
        </div>
      )}

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Cuotas</TableHead>
                <TableHead className="text-right">Cuota</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-text-muted">
                    <PantallaCargaLogo variante="en-linea" />
                  </TableCell>
                </TableRow>
              ) : visibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-text-muted">
                    No hay préstamos en esta vista.
                  </TableCell>
                </TableRow>
              ) : (
                visibles.map((p) => {
                  const avance = p.monto > 0 ? Math.min(100, Math.round(((p.monto - p.saldoPendiente) / p.monto) * 100)) : 0;
                  return (
                    <TableRow key={p.id} className={cn(p.estado === 'Cancelado' && 'opacity-60')}>
                      <TableCell>
                        <div className="font-medium text-navy">{p.nombreTrabajador}</div>
                        <div className="text-xs text-text-muted">
                          {p.nota ? `${p.nota} · ` : ''}desde {formatearDia(p.primeraCuotaDesde)}
                        </div>
                      </TableCell>
                      <TableCell className="text-navy">{p.tipo === 'Adelanto' ? 'Adelanto' : 'Préstamo'}</TableCell>
                      <TableCell className="text-right text-navy">{formatoMoneda.format(p.monto)}</TableCell>
                      <TableCell>
                        <div className="text-navy">
                          {p.cuotasDescontadas} de {p.numeroCuotas}
                        </div>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${avance}%` }} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-navy">{formatoMoneda.format(p.valorCuota)}</TableCell>
                      <TableCell className="text-right font-medium text-navy">
                        {formatoMoneda.format(p.saldoPendiente)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={variantePorEstado(p.estado)}>{ETIQUETA_ESTADO_PRESTAMO[p.estado]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          {p.estado === 'Activo' && p.cuotasDescontadas === 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Cancelar préstamo de ${p.nombreTrabajador}`}
                              onClick={() => setParaCancelar(p)}
                            >
                              <XCircle className="h-4 w-4 text-error-text" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo préstamo o adelanto</DialogTitle>
            <DialogDescription>
              La cuota se descuenta automáticamente en cada quincena hasta saldar la deuda. Un adelanto se descuenta
              completo en una sola quincena.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pre-trabajador">Trabajador</Label>
              <Select value={formulario.trabajadorId} onValueChange={(v) => actualizarCampo('trabajadorId', v)}>
                <SelectTrigger id="pre-trabajador">
                  <SelectValue placeholder="Selecciona un trabajador" />
                </SelectTrigger>
                <SelectContent>
                  {trabajadores.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pre-tipo">Tipo</Label>
                <Select value={formulario.tipo} onValueChange={(v) => actualizarCampo('tipo', v as TipoPrestamo)}>
                  <SelectTrigger id="pre-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Prestamo">Préstamo en cuotas</SelectItem>
                    <SelectItem value="Adelanto">Adelanto de sueldo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pre-monto">Monto</Label>
                <Input
                  id="pre-monto"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={formulario.monto}
                  onChange={(e) => actualizarCampo('monto', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {!esAdelanto && (
                <div className="space-y-2">
                  <Label htmlFor="pre-cuotas">Número de cuotas (quincenas)</Label>
                  <Input
                    id="pre-cuotas"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAXIMO_CUOTAS}
                    step={1}
                    value={formulario.numeroCuotas}
                    onChange={(e) => actualizarCampo('numeroCuotas', e.target.value)}
                    required
                  />
                </div>
              )}
              <div className={cn('space-y-2', esAdelanto && 'sm:col-span-2')}>
                <Label htmlFor="pre-desde">Descontar desde la quincena de</Label>
                <Input
                  id="pre-desde"
                  type="date"
                  value={formulario.primeraCuotaDesde}
                  onChange={(e) => actualizarCampo('primeraCuotaDesde', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pre-nota">Nota (opcional)</Label>
              <Input
                id="pre-nota"
                maxLength={300}
                value={formulario.nota}
                onChange={(e) => actualizarCampo('nota', e.target.value)}
              />
            </div>

            {cuotaEstimada !== null && (
              <p className="rounded-md bg-foreground/5 px-3 py-2 text-sm text-navy">
                {esAdelanto
                  ? `Se descontarán ${formatoMoneda.format(cuotaEstimada)} en una sola quincena.`
                  : `${cuotasNumero} cuota${cuotasNumero === 1 ? '' : 's'} de ${formatoMoneda.format(cuotaEstimada)} (la última se ajusta al saldo).`}
              </p>
            )}

            {errorFormulario && (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorFormulario}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={paraCancelar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setParaCancelar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este préstamo?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede cancelar si todavía no se ha descontado ninguna cuota. Úsalo si se registró por error.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelando}
              onClick={(e) => {
                e.preventDefault();
                handleCancelar();
              }}
            >
              {cancelando ? 'Cancelando...' : 'Cancelar préstamo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
