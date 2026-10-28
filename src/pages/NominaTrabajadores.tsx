import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { PantallaCargaLogo } from '@/components/PantallaCargaLogo';
import { NominaTabs } from '@/components/nomina/NominaTabs';
import { Kpi } from '@/components/reportes/comun';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import {
  activarTrabajador,
  actualizarTrabajador,
  crearTrabajador,
  desactivarTrabajador,
  obtenerTrabajadores,
} from '@/services/nominaService';
import type { GuardarTrabajadorRequest, MetodoPagoNomina, TipoContrato, Trabajador } from '@/types/nomina';
import {
  contratoRequiereFin,
  ETIQUETA_CONTRATO,
  formatearDia,
  METODOS_PAGO,
  soloDia,
  TIPOS_CONTRATO,
} from '@/utils/nomina';
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
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface TrabajadorForm {
  nombre: string;
  numeroIdentificacion: string;
  telefono: string;
  cargo: string;
  tipoContrato: TipoContrato;
  fechaIngreso: string;
  fechaFinContrato: string;
  salarioMensual: string;
  aplicaSeguridadSocial: boolean;
  metodoPago: MetodoPagoNomina;
}

function formularioVacio(): TrabajadorForm {
  return {
    nombre: '',
    numeroIdentificacion: '',
    telefono: '',
    cargo: '',
    tipoContrato: 'Indefinido',
    fechaIngreso: hoyColombia(),
    fechaFinContrato: '',
    salarioMensual: '',
    aplicaSeguridadSocial: true,
    metodoPago: 'Efectivo',
  };
}

function EstadoContrato({ trabajador }: { trabajador: Trabajador }) {
  const dias = trabajador.diasParaFinContrato;
  if (dias === null) return <span className="text-text-muted">Sin fecha de cierre</span>;
  if (dias < 0) return <Badge variant="destructive">Vencido el {formatearDia(trabajador.fechaFinContrato!)}</Badge>;
  if (dias <= 30) return <Badge variant="gold">Vence en {dias} d</Badge>;
  return <span className="text-text-muted">Hasta {formatearDia(trabajador.fechaFinContrato!)}</span>;
}

export function NominaTrabajadores() {
  const { token } = useAuth();

  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [formulario, setFormulario] = useState<TrabajadorForm>(formularioVacio);
  const [editando, setEditando] = useState<Trabajador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const [paraDesactivar, setParaDesactivar] = useState<Trabajador | null>(null);
  const [desactivando, setDesactivando] = useState(false);
  const [activandoId, setActivandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      // Siempre se trae la lista completa; el interruptor solo decide qué se pinta.
      setTrabajadores(await obtenerTrabajadores(true, token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los trabajadores.');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = mostrarInactivos ? trabajadores : trabajadores.filter((t) => t.activo);

  const resumen = useMemo(() => {
    const activos = trabajadores.filter((t) => t.activo);
    return {
      cantidad: activos.length,
      nominaMensual: activos.reduce((suma, t) => suma + t.salarioMensual, 0),
      saldoPrestamos: activos.reduce((suma, t) => suma + t.saldoPrestamos, 0),
    };
  }, [trabajadores]);

  function actualizarCampo<K extends keyof TrabajadorForm>(campo: K, valor: TrabajadorForm[K]) {
    setFormulario((previo) => ({ ...previo, [campo]: valor }));
  }

  function abrirNuevo() {
    setEditando(null);
    setFormulario(formularioVacio());
    setErrorFormulario(null);
    setDialogAbierto(true);
  }

  function abrirEditar(t: Trabajador) {
    setEditando(t);
    setFormulario({
      nombre: t.nombre,
      numeroIdentificacion: t.numeroIdentificacion,
      telefono: t.telefono ?? '',
      cargo: t.cargo,
      tipoContrato: t.tipoContrato,
      fechaIngreso: soloDia(t.fechaIngreso),
      fechaFinContrato: t.fechaFinContrato ? soloDia(t.fechaFinContrato) : '',
      salarioMensual: String(t.salarioMensual),
      aplicaSeguridadSocial: t.aplicaSeguridadSocial,
      metodoPago: t.metodoPago,
    });
    setErrorFormulario(null);
    setDialogAbierto(true);
  }

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    setErrorFormulario(null);

    const salario = Number(formulario.salarioMensual);
    const requiereFin = contratoRequiereFin(formulario.tipoContrato);

    if (!formulario.nombre.trim()) return setErrorFormulario('El nombre es obligatorio.');
    if (!formulario.numeroIdentificacion.trim()) return setErrorFormulario('La identificación es obligatoria.');
    if (!formulario.cargo.trim()) return setErrorFormulario('El cargo es obligatorio.');
    if (!formulario.fechaIngreso) return setErrorFormulario('Indica la fecha de ingreso.');
    if (!Number.isFinite(salario) || salario <= 0) return setErrorFormulario('El salario debe ser mayor que cero.');
    if (requiereFin && !formulario.fechaFinContrato)
      return setErrorFormulario('Este tipo de contrato necesita fecha de terminación.');
    if (formulario.fechaFinContrato && formulario.fechaFinContrato < formulario.fechaIngreso)
      return setErrorFormulario('La terminación no puede ser anterior al ingreso.');

    const data: GuardarTrabajadorRequest = {
      nombre: formulario.nombre.trim(),
      numeroIdentificacion: formulario.numeroIdentificacion.trim(),
      telefono: formulario.telefono.trim() || null,
      cargo: formulario.cargo.trim(),
      tipoContrato: formulario.tipoContrato,
      fechaIngreso: formulario.fechaIngreso,
      fechaFinContrato: formulario.fechaFinContrato || null,
      salarioMensual: salario,
      aplicaSeguridadSocial: formulario.aplicaSeguridadSocial,
      metodoPago: formulario.metodoPago,
    };

    setGuardando(true);
    try {
      if (editando) {
        await actualizarTrabajador(editando.id, data, token);
        toast.success('Trabajador actualizado');
      } else {
        await crearTrabajador(data, token);
        toast.success(`Trabajador "${data.nombre}" creado`);
      }
      setDialogAbierto(false);
      setEditando(null);
      await cargar();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo guardar el trabajador.';
      setErrorFormulario(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  async function handleDesactivar() {
    if (!paraDesactivar) return;
    setDesactivando(true);
    try {
      await desactivarTrabajador(paraDesactivar.id, token);
      toast.success('Trabajador desactivado');
      setParaDesactivar(null);
      await cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo desactivar el trabajador.');
    } finally {
      setDesactivando(false);
    }
  }

  async function handleActivar(t: Trabajador) {
    setActivandoId(t.id);
    try {
      await activarTrabajador(t.id, token);
      toast.success('Trabajador activado');
      await cargar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo activar el trabajador.');
    } finally {
      setActivandoId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-navy">Nómina</h2>
          <p className="text-sm text-text-muted">Trabajadores, sueldos y forma de pago.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-text-muted">
            <Switch checked={mostrarInactivos} onCheckedChange={setMostrarInactivos} />
            Mostrar inactivos
          </label>
          <Button variant="gold" onClick={abrirNuevo}>
            <Plus className="h-4 w-4" />
            Nuevo trabajador
          </Button>
        </div>
      </div>

      <NominaTabs />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi etiqueta="Trabajadores activos" valor={String(resumen.cantidad)} />
        <Kpi etiqueta="Nómina mensual estimada" valor={formatoMoneda.format(resumen.nominaMensual)} ayuda="Suma de sueldos base" />
        <Kpi etiqueta="Saldo de préstamos" valor={formatoMoneda.format(resumen.saldoPrestamos)} ayuda="Lo que deben los trabajadores" />
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
                <TableHead>Contrato</TableHead>
                <TableHead className="text-right">Sueldo mensual</TableHead>
                <TableHead>Seg. social</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-text-muted">
                    <PantallaCargaLogo variante="en-linea" />
                  </TableCell>
                </TableRow>
              ) : visibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-text-muted">
                    Aún no hay trabajadores. Agrega el primero con “Nuevo trabajador”.
                  </TableCell>
                </TableRow>
              ) : (
                visibles.map((t) => (
                  <TableRow key={t.id} className={cn(!t.activo && 'opacity-50')}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium text-navy">
                        {t.nombre}
                        {!t.activo && <Badge variant="outline">Inactivo</Badge>}
                      </div>
                      <div className="text-xs text-text-muted">
                        {t.cargo} · {t.numeroIdentificacion}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="text-navy">{ETIQUETA_CONTRATO[t.tipoContrato]}</div>
                      <div className="text-xs">
                        <EstadoContrato trabajador={t} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-navy">
                      {formatoMoneda.format(t.salarioMensual)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.aplicaSeguridadSocial ? 'default' : 'outline'}>
                        {t.aplicaSeguridadSocial ? 'Sí' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-navy">{t.metodoPago}</TableCell>
                    <TableCell className="text-right text-navy">
                      {t.saldoPrestamos > 0 ? formatoMoneda.format(t.saldoPrestamos) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${t.nombre}`} onClick={() => abrirEditar(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {t.activo ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Desactivar ${t.nombre}`}
                            onClick={() => setParaDesactivar(t)}
                          >
                            <Trash2 className="h-4 w-4 text-error-text" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Activar ${t.nombre}`}
                            disabled={activandoId === t.id}
                            onClick={() => handleActivar(t)}
                          >
                            {activandoId === t.id ? (
                              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                            ) : (
                              <RotateCcw className="h-4 w-4 text-green" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar trabajador' : 'Nuevo trabajador'}</DialogTitle>
            <DialogDescription>
              Los cambios de sueldo aplican a las quincenas que aún están en borrador; las aprobadas no cambian.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trab-nombre">Nombre completo</Label>
              <Input id="trab-nombre" value={formulario.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trab-id">Identificación</Label>
                <Input
                  id="trab-id"
                  value={formulario.numeroIdentificacion}
                  onChange={(e) => actualizarCampo('numeroIdentificacion', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trab-tel">Teléfono (opcional)</Label>
                <Input id="trab-tel" value={formulario.telefono} onChange={(e) => actualizarCampo('telefono', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trab-cargo">Cargo</Label>
              <Input id="trab-cargo" value={formulario.cargo} onChange={(e) => actualizarCampo('cargo', e.target.value)} required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trab-contrato">Tipo de contrato</Label>
                <Select
                  value={formulario.tipoContrato}
                  onValueChange={(v) => actualizarCampo('tipoContrato', v as TipoContrato)}
                >
                  <SelectTrigger id="trab-contrato">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTRATO.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {ETIQUETA_CONTRATO[tipo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trab-pago">Forma de pago</Label>
                <Select
                  value={formulario.metodoPago}
                  onValueChange={(v) => actualizarCampo('metodoPago', v as MetodoPagoNomina)}
                >
                  <SelectTrigger id="trab-pago">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METODOS_PAGO.map((metodo) => (
                      <SelectItem key={metodo} value={metodo}>
                        {metodo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trab-ingreso">Fecha de ingreso</Label>
                <Input
                  id="trab-ingreso"
                  type="date"
                  value={formulario.fechaIngreso}
                  onChange={(e) => actualizarCampo('fechaIngreso', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trab-fin">
                  Terminación del contrato{contratoRequiereFin(formulario.tipoContrato) ? '' : ' (opcional)'}
                </Label>
                <Input
                  id="trab-fin"
                  type="date"
                  value={formulario.fechaFinContrato}
                  min={formulario.fechaIngreso}
                  onChange={(e) => actualizarCampo('fechaFinContrato', e.target.value)}
                  required={contratoRequiereFin(formulario.tipoContrato)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trab-salario">Sueldo mensual</Label>
              <Input
                id="trab-salario"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={formulario.salarioMensual}
                onChange={(e) => actualizarCampo('salarioMensual', e.target.value)}
                required
              />
              <p className="text-xs text-text-muted">
                Cada quincena se paga la mitad. El auxilio de transporte se suma automáticamente si le corresponde.
              </p>
            </div>

            <label className="flex items-start justify-between gap-4 rounded-md border border-border px-3 py-2.5">
              <span>
                <span className="block text-sm font-medium text-navy">Descontar salud y pensión</span>
                <span className="block text-xs text-text-muted">
                  Si está activo, se descuenta el aporte del trabajador y se calcula la seguridad social.
                </span>
              </span>
              <Switch
                checked={formulario.aplicaSeguridadSocial}
                onCheckedChange={(v) => actualizarCampo('aplicaSeguridadSocial', v)}
              />
            </label>

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
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar trabajador'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={paraDesactivar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setParaDesactivar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar a {paraDesactivar?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no aparecerá en las próximas quincenas, pero su historial y sus préstamos se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desactivando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={desactivando}
              onClick={(e) => {
                e.preventDefault();
                handleDesactivar();
              }}
            >
              {desactivando ? 'Desactivando...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
