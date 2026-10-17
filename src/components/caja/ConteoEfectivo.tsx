import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Input } from '@/components/ui/input';
import {
  GRUPOS_DENOMINACIONES,
  calcularContado,
  cantidadNumerica,
} from '@/utils/denominaciones';
import type { CantidadesPorDenominacion } from '@/utils/denominaciones';

interface ConteoEfectivoProps {
  cantidades: CantidadesPorDenominacion;
  onCambiarCantidad: (denominacion: number, texto: string) => void;
  deshabilitado?: boolean;
}

/**
 * Conteo físico del efectivo: una fila por denominación con "valor × cantidad = subtotal" y el
 * total contado abajo. Es controlado: el estado vive en quien lo usa, que es también quien
 * arma la petición de cierre.
 */
export function ConteoEfectivo({ cantidades, onCambiarCantidad, deshabilitado }: ConteoEfectivoProps) {
  const total = calcularContado(cantidades);

  return (
    <div className="space-y-4">
      {GRUPOS_DENOMINACIONES.map((grupo) => (
        <div key={grupo.titulo} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{grupo.titulo}</h4>
          {grupo.denominaciones.map(({ valor, etiqueta }) => {
            const cantidad = cantidadNumerica(cantidades[valor]);
            return (
              <div
                key={valor}
                className="grid grid-cols-[1fr_14px_64px_14px_110px] items-center gap-2 text-sm"
              >
                <span className="text-navy">{etiqueta}</span>
                <span className="text-center text-text-muted" aria-hidden="true">×</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={cantidades[valor] ?? ''}
                  placeholder="0"
                  disabled={deshabilitado}
                  onChange={(e) => onCambiarCantidad(valor, e.target.value)}
                  aria-label={`Cantidad de ${etiqueta}`}
                  className="sin-flechas h-9 px-2 text-center"
                />
                <span className="text-center text-text-muted" aria-hidden="true">=</span>
                <span className="text-right font-medium tabular-nums text-navy">
                  {formatoMoneda.format(valor * cantidad)}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      <div className="flex items-baseline justify-between border-t border-border pt-3">
        <span className="text-sm font-semibold text-navy">Total contado</span>
        <span className="text-lg font-bold tabular-nums text-navy">{formatoMoneda.format(total)}</span>
      </div>
    </div>
  );
}
