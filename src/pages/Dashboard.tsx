import { TrendingUp, AlertTriangle, Truck, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// TODO: conectar a datos reales (endpoints de ventas, inventario, pedidos y créditos).
interface Kpi {
  label: string;
  value: string;
  icon: LucideIcon;
  colorClass: string;
}

const kpis: Kpi[] = [
  {
    label: 'Ventas de hoy',
    value: '$1,240,000',
    icon: TrendingUp,
    colorClass: 'text-green',
  },
  {
    label: 'Productos con stock bajo',
    value: '7',
    icon: AlertTriangle,
    colorClass: 'text-gold',
  },
  {
    label: 'Pedidos pendientes',
    value: '12',
    icon: Truck,
    colorClass: 'text-navy',
  },
  {
    label: 'Créditos por vencer',
    value: '3',
    icon: Clock,
    colorClass: 'text-error-text',
  },
];

// TODO: conectar a un feed real de actividad (auditoría de ventas, pedidos, etc.).
const actividadReciente = [
  'Venta registrada - Juan Pérez - hace 12 min',
  'Pedido #1042 marcado como recibido - hace 34 min',
  'Producto "Cemento gris 50kg" actualizado - hace 1 h',
  'Crédito de proveedor Ferrolux vence en 3 días - hace 2 h',
  'Nuevo cliente registrado - María Gómez - hace 3 h',
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, colorClass }) => (
          <Card key={label} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-text-muted">{label}</CardTitle>
              <Icon className={cn('h-5 w-5', colorClass)} />
            </CardHeader>
            <CardContent>
              <p className={cn('text-2xl font-heading font-bold', colorClass)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-navy">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {actividadReciente.map((linea, index) => (
              <li key={linea}>
                <p className="text-sm text-navy">{linea}</p>
                {index < actividadReciente.length - 1 && <Separator className="mt-3" />}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

