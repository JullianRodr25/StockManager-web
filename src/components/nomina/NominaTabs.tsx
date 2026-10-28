import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const PESTANAS = [
  { etiqueta: 'Quincena', to: '/nomina' },
  { etiqueta: 'Trabajadores', to: '/nomina/trabajadores' },
  { etiqueta: 'Préstamos', to: '/nomina/prestamos' },
];

/** Pestañas que enlazan las tres pantallas del módulo de nómina. */
export function NominaTabs() {
  return (
    <nav aria-label="Secciones de nómina" className="flex gap-1 overflow-x-auto border-b border-border">
      {PESTANAS.map((pestana) => (
        <NavLink
          key={pestana.to}
          to={pestana.to}
          end
          className={({ isActive }) =>
            cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-gold text-foreground'
                : 'border-transparent text-text-muted hover:text-foreground'
            )
          }
        >
          {pestana.etiqueta}
        </NavLink>
      ))}
    </nav>
  );
}
