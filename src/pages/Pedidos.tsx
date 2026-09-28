import { useCallback, useEffect, useState } from 'react';
import { Ban, CheckCircle2, Loader2, MapPin, PackageCheck, PackageSearch, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import {
  cancelarPedido,
  confirmarPedido,
  enviarACaminoPedido,
  iniciarPreparacionPedido,
  marcarPedidoEntregado,
  obtenerPedidoPorId,
  obtenerPedidos,
} from '@/services/pedidoService';
import type { EstadoPedido, PedidoResponse, PedidoResumenResponse } from '@/types/pedidos';
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const TAMANO_PAGINA = 20;

const estadosFiltro: { valor: string; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'Pendiente', etiqueta: 'Pendiente' },
  { valor: 'Confirmado', etiqueta: 'Confirmado' },
  { valor: 'EnPreparacion', etiqueta: 'En preparación' },
  { valor: 'EnCamino', etiqueta: 'En camino' },
  { valor: 'Entregado', etiqueta: 'Entregado' },
  { valor: 'Cancelado', etiqueta: 'Cancelado' },
];

const metodosPago: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'Efectivo', etiqueta: 'Efectivo' },
  { valor: 'Tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'Transferencia', etiqueta: 'Transferencia' },
];

function BadgeEstadoPedido({ estado }: { estado: EstadoPedido }) {
  switch (estado) {
    case 'Pendiente':
      return <Badge className="border-transparent bg-gold/10 text-gold">Pendiente</Badge>;
    case 'Confirmado':
      return <Badge variant="outline">Confirmado</Badge>;
    case 'EnPreparacion':
      return <Badge variant="outline">En preparación</Badge>;
    case 'EnCamino':
      return <Badge className="border-transparent bg-gold/10 text-gold">En camino</Badge>;
    case 'Entregado':
      return <Badge className="border-transparent bg-green/10 text-green">Entregado</Badge>;
    case 'Cancelado':
      return <Badge className="border-transparent bg-error-bg text-error-text">Cancelado</Badge>;
    default:
      return <Badge variant="outline">{estado}</Badge>;
  }
}

function BadgeEstadoLinea({ estado }: { estado: 'Disponible' | 'PorEncargo' }) {
  if (estado === 'PorEncargo') {
    return <Badge className="border-transparent bg-gold/10 text-gold">Por encargo</Badge>;
  }
  return <Badge className="border-transparent bg-green/10 text-green">Disponible</Badge>;
}

export function Pedidos() {
  const { token } = useAuth();

  const [pedidos, setPedidos] = useState<PedidoResumenResponse[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState('todos');

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoResponse | null>(null);
  const [actualizandoEstado, setActualizandoEstado] = useState(false);

  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [entregandoDialogAbierto, setEntregandoDialogAbierto] = useState(false);
  const [metodoPagoEntrega, setMetodoPagoEntrega] = useState<MetodoPago | ''>('');
  const [marcandoEntregado, setMarcandoEntregado] = useState(false);

  const cargarPedidos = useCallback(
    async (paginaSolicitada: number) => {
      setCargando(true);
      setError(null);
      try {
        const respuesta = await obtenerPedidos(
          paginaSolicitada,
          TAMANO_PAGINA,
          token,
          estadoFiltro === 'todos' ? undefined : estadoFiltro
        );
        setPedidos(respuesta.data);
        setPagina(respuesta.pagina);
        setTotalPaginas(respuesta.totalPaginas);
        setTotal(respuesta.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los pedidos.');
      } finally {
        setCargando(false);
      }
    },
    [token, estadoFiltro]
  );

  useEffect(() => {
    cargarPedidos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoFiltro]);

  function irAPagina(nuevaPagina: number) {
    cargarPedidos(nuevaPagina);
  }

  async function abrirDetalle(resumen: PedidoResumenResponse) {
    setPedidoSeleccionado(null);
    setDialogAbierto(true);
    try {
      const detalle = await obtenerPedidoPorId(resumen.id, token);
      setPedidoSeleccionado(detalle);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cargar el detalle del pedido.');
      setDialogAbierto(false);
    }
  }

  function cerrarDetalle(abierto: boolean) {
    setDialogAbierto(abierto);
    if (!abierto) {
      setPedidoSeleccionado(null);
    }
  }

  async function refrescarListaYDetalle(pedidoActualizado: PedidoResponse) {
    setPedidoSeleccionado(pedidoActualizado);
    await cargarPedidos(pagina);
  }

  async function handleAvanzarEstado() {
    if (!pedidoSeleccionado || actualizandoEstado) return;

    const accionesPorEstado: Partial<Record<EstadoPedido, (id: number, token: string | null) => Promise<PedidoResponse>>> = {
      Pendiente: confirmarPedido,
      Confirmado: iniciarPreparacionPedido,
      EnPreparacion: enviarACaminoPedido,
    };
    const accion = accionesPorEstado[pedidoSeleccionado.estado];
    if (!accion) return;

    setActualizandoEstado(true);
    try {
      const actualizado = await accion(pedidoSeleccionado.id, token);
      await refrescarListaYDetalle(actualizado);
      toast.success('Pedido actualizado', { description: `Ahora está en estado "${actualizado.estado}".` });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo actualizar el pedido.');
    } finally {
      setActualizandoEstado(false);
    }
  }

  async function handleConfirmarCancelar() {
    if (!pedidoSeleccionado) return;

    setCancelando(true);
    try {
      const actualizado = await cancelarPedido(pedidoSeleccionado.id, token);
      await refrescarListaYDetalle(actualizado);
      toast.success('Pedido cancelado', { description: 'Se repuso el stock de los productos disponibles.' });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cancelar el pedido.');
    } finally {
      setCancelando(false);
      setConfirmandoCancelar(false);
    }
  }

  function abrirDialogoEntrega() {
    setMetodoPagoEntrega('');
    setEntregandoDialogAbierto(true);
  }

  async function handleConfirmarEntrega() {
    if (!pedidoSeleccionado || !metodoPagoEntrega || marcandoEntregado) return;

    setMarcandoEntregado(true);
    try {
      const actualizado = await marcarPedidoEntregado(pedidoSeleccionado.id, { metodoPago: metodoPagoEntrega }, token);
      await refrescarListaYDetalle(actualizado);
      setEntregandoDialogAbierto(false);
      toast.success('Pedido entregado', {
        description: `Se generó la venta #${actualizado.ventaId} por ${formatoMoneda.format(actualizado.total)}.`,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo marcar el pedido como entregado.');
    } finally {
      setMarcandoEntregado(false);
    }
  }

  const puedeCancelar = pedidoSeleccionado
    ? pedidoSeleccionado.estado !== 'Entregado' && pedidoSeleccionado.estado !== 'Cancelado'
    : false;

  const tieneLineasPorEncargo = pedidoSeleccionado?.detalles.some((d) => d.estadoLinea === 'PorEncargo') ?? false;

  const etiquetaSiguienteEstado: Partial<Record<EstadoPedido, string>> = {
    Pendiente: 'Confirmar pedido',
    Confirmado: 'Iniciar preparación',
    EnPreparacion: 'Enviar a camino',
  };
  const iconoSiguienteEstado: Partial<Record<EstadoPedido, LucideIcon>> = {
    Pendiente: CheckCircle2,
    Confirmado: PackageSearch,
    EnPreparacion: Truck,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
            <SelectTrigger id="estado" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {estadosFiltro.map((opcion) => (
                <SelectItem key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Productos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-text-muted">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin motion-reduce:animate-none" />
                  </TableCell>
                </TableRow>
              ) : pedidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-text-muted">
                    No se encontraron pedidos.
                  </TableCell>
                </TableRow>
              ) : (
                pedidos.map((pedido) => (
                  <TableRow
                    key={pedido.id}
                    className="cursor-pointer hover:bg-background"
                    onClick={() => abrirDetalle(pedido)}
                  >
                    <TableCell className="text-navy">{formatoFecha(pedido.fecha)}</TableCell>
                    <TableCell className="text-navy">{pedido.clienteNombre}</TableCell>
                    <TableCell className="font-medium text-navy">{formatoMoneda.format(pedido.total)}</TableCell>
                    <TableCell>
                      <BadgeEstadoPedido estado={pedido.estado} />
                    </TableCell>
                    <TableCell>
                      {pedido.tieneLineasPorEncargo ? (
                        <Badge className="border-transparent bg-gold/10 text-gold">Con productos por encargo</Badge>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-text-muted">
          Página {pagina} de {totalPaginas} · {total} pedido(s) en total
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1 || cargando} onClick={() => irAPagina(pagina - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas || cargando}
            onClick={() => irAPagina(pagina + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <Dialog open={dialogAbierto} onOpenChange={cerrarDetalle}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del pedido</DialogTitle>
          </DialogHeader>

          {!pedidoSeleccionado ? (
            <div className="py-8 text-center text-text-muted">
              <Loader2 className="mx-auto h-5 w-5 animate-spin motion-reduce:animate-none" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="font-heading text-lg font-semibold text-navy">{pedidoSeleccionado.clienteNombre}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {pedidoSeleccionado.direccion}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Pedido #{pedidoSeleccionado.id} · {formatoFecha(pedidoSeleccionado.fecha)}
                  </p>
                </div>
                <BadgeEstadoPedido estado={pedidoSeleccionado.estado} />
              </div>

              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidoSeleccionado.detalles.map((linea) => (
                      <TableRow key={linea.id}>
                        <TableCell className="text-navy">{linea.productoNombre}</TableCell>
                        <TableCell className="text-navy">{linea.cantidad}</TableCell>
                        <TableCell className="text-right font-medium text-navy">
                          {formatoMoneda.format(linea.subtotal)}
                        </TableCell>
                        <TableCell>
                          <BadgeEstadoLinea estado={linea.estadoLinea} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-text-muted">Total</span>
                <span className="text-lg font-semibold text-navy">
                  {formatoMoneda.format(pedidoSeleccionado.total)}
                </span>
              </div>

              {pedidoSeleccionado.estado === 'Entregado' && pedidoSeleccionado.ventaId && (
                <p className="text-sm text-text-muted">
                  Este pedido generó la venta #{pedidoSeleccionado.ventaId}. Puedes ver su factura desde el
                  historial de ventas.
                </p>
              )}

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                {puedeCancelar ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-error-text text-error-text hover:bg-error-bg"
                    onClick={() => setConfirmandoCancelar(true)}
                  >
                    <Ban className="h-4 w-4" />
                    Cancelar pedido
                  </Button>
                ) : (
                  <span />
                )}

                {pedidoSeleccionado.estado === 'EnCamino' ? (
                  <Button
                    type="button"
                    variant="gold"
                    onClick={abrirDialogoEntrega}
                    disabled={tieneLineasPorEncargo}
                    title={
                      tieneLineasPorEncargo
                        ? 'No se puede entregar: todavía hay productos por encargo pendientes de llegar.'
                        : undefined
                    }
                  >
                    <PackageCheck className="h-4 w-4" />
                    Marcar entregado
                  </Button>
                ) : (
                  etiquetaSiguienteEstado[pedidoSeleccionado.estado] && (
                    <Button type="button" variant="gold" onClick={handleAvanzarEstado} disabled={actualizandoEstado}>
                      {actualizandoEstado ? (
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                      ) : (
                        (() => {
                          const Icono = iconoSiguienteEstado[pedidoSeleccionado.estado];
                          return Icono ? <Icono className="h-4 w-4" /> : null;
                        })()
                      )}
                      {etiquetaSiguienteEstado[pedidoSeleccionado.estado]}
                    </Button>
                  )
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={entregandoDialogAbierto} onOpenChange={(open) => !marcandoEntregado && setEntregandoDialogAbierto(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              ¿Cómo pagó el cliente contra-entrega? Esto genera la venta y la factura del pedido.
            </p>
            <div className="space-y-2">
              <Label htmlFor="metodoPagoEntrega">Método de pago</Label>
              <Select value={metodoPagoEntrega} onValueChange={(valor) => setMetodoPagoEntrega(valor as MetodoPago)}>
                <SelectTrigger id="metodoPagoEntrega" disabled={marcandoEntregado}>
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
          <DialogFooter>
            <Button
              type="button"
              variant="gold"
              className="w-full"
              disabled={!metodoPagoEntrega || marcandoEntregado}
              onClick={handleConfirmarEntrega}
            >
              {marcandoEntregado && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
              Confirmar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmandoCancelar} onOpenChange={(open) => !cancelando && setConfirmandoCancelar(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Se repondrá el stock de los productos disponibles y se cancelarán las solicitudes de "por encargo"
              asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarCancelar} disabled={cancelando}>
              {cancelando ? 'Cancelando...' : 'Sí, cancelar pedido'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
