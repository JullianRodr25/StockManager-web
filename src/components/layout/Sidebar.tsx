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
import { useBorradorVenta } from '@/context/BorradorVentaContext';
import { useAuth } from '@/context/AuthContext';
import { useLogo } from '@/context/LogoContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ROLES_CONSULTA_INVENTARIO, ROLES_OPERATIVOS } from '@/utils/permisos';
import type { RolUsuario } from '@/types/auth';

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
  /** Roles que ven este módulo; por defecto, solo los que operan el negocio. */
  roles?: RolUsuario[];
}

const modulos: ModuloNav[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  {
    label: 'Inventario',
    to: '/inventario',
    icon: Package,
    roles: ROLES_CONSULTA_INVENTARIO,
    children: [
      { label: 'Productos', to: '/inventario' },
      { label: 'Etiquetas pendientes', to: '/inventario/etiquetas', soloAdmin: true },
    ],
  },
  {
    label: 'Ventas',
    to: '/ventas',
    icon: ShoppingCart,
    children: [
      { label: 'Nueva venta', to: '/ventas' },
      { label: 'Cuentas Abiertas', to: '/ventas/fiado' },
      { label: 'Historial de ventas', to: '/ventas/historial' },
    ],
  },
  { label: 'Pedidos', to: '/pedidos', icon: Truck },
  { label: 'Clientes', to: '/clientes', icon: Users },
  {
    label: 'Proveedores',
    to: '/proveedores',
    icon: Building2,
    children: [
      { label: 'Proveedores', to: '/proveedores' },
      { label: 'Cuentas por pagar', to: '/proveedores/cuentas-por-pagar' },
    ],
  },
  { label: 'Reportes', to: '/reportes', icon: BarChart3 },
  { label: 'Configuración', to: '/configuracion', icon: Settings },
];

function Marca({ compact = false }: { compact?: boolean }) {
  // Usa el logo configurado en Configuración (o el predeterminado de la ferretería si nadie
  // subió uno propio); antes esta insignia era un "FG" fijo que nunca reflejaba el logo real.
  const { logoUrl } = useLogo();
  return (
    <div className={cn('flex items-center gap-3 px-6 py-6', compact && 'px-4 py-5')}>
      <img
        src={logoUrl}
        alt="Logo de la empresa"
        className="h-9 w-9 shrink-0 rounded-full border-2 border-gold object-cover"
      />
      <span className="font-heading text-sm font-semibold tracking-wide text-white">
        Ferretería Gold
      </span>
    </div>
  );
}

const navLinkClasses = (isActive: boolean) =>
  cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none',
    isActive ? 'bg-gold/10 text-gold' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  );

// Insignia que avisa que hay una venta a medio hacer (ver BorradorVentaContext), para que quien
// salió a crear un producto sepa que puede volver a ella.
function InsigniaVentaEnCurso({ cantidad }: { cantidad: number }) {
  if (cantidad === 0) return null;
  return (
    <span
      className="ml-auto rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold leading-none text-brand-navy"
      title="Tienes una venta en curso"
      aria-label={`Venta en curso con ${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}`}
    >
      {cantidad}
    </span>
  );
}

function SidebarNav() {
  const location = useLocation();
  const { usuario } = useAuth();
  const modulosVisibles = modulos.filter((modulo) =>
    (modulo.roles ?? ROLES_OPERATIVOS).some((rol) => rol === usuario?.rol)
  );
  const [carritoEnCurso] = useBorradorVenta<unknown[]>('carrito', []);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({
    '/inventario': location.pathname.startsWith('/inventario'),
    '/ventas': location.pathname.startsWith('/ventas'),
    '/proveedores': location.pathname.startsWith('/proveedores'),
  });

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {modulosVisibles.map(({ label, to, icon: Icon, children }) => {
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
                {label === 'Ventas' && !abierto && <InsigniaVentaEnCurso cantidad={carritoEnCurso.length} />}
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
                        isActive ? 'text-gold' : 'text-slate-400 hover:text-white'
                      )
                    }
                  >
                    <Tags className="h-3.5 w-3.5 shrink-0" />
                    {subItem.label}
                    {subItem.to === '/ventas' && <InsigniaVentaEnCurso cantidad={carritoEnCurso.length} />}
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
      <aside className="hidden w-60 shrink-0 flex-col bg-brand-navy md:flex">
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
