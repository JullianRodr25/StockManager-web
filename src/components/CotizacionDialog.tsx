import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { actualizarCotizacion, crearCotizacion } from '@/services/cotizacionService';
import { obtenerProductos } from '@/services/inventarioService';
import type { Cotizacion } from '@/types/cotizaciones';
import type { Producto } from '@/types/inventario';
import { BuscadorCliente } from '@/components/BuscadorCliente';
import { BuscadorProductos } from '@/components/BuscadorProductos';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hoyColombia, sumarDias } from '@/utils/fechas';

/** Plazo que se sugiere al crear una cotización (días desde hoy); el usuario puede cambiarlo. */
const PLAZO_PREDETERMINADO_DIAS = 8;
const PRODUCTOS_INICIALES = 40;

interface LineaEditable {
  productoId: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  precioLista: number;
}

interface CotizacionDialogProps {
  open: boolean;
  /** null = cotización nueva. */
  cotizacion: Cotizacion | null;
  /** Solo un Admin puede cotizar a un precio distinto al de lista. */
  esAdmin: boolean;
  onOpenChange: (abierto: boolean) => void;
  onGuardada: (cotizacion: Cotizacion) => void;
}

/**
 * Crea o edita una cotización: cliente (registrado o solo nombre), plazo, productos con
 * cantidad, y notas. Una cotización vencida se puede editar: cambiar el plazo la reactiva.
 */
export function CotizacionDialog({ open, cotizacion, esAdmin, onOpenChange, onGuardada }: CotizacionDialogProps) {
  const { token } = useAuth();
  const [cliente, setCliente] = useState<{ id: number; nombre: string } | null>(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [vence, setVence] = useState('');
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<LineaEditable[]>([]);
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setGuardando(false);
    if (cotizacion) {
      setCliente(cotizacion.clienteId ? { id: cotizacion.clienteId, nombre: cotizacion.nombreCliente ?? '' } : null);
      setNombre(cotizacion.clienteId ? '' : (cotizacion.nombreCliente ?? ''));
      setTelefono(cotizacion.clienteId ? '' : (cotizacion.telefonoCliente ?? ''));
      // Si ya venció, se propone un plazo nuevo en vez de dejar uno en el pasado.
      const hoy = hoyColombia();
      setVence(cotizacion.fechaVencimiento < hoy ? sumarDias(hoy, PLAZO_PREDETERMINADO_DIAS) : cotizacion.fechaVencimiento);
      setNotas(cotizacion.notas ?? '');
      setLineas(
        cotizacion.lineas.map((l) => ({
          productoId: l.productoId,
          nombre: l.productoNombre,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          precioLista: l.precioActual,
        }))
      );
    } else {
      setCliente(null);
      setNombre('');
      setTelefono('');
      setVence(sumarDias(hoyColombia(), PLAZO_PREDETERMINADO_DIAS));
      setNotas('');
      setLineas([]);
    }
  }, [open, cotizacion]);

  // Carga inicial del catálogo para el buscador (igual que en Ventas); al escribir, el buscador
  // consulta al servidor por nombre en todo el inventario.
  useEffect(() => {
    if (!open) return;
    let vigente = true;
    setCargandoCatalogo(true);
    obtenerProductos(1, PRODUCTOS_INICIALES, token)
      .then((r) => vigente && setCatalogo(r.data))
      .catch(() => vigente && setCatalogo([]))
      .finally(() => vigente && setCargandoCatalogo(false));
    return () => {
      vigente = false;
    };
  }, [open, token]);

  const total = useMemo(() => lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0), [lineas]);

  function agregarProducto(producto: Producto) {
    setLineas((actuales) => {
      const existente = actuales.find((l) => l.productoId === producto.id);
      if (existente) {
        return actuales.map((l) => (l.productoId === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l));
      }
      return [
        ...actuales,
        { productoId: producto.id, nombre: producto.nombre, cantidad: 1, precioUnitario: producto.precio, precioLista: producto.precio },
      ];
    });
  }

  function cambiarLinea(productoId: number, cambios: Partial<LineaEditable>) {
    setLineas((actuales) => actuales.map((l) => (l.productoId === productoId ? { ...l, ...cambios } : l)));
  }

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    if (lineas.length === 0) {
      setError('Agrega al menos un producto.');
      return;
    }
    if (!vence || vence < hoyColombia()) {
      setError('El plazo no puede estar en el pasado.');
      return;
    }
    if (lineas.some((l) => l.cantidad <= 0 || l.precioUnitario <= 0)) {
      setError('Revisa las cantidades y los precios: deben ser mayores a 0.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const datos = {
        clienteId: cliente?.id ?? null,
        nombreCliente: cliente ? null : nombre.trim() || null,
        telefonoCliente: cliente ? null : telefono.trim() || null,
        fechaVencimiento: vence,
        notas: notas.trim() || null,
        lineas: lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
      };
      const guardada = cotizacion
        ? await actualizarCotizacion(cotizacion.id, datos, token)
        : await crearCotizacion(datos, token);
      toast.success(cotizacion ? 'Cotización actualizada' : `Cotización ${guardada.numero} creada`);
      onGuardada(guardada);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la cotización.');
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !guardando && onOpenChange(abierto)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cotizacion ? `Editar ${cotizacion.numero}` : 'Nueva cotización'}</DialogTitle>
          <DialogDescription>
            {cotizacion?.estado === 'Vencida'
              ? 'Esta cotización venció. Cambia el plazo para volver a activarla.'
              : 'Es una oferta con plazo: no descuenta inventario ni registra dinero hasta que se convierta en venta.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={manejarEnvio} className="space-y-5">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <BuscadorCliente token={token} seleccionado={cliente} onSeleccionar={(c) => setCliente(c ? { id: c.id, nombre: c.nombre } : null)} disabled={guardando} />
            {!cliente && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="…o solo el nombre (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} disabled={guardando} />
                <Input placeholder="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={50} disabled={guardando} />
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="cot-vence">Válida hasta</Label>
            <Input id="cot-vence" type="date" min={hoyColombia()} value={vence} onChange={(e) => setVence(e.target.value)} disabled={guardando} className="w-full sm:w-48" />
          </div>

          <div className="space-y-2">
            <Label>Productos</Label>
            <BuscadorProductos
              variante="integrado"
              productos={catalogo}
              cargandoProductos={cargandoCatalogo}
              errorProductos={null}
              token={token}
              onSeleccionarProducto={agregarProducto}
              disabled={guardando}
              placeholder="Buscar producto por nombre o escanear código..."
              autoFocus={false}
            />

            {lineas.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-text-muted">
                Aún no hay productos en la cotización.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {lineas.map((l) => (
                  <li key={l.productoId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy">{l.nombre}</p>
                      {l.precioUnitario !== l.precioLista && (
                        <p className="text-xs text-text-muted">Lista hoy: {formatoMoneda.format(l.precioLista)}</p>
                      )}
                    </div>
                    <Input
                      type="number"
                      min={1}
                      aria-label={`Cantidad de ${l.nombre}`}
                      className="w-20"
                      value={l.cantidad}
                      disabled={guardando}
                      onChange={(e) => cambiarLinea(l.productoId, { cantidad: Math.max(0, Math.floor(Number(e.target.value))) })}
                    />
                    {esAdmin ? (
                      <Input
                        type="number"
                        min={1}
                        aria-label={`Precio de ${l.nombre}`}
                        className="w-28"
                        value={l.precioUnitario}
                        disabled={guardando}
                        onChange={(e) => cambiarLinea(l.productoId, { precioUnitario: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="w-28 text-right text-sm tabular-nums text-navy">{formatoMoneda.format(l.precioUnitario)}</span>
                    )}
                    <span className="w-28 text-right text-sm font-medium tabular-nums text-navy">
                      {formatoMoneda.format(l.cantidad * l.precioUnitario)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Quitar ${l.nombre}`}
                      disabled={guardando}
                      onClick={() => setLineas((a) => a.filter((x) => x.productoId !== l.productoId))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-right text-base font-bold text-navy">Total: {formatoMoneda.format(total)}</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cot-notas">Notas (opcional)</Label>
            <textarea
              id="cot-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={guardando}
              placeholder="Condiciones, tiempo de entrega, observaciones…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cotizacion ? 'Guardar cambios' : 'Crear cotización'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
