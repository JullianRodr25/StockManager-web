import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { cambiarContrasena } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

const LONGITUD_MINIMA = 8;

interface CambiarContrasenaDialogProps {
  open: boolean;
  onOpenChange: (abierto: boolean) => void;
}

/**
 * Cambio de contraseña del usuario que tiene la sesión abierta. Pide la actual (así una sesión
 * desatendida no basta para adueñarse de la cuenta) y la nueva dos veces para evitar errores de
 * digitación. Las reglas de fondo las valida el servidor; aquí solo se evitan viajes inútiles.
 */
export function CambiarContrasenaDialog({ open, onOpenChange }: CambiarContrasenaDialogProps) {
  const { token } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setActual('');
      setNueva('');
      setConfirmacion('');
      setError(null);
      setGuardando(false);
    }
  }, [open]);

  function validar(): string | null {
    if (!actual) return 'Escribe tu contraseña actual.';
    if (nueva.length < LONGITUD_MINIMA) return `La nueva contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`;
    if (nueva === actual) return 'La nueva contraseña debe ser distinta de la actual.';
    if (nueva !== confirmacion) return 'La confirmación no coincide con la nueva contraseña.';
    return null;
  }

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await cambiarContrasena({ passwordActual: actual, passwordNueva: nueva }, token);
      toast.success('Contraseña actualizada');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.');
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !guardando && onOpenChange(abierto)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>Usa al menos {LONGITUD_MINIMA} caracteres.</DialogDescription>
        </DialogHeader>

        <form onSubmit={manejarEnvio} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="pwd-actual">Contraseña actual</Label>
            <PasswordInput
              id="pwd-actual"
              autoComplete="current-password"
              autoFocus
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              disabled={guardando}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pwd-nueva">Nueva contraseña</Label>
            <PasswordInput
              id="pwd-nueva"
              autoComplete="new-password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              disabled={guardando}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pwd-confirmar">Repite la nueva contraseña</Label>
            <PasswordInput
              id="pwd-confirmar"
              autoComplete="new-password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              disabled={guardando}
            />
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
            <Button type="submit" variant="gold" disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
