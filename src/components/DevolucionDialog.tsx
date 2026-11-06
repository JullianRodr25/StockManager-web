import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { obtenerDevolucionesDeVenta, registrarDevolucion } from '@/services/devolucionService';
import { obtenerProductos } from '@/services/inventarioService';
import { obtenerVentaPorId } from '@/services/ventaService';
import type { DevolucionResponse } from '@/types/devoluciones';
import type { Producto } from '@/types/inventario';
import type { MetodoPago, VentaResponse, VentaResumenResponse } from '@/types/ventas';
import { BuscadorProductos } from '@/components/BuscadorProductos';
import { formatoFecha, formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const METODOS: MetodoPago[] = ['Efectivo', 'Transferencia', 'Tarjeta'];
const PRODUCTOS_INICIALES = 40;

interface LineaCambio {
  producto: Producto;
  cantidad: number;
}

interface DevolucionDialogProps {
  /** Venta que se devuelve; null mantiene el diálogo cerrado. */
  venta: VentaResumenResponse | null;
  onCerrar: () => void;
  /** Se llama tras registrar la devolución, para que el listado refresque su estado. */
  onRegistrada: () => void;
}

/**
 * Devolución o cambio sobre una venta pagada. La venta original no se modifica: se registra un
 * documento nuevo con lo que vuelve (a su precio original) y, si aplica, lo que el cliente se
 * lleva a cambio (al precio de hoy). La diferencia se paga o se reembolsa con un método.
 */
export function DevolucionDialog({ venta, onCerrar, onRegistrada }: DevolucionDialogProps) {
  const { token } = useAuth();

  const [detalle, setDetalle] = useState<VentaResponse | null>(null);
  const [anteriores, setAnteriores] = useState<DevolucionResponse[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Cantidad a devolver por línea de la venta (texto, para permitir el campo vacío) y si vuelve al stock.
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [noReintegrar, setNoReintegrar] = useState<Record<number, boolean>>({});

  const [lineasCambio, setLineasCambio] = useState<LineaCambio[]>([]);
  // Carga inicial del catálogo para el buscador (igual que Ventas); al escribir, el buscador
  // consulta al servidor por nombre en todo el inventario.
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);

  const [motivo, setMotivo] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago | ''>('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const ventaId = venta?.id ?? null;

  // Al abrir con otra venta: se parte de cero y se cargan sus líneas y sus devoluciones anteriores.
  useEffect(() => {
    if (ventaId === null) return;
    setDetalle(null);
    setAnteriores([]);
    setErrorCarga(null);
    setCantidades({});
    setNoReintegrar({});
    setLineasCambio([]);
    setMotivo('');
    setMetodoPago('');
    setErrorEnvio(null);
    setCargando(true);

    let vigente = true;
    Promise.all([obtenerVentaPorId(ventaId, token), obtenerDevolucionesDeVenta(ventaId, token)])
      .then(([ventaDetalle, devoluciones]) => {
        if (!vigente) return;
        setDetalle(ventaDetalle);
        setAnteriores(devoluciones);
      })
      .catch((err) => {
        if (vigente) setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar la venta.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [ventaId, token]);

  useEffect(() => {
    if (ventaId === null) return;
    let vigente = true;
    setCargandoCatalogo(true);
    obtenerProductos(1, PRODUCTOS_INICIALES, token)
      .then((respuesta) => {
        if (vigente) setCatalogo(respuesta.data);
      })
      .catch(() => {
        if (vigente) setCatalogo([]);
      })
      .finally(() => {
        if (vigente) setCargandoCatalogo(false);
      });
    return () => {
      vigente = false;
    };
  }, [ventaId, token]);

  // Unidades ya devueltas de cada línea, sumando todas las devoluciones anteriores.
  const yaDevuelto = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const devolucion of anteriores) {
      for (const linea of devolucion.detalles) {
        if (linea.sentido === 'Devuelto' && linea.detalleVentaId !== null) {
          mapa.set(linea.detalleVentaId, (mapa.get(linea.detalleVentaId) ?? 0) + linea.cantidad);
        }
      }
    }
    return mapa;
  }, [anteriores]);

  const lineasDevueltas = useMemo(() => {
    if (!detalle) return [];
    return detalle.detalles
      .map((d) => ({ detalle: d, cantidad: Number.parseInt(cantidades[d.id] ?? '', 10) || 0 }))
      .filter((x) => x.cantidad > 0);
  }, [detalle, cantidades]);

  const totalDevuelto = lineasDevueltas.reduce((suma, x) => suma + x.cantidad * x.detalle.precioUnitario, 0);
  const totalCambio = lineasCambio.reduce((suma, x) => suma + x.cantidad * x.producto.precio, 0);
  const diferencia = totalCambio - totalDevuelto;
  const hayMovimientoDeDinero = lineasDevueltas.length > 0 && diferencia !== 0;

  function cambiarCantidad(detalleId: number, texto: string, maximo: number) {
    const limpio = texto.replace(/\D/g, '');
    const valor = limpio === '' ? '' : String(Math.min(Number(limpio), maximo));
    setCantidades((previo) => ({ ...previo, [detalleId]: valor }));
  }

  function agregarACambio(producto: Producto) {
    setLineasCambio((previo) => {
      const existente = previo.find((l) => l.producto.id === producto.id);
      if (existente) {
        return previo.map((l) =>
          l.producto.id === producto.id ? { ...l, cantidad: Math.min(l.cantidad + 1, producto.stockActual) } : l
        );
      }
      return [...previo, { producto, cantidad: 1 }];
    });
  }

  function cambiarCantidadCambio(productoId: number, texto: string) {
    const limpio = texto.replace(/\D/g, '');
    setLineasCambio((previo) =>
      previo.map((l) =>
        l.producto.id === productoId
          ? { ...l, cantidad: Math.min(Math.max(Number(limpio) || 1, 1), l.producto.stockActual) }
          : l
      )
    );
  }

  const motivoValido = motivo.trim() !== '';
  const puedeEnviar =
    !cargando && !enviando && detalle !== null && lineasDevueltas.length > 0 && motivoValido &&
    (!hayMovimientoDeDinero || metodoPago !== '');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!puedeEnviar || ventaId === null) return;

    setEnviando(true);
    setErrorEnvio(null);
    try {
      await registrarDevolucion(
        ventaId,
        {
          motivo: motivo.trim(),
          devueltas: lineasDevueltas.map((x) => ({
            detalleVentaId: x.detalle.id,
            cantidad: x.cantidad,
            reintegrarAlStock: !noReintegrar[x.detalle.id],
          })),
          cambio: lineasCambio.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
          metodoPago: hayMovimientoDeDinero && metodoPago !== '' ? metodoPago : undefined,
        },
        token
      );
      toast.success('Devolución registrada correctamente');
      onRegistrada();
      onCerrar();
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo registrar la devolución.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={venta !== null} onOpenChange={(abierto) => !abierto && !enviando && onCerrar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Devolver o cambiar</DialogTitle>
          <DialogDescription>
            Venta del {venta ? formatoFecha(venta.fecha) : ''}. La venta original no se modifica: queda un registro nuevo
            ligado a ella.
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center gap-2 py-6 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Cargando la venta...
          </div>
        )}

        {errorCarga && (
          <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
            {errorCarga}
          </div>
        )}

        {detalle && (
          <form onSubmit={handleSubmit} className="grid gap-5">
            {detalle.requiereFacturaElectronica && (
              <div className="rounded-md border border-gold bg-gold/10 px-3 py-2 text-sm text-navy">
                Esta venta tiene factura electrónica. Al registrar la devolución queda marcada como{' '}
                <strong>pendiente de nota crédito</strong>: acuérdate de emitirla ante la DIAN.
              </div>
            )}

            <section className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-navy">¿Qué devuelve el cliente?</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={enviando}
                  onClick={() => {
                    const todas: Record<number, string> = {};
                    for (const d of detalle.detalles) {
                      const disponible = d.cantidad - (yaDevuelto.get(d.id) ?? 0);
                      if (disponible > 0) todas[d.id] = String(disponible);
                    }
                    setCantidades(todas);
                  }}
                >
                  Devolver todo
                </Button>
              </div>
              <ul className="divide-y divide-border rounded-md border border-border">
                {detalle.detalles.map((d) => {
                  const disponible = d.cantidad - (yaDevuelto.get(d.id) ?? 0);
                  const cantidadActual = Number.parseInt(cantidades[d.id] ?? '', 10) || 0;
                  return (
                    <li key={d.id} className="grid gap-2 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-navy">{d.productoNombre}</p>
                          <p className="text-xs text-text-muted">
                            Vendido {d.cantidad} × {formatoMoneda.format(d.precioUnitario)}
                            {d.cantidad - disponible > 0 && ` · ya devuelto ${d.cantidad - disponible}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9"
                            aria-label={`Devolver todas las unidades de ${d.productoNombre}`}
                            disabled={disponible <= 0 || enviando}
                            onClick={() => cambiarCantidad(d.id, String(disponible), disponible)}
                          >
                            Todo
                          </Button>
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="h-9 w-20 text-center"
                            aria-label={`Cantidad a devolver de ${d.productoNombre}`}
                            placeholder={disponible > 0 ? `0 – ${disponible}` : '—'}
                            disabled={disponible <= 0 || enviando}
                            value={cantidades[d.id] ?? ''}
                            onChange={(e) => cambiarCantidad(d.id, e.target.value, disponible)}
                          />
                        </div>
                      </div>
                      {cantidadActual > 0 && (
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-muted">
                          <Checkbox
                            checked={!!noReintegrar[d.id]}
                            onCheckedChange={(valor) =>
                              setNoReintegrar((previo) => ({ ...previo, [d.id]: valor === true }))
                            }
                          />
                          No devolver al inventario (dañado o inservible)
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="grid gap-2">
              <h3 className="text-sm font-semibold text-navy">Se lleva a cambio (opcional)</h3>
              <BuscadorProductos
                variante="integrado"
                productos={catalogo}
                cargandoProductos={cargandoCatalogo}
                errorProductos={null}
                token={token}
                onSeleccionarProducto={agregarACambio}
                disabled={enviando}
                placeholder="Buscar producto por nombre o escanear código..."
                autoFocus={false}
              />

              {lineasCambio.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {lineasCambio.map((l) => (
                    <li key={l.producto.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-navy">{l.producto.nombre}</p>
                        <p className="text-xs text-text-muted">
                          {formatoMoneda.format(l.producto.precio)} c/u · {formatoMoneda.format(l.producto.precio * l.cantidad)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="w-16 text-center"
                          aria-label={`Cantidad de ${l.producto.nombre}`}
                          value={String(l.cantidad)}
                          disabled={enviando}
                          onChange={(e) => cambiarCantidadCambio(l.producto.id, e.target.value)}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Quitar ${l.producto.nombre}`}
                          disabled={enviando}
                          onClick={() => setLineasCambio((previo) => previo.filter((x) => x.producto.id !== l.producto.id))}
                        >
                          <Trash2 className="h-4 w-4 text-error-text" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex items-center gap-1 text-xs text-text-muted">
                <Plus className="h-3 w-3" /> Se cobra al precio de hoy. Para un cambio de precio, devuelve la línea y agrégala
                de nuevo.
              </p>
            </section>

            <section className="grid gap-2">
              <Label htmlFor="motivoDevolucion">Motivo</Label>
              <Input
                id="motivoDevolucion"
                value={motivo}
                maxLength={200}
                placeholder="Ej: no le sirvió, medida equivocada, defectuoso"
                disabled={enviando}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </section>

            <section className="grid gap-3 rounded-md border border-border bg-background px-3 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Devuelve</span>
                <span className="font-medium text-navy">{formatoMoneda.format(totalDevuelto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Se lleva a cambio</span>
                <span className="font-medium text-navy">{formatoMoneda.format(totalCambio)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base">
                <span className="font-semibold text-navy">
                  {lineasDevueltas.length === 0 || diferencia === 0
                    ? 'Diferencia'
                    : diferencia > 0
                      ? 'El cliente paga'
                      : 'Se le reembolsa'}
                </span>
                <span
                  className={cn(
                    'font-semibold',
                    diferencia === 0 || lineasDevueltas.length === 0 ? 'text-navy' : diferencia > 0 ? 'text-navy' : 'text-error-text'
                  )}
                >
                  {lineasDevueltas.length === 0 ? '—' : diferencia === 0 ? 'Sin diferencia' : formatoMoneda.format(Math.abs(diferencia))}
                </span>
              </div>

              {hayMovimientoDeDinero && (
                <div className="grid gap-2">
                  <Label>{diferencia > 0 ? 'Con qué paga el cliente' : 'Con qué se le reembolsa'}</Label>
                  <div role="group" className="flex flex-wrap gap-2">
                    {METODOS.map((metodo) => (
                      <Button
                        key={metodo}
                        type="button"
                        size="sm"
                        variant={metodoPago === metodo ? 'gold' : 'outline'}
                        aria-pressed={metodoPago === metodo}
                        disabled={enviando}
                        onClick={() => setMetodoPago(metodo)}
                      >
                        {metodo}
                      </Button>
                    ))}
                  </div>
                  {metodoPago === 'Efectivo' && (
                    <p className="text-xs text-text-muted">El efectivo entra o sale del cajón: necesitas tu caja abierta.</p>
                  )}
                </div>
              )}
            </section>

            {errorEnvio && (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorEnvio}
              </div>
            )}

            {anteriores.length > 0 && (
              <section className="grid gap-2">
                <h3 className="text-sm font-semibold text-navy">Devoluciones anteriores de esta venta</h3>
                <ul className="divide-y divide-border rounded-md border border-border text-sm">
                  {anteriores.map((d) => (
                    <li key={d.id} className="grid gap-0.5 px-3 py-2">
                      <div className="flex justify-between gap-3">
                        <span className="font-medium text-navy">{formatoFecha(d.fecha)}</span>
                        <span className="text-navy">{formatoMoneda.format(d.totalDevuelto)}</span>
                      </div>
                      <p className="text-xs text-text-muted">
                        {d.motivo}
                        {d.nombreEmpleado && ` · ${d.nombreEmpleado}`}
                        {d.requiereNotaCredito && ' · pendiente de nota crédito'}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={!puedeEnviar}>
                {enviando ? 'Registrando...' : 'Registrar devolución'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
