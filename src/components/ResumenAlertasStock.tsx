import { cn } from '@/lib/utils';

export type FiltroAlertaStock = 'agotado' | 'bajo';

interface ResumenAlertasStockProps {
  agotados: number;
  stockBajo: number;
  filtro: FiltroAlertaStock | null;
  onCambiarFiltro: (filtro: FiltroAlertaStock | null) => void;
}

interface ChipProps {
  cantidad: number;
  etiqueta: string;
  activo: boolean;
  onClick: () => void;
  colores: { punto: string; borde: string; fondo: string; texto: string };
}

function Chip({ cantidad, etiqueta, activo, onClick, colores }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        colores.borde,
        colores.texto,
        activo ? colores.fondo.replace('/10', '/25') : colores.fondo
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', colores.punto)} aria-hidden="true" />
      {cantidad} {etiqueta}
    </button>
  );
}

/**
 * Resumen de productos que necesitan reposición. Cada chip filtra la tabla a esos productos al
 * hacer clic (y vuelve a la vista normal al hacer clic otra vez). No se muestra cuando todo el
 * inventario está en orden, para no ocupar espacio con un "0" que no pide ninguna acción.
 */
export function ResumenAlertasStock({ agotados, stockBajo, filtro, onCambiarFiltro }: ResumenAlertasStockProps) {
  if (agotados === 0 && stockBajo === 0) return null;

  const alternar = (valor: FiltroAlertaStock) => onCambiarFiltro(filtro === valor ? null : valor);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {agotados > 0 && (
        <Chip
          cantidad={agotados}
          etiqueta={agotados === 1 ? 'agotado' : 'agotados'}
          activo={filtro === 'agotado'}
          onClick={() => alternar('agotado')}
          colores={{
            punto: 'bg-error-text',
            borde: 'border-error-text/50',
            fondo: 'bg-error-bg/10',
            texto: 'text-error-text',
          }}
        />
      )}
      {stockBajo > 0 && (
        <Chip
          cantidad={stockBajo}
          etiqueta="con stock bajo"
          activo={filtro === 'bajo'}
          onClick={() => alternar('bajo')}
          colores={{
            punto: 'bg-gold',
            borde: 'border-gold/50',
            fondo: 'bg-gold/10',
            texto: 'text-gold',
          }}
        />
      )}
      <span className="text-sm text-text-muted">
        {filtro ? 'Mostrando solo esos productos. Haz clic de nuevo para ver todos.' : 'Haz clic para ver solo esos productos.'}
      </span>
    </div>
  );
}
