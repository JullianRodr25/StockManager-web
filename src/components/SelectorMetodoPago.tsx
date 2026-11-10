import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { DetallePagoRequest, MetodoPago, MetodoPagoVenta } from '@/types/ventas';

const OPCIONES: MetodoPagoVenta[] = ['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto'];
export const METODOS_INDIVIDUALES: MetodoPago[] = ['Efectivo', 'Tarjeta', 'Transferencia'];

// El estado guarda solo dígitos; el punto de miles es solo de presentación.
const formatoMiles = new Intl.NumberFormat('es-CO');
const aDigitos = (valor: string) => valor.replace(/\D/g, '');
const mostrarMiles = (digitos: string) => (digitos === '' ? '' : formatoMiles.format(Number(digitos)));

/** Cómo se está pagando una venta: método, efectivo recibido y, si es Mixto, el monto de cada método. */
export interface PagoVentaEstado {
  metodo: MetodoPagoVenta;
  /** Efectivo entregado (solo dígitos); relevante si el método es Efectivo. */
  recibido: string;
  montosMixto: Record<MetodoPago, string>;
}

export function pagoInicial(total: number, metodo: MetodoPagoVenta = 'Efectivo'): PagoVentaEstado {
  return {
    metodo,
    recibido: String(Math.round(total)),
    montosMixto: { Efectivo: '', Tarjeta: '', Transferencia: '' },
  };
}

export interface PagoEvaluado {
  /** El pago cumple las mismas reglas que valida el servidor (efectivo suficiente, Mixto cuadrado). */
  valido: boolean;
  metodoPago: MetodoPagoVenta;
  montoRecibido: number | null;
  detallesPago: DetallePagoRequest[] | undefined;
  /** En Mixto: >0 falta, <0 sobra. */
  diferenciaMixto: number;
}

/**
 * Traduce el estado de la pantalla a lo que se envía al servidor y dice si ya es válido.
 * La validación definitiva es la del servidor; esto solo evita viajes inútiles.
 */
export function evaluarPago(pago: PagoVentaEstado, total: number): PagoEvaluado {
  const lineas: DetallePagoRequest[] = METODOS_INDIVIDUALES.filter((m) => Number(pago.montosMixto[m] || 0) > 0).map(
    (m) => ({ metodoPago: m, monto: Number(pago.montosMixto[m]) })
  );
  const suma = lineas.reduce((acc, l) => acc + l.monto, 0);
  const diferenciaMixto = total - suma;

  const valido =
    pago.metodo === 'Efectivo'
      ? Number(pago.recibido || 0) >= total
      : pago.metodo === 'Mixto'
        ? lineas.length >= 2 && diferenciaMixto === 0
        : true;

  return {
    valido,
    metodoPago: pago.metodo,
    montoRecibido: pago.metodo === 'Efectivo' ? Number(pago.recibido || 0) : null,
    detallesPago: pago.metodo === 'Mixto' ? lineas : undefined,
    diferenciaMixto,
  };
}

interface SelectorMetodoPagoProps {
  total: number;
  value: PagoVentaEstado;
  onChange: (valor: PagoVentaEstado) => void;
  disabled?: boolean;
  /** Prefijo para los id de los campos, por si hay más de un selector en pantalla. */
  idBase?: string;
}

/**
 * Selector de método de pago reutilizable: Efectivo (con vuelta), Tarjeta, Transferencia y
 * Mixto (con desglose que debe sumar el total). Lo usan el cambio de método de una venta y la
 * conversión de una cotización en venta.
 */
export function SelectorMetodoPago({ total, value, onChange, disabled, idBase = 'pago' }: SelectorMetodoPagoProps) {
  const evaluado = evaluarPago(value, total);
  const efectivoInsuficiente = value.metodo === 'Efectivo' && !evaluado.valido;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {OPCIONES.map((opcion) => (
          <Button
            key={opcion}
            type="button"
            variant={value.metodo === opcion ? 'default' : 'outline'}
            className={cn('w-full')}
            disabled={disabled}
            onClick={() => onChange({ ...value, metodo: opcion })}
          >
            {opcion === 'Mixto' ? 'Mixto (varios)' : opcion}
          </Button>
        ))}
      </div>

      {value.metodo === 'Efectivo' && (
        <div className="space-y-1">
          <Label htmlFor={`${idBase}-recibido`}>Efectivo recibido</Label>
          <Input
            id={`${idBase}-recibido`}
            inputMode="numeric"
            value={mostrarMiles(value.recibido)}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, recibido: aDigitos(e.target.value) })}
          />
          {efectivoInsuficiente ? (
            <p className="text-xs text-error-text">Debe cubrir el total ({formatoMoneda.format(total)}).</p>
          ) : (
            <p className="text-xs text-text-muted">Vuelta: {formatoMoneda.format(Number(value.recibido || 0) - total)}</p>
          )}
        </div>
      )}

      {value.metodo === 'Mixto' && (
        <div className="space-y-3">
          {METODOS_INDIVIDUALES.map((m) => (
            <div key={m} className="flex items-center gap-3">
              <Label className="w-28 shrink-0" htmlFor={`${idBase}-${m}`}>
                {m}
              </Label>
              <Input
                id={`${idBase}-${m}`}
                inputMode="numeric"
                placeholder="0"
                value={mostrarMiles(value.montosMixto[m])}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...value, montosMixto: { ...value.montosMixto, [m]: aDigitos(e.target.value) } })
                }
              />
            </div>
          ))}
          <p className={cn('text-xs', evaluado.valido ? 'text-text-muted' : 'text-error-text')}>
            {evaluado.diferenciaMixto > 0 && `Faltan ${formatoMoneda.format(evaluado.diferenciaMixto)}`}
            {evaluado.diferenciaMixto < 0 && `Sobran ${formatoMoneda.format(-evaluado.diferenciaMixto)}`}
            {evaluado.diferenciaMixto === 0 &&
              (evaluado.valido ? 'El desglose cuadra con el total.' : 'Usa al menos dos métodos.')}
          </p>
        </div>
      )}
    </div>
  );
}
