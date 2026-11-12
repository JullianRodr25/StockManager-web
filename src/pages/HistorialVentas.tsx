import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Eye, Loader2, Printer, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { PantallaCargaLogo } from '@/components/PantallaCargaLogo';
import { descargarPdfFacturaDeVenta } from '@/services/facturaService';
import { obtenerVentaPorId, obtenerVentas } from '@/services/ventaService';
import type { VentaResponse, VentaResumenResponse } from '@/types/ventas';
import { BadgeEstado, DetalleFacturaDialog, formatoFecha, formatoMoneda, nombreComprador } from '@/components/DetalleFacturaDialog';
import { CambiarMetodoPagoDialog } from '@/components/CambiarMetodoPagoDialog';
import { DevolucionDialog } from '@/components/DevolucionDialog';
import { descargarArchivo } from '@/lib/descargarArchivo';
import { esHoyEnColombia } from '@/utils/fechasColombia';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

const TAMANO_PAGINA = 20;

const estadosFiltro = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'Pagada', etiqueta: 'Pagada' },
  { valor: 'Pendiente', etiqueta: 'Pendiente' },
  { valor: 'Cancelada', etiqueta: 'Cancelada' },
];

export function HistorialVentas() {
  const { token } = useAuth();

  const [ventas, setVentas] = useState<VentaResumenResponse[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<VentaResponse | null>(null);
  const [imprimiendoId, setImprimiendoId] = useState<number | null>(null);
  const [ventaADevolver, setVentaADevolver] = useState<VentaResumenResponse | null>(null);
  const [ventaCambioMetodo, setVentaCambioMetodo] = useState<VentaResumenResponse | null>(null);

  const cargarVentas = useCallback(
    async (paginaSolicitada: number) => {
      setCargando(true);
      setError(null);
      try {
        const respuesta = await obtenerVentas(paginaSolicitada, TAMANO_PAGINA, token, {
          desde: desde || undefined,
          hasta: hasta || undefined,
          estado: estadoFiltro === 'todos' ? undefined : estadoFiltro,
        });
        setVentas(respuesta.data);
        setPagina(respuesta.pagina);
        setTotalPaginas(respuesta.totalPaginas);
        setTotal(respuesta.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial de ventas.');
      } finally {
        setCargando(false);
      }
    },
    [token, desde, hasta, estadoFiltro]
  );

  useEffect(() => {
    cargarVentas(1);
    // Solo debe recargar cuando cambian los filtros; cargarVentas ya
    // depende de "token" y de los filtros internamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, estadoFiltro]);

  function irAPagina(nuevaPagina: number) {
    cargarVentas(nuevaPagina);
  }

  /**
   * Abre el PDF de la factura en una pestaña nueva, listo para imprimir (Ctrl+P) o guardar.
   * La pestaña se abre ANTES de pedir el archivo: si se abriera después del await, el
   * navegador la bloquearía como ventana emergente por no venir directo del clic.
   */
  async function imprimirFactura(ventaId: number) {
    const ventana = window.open('', '_blank');
    setImprimiendoId(ventaId);
    try {
      const pdf = await descargarPdfFacturaDeVenta(ventaId, token);
      const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      if (ventana) {
        ventana.location.href = url;
      } else {
        descargarArchivo(pdf, `factura-venta-${ventaId}.pdf`);
      }
      // Se libera tarde para no cortar la carga del visor de PDF.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      ventana?.close();
      toast.error(err instanceof ApiError ? err.message : 'No se pudo generar la factura.');
    } finally {
      setImprimiendoId(null);
    }
  }

  async function abrirDetalle(venta: VentaResumenResponse) {
    setVentaSeleccionada(null);
    setDialogAbierto(true);
    try {
      const detalle = await obtenerVentaPorId(venta.id, token);
      setVentaSeleccionada(detalle);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cargar el detalle de la venta.');
      setDialogAbierto(false);
    }
  }

  function cerrarDetalle(abierto: boolean) {
    setDialogAbierto(abierto);
    if (!abierto) {
      setVentaSeleccionada(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
            <SelectTrigger id="estado" className="w-full sm:w-48">
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
                <TableHead>Comprador</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Método de pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Número de factura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                    <PantallaCargaLogo variante="en-linea" />
                  </TableCell>
                </TableRow>
              ) : ventas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                    No se encontraron ventas.
                  </TableCell>
                </TableRow>
              ) : (
                ventas.map((venta) => (
                  <TableRow
                    key={venta.id}
                    className="cursor-pointer hover:bg-background"
                    onClick={() => abrirDetalle(venta)}
                  >
                    <TableCell className="text-navy">{formatoFecha(venta.fecha)}</TableCell>
                    <TableCell className="text-navy">{nombreComprador(venta)}</TableCell>
                    <TableCell className="font-medium text-navy">
                      {formatoMoneda.format(venta.total)}
                      {venta.totalDevuelto > 0 && (
                        <span className="block text-xs font-normal text-text-muted">
                          Neto {formatoMoneda.format(venta.total - venta.totalDevuelto + venta.totalCambio)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-navy">{venta.metodoPago}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <BadgeEstado estado={venta.estado} />
                        {venta.totalDevuelto > 0 && (
                          <span
                            className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-navy"
                            title={`Devuelto: ${formatoMoneda.format(venta.totalDevuelto)}`}
                          >
                            Con devolución
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-text-muted">
                      <div className="flex items-center justify-between gap-2">
                        {venta.numeroFactura}
                        {/* La fila entera ya abre el detalle al hacer clic, pero no es obvio
                            a simple vista; este ojito lo deja claro sin cambiar el
                            comportamiento (mismo abrirDetalle de siempre). stopPropagation
                            evita que también se dispare el onClick de la fila y se pida el
                            detalle dos veces. */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label={`Ver factura ${venta.numeroFactura}`}
                          title="Ver factura"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirDetalle(venta);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label={`Imprimir factura ${venta.numeroFactura}`}
                          title="Imprimir factura"
                          disabled={imprimiendoId === venta.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void imprimirFactura(venta.id);
                          }}
                        >
                          {imprimiendoId === venta.id ? (
                            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                        {/* Solo el mismo día de la venta y si no se pagó con abonos; el servidor
                            valida de nuevo (y además bloquea si el turno ya cerró). */}
                        {venta.estado === 'Pagada' && venta.totalAbonado === 0 && esHoyEnColombia(venta.fecha) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            aria-label={`Cambiar método de pago de la venta ${venta.numeroFactura || venta.id}`}
                            title="Cambiar método de pago"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVentaCambioMetodo(venta);
                            }}
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        {venta.estado === 'Pagada' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            aria-label={`Devolver o cambiar la venta ${venta.numeroFactura || venta.id}`}
                            title="Devolver o cambiar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVentaADevolver(venta);
                            }}
                          >
                            <Undo2 className="h-4 w-4" />
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

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-text-muted">
          Página {pagina} de {totalPaginas} · {total} venta(s) en total
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

      <DetalleFacturaDialog venta={ventaSeleccionada} open={dialogAbierto} onOpenChange={cerrarDetalle} />

      <CambiarMetodoPagoDialog
        venta={ventaCambioMetodo}
        onCerrar={() => setVentaCambioMetodo(null)}
        onCambiado={() => cargarVentas(pagina)}
      />

      <DevolucionDialog
        venta={ventaADevolver}
        onCerrar={() => setVentaADevolver(null)}
        onRegistrada={() => cargarVentas(pagina)}
      />
    </div>
  );
}
