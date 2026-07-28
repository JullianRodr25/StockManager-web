import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  BarChart3,
  Settings,
  ChevronDown,
  Tags,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface SubModuloNav {
  label: string;
  to: string;
  soloAdmin?: boolean;
}

interface ModuloNav {
  label: string;
  to: string;
  icon: LucideIcon;
  children?: SubModuloNav[];
}

const modulos: ModuloNav[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  {
    label: 'Inventario',
    to: '/inventario',
    icon: Package,
    children: [
      { label: 'Productos', to: '/inventario' },
      { label: 'Etiquetas pendientes', to: '/inventario/etiquetas', soloAdmin: true },
    ],
  },
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

const navLinkClasses = (isActive: boolean) =>
  cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none',
    isActive ? 'bg-gold/10 text-gold' : 'text-slate-300 hover:bg-white/5 hover:text-background'
  );

function SidebarNav() {
  const location = useLocation();
  const { usuario } = useAuth();
  const [expandido, setExpandido] = useState<Record<string, boolean>>({
    '/inventario': location.pathname.startsWith('/inventario'),
  });

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {modulos.map(({ label, to, icon: Icon, children }) => {
        if (!children) {
          return (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => navLinkClasses(isActive)}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          );
        }

        const subItemsVisibles = children.filter((item) => !item.soloAdmin || usuario?.rol === 'Admin');
        const abierto = expandido[to] ?? false;

        return (
          <div key={to}>
            <div className={navLinkClasses(location.pathname === to)}>
              <NavLink to={to} className="flex flex-1 items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
              <button
                type="button"
                onClick={() => setExpandido((prev) => ({ ...prev, [to]: !abierto }))}
                className="rounded p-0.5 hover:bg-white/10"
                aria-label={abierto ? `Contraer ${label}` : `Expandir ${label}`}
                aria-expanded={abierto}
              >
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform motion-reduce:transition-none', abierto && 'rotate-180')}
                />
              </button>
            </div>

            {abierto && (
              <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-white/10 pl-4">
                {subItemsVisibles.map((subItem) => (
                  <NavLink
                    key={subItem.to}
                    to={subItem.to}
                    end
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors motion-reduce:transition-none',
                        isActive ? 'text-gold' : 'text-slate-400 hover:text-background'
                      )
                    }
                  >
                    <Tags className="h-3.5 w-3.5 shrink-0" />
                    {subItem.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
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
