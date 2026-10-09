import { Loader2 } from 'lucide-react';
import { formatoFecha, formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { diasAbierta, estaVencida, iniciales, saldoPendiente, textoAntiguedad } from '@/utils/cuentasAbiertas';
import type { VentaResumenResponse } from '@/types/ventas';

interface TarjetaCuentaAbiertaProps {
  cuenta: VentaResumenResponse;
  nombre: string;
  cargando: boolean;
  deshabilitada: boolean;
  onContinuar: (cuenta: VentaResumenResponse) => void;
}

export function TarjetaCuentaAbierta({ cuenta, nombre, cargando, deshabilitada, onContinuar }: TarjetaCuentaAbiertaProps) {
  const dias = diasAbierta(cuenta.fecha);
  const vencida = estaVencida(cuenta);
  const saldo = saldoPendiente(cuenta);
  const avance = cuenta.total > 0 ? Math.min((cuenta.totalAbonado / cuenta.total) * 100, 100) : 0;

  return (
    <article className="grid grid-cols-1 items-center gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-[44px_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
      <div
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-sm font-semibold text-gold"
      >
        {iniciales(nombre)}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium text-navy">{nombre}</h3>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              vencida ? 'bg-error-bg text-error-text' : 'bg-green/15 text-green'
            )}
          >
            {vencida ? 'Vencida' : 'Al día'}
          </span>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Abierta el {formatoFecha(cuenta.fecha)} · {textoAntiguedad(dias)}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex justify-between text-xs text-text-muted">
          <span>Abonado {formatoMoneda.format(cuenta.totalAbonado)}</span>
          <span>Total {formatoMoneda.format(cuenta.total)}</span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-label="Avance de pago"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(avance)}
        >
          <div className="h-full rounded-full bg-gold" style={{ width: `${avance}%` }} />
        </div>
        <p className="mt-1.5 text-sm">
          <span className="text-text-muted">Saldo pendiente </span>
          <span className="font-semibold text-navy">{formatoMoneda.format(saldo)}</span>
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="border-gold text-gold hover:bg-gold/10"
        onClick={() => onContinuar(cuenta)}
        disabled={deshabilitada}
        aria-label={`Continuar la cuenta de ${nombre}`}
      >
        {cargando && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
        Continuar
      </Button>
    </article>
  );
}
