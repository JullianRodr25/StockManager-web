import { useState } from 'react';
import type { FormEvent } from 'react';
import { Banknote, CreditCard, Loader2, Landmark } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { cn } from '@/lib/utils';
import type { MetodoPago } from '@/types/ventas';

const METODOS: { valor: MetodoPago; etiqueta: string; icono: LucideIcon }[] = [
  { valor: 'Efectivo', etiqueta: 'Efectivo', icono: Banknote },
  { valor: 'Tarjeta', etiqueta: 'Tarjeta', icono: CreditCard },
  { valor: 'Transferencia', etiqueta: 'Transferencia', icono: Landmark },
];

interface RegistrarAbonoDialogProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  titulo: string;
  descripcion: string;
  saldoPendiente: number;
  /** En cobros en efectivo, pide cuánto entregó el cliente y calcula el cambio (solo apoyo visual). */
  pedirEfectivoRecibido?: boolean;
  enviando: boolean;
  /** Error devuelto por el servidor al intentar registrar; las validaciones del formulario son locales. */
  error: string | null;
  onConfirmar: (monto: number, metodoPago: MetodoPago) => Promise<void>;
}

/**
 * Registro de un abono/pago en una ventana emergente: lo único que hay que decidir es el monto
 * (ya viene con el saldo completo) y el método (un toque). Es reutilizable para cobros a
 * clientes (cuentas abiertas) y pagos a proveedores (cuentas por pagar). Es presentacional:
 * quien lo usa llama a la API y cierra la ventana cuando el abono se registró.
 */
export function RegistrarAbonoDialog({ abierto, onAbiertoChange, ...resto }: RegistrarAbonoDialogProps) {
  return (
    <Dialog open={abierto} onOpenChange={(valor) => !resto.enviando && onAbiertoChange(valor)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{resto.titulo}</DialogTitle>
          <DialogDescription>{resto.descripcion}</DialogDescription>
        </DialogHeader>
        {/* El formulario vive dentro del contenido: al cerrar se desmonta y el siguiente abono parte limpio. */}
        <FormularioAbono {...resto} onCancelar={() => onAbiertoChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type FormularioProps = Omit<RegistrarAbonoDialogProps, 'abierto' | 'onAbiertoChange' | 'titulo' | 'descripcion'> & {
  onCancelar: () => void;
};

function FormularioAbono({
  saldoPendiente,
  pedirEfectivoRecibido = false,
  enviando,
  error,
  onConfirmar,
  onCancelar,
}: FormularioProps) {
  const saldoCompleto = String(Math.round(saldoPendiente));
  const [monto, setMonto] = useState(saldoCompleto);
  const [metodo, setMetodo] = useState<MetodoPago | ''>('');
  const [recibido, setRecibido] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const montoNumero = Number(monto);
  const recibidoNumero = Number(recibido);
  const recibidoValido = recibido.trim() !== '' && Number.isFinite(recibidoNumero);
  const pideRecibido = pedirEfectivoRecibido && metodo === 'Efectivo';
  const cambio = recibidoValido ? recibidoNumero - montoNumero : null;

  function validar(): string | null {
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) return 'Ingresa un monto válido.';
    if (montoNumero > saldoPendiente) return 'El monto no puede superar el saldo pendiente.';
    if (!metodo) return 'Selecciona un método de pago.';
    if (pideRecibido && (!recibidoValido || recibidoNumero < montoNumero))
      return 'Ingresa lo recibido en efectivo; debe ser al menos el monto del abono.';
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const mensaje = validar();
    setErrorLocal(mensaje);
    if (mensaje || !metodo) return;
    await onConfirmar(montoNumero, metodo);
  }

  const mensajeError = errorLocal ?? error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-foreground/5 px-4 py-3">
        <span className="text-sm text-text-muted">Saldo pendiente</span>
        <span className="font-heading text-xl font-extrabold">{formatoMoneda.format(saldoPendiente)}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="montoAbono">Monto a abonar</Label>
          <button
            type="button"
            onClick={() => setMonto(saldoCompleto)}
            disabled={enviando || monto === saldoCompleto}
            className="text-xs font-semibold text-gold-text hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-50"
          >
            Pagar saldo completo
          </button>
        </div>
        <Input
          id="montoAbono"
          type="number"
          inputMode="numeric"
          className="sin-flechas h-12 text-lg font-semibold"
          min="1"
          step="1"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          disabled={enviando}
          autoFocus
        />
      </div>

      <fieldset className="space-y-2" disabled={enviando}>
        <legend className="mb-2 text-sm font-medium">Método de pago</legend>
        <div className="grid grid-cols-3 gap-2">
          {METODOS.map(({ valor, etiqueta, icono: Icono }) => {
            const activo = metodo === valor;
            return (
              <button
                key={valor}
                type="button"
                aria-pressed={activo}
                onClick={() => setMetodo(valor)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                  activo
                    ? 'border-primary bg-primary/15 text-gold-text'
                    : 'border-border bg-foreground/5 text-text-muted hover:text-foreground'
                )}
              >
                <Icono className="h-5 w-5" aria-hidden="true" />
                {etiqueta}
              </button>
            );
          })}
        </div>
      </fieldset>

      {pideRecibido && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="montoRecibidoAbono">Recibido en efectivo</Label>
            <button
              type="button"
              onClick={() => setRecibido(String(montoNumero))}
              disabled={enviando || !Number.isFinite(montoNumero) || montoNumero <= 0}
              className="text-xs font-semibold text-gold-text hover:underline disabled:opacity-50"
            >
              Monto exacto
            </button>
          </div>
          <Input
            id="montoRecibidoAbono"
            type="number"
            inputMode="numeric"
            className="sin-flechas"
            min="0"
            step="1"
            value={recibido}
            onChange={(e) => setRecibido(e.target.value)}
            disabled={enviando}
          />
          {recibidoValido && (
            <p className={cn('text-sm font-medium', recibidoNumero < montoNumero && 'text-error-text')}>
              {recibidoNumero < montoNumero
                ? `Falta ${formatoMoneda.format(montoNumero - recibidoNumero)}`
                : `Cambio: ${formatoMoneda.format(cambio ?? 0)}`}
            </p>
          )}
        </div>
      )}

      {mensajeError && (
        <div
          className="rounded-xl border border-error-text/40 bg-error-bg px-3 py-2 text-sm text-error-text"
          role="alert"
        >
          {mensajeError}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" variant="gold" className="sm:min-w-40" disabled={enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
          Registrar abono
        </Button>
      </div>
    </form>
  );
}
