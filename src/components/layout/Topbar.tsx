import { Menu, Moon, Sun } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NotificacionesBell } from './NotificacionesBell';
import { esOperativo, etiquetaDeRol } from '@/utils/permisos';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const TITULOS_POR_RUTA: Record<string, string> = {
  '/': 'Dashboard',
  '/inventario': 'Inventario',
  '/inventario/etiquetas': 'Etiquetas pendientes',
  '/ventas': 'Ventas',
  '/ventas/fiado': 'Cuentas abiertas',
  '/ventas/historial': 'Historial de ventas',
  '/caja': 'Caja',
  '/pedidos': 'Pedidos',
  '/clientes': 'Clientes',
  '/proveedores': 'Proveedores',
  '/proveedores/cuentas-por-pagar': 'Cuentas por pagar',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
};

// Texto pequeño en mayúsculas sobre el título (sección a la que pertenece la pantalla).
const SECCION_POR_PREFIJO: Array<[string, string]> = [
  ['/inventario', 'Inventario'],
  ['/ventas', 'Ventas'],
  ['/caja', 'Operación'],
  ['/pedidos', 'Operación'],
  ['/clientes', 'Operación'],
  ['/proveedores', 'Proveedores'],
  ['/reportes', 'Administración'],
  ['/configuracion', 'Administración'],
];

function seccionDeRuta(pathname: string): string {
  return SECCION_POR_PREFIJO.find(([prefijo]) => pathname.startsWith(prefijo))?.[1] ?? 'Principal';
}

function obtenerIniciales(nombre: string | undefined): string {
  if (!nombre) return '??';
  const partes = nombre.trim().split(/\s+/);
  const iniciales = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? '');
  return iniciales.join('') || '??';
}

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { usuario, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const titulo = TITULOS_POR_RUTA[location.pathname] ?? 'StockManager';
  const seccion = seccionDeRuta(location.pathname);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--glass-border)] bg-[var(--sidebar-bg)] px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5 text-foreground" />
          <span className="sr-only">Abrir menú</span>
        </Button>
        <div className="flex flex-col">
          <span className="etiqueta-mono text-[10px] text-text-muted">{seccion}</span>
          <h1 className="font-heading text-lg font-extrabold leading-tight text-foreground">{titulo}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5 text-foreground" /> : <Moon className="h-5 w-5 text-foreground" />}
        </Button>

        {/* Las notificaciones internas son del personal operativo; el rol de consulta no las recibe. */}
        {esOperativo(usuario?.rol) && <NotificacionesBell />}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{obtenerIniciales(usuario?.nombre)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold text-foreground">{usuario?.nombre}</p>
                <p className="text-xs text-text-muted">{etiquetaDeRol(usuario?.rol)}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-error-text focus:text-error-text">
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
