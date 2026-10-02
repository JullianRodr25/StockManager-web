import { useLogo } from '@/context/LogoContext';
import { cn } from '@/lib/utils';

interface PantallaCargaLogoProps {
  /**
   * 'completa': overlay de pantalla completa (fixed, por encima de todo). Pensado para el único
   * momento en que toda la app bloquea sin nada en pantalla: la verificación de sesión inicial
   * en RutaProtegida.
   * 'en-linea': versión más chica para insertar dentro del contenido de una página mientras esta
   * carga sus propios datos (reemplaza los spinners sueltos de Loader2).
   */
  variante?: 'completa' | 'en-linea';
  /** Texto opcional debajo del logo, p. ej. "Cargando inventario...". */
  mensaje?: string;
  className?: string;
}

/**
 * Pantalla/indicador de carga con el logo de la marca (configurable desde Configuración vía
 * LogoContext), en vez del spinner genérico de Lucide. El logo "respira" (pulse) dentro de un
 * anillo dorado que gira; ambas animaciones respetan prefers-reduced-motion.
 */
export function PantallaCargaLogo({ variante = 'en-linea', mensaje, className }: PantallaCargaLogoProps) {
  const { logoUrl } = useLogo();
  const esCompleta = variante === 'completa';

  const tamanoAnillo = esCompleta ? 'h-20 w-20' : 'h-14 w-14';
  const tamanoLogo = esCompleta ? 'h-14 w-14' : 'h-9 w-9';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        esCompleta ? 'fixed inset-0 z-50 bg-background' : 'py-10',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn('relative flex items-center justify-center', tamanoAnillo)}>
        <span
          className="absolute inset-0 animate-spin rounded-full border-2 border-gold/20 border-t-gold motion-reduce:animate-none"
          aria-hidden="true"
        />
        <img
          src={logoUrl}
          alt="Ferretería Gold"
          className={cn('animate-pulse rounded-full object-cover motion-reduce:animate-none', tamanoLogo)}
        />
      </div>
      {mensaje && <p className="text-sm text-text-muted">{mensaje}</p>}
      <span className="sr-only">Cargando...</span>
    </div>
  );
}
