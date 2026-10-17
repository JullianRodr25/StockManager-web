import { useSearchParams } from 'react-router-dom';
import { Banknote, BarChart3, Boxes, PackageSearch } from 'lucide-react';
import { NavegacionConfiguracion } from '@/components/NavegacionConfiguracion';
import type { SeccionConfiguracion } from '@/components/NavegacionConfiguracion';
import { ReporteCartera } from '@/components/reportes/ReporteCartera';
import { ReporteInventario } from '@/components/reportes/ReporteInventario';
import { ReporteProductos } from '@/components/reportes/ReporteProductos';
import { ReporteVentas } from '@/components/reportes/ReporteVentas';

// Informes disponibles. El selector reutiliza el menú de tarjetas de Configuración: misma
// interacción (elegir una tarjeta, el contenido cambia al lado) y la selección vive en la URL.
const INFORMES: SeccionConfiguracion[] = [
  { id: 'ventas', titulo: 'Ventas', descripcion: 'Total, ticket promedio y métodos de pago', icono: BarChart3 },
  { id: 'productos', titulo: 'Productos vendidos', descripcion: 'Lo que más ingresa y su utilidad', icono: PackageSearch },
  { id: 'inventario', titulo: 'Inventario', descripcion: 'Valor del stock y qué reponer', icono: Boxes },
  { id: 'cartera', titulo: 'Cartera', descripcion: 'Por cobrar a clientes y por pagar', icono: Banknote },
];

export function Reportes() {
  const [parametros, setParametros] = useSearchParams();
  const activo = INFORMES.some((i) => i.id === parametros.get('informe'))
    ? (parametros.get('informe') as string)
    : INFORMES[0].id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">Reportes</h1>
        <p className="mt-1 text-sm text-text-muted">Informes del negocio. Fechas en hora de Colombia.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <NavegacionConfiguracion
          secciones={INFORMES}
          activa={activo}
          onSeleccionar={(id) => setParametros({ informe: id })}
        />
        <div className="min-w-0">
          {activo === 'ventas' && <ReporteVentas />}
          {activo === 'productos' && <ReporteProductos />}
          {activo === 'inventario' && <ReporteInventario />}
          {activo === 'cartera' && <ReporteCartera />}
        </div>
      </div>
    </div>
  );
}
