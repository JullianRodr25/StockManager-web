import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  BarChart3,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface ModuloNav {
  label: string;
  to: string;
  icon: LucideIcon;
}

const modulos: ModuloNav[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Inventario', to: '/inventario', icon: Package },
  { label: 'Ventas', to: '/ventas', icon: ShoppingCart },
  { label: 'Pedidos', to: '/pedidos', icon: Truck },
  { label: 'Clientes', to: '/clientes', icon: Users },
  { label: 'Proveedores', to: '/proveedores', icon: Building2 },
  { label: 'Reportes', to: '/reportes', icon: BarChart3 },
  { label: 'Configuración', to: '/configuracion', icon: Settings },
];

function Marca({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 px-6 py-6', compact && 'px-4 py-5')}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-navy font-heading text-sm font-extrabold text-gold">
        FG
      </div>
      <span className="font-heading text-sm font-semibold tracking-wide text-background">
        Ferretería Gold
      </span>
    </div>
  );
}

function SidebarNav() {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {modulos.map(({ label, to, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none',
              isActive
                ? 'bg-gold/10 text-gold'
                : 'text-slate-300 hover:bg-white/5 hover:text-background'
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 flex-col bg-navy md:flex">
        <Marca />
        <SidebarNav />
      </aside>

      {/* Mobile */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="flex w-64 flex-col">
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            <Marca compact />
          </SheetHeader>
          <SidebarNav />
        </SheetContent>
      </Sheet>
    </>
  );
}
