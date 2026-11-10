import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { convertirCotizacion } from '@/services/cotizacionService';
import type { Cotizacion } from '@/types/cotizaciones';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { evaluarPago, pagoInicial, SelectorMetodoPago } from '@/components/SelectorMetodoPago';
import type { PagoVentaEstado } from '@/components/SelectorMetodoPago';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ConvertirCotizacionDialogProps {
  /** Cotización a convertir; null mantiene el diálogo cerrado. */
  cotizacion: Cotizacion | null;
  onCerrar: () => void;
  onConvertida: () => void;
}

/**
 * Convierte una cotización vigente en una venta cobrada. Las líneas, el cliente y los precios
 * salen de la cotización (se respeta lo ofrecido); aquí solo se cobra. El servidor descuenta el
 * stock y rechaza todo, sin cambios, si falta inventario.
 */
export function ConvertirCotizacionDialog({ cotizacion, onCerrar, onConvertida }: ConvertirCotizacionDialogProps) {
  const { token } = useAuth();
  const [pago, setPago] = useState<PagoVentaEstado>(pagoInicial(0));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cotizacion) return;
    setPago(pagoInicial(cotizacion.total));
    setGuardando(false);
    setError(null);
  }, [cotizacion]);

  const total = cotizacion?.total ?? 0;
  const evaluado = evaluarPago(pago, total);
  const sinStock = cotizacion?.lineas.filter((l) => l.stockDisponible < l.cantidad) ?? [];
  const conPrecioDistinto = cotizacion?.lineas.filter((l) => l.precioActual !== l.precioUnitario) ?? [];

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    if (!cotizacion || guardando || !evaluado.valido) return;
    setGuardando(true);
    setError(null);
    try {
      const venta = await convertirCotizacion(
        cotizacion.id,
        { metodoPago: evaluado.metodoPago, montoRecibido: evaluado.montoRecibido, detallesPago: evaluado.detallesPago },
        token
      );
      toast.success(`Venta registrada (factura ${venta.numeroFactura})`);
      onConvertida();
      onCerrar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo convertir la cotización en venta.');
      setGuardando(false);
    }
  }

  return (
    <Dialog open={cotizacion !== null} onOpenChange={(abierto) => !abierto && !guardando && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convertir en venta</DialogTitle>
          <DialogDescription>
            {cotizacion ? `${cotizacion.numero} · ${cotizacion.nombreCliente ?? 'Sin cliente'} · ${formatoMoneda.format(total)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={manejarEnvio} className="space-y-4">
          <p className="text-sm text-text-muted">
            Se vende a los precios cotizados y se descuenta el inventario. Elige cómo paga el cliente.
          </p>

          {conPrecioDistinto.length > 0 && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-text-muted">
              El precio de lista cambió en {conPrecioDistinto.length} producto(s); se respeta el cotizado.
            </p>
          )}

          {sinStock.length > 0 && (
            <div className="flex gap-2 rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Stock insuficiente ahora:</p>
                <ul className="list-disc pl-4">
                  {sinStock.map((l) => (
                    <li key={l.productoId}>
                      {l.productoNombre}: pides {l.cantidad}, hay {l.stockDisponible}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <SelectorMetodoPago total={total} value={pago} onChange={setPago} disabled={guardando} idBase="conv" />

          {error && (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={guardando || !evaluado.valido || sinStock.length > 0}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cobrar y vender
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
