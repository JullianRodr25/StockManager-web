import { Loader2, Printer } from 'lucide-react';
import type { VentaResponse } from '@/types/ventas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const formatoMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function formatoFecha(fecha: string): string {
  return new Date(fecha).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function nombreComprador(venta: { nombreComprador: string | null; clienteId: number | null }): string {
  if (venta.nombreComprador) return venta.nombreComprador;
  if (venta.clienteId) return `Cliente #${venta.clienteId}`;
  return '—';
}

export function BadgeEstado({ estado }: { estado: string }) {
  const normalizado = estado.trim().toLowerCase();
  if (normalizado === 'pagada') {
    return <Badge className="border-transparent bg-green/10 text-green">Pagada</Badge>;
  }
  if (normalizado === 'pendiente') {
    return <Badge className="border-transparent bg-gold/10 text-gold">Pendiente</Badge>;
  }
  if (normalizado === 'cancelada') {
    return <Badge className="border-transparent bg-error-bg text-error-text">Cancelada</Badge>;
  }
  return <Badge variant="outline">{estado}</Badge>;
}

interface DetalleFacturaDialogProps {
  venta: VentaResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetalleFacturaDialog({ venta, open, onOpenChange }: DetalleFacturaDialogProps) {
  function handleImprimir() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de venta</DialogTitle>
        </DialogHeader>

        {!venta ? (
          <div className="py-8 text-center text-text-muted">
            <Loader2 className="mx-auto h-5 w-5 animate-spin motion-reduce:animate-none" />
          </div>
        ) : (
          <>
            <div id="factura-para-imprimir" className="space-y-5">
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-navy font-heading text-sm font-bold tracking-wide text-gold">
                    FG
                  </div>
                  <div>
                    <p className="font-heading text-lg font-semibold text-navy">Ferretería Gold</p>
                    <p className="text-sm text-text-muted">Factura {venta.numeroFactura}</p>
                  </div>
                </div>
                <BadgeEstado estado={venta.estado} />
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                <div className="space-y-1.5">
                  <p>
                    <span className="text-text-muted">Fecha: </span>
                    <span className="text-navy">{formatoFecha(venta.fecha)}</span>
                  </p>
                  <p>
                    <span className="text-text-muted">Comprador: </span>
                    <span className="text-navy">{nombreComprador(venta)}</span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p>
                    <span className="text-text-muted">Método de pago: </span>
                    <span className="text-navy">{venta.metodoPago}</span>
                  </p>
                  {venta.telefonoComprador && (
                    <p>
                      <span className="text-text-muted">Teléfono: </span>
                      <span className="text-navy">{venta.telefonoComprador}</span>
                    </p>
                  )}
                  {venta.emailComprador && (
                    <p>
                      <span className="text-text-muted">Correo: </span>
                      <span className="text-navy">{venta.emailComprador}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Precio unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {venta.detalles.map((linea) => (
                      <TableRow key={linea.productoId}>
                        <TableCell className="text-navy">{linea.productoNombre}</TableCell>
                        <TableCell className="text-navy">{linea.cantidad}</TableCell>
                        <TableCell className="text-navy">{formatoMoneda.format(linea.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium text-navy">
                          {formatoMoneda.format(linea.subtotalConIva)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end border-t border-border pt-4">
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-text-muted">Total</p>
                  <p className="text-2xl font-bold text-navy">{formatoMoneda.format(venta.total)}</p>
                </div>
              </div>

              <p className="text-center text-xs text-text-muted">
                Gracias por su compra — Ferretería Gold
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="gold" onClick={handleImprimir}>
                <Printer className="h-4 w-4" />
                Imprimir factura
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
