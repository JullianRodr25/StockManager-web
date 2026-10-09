import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { DIAS_CUENTA_VENCIDA, estaVencida, saldoPendiente } from '@/utils/cuentasAbiertas';
import type { VentaResumenResponse } from '@/types/ventas';
import { cn } from '@/lib/utils';

interface ResumenCuentasAbiertasProps {
  cuentas: VentaResumenResponse[];
}

function Indicador({ titulo, valor, detalle, alerta = false }: { titulo: string; valor: string; detalle?: string; alerta?: boolean }) {
  return (
    <div className={cn('rounded-lg border px-5 py-4', alerta ? 'border-error-text/40 bg-error-bg' : 'border-border bg-card')}>
      <p className={cn('text-xs font-medium uppercase tracking-wide', alerta ? 'text-error-text' : 'text-text-muted')}>
        {titulo}
      </p>
      <p className={cn('mt-1 text-2xl font-semibold', alerta ? 'text-error-text' : 'text-navy')}>{valor}</p>
      {detalle && <p className={cn('mt-0.5 text-xs', alerta ? 'text-error-text' : 'text-text-muted')}>{detalle}</p>}
    </div>
  );
}

/** Tres cifras de un vistazo: cuántas cuentas hay, cuánto se debe y cuánto está vencido. */
export function ResumenCuentasAbiertas({ cuentas }: ResumenCuentasAbiertasProps) {
  const porCobrar = cuentas.reduce((acumulado, cuenta) => acumulado + saldoPendiente(cuenta), 0);
  const vencidas = cuentas.filter((cuenta) => estaVencida(cuenta));
  const saldoVencido = vencidas.reduce((acumulado, cuenta) => acumulado + saldoPendiente(cuenta), 0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Indicador titulo="Cuentas abiertas" valor={String(cuentas.length)} />
      <Indicador titulo="Por cobrar" valor={formatoMoneda.format(porCobrar)} />
      <Indicador
        titulo={`Vencidas (más de ${DIAS_CUENTA_VENCIDA} días)`}
        valor={vencidas.length === 0 ? 'Ninguna' : `${vencidas.length} · ${formatoMoneda.format(saldoVencido)}`}
        alerta={vencidas.length > 0}
      />
    </div>
  );
}
