import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SeccionConfiguracion {
  id: string;
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
}

interface NavegacionConfiguracionProps {
  secciones: SeccionConfiguracion[];
  activa: string;
  onSeleccionar: (id: string) => void;
}

/**
 * Menú de secciones de Configuración. En escritorio es una columna con título y descripción
 * corta de cada sección; en pantallas angostas se vuelve una fila deslizable de chips para no
 * ocupar la mitad de la pantalla. Es presentacional: quien lo usa decide qué hay en cada sección.
 */
export function NavegacionConfiguracion({ secciones, activa, onSeleccionar }: NavegacionConfiguracionProps) {
  return (
    <nav
      aria-label="Secciones de configuración"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {secciones.map(({ id, titulo, descripcion, icono: Icono }) => {
        const esActiva = id === activa;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSeleccionar(id)}
            aria-current={esActiva ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
              esActiva
                ? 'border-gold bg-gold/10 text-navy'
                : 'border-transparent text-text-muted hover:bg-gold/5 hover:text-navy lg:py-3'
            )}
          >
            <Icono className={cn('h-5 w-5 shrink-0', esActiva && 'text-gold')} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{titulo}</span>
              <span className="hidden text-xs text-text-muted lg:block">{descripcion}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
