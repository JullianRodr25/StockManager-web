import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useReporte } from '@/hooks/useReporte';
import { obtenerReporteProductosVendidos } from '@/services/reporteService';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { descargarCsv } from '@/utils/csv';
import { rangoMesActual } from '@/utils/fechas';
import type { RangoFechas } from '@/utils/fechas';
import { BotonExportar, CuerpoReporte, SelectorRango, TituloSeccion } from './comun';

export function ReporteProductos() {
  const { token } = useAuth();
  const [rango, setRango] = useState<RangoFechas>(rangoMesActual);
  const { datos, cargando, error } = useReporte(
    () => obtenerReporteProductosVendidos(rango.desde, rango.hasta, token),
    [rango.desde, rango.hasta, token]
  );

  function exportar() {
    if (!datos) return;
    descargarCsv(
      `productos_vendidos_${datos.desde}_a_${datos.hasta}.csv`,
      ['Producto', 'Categoría', 'Unidades', 'Ingresos', 'Utilidad estimada'],
      datos.productos.map((p) => [p.nombre, p.categoria, p.unidades, p.ingresos, p.utilidadEstimada])
    );
  }

  return (
    <div className="space-y-4">
      <SelectorRango rango={rango} onCambio={setRango} />
      <CuerpoReporte cargando={cargando} error={error} vacio={!datos || datos.productos.length === 0}>
        {datos && (
          <Card className="space-y-3 p-4">
            <TituloSeccion accion={<BotonExportar onClick={exportar} />}>Productos más vendidos</TituloSeccion>
            <p className="text-xs text-text-muted">
              Ordenados por ingresos. La utilidad es estimada: usa el costo actual del producto, no el del día de la venta.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Utilidad est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.productos.map((p) => (
                  <TableRow key={p.productoId}>
                    <TableCell className="font-medium">{p.nombre}</TableCell>
                    <TableCell className="text-text-muted">{p.categoria}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.unidades}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda.format(p.ingresos)}</TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${p.utilidadEstimada < 0 ? 'text-error-text' : ''}`}
                    >
                      {formatoMoneda.format(p.utilidadEstimada)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </CuerpoReporte>
    </div>
  );
}
