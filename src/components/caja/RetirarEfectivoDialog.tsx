import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { registrarRetiro } from '@/services/cajaService';
import type { TurnoCaja } from '@/types/caja';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// El estado guarda solo dígitos; el punto de miles es solo de presentación.
const formatoMiles = new Intl.NumberFormat('es-CO');
const aDigitos = (valor: string) => valor.replace(/\D/g, '');

interface RetirarEfectivoDialogProps {
  open: boolean;
  /** Turno abierto del que se retira; con conteo a ciegas el esperado no viene y no se muestra. */
  turno: TurnoCaja | null;
  onOpenChange: (abierto: boolean) => void;
  /** Tras registrar el retiro, para que la pantalla vuelva a consultar los totales del turno. */
  onRegistrado: () => void;
}

/**
 * Retiro parcial de efectivo: saca dinero de la caja sin cerrarla (típicamente lo vendido, para
 * dejar solo la base). No afecta las ventas: solo baja el efectivo esperado del turno.
 */
export function RetirarEfectivoDialog({ open, turno, onOpenChange, onRegistrado }: RetirarEfectivoDialogProps) {
  const { token } = useAuth();
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMonto('');
      setError(null);
      setGuardando(false);
    }
  }, [open]);

  const valor = Number(monto || 0);
  const esperado = turno?.esperadoVisible ? turno.efectivoEsperado : null;

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    if (valor <= 0) {
      setError('Escribe el monto que vas a retirar.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await registrarRetiro(valor, token);
      toast.success(`Retiro de ${formatoMoneda.format(valor)} registrado`);
      onRegistrado();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar el retiro.');
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !guardando && onOpenChange(abierto)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Retirar efectivo de la caja</DialogTitle>
          <DialogDescription>
            Saca dinero sin cerrar la caja (por ejemplo lo vendido, dejando la base). No cambia las ventas: solo baja
            el efectivo esperado para que el conteo de cierre cuadre.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={manejarEnvio} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="monto-retiro">Monto a retirar</Label>
            <Input
              id="monto-retiro"
              inputMode="numeric"
              autoFocus
              placeholder="0"
              value={monto === '' ? '' : formatoMiles.format(valor)}
              onChange={(e) => setMonto(aDigitos(e.target.value))}
              disabled={guardando}
            />
            {esperado !== null && (
              <p className="text-xs text-text-muted">
                Esperado en caja: {formatoMoneda.format(esperado)}
                {valor > 0 && ` · quedaría ${formatoMoneda.format(esperado - valor)}`}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={guardando || valor <= 0}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Retirar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
