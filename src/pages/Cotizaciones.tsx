import { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Ban, FileDown, Loader2, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { descargarArchivo } from '@/lib/descargarArchivo';
import { ApiError } from '@/services/api';
import {
  anularCotizacion,
  descargarPdfCotizacion,
  listarCotizaciones,
  obtenerCotizacion,
} from '@/services/cotizacionService';
import type { Cotizacion, CotizacionResumen, EstadoCotizacion } from '@/types/cotizaciones';
import { CotizacionDialog } from '@/components/CotizacionDialog';
import { ConvertirCotizacionDialog } from '@/components/ConvertirCotizacionDialog';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
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
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { etiquetaDia } from '@/utils/fechas';

const TAMANO_PAGINA = 20;
const ESTADOS: { valor: '' | EstadoCotizacion; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'Vigente', etiqueta: 'Vigentes' },
  { valor: 'Vencida', etiqueta: 'Vencidas' },
  { valor: 'Convertida', etiqueta: 'Convertidas' },
  { valor: 'Anulada', etiqueta: 'Anuladas' },
];

function EstadoBadge({ estado }: { estado: EstadoCotizacion }) {
  const variante = estado === 'Vigente' ? 'gold' : estado === 'Anulada' ? 'destructive' : 'outline';
  return <Badge variant={variante}>{estado}</Badge>;
}

function mensajeDe(err: unknown, porDefecto: string): string {
  return err instanceof ApiError ? err.message : porDefecto;
}

export function Cotizaciones() {
  const { usuario, token } = useAuth();
  const esAdmin = usuario?.rol === 'Admin';

  const [estado, setEstado] = useState<'' | EstadoCotizacion>('');
  const [busquedaInput, setBusquedaInput] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<CotizacionResumen[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<Cotizacion | null>(null);
  const [aConvertir, setAConvertir] = useState<Cotizacion | null>(null);
  const [aAnular, setAAnular] = useState<CotizacionResumen | null>(null);
  const [ocupada, setOcupada] = useState<number | null>(null);
  const [anulando, setAnulando] = useState(false);

  // Debounce de la búsqueda para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(busquedaInput.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busquedaInput]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    listarCotizaciones({ pagina, tamanoPagina: TAMANO_PAGINA, estado, busqueda }, token)
      .then((r) => {
        if (!vigente) return;
        setDatos(r.data);
        setTotalPaginas(Math.max(1, r.totalPaginas));
      })
      .catch((err) => vigente && setError(mensajeDe(err, 'No se pudieron cargar las cotizaciones.')))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [pagina, estado, busqueda, token, version]);

  const refrescar = useCallback(() => setVersion((v) => v + 1), []);

  /** Carga el detalle completo (líneas, stock actual) antes de editar o convertir. */
  async function conDetalle(id: number, accion: (c: Cotizacion) => void) {
    setOcupada(id);
    try {
      accion(await obtenerCotizacion(id, token));
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo cargar la cotización.'));
    } finally {
      setOcupada(null);
    }
  }

  async function descargarPdf(c: CotizacionResumen) {
    setOcupada(c.id);
    try {
      descargarArchivo(await descargarPdfCotizacion(c.id, token), `${c.numero}.pdf`);
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo generar el PDF.'));
    } finally {
      setOcupada(null);
    }
  }

  async function confirmarAnular() {
    if (!aAnular) return;
    setAnulando(true);
    try {
      await anularCotizacion(aAnular.id, token);
      toast.success(`${aAnular.numero} anulada`);
      setAAnular(null);
      refrescar();
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo anular la cotización.'));
    } finally {
      setAnulando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">Cotizaciones</h1>
          <p className="mt-1 text-sm text-text-muted">
            Ofertas con plazo. No descuentan inventario hasta que se convierten en venta.
          </p>
        </div>
        <Button
          variant="gold"
          onClick={() => {
            setEnEdicion(null);
            setDialogoAbierto(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Nueva cotización
        </Button>
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <Input
              value={busquedaInput}
              onChange={(e) => setBusquedaInput(e.target.value)}
              placeholder="Buscar por cliente o número..."
              className="pl-9"
              aria-label="Buscar cotización"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((e) => (
              <Button
                key={e.valor}
                type="button"
                size="sm"
                variant={estado === e.valor ? 'gold' : 'outline'}
                onClick={() => {
                  setEstado(e.valor);
                  setPagina(1);
                }}
              >
                {e.etiqueta}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-error-text/40 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
            {error}
          </div>
        )}

        {cargando ? (
          <div className="flex items-center gap-2 py-10 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            Cargando cotizaciones...
          </div>
        ) : datos.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">No hay cotizaciones para mostrar.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N.°</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Válida hasta</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.map((c) => {
                const editable = c.estado === 'Vigente' || c.estado === 'Vencida';
                const ocupadaEsta = ocupada === c.id;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.numero}</TableCell>
                    <TableCell>{c.nombreCliente ?? <span className="text-text-muted">Sin cliente</span>}</TableCell>
                    <TableCell>{c.empleadoNombre}</TableCell>
                    <TableCell className={c.estado === 'Vencida' ? 'text-error-text' : ''}>
                      {etiquetaDia(c.fechaVencimiento)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda.format(c.total)}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={c.estado} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {c.estado === 'Vigente' && (
                          <Button
                            size="sm"
                            variant="gold"
                            disabled={ocupadaEsta}
                            onClick={() => void conDetalle(c.id, setAConvertir)}
                          >
                            <ArrowRightLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                            Vender
                          </Button>
                        )}
                        {editable && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Editar ${c.numero}`}
                            disabled={ocupadaEsta}
                            onClick={() =>
                              void conDetalle(c.id, (det) => {
                                setEnEdicion(det);
                                setDialogoAbierto(true);
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={`Descargar PDF de ${c.numero}`}
                          disabled={ocupadaEsta}
                          onClick={() => void descargarPdf(c)}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        {editable && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Anular ${c.numero}`}
                            disabled={ocupadaEsta}
                            onClick={() => setAAnular(c)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between text-sm">
            <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-text-muted">
              Página {pagina} de {totalPaginas}
            </span>
            <Button size="sm" variant="outline" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        )}
      </Card>

      <CotizacionDialog
        open={dialogoAbierto}
        cotizacion={enEdicion}
        esAdmin={esAdmin}
        onOpenChange={setDialogoAbierto}
        onGuardada={refrescar}
      />

      <ConvertirCotizacionDialog cotizacion={aConvertir} onCerrar={() => setAConvertir(null)} onConvertida={refrescar} />

      <AlertDialog open={aAnular !== null} onOpenChange={(abierto) => !abierto && !anulando && setAAnular(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular la cotización {aAnular?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Quedará como anulada y ya no se podrá convertir en venta. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anulando}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={anulando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarAnular();
              }}
            >
              {anulando ? 'Anulando...' : 'Anular'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
