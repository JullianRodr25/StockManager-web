import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { cambiarMetodoPago } from '@/services/ventaService';
import type { DetallePagoRequest, MetodoPago, MetodoPagoVenta, VentaResumenResponse } from '@/types/ventas';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const OPCIONES: MetodoPagoVenta[] = ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto'];
const METODOS_INDIVIDUALES: MetodoPago[] = ['Efectivo', 'Tarjeta', 'Transferencia'];

// El estado guarda solo dígitos; se formatea con punto de miles únicamente al mostrar.
const formatoMiles = new Intl.NumberFormat('es-CO');
const aDigitos = (valor: string) => valor.replace(/\D/g, '');
const mostrarMiles = (digitos: string) => (digitos === '' ? '' : formatoMiles.format(Number(digitos)));

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
  const [metodo, setMetodo] = useState<MetodoPagoVenta>('Efectivo');
  const [recibido, setRecibido] = useState('');
  const [montosMixto, setMontosMixto] = useState<Record<MetodoPago, string>>({ Efectivo: '', Tarjeta: '', Transferencia: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!venta) return;
    const actual = OPCIONES.find((o) => o === venta.metodoPago) ?? 'Efectivo';
    setMetodo(actual);
    setRecibido(String(Math.round(venta.total)));
    setMontosMixto({ Efectivo: '', Tarjeta: '', Transferencia: '' });
    setGuardando(false);
  }, [venta]);

  const total = venta?.total ?? 0;

  const sumaMixto = useMemo(
    () => METODOS_INDIVIDUALES.reduce((acc, m) => acc + Number(montosMixto[m] || 0), 0),
    [montosMixto]
  );
  const diferencia = total - sumaMixto; // >0 falta, <0 sobra
  const lineasMixto: DetallePagoRequest[] = METODOS_INDIVIDUALES.filter((m) => Number(montosMixto[m] || 0) > 0).map(
    (m) => ({ metodoPago: m, monto: Number(montosMixto[m]) })
  );

  const efectivoInsuficiente = metodo === 'Efectivo' && Number(recibido || 0) < total;
  const mixtoInvalido = metodo === 'Mixto' && (lineasMixto.length < 2 || diferencia !== 0);
  const sinCambios = metodo === venta?.metodoPago && metodo !== 'Mixto' && metodo !== 'Efectivo';
  const puedeGuardar = !guardando && !efectivoInsuficiente && !mixtoInvalido && !sinCambios;

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    if (!venta || !puedeGuardar) return;
    setGuardando(true);
    try {
      await cambiarMetodoPago(
        venta.id,
        {
          metodoPago: metodo,
          montoRecibido: metodo === 'Efectivo' ? Number(recibido) : null,
          detallesPago: metodo === 'Mixto' ? lineasMixto : undefined,
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
          <div className="grid grid-cols-2 gap-2">
            {OPCIONES.map((opcion) => (
              <Button
                key={opcion}
                type="button"
                variant={metodo === opcion ? 'default' : 'outline'}
                className={cn('w-full')}
                onClick={() => setMetodo(opcion)}
              >
                {opcion === 'Mixto' ? 'Mixto (varios)' : opcion}
              </Button>
            ))}
          </div>

          {metodo === 'Efectivo' && (
            <div className="space-y-1">
              <Label htmlFor="cmp-recibido">Efectivo recibido</Label>
              <Input
                id="cmp-recibido"
                inputMode="numeric"
                value={mostrarMiles(recibido)}
                onChange={(e) => setRecibido(aDigitos(e.target.value))}
              />
              {efectivoInsuficiente ? (
                <p className="text-xs text-error-text">Debe cubrir el total ({formatoMoneda.format(total)}).</p>
              ) : (
                <p className="text-xs text-text-muted">Vuelta: {formatoMoneda.format(Number(recibido || 0) - total)}</p>
              )}
            </div>
          )}

          {metodo === 'Mixto' && (
            <div className="space-y-3">
              {METODOS_INDIVIDUALES.map((m) => (
                <div key={m} className="flex items-center gap-3">
                  <Label className="w-28 shrink-0" htmlFor={`cmp-${m}`}>
                    {m}
                  </Label>
                  <Input
                    id={`cmp-${m}`}
                    inputMode="numeric"
                    placeholder="0"
                    value={mostrarMiles(montosMixto[m])}
                    onChange={(e) => setMontosMixto((prev) => ({ ...prev, [m]: aDigitos(e.target.value) }))}
                  />
                </div>
              ))}
              <p className={cn('text-xs', diferencia === 0 && lineasMixto.length >= 2 ? 'text-text-muted' : 'text-error-text')}>
                {diferencia > 0 && `Faltan ${formatoMoneda.format(diferencia)}`}
                {diferencia < 0 && `Sobran ${formatoMoneda.format(-diferencia)}`}
                {diferencia === 0 && (lineasMixto.length >= 2 ? 'El desglose cuadra con el total.' : 'Usa al menos dos métodos.')}
              </p>
            </div>
          )}

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
