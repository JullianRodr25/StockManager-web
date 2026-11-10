import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { listarCotizaciones, obtenerCotizacion } from '@/services/cotizacionService';
import type { Cotizacion, CotizacionResumen } from '@/types/cotizaciones';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { etiquetaDia } from '@/utils/fechas';

interface TraerCotizacionDialogProps {
  open: boolean;
  /** True si la venta actual ya tiene productos: se avisa que traer la cotización la reemplaza. */
  reemplazaVentaActual: boolean;
  onOpenChange: (abierto: boolean) => void;
  onTraer: (cotizacion: Cotizacion) => void;
}

/** Busca una cotización vigente por número (COT-00012) o cliente y la entrega completa. */
export function TraerCotizacionDialog({ open, reemplazaVentaActual, onOpenChange, onTraer }: TraerCotizacionDialogProps) {
  const { token } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<CotizacionResumen[]>([]);
  const [cargando, setCargando] = useState(false);
  const [trayendo, setTrayendo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBusqueda('');
      setError(null);
    }
  }, [open]);

  // Solo vigentes: son las únicas que se pueden convertir. Con debounce al escribir.
  useEffect(() => {
    if (!open) return;
    let vigente = true;
    setCargando(true);
    const t = setTimeout(() => {
      listarCotizaciones({ estado: 'Vigente', busqueda: busqueda.trim(), pagina: 1, tamanoPagina: 20 }, token)
        .then((r) => vigente && setResultados(r.data))
        .catch((err) => vigente && setError(err instanceof ApiError ? err.message : 'No se pudieron buscar cotizaciones.'))
        .finally(() => vigente && setCargando(false));
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [open, busqueda, token]);

  async function traer(id: number) {
    setTrayendo(id);
    setError(null);
    try {
      onTraer(await obtenerCotizacion(id, token));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la cotización.');
    } finally {
      setTrayendo(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Traer cotización</DialogTitle>
          <DialogDescription>
            Carga sus productos, cliente y precios cotizados en la venta. Podrás ajustarla antes de cobrar.
            {reemplazaVentaActual && ' Esto reemplaza la venta que tienes armada.'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <Input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Número (COT-00012) o nombre del cliente..."
            className="pl-9"
            aria-label="Buscar cotización vigente"
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
            {error}
          </div>
        )}

        <div className="max-h-80 overflow-y-auto">
          {cargando ? (
            <div className="flex items-center gap-2 py-6 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Buscando...
            </div>
          ) : resultados.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">No hay cotizaciones vigentes con ese criterio.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {resultados.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy">
                      {c.numero} · {c.nombreCliente ?? 'Sin cliente'}
                    </p>
                    <p className="text-xs text-text-muted">
                      {c.cantidadLineas} producto(s) · válida hasta {etiquetaDia(c.fechaVencimiento)} ·{' '}
                      {formatoMoneda.format(c.total)}
                    </p>
                  </div>
                  <Button size="sm" variant="gold" disabled={trayendo !== null} onClick={() => void traer(c.id)}>
                    {trayendo === c.id && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    Traer
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
