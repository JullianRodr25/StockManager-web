import { useAuth } from '@/context/AuthContext';
import { useReporte } from '@/hooks/useReporte';
import { obtenerReporteInventario } from '@/services/reporteService';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { descargarCsv } from '@/utils/csv';
import { hoyColombia } from '@/utils/fechas';
import { BotonExportar, CuerpoReporte, Kpi, TituloSeccion } from './comun';

export function ReporteInventario() {
  const { token } = useAuth();
  const { datos, cargando, error } = useReporte(() => obtenerReporteInventario(token), [token]);

  function exportarStockBajo() {
    if (!datos) return;
    descargarCsv(
      `stock_bajo_${hoyColombia()}.csv`,
      ['Producto', 'Categoría', 'Stock actual', 'Stock mínimo', 'Faltante'],
      datos.productosStockBajo.map((p) => [p.nombre, p.categoria, p.stockActual, p.stockMinimo, p.faltante])
    );
  }

  return (
    <CuerpoReporte cargando={cargando} error={error} vacio={!datos}>
      {datos && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi etiqueta="Productos activos" valor={String(datos.productosActivos)} />
            <Kpi etiqueta="Valor a costo" valor={formatoMoneda.format(datos.valorCosto)} destacado ayuda="Lo invertido en stock" />
            <Kpi etiqueta="Valor a precio de venta" valor={formatoMoneda.format(datos.valorVenta)} />
            <Kpi etiqueta="Stock bajo / agotados" valor={`${datos.stockBajo} / ${datos.agotados}`} ayuda="Para reponer" />
          </div>

          <Card className="space-y-3 p-4">
            <TituloSeccion>Valor por categoría</TituloSeccion>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Valor a costo</TableHead>
                  <TableHead className="text-right">Valor a precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.porCategoria.map((c) => (
                  <TableRow key={c.categoria}>
                    <TableCell className="font-medium">{c.categoria}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.productos}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.unidades}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda.format(c.valorCosto)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoMoneda.format(c.valorVenta)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="space-y-3 p-4">
            <TituloSeccion
              accion={<BotonExportar onClick={exportarStockBajo} disabled={datos.productosStockBajo.length === 0} />}
            >
              Productos para reponer
            </TituloSeccion>
            {datos.productosStockBajo.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-muted">Ningún producto por debajo de su stock mínimo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">Faltante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.productosStockBajo.map((p) => (
                    <TableRow key={p.productoId}>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      <TableCell className="text-text-muted">{p.categoria}</TableCell>
                      <TableCell className={`text-right tabular-nums ${p.stockActual <= 0 ? 'text-error-text' : ''}`}>
                        {p.stockActual}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.stockMinimo}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{p.faltante}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </CuerpoReporte>
  );
}
