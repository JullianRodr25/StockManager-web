import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { obtenerProveedores } from '@/services/proveedorService';
import {
  cancelarCuentaPorPagar,
  crearCuentaPorPagar,
  obtenerCuentaPorPagarPorId,
  obtenerCuentasPorPagar,
  registrarAbonoCuentaPorPagar,
} from '@/services/cuentaPorPagarService';
import type { Proveedor } from '@/types/proveedores';
import type { CuentaPorPagarResponse, CuentaPorPagarResumenResponse } from '@/types/cuentasPorPagar';
import type { MetodoPago } from '@/types/ventas';
import { formatoFecha, formatoMoneda } from '@/components/DetalleFacturaDialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const TAMANO_PAGINA = 100;
const PROVEEDORES_TAMANO_PAGINA = 200;

const metodosPago: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'Efectivo', etiqueta: 'Efectivo' },
  { valor: 'Tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'Transferencia', etiqueta: 'Transferencia' },
];

// "todas" y "vencidas" no son estados del backend: "todas" simplemente no manda el filtro
// `estado`, y "vencidas" pide las Pendientes y filtra en el cliente por el flag `vencida`
// (que el backend ya calcula) — evita duplicar en el front la regla de qué es "vencida".
type FiltroEstado = 'todas' | 'Pendiente' | 'Pagada' | 'Cancelada' | 'vencidas';

function BadgeEstadoCuenta({ cuenta }: { cuenta: { estado: string; vencida: boolean } }) {
  if (cuenta.vencida) {
    return <Badge className="border-transparent bg-error-bg text-error-text">Vencida</Badge>;
  }
  const normalizado = cuenta.estado.trim().toLowerCase();
  if (normalizado === 'pagada') {
    return <Badge className="border-transparent bg-green/10 text-green">Pagada</Badge>;
  }
  if (normalizado === 'pendiente') {
    return <Badge className="border-transparent bg-gold/10 text-gold">Pendiente</Badge>;
  }
  if (normalizado === 'cancelada') {
    return <Badge variant="outline">Cancelada</Badge>;
  }
  return <Badge variant="outline">{cuenta.estado}</Badge>;
}

interface NuevaCuentaForm {
  proveedorId: string;
  concepto: string;
  montoTotal: string;
  fechaVencimiento: string;
}

const formularioVacio: NuevaCuentaForm = {
  proveedorId: '',
  concepto: '',
  montoTotal: '',
  fechaVencimiento: '',
};

export function CuentasPorPagar() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const proveedorIdFiltroParam = searchParams.get('proveedorId');

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cuentas, setCuentas] = useState<CuentaPorPagarResumenResponse[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');

  const [dialogNuevaAbierto, setDialogNuevaAbierto] = useState(false);
  const [formulario, setFormulario] = useState<NuevaCuentaForm>(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaPorPagarResponse | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoPagoAbono, setMetodoPagoAbono] = useState<MetodoPago | ''>('');
  const [registrandoAbono, setRegistrandoAbono] = useState(false);
  const [errorAbono, setErrorAbono] = useState<string | null>(null);

  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    obtenerProveedores(1, PROVEEDORES_TAMANO_PAGINA, token, true)
      .then((respuesta) => setProveedores(respuesta.data))
      .catch(() => {
        // Si falla, el selector de proveedor del formulario simplemente queda vacío.
      });
  }, [token]);

  const cargarCuentas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const proveedorId = proveedorIdFiltroParam ? Number(proveedorIdFiltroParam) : undefined;
      const estadoParaBackend = filtroEstado === 'todas' || filtroEstado === 'vencidas' ? undefined : filtroEstado;

      const respuesta = await obtenerCuentasPorPagar(1, TAMANO_PAGINA, token, {
        estado: filtroEstado === 'vencidas' ? 'Pendiente' : estadoParaBackend,
        proveedorId,
      });

      const items = filtroEstado === 'vencidas' ? respuesta.data.filter((c) => c.vencida) : respuesta.data;
      setCuentas(items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las cuentas por pagar.');
    } finally {
      setCargando(false);
    }
  }, [token, filtroEstado, proveedorIdFiltroParam]);

  useEffect(() => {
    cargarCuentas();
  }, [cargarCuentas]);

  const proveedorFiltro = proveedorIdFiltroParam
    ? proveedores.find((p) => p.id === Number(proveedorIdFiltroParam))
    : undefined;

  function limpiarFiltroProveedor() {
    setSearchParams((params) => {
      params.delete('proveedorId');
      return params;
    });
  }

  function actualizarCampoFormulario(campo: keyof NuevaCuentaForm, valor: string) {
    setFormulario((previo) => ({ ...previo, [campo]: valor }));
  }

  function abrirDialogNueva() {
    setFormulario({
      ...formularioVacio,
      proveedorId: proveedorIdFiltroParam ?? '',
    });
    setErrorFormulario(null);
    setDialogNuevaAbierto(true);
  }

  async function handleGuardarCuenta(e: FormEvent) {
    e.preventDefault();
    setErrorFormulario(null);

    const proveedorId = Number(formulario.proveedorId);
    const montoTotal = Number(formulario.montoTotal);

    if (!proveedorId) {
      setErrorFormulario('Selecciona un proveedor.');
      return;
    }
    if (!formulario.concepto.trim()) {
      setErrorFormulario('Ingresa un concepto para la compra.');
      return;
    }
    if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
      setErrorFormulario('Ingresa un monto total válido.');
      return;
    }
    if (!formulario.fechaVencimiento) {
      setErrorFormulario('Selecciona la fecha de vencimiento.');
      return;
    }

    setGuardando(true);
    try {
      await crearCuentaPorPagar(
        {
          proveedorId,
          concepto: formulario.concepto.trim(),
          montoTotal,
          fechaVencimiento: formulario.fechaVencimiento,
        },
        token
      );
      toast.success('Cuenta por pagar registrada correctamente');
      setDialogNuevaAbierto(false);
      await cargarCuentas();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo registrar la cuenta por pagar.';
      setErrorFormulario(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  async function abrirDetalle(resumen: CuentaPorPagarResumenResponse) {
    setCargandoDetalle(true);
    setMontoAbono('');
    setMetodoPagoAbono('');
    setErrorAbono(null);
    setCuentaSeleccionada(null);
    try {
      const cuenta = await obtenerCuentaPorPagarPorId(resumen.id, token);
      setCuentaSeleccionada(cuenta);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cargar el detalle de la cuenta.');
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cerrarDetalle(abierto: boolean) {
    if (!abierto) {
      setCuentaSeleccionada(null);
    }
  }

  async function handleRegistrarAbono(e: FormEvent) {
    e.preventDefault();
    if (!cuentaSeleccionada) return;

    setErrorAbono(null);
    const monto = Number(montoAbono);
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorAbono('Ingresa un monto válido.');
      return;
    }
    if (!metodoPagoAbono) {
      setErrorAbono('Selecciona un método de pago.');
      return;
    }

    setRegistrandoAbono(true);
    try {
      const cuentaActualizada = await registrarAbonoCuentaPorPagar(
        cuentaSeleccionada.id,
        { monto, metodoPago: metodoPagoAbono },
        token
      );
      setCuentaSeleccionada(cuentaActualizada);
      setMontoAbono('');
      setMetodoPagoAbono('');
      if (cuentaActualizada.estado === 'Pagada') {
        toast.success('Cuenta por pagar saldada por completo');
      } else {
        toast.success('Abono registrado', {
          description: `Saldo pendiente: ${formatoMoneda.format(cuentaActualizada.saldoPendiente)}`,
        });
      }
      await cargarCuentas();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo registrar el abono.';
      setErrorAbono(mensaje);
      toast.error(mensaje);
    } finally {
      setRegistrandoAbono(false);
    }
  }

  async function handleConfirmarCancelar() {
    if (!cuentaSeleccionada) return;

    setCancelando(true);
    try {
      await cancelarCuentaPorPagar(cuentaSeleccionada.id, token);
      toast.success('Cuenta por pagar cancelada');
      setCuentaSeleccionada(null);
      await cargarCuentas();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cancelar la cuenta por pagar.');
    } finally {
      setCancelando(false);
      setConfirmandoCancelar(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-navy">Cuentas por pagar</h2>
          <p className="text-sm text-text-muted">Compras a crédito con proveedores y su estado de pago.</p>
        </div>

        <Button variant="gold" onClick={abrirDialogNueva}>
          <Plus className="h-4 w-4" />
          Registrar compra a crédito
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filtroEstado} onValueChange={(valor) => setFiltroEstado(valor as FiltroEstado)}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos los estados</SelectItem>
            <SelectItem value="Pendiente">Pendiente</SelectItem>
            <SelectItem value="vencidas">Vencidas</SelectItem>
            <SelectItem value="Pagada">Pagada</SelectItem>
            <SelectItem value="Cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        {proveedorFiltro && (
          <div className="flex items-center gap-2 rounded-md border border-gold bg-gold/10 px-3 py-1.5 text-sm text-navy">
            Proveedor: <span className="font-medium">{proveedorFiltro.nombre}</span>
            <Button type="button" variant="ghost" size="sm" onClick={limpiarFiltroProveedor}>
              Quitar filtro
            </Button>
          </div>
        )}
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
                <TableHead>Proveedor</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto total</TableHead>
                <TableHead className="text-right">Saldo pendiente</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin motion-reduce:animate-none" />
                  </TableCell>
                </TableRow>
              ) : cuentas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                    No hay cuentas por pagar con estos filtros.
                  </TableCell>
                </TableRow>
              ) : (
                cuentas.map((cuenta) => (
                  <TableRow
                    key={cuenta.id}
                    className="cursor-pointer hover:bg-background"
                    onClick={() => abrirDetalle(cuenta)}
                  >
                    <TableCell className="font-medium text-navy">{cuenta.proveedorNombre}</TableCell>
                    <TableCell className="text-navy">{cuenta.concepto}</TableCell>
                    <TableCell className="text-right text-navy">{formatoMoneda.format(cuenta.montoTotal)}</TableCell>
                    <TableCell className="text-right font-medium text-navy">
                      {formatoMoneda.format(cuenta.saldoPendiente)}
                    </TableCell>
                    <TableCell className="text-navy">{formatoFecha(cuenta.fechaVencimiento)}</TableCell>
                    <TableCell>
                      <BadgeEstadoCuenta cuenta={cuenta} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogNuevaAbierto} onOpenChange={setDialogNuevaAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar compra a crédito</DialogTitle>
            <DialogDescription>Crea una nueva cuenta por pagar con un proveedor.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardarCuenta} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proveedorId">Proveedor</Label>
              <Select
                value={formulario.proveedorId}
                onValueChange={(valor) => actualizarCampoFormulario('proveedorId', valor)}
              >
                <SelectTrigger id="proveedorId">
                  <SelectValue placeholder="Selecciona un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map((proveedor) => (
                    <SelectItem key={proveedor.id} value={String(proveedor.id)}>
                      {proveedor.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="concepto">Concepto</Label>
              <Input
                id="concepto"
                placeholder="Ej. Compra de tornillería y herramientas"
                value={formulario.concepto}
                onChange={(e) => actualizarCampoFormulario('concepto', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="montoTotal">Monto total</Label>
                <Input
                  id="montoTotal"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formulario.montoTotal}
                  onChange={(e) => actualizarCampoFormulario('montoTotal', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaVencimiento">Fecha de vencimiento</Label>
                <Input
                  id="fechaVencimiento"
                  type="date"
                  value={formulario.fechaVencimiento}
                  onChange={(e) => actualizarCampoFormulario('fechaVencimiento', e.target.value)}
                  required
                />
              </div>
            </div>

            {errorFormulario && (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorFormulario}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogNuevaAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Registrar compra'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cuentaSeleccionada !== null || cargandoDetalle} onOpenChange={cerrarDetalle}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalle de la cuenta por pagar</DialogTitle>
          </DialogHeader>

          {cargandoDetalle || !cuentaSeleccionada ? (
            <div className="py-8 text-center text-text-muted">
              <Loader2 className="mx-auto h-5 w-5 animate-spin motion-reduce:animate-none" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <p className="font-medium text-navy">{cuentaSeleccionada.proveedorNombre}</p>
                  <p className="text-sm text-text-muted">{cuentaSeleccionada.concepto}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Vence el {formatoFecha(cuentaSeleccionada.fechaVencimiento)}
                  </p>
                </div>
                <BadgeEstadoCuenta cuenta={cuentaSeleccionada} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-text-muted">Monto total</p>
                  <p className="text-lg font-semibold text-navy">{formatoMoneda.format(cuentaSeleccionada.montoTotal)}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-text-muted">Saldo pendiente</p>
                  <p className="text-lg font-semibold text-navy">
                    {formatoMoneda.format(cuentaSeleccionada.saldoPendiente)}
                  </p>
                </div>
              </div>

              {cuentaSeleccionada.estado === 'Pendiente' && (
                <form onSubmit={handleRegistrarAbono} className="space-y-3 border-t border-border pt-4">
                  <p className="text-sm font-medium text-navy">Registrar abono</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="montoAbono">Monto</Label>
                      <Input
                        id="montoAbono"
                        type="number"
                        min="1"
                        step="1"
                        value={montoAbono}
                        onChange={(e) => setMontoAbono(e.target.value)}
                        disabled={registrandoAbono}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="metodoPagoAbono">Método de pago</Label>
                      <Select value={metodoPagoAbono} onValueChange={(valor) => setMetodoPagoAbono(valor as MetodoPago)}>
                        <SelectTrigger id="metodoPagoAbono" disabled={registrandoAbono}>
                          <SelectValue placeholder="Selecciona un método" />
                        </SelectTrigger>
                        <SelectContent>
                          {metodosPago.map((metodo) => (
                            <SelectItem key={metodo.valor} value={metodo.valor}>
                              {metodo.etiqueta}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {errorAbono && (
                    <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                      {errorAbono}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-error-text text-error-text hover:bg-error-bg"
                      onClick={() => setConfirmandoCancelar(true)}
                      disabled={registrandoAbono || cuentaSeleccionada.abonos.length > 0}
                      title={
                        cuentaSeleccionada.abonos.length > 0
                          ? 'No se puede cancelar una cuenta que ya tiene abonos registrados.'
                          : undefined
                      }
                    >
                      <Ban className="h-4 w-4" />
                      Cancelar cuenta
                    </Button>
                    <Button type="submit" variant="gold" disabled={registrandoAbono}>
                      {registrandoAbono && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                      Registrar abono
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-sm font-medium text-navy">Historial de abonos</p>
                {cuentaSeleccionada.abonos.length === 0 ? (
                  <p className="py-2 text-sm text-text-muted">Todavía no se han registrado abonos.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cuentaSeleccionada.abonos.map((abono) => (
                          <TableRow key={abono.id}>
                            <TableCell className="text-navy">{formatoFecha(abono.fecha)}</TableCell>
                            <TableCell className="text-navy">{abono.metodoPago}</TableCell>
                            <TableCell className="text-right font-medium text-navy">
                              {formatoMoneda.format(abono.monto)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmandoCancelar} onOpenChange={(open) => !cancelando && setConfirmandoCancelar(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta cuenta por pagar?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Solo se puede cancelar una cuenta que todavía no tiene abonos
              registrados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarCancelar} disabled={cancelando}>
              {cancelando ? 'Cancelando...' : 'Sí, cancelar cuenta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
