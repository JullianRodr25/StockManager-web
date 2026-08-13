import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { obtenerVentaPorId, obtenerVentas } from '@/services/ventaService';
import type { VentaResponse, VentaResumenResponse } from '@/types/ventas';
import { BadgeEstado, DetalleFacturaDialog, formatoFecha, formatoMoneda, nombreComprador } from '@/components/DetalleFacturaDialog';
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
                    <Loader2 className="mx-auto h-5 w-5 animate-spin motion-reduce:animate-none" />
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
                    <TableCell className="font-medium text-navy">{formatoMoneda.format(venta.total)}</TableCell>
                    <TableCell className="text-navy">{venta.metodoPago}</TableCell>
                    <TableCell>
                      <BadgeEstado estado={venta.estado} />
                    </TableCell>
                    <TableCell className="text-text-muted">{venta.numeroFactura}</TableCell>
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
    </div>
  );
}
