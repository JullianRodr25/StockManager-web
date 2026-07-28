import { Menu, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// TODO: conectar a datos reales de alertas (backorders + créditos por vencer).
const ALERTAS_PENDIENTES = 3;

const TITULOS_POR_RUTA: Record<string, string> = {
  '/': 'Dashboard',
  '/inventario': 'Inventario',
  '/inventario/etiquetas': 'Etiquetas pendientes',
  '/ventas': 'Ventas',
  '/pedidos': 'Pedidos',
  '/clientes': 'Clientes',
  '/proveedores': 'Proveedores',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
};

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
  const location = useLocation();
  const titulo = TITULOS_POR_RUTA[location.pathname] ?? 'StockManager';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5 text-navy" />
          <span className="sr-only">Abrir menú</span>
        </Button>
        <h1 className="font-heading text-lg font-semibold text-navy">{titulo}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5 text-navy" />
            <span className="sr-only">Alertas</span>
          </Button>
          {ALERTAS_PENDIENTES > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[0.65rem]"
            >
              {ALERTAS_PENDIENTES}
            </Badge>
          )}
        </div>

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
                <p className="text-sm font-semibold text-navy">{usuario?.nombre}</p>
                <p className="text-xs text-text-muted">{usuario?.rol}</p>
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
