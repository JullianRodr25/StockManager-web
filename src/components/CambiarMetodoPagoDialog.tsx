import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { cambiarMetodoPago } from '@/services/ventaService';
import type { MetodoPagoVenta, VentaResumenResponse } from '@/types/ventas';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { evaluarPago, pagoInicial, SelectorMetodoPago } from '@/components/SelectorMetodoPago';
import type { PagoVentaEstado } from '@/components/SelectorMetodoPago';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const METODOS: MetodoPagoVenta[] = ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto'];

interface CambiarMetodoPagoDialogProps {
  /** Venta a corregir; null mantiene el diálogo cerrado. */
  venta: VentaResumenResponse | null;
  onCerrar: () => void;
  /** Se llama tras guardar, para que el listado refresque su estado. */
  onCambiado: () => void;
}

/**
 * Corrige el método de pago de una venta pagada (incluye "Mixto"). El backend solo lo permite
 * el mismo día de la venta; el botón que abre este diálogo ya se oculta fuera de esa ventana,
 * pero la validación definitiva es la del servidor.
 */
export function CambiarMetodoPagoDialog({ venta, onCerrar, onCambiado }: CambiarMetodoPagoDialogProps) {
  const { token } = useAuth();
  const [pago, setPago] = useState<PagoVentaEstado>(pagoInicial(0));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!venta) return;
    const actual = METODOS.find((m) => m === venta.metodoPago) ?? 'Efectivo';
    setPago(pagoInicial(venta.total, actual));
    setGuardando(false);
  }, [venta]);

  const total = venta?.total ?? 0;
  const evaluado = evaluarPago(pago, total);
  // Sin cambios reales solo si deja un método simple igual al actual (en Efectivo/Mixto
  // pueden cambiar el monto recibido o el desglose, así que sí es un cambio).
  const sinCambios = pago.metodo === venta?.metodoPago && pago.metodo !== 'Mixto' && pago.metodo !== 'Efectivo';
  const puedeGuardar = !guardando && evaluado.valido && !sinCambios;

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    if (!venta || !puedeGuardar) return;
    setGuardando(true);
    try {
      await cambiarMetodoPago(
        venta.id,
        {
          metodoPago: evaluado.metodoPago,
          montoRecibido: evaluado.montoRecibido,
          detallesPago: evaluado.detallesPago,
        },
        token
      );
      toast.success('Método de pago actualizado');
      onCambiado();
      onCerrar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo cambiar el método de pago');
      setGuardando(false);
    }
  }

  return (
    <Dialog open={venta !== null} onOpenChange={(abierto) => !abierto && !guardando && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar método de pago</DialogTitle>
          <DialogDescription>
            {venta ? `Factura ${venta.numeroFactura || venta.id} · ${formatoMoneda.format(total)} · actual: ${venta.metodoPago}` : ''}
            . Solo se puede corregir el mismo día de la venta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={manejarEnvio} className="space-y-4">
          <SelectorMetodoPago total={total} value={pago} onChange={setPago} disabled={guardando} idBase="cmp" />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!puedeGuardar}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
