import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  HandCoins,
  Truck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { obtenerResumenDashboard } from '@/services/dashboardService';
import type { DashboardResumen } from '@/types/dashboard';

interface Kpi {
  label: string;
  value: string;
  icon: LucideIcon;
  colorClass: string;
}

function construirKpisPrincipales(resumen: DashboardResumen): Kpi[] {
  return [
    {
      label: 'Ventas de hoy',
      value: `${formatoMoneda.format(resumen.ventasHoyTotal)} (${resumen.ventasHoyCantidad})`,
      icon: TrendingUp,
      colorClass: 'text-green',
    },
    {
      label: 'Productos con stock bajo',
      value: String(resumen.productosStockBajo),
      icon: AlertTriangle,
      colorClass: 'text-gold',
    },
    {
      label: 'Pedidos activos',
      value: String(resumen.pedidosActivos),
      icon: Truck,
      colorClass: 'text-navy',
    },
    {
      label: 'Cuentas por pagar por vencer',
      value: String(resumen.cuentasPorPagarPorVencer),
      icon: Clock,
      colorClass: 'text-error-text',
    },
  ];
}

function construirKpisSecundarios(resumen: DashboardResumen): Kpi[] {
  return [
    {
      label: 'Por cobrar (fiados abiertos)',
      value: `${formatoMoneda.format(resumen.totalPorCobrarFiado)} (${resumen.clientesConFiadoAbierto})`,
      icon: HandCoins,
      colorClass: 'text-green',
    },
    {
      label: 'Por pagar a proveedores',
      value: formatoMoneda.format(resumen.totalPorPagarProveedores),
      icon: Wallet,
      colorClass: 'text-error-text',
    },
    {
      label: 'Clientes activos',
      value: String(resumen.clientesActivos),
      icon: Users,
      colorClass: 'text-navy',
    },
  ];
}

function formatearFechaActividad(fechaIso: string): string {
  return new Date(fechaIso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function TarjetaKpi({ label, value, icon: Icon, colorClass }: Kpi) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-text-muted">{label}</CardTitle>
        <Icon className={cn('h-5 w-5', colorClass)} />
      </CardHeader>
      <CardContent>
        <p className={cn('text-2xl font-heading font-bold', colorClass)}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { token } = useAuth();
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const datos = await obtenerResumenDashboard(token);
        if (!cancelado) setResumen(datos);
      } catch {
        if (!cancelado) setError('No se pudieron cargar las estadísticas del Dashboard.');
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [token]);

  if (cargando) {
    return <p className="text-sm text-text-muted">Cargando estadísticas...</p>;
  }

  if (error || !resumen) {
    return <p className="text-sm text-error-text">{error ?? 'No se pudieron cargar las estadísticas.'}</p>;
  }

  const kpisPrincipales = construirKpisPrincipales(resumen);
  const kpisSecundarios = construirKpisSecundarios(resumen);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpisPrincipales.map((kpi) => (
          <TarjetaKpi key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpisSecundarios.map((kpi) => (
          <TarjetaKpi key={kpi.label} {...kpi} />
        ))}
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-navy">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {resumen.actividadReciente.length === 0 ? (
            <p className="text-sm text-text-muted">Todavía no hay actividad registrada.</p>
          ) : (
            <ul className="space-y-3">
              {resumen.actividadReciente.map((item, index) => (
                <li key={`${item.fecha}-${index}`}>
                  <p className="text-sm text-navy">
                    {item.descripcion} —{' '}
                    <span className="text-text-muted">{formatearFechaActividad(item.fecha)}</span>
                  </p>
                  {index < resumen.actividadReciente.length - 1 && <Separator className="mt-3" />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
