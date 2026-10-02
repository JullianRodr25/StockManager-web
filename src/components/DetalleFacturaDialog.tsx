import { useEffect, useState } from 'react';
import { Loader2, Printer, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useLogo } from '@/context/LogoContext';
import { obtenerConfiguracion } from '@/services/configuracionService';
import { debeAbrirCajon, imprimirRecibo } from '@/services/impresionService';
import type { DatosEmpresaTiquete } from '@/services/impresionService';
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
  const { token } = useAuth();
  const { logoUrl } = useLogo();
  const [nombreImpresora, setNombreImpresora] = useState<string | null>(null);
  const [datosEmpresa, setDatosEmpresa] = useState<DatosEmpresaTiquete | null>(null);
  const [imprimiendoTiquete, setImprimiendoTiquete] = useState(false);

  // Base e IVA segregados para el resumen final de la factura: se derivan sumando el
  // desglose por línea que ya trae cada detalle (ver VentaService), nunca recalculando el
  // IVA acá — así el resumen siempre coincide exactamente con lo que se cobró.
  const valorBase = venta?.detalles.reduce((acumulado, linea) => acumulado + linea.subtotalSinIva, 0) ?? 0;
  const valorIva = venta?.detalles.reduce((acumulado, linea) => acumulado + linea.iva, 0) ?? 0;

  // Se consulta el nombre de la impresora configurada solo cuando el diálogo se abre (no en
  // cada render), y solo una vez: si no hay impresora configurada, el botón de tiquete
  // físico simplemente no se muestra, en vez de mostrar un botón que siempre fallaría.
  useEffect(() => {
    if (!open || nombreImpresora !== null) return;
    obtenerConfiguracion(token)
      .then((config) => {
        setNombreImpresora(config.nombreImpresoraTickets);
        setDatosEmpresa({
          nombreEmpresa: config.nombreEmpresa,
          nitEmpresa: config.nitEmpresa,
          direccionEmpresa: config.direccionEmpresa,
          telefonoEmpresa: config.telefonoEmpresa,
          emailEmpresa: config.emailEmpresa,
        });
      })
      .catch(() => {
        // Si no se pudo consultar la configuración, simplemente no se ofrece el botón de
        // impresión física; el resto del diálogo (factura en pantalla) sigue funcionando.
      });
  }, [open, nombreImpresora, token]);

  function handleImprimir() {
    window.print();
  }

  async function handleImprimirTiquete() {
    if (!venta || !nombreImpresora) return;
    setImprimiendoTiquete(true);
    try {
      await imprimirRecibo(venta, nombreImpresora, datosEmpresa ?? {
        nombreEmpresa: null,
        nitEmpresa: null,
        direccionEmpresa: null,
        telefonoEmpresa: null,
        emailEmpresa: null,
      });
      toast.success(
        debeAbrirCajon(venta) ? 'Tiquete enviado a la impresora y cajón abierto' : 'Tiquete enviado a la impresora'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir el tiquete.');
    } finally {
      setImprimiendoTiquete(false);
    }
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
                  {/* Antes era un bloque "FG" fijo que nunca mostraba el logo real de
                      Configuración; ahora usa el mismo logo que ya se ve en Login y en el
                      menú lateral, así la factura en pantalla queda consistente con el resto
                      de la app. */}
                  <img
                    src={logoUrl}
                    alt="Logo de la empresa"
                    className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                  />
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

              {venta.requiereFacturaElectronica && (
                <div className="flex flex-col gap-1 rounded-md border border-gold bg-gold/10 px-3 py-2 text-sm text-navy">
                  <p className="font-semibold">
                    Factura electrónica solicitada
                    {venta.estadoFacturaElectronica === 'Pendiente' && ' — pendiente de envío a la DIAN'}
                    {venta.estadoFacturaElectronica === 'Transmitida' && ' — transmitida a la DIAN'}
                    {venta.estadoFacturaElectronica === 'Error' && ' — error al transmitir a la DIAN'}
                  </p>
                  {(venta.tipoDocumentoFacturado || venta.numeroDocumentoFacturado || venta.razonSocialFacturada) && (
                    <p className="text-text-muted">
                      {venta.razonSocialFacturada}
                      {venta.tipoDocumentoFacturado && venta.numeroDocumentoFacturado
                        ? ` · ${venta.tipoDocumentoFacturado} ${venta.numeroDocumentoFacturado}`
                        : ''}
                    </p>
                  )}
                  {venta.direccionFacturada && <p className="text-text-muted">{venta.direccionFacturada}</p>}
                  {venta.emailFacturacion && <p className="text-text-muted">{venta.emailFacturacion}</p>}
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Precio unit.</TableHead>
                      <TableHead className="text-right">Subtotal (sin IVA)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {venta.detalles.map((linea) => (
                      <TableRow key={linea.productoId}>
                        <TableCell className="text-navy">{linea.productoNombre}</TableCell>
                        <TableCell className="text-navy">{linea.cantidad}</TableCell>
                        <TableCell className="text-navy">{formatoMoneda.format(linea.precioUnitario)}</TableCell>
                        <TableCell className="text-right font-medium text-navy">
                          {formatoMoneda.format(linea.subtotalSinIva)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {venta.metodoPago === 'Mixto' && venta.detallesPago && venta.detallesPago.length > 0 && (
                <div className="space-y-1 border-t border-border pt-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-text-muted">Desglose del pago</p>
                  {venta.detallesPago.map((linea) => (
                    <div key={linea.metodoPago} className="flex justify-between">
                      <span className="text-text-muted">{linea.metodoPago}</span>
                      <span className="text-navy">{formatoMoneda.format(linea.monto)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end border-t border-border pt-4">
                <div className="w-full max-w-[220px] space-y-1.5 text-right">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Valor base</span>
                    <span className="text-navy">{formatoMoneda.format(valorBase)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">IVA</span>
                    <span className="text-navy">{formatoMoneda.format(valorIva)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5">
                    <span className="text-xs uppercase tracking-wide text-text-muted">Total</span>
                    <span className="text-xl font-bold text-navy">{formatoMoneda.format(venta.total)}</span>
                  </div>
                </div>
              </div>

              <p className="text-center text-xs text-text-muted">
                Gracias por su compra — Ferretería Gold
              </p>
            </div>

            <DialogFooter>
              {nombreImpresora && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleImprimirTiquete}
                  disabled={imprimiendoTiquete}
                >
                  {imprimiendoTiquete ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                  {debeAbrirCajon(venta) ? 'Imprimir tiquete y abrir caja' : 'Imprimir tiquete'}
                </Button>
              )}
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
