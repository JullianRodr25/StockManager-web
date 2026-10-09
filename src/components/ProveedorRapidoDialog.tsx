import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { crearProveedor } from '@/services/proveedorService';
import type { Proveedor } from '@/types/proveedores';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Mismo formato que valida el módulo de Proveedores y el backend (E.164).
const FORMATO_TELEFONO_E164 = /^\+[1-9]\d{7,14}$/;

interface ProveedorRapidoDialogProps {
  abierto: boolean;
  onCambiarAbierto: (abierto: boolean) => void;
  /** Se llama con el proveedor ya creado, para que quien lo abrió lo seleccione. */
  onCreado: (proveedor: Proveedor) => void;
}

/**
 * Alta rápida de un proveedor (solo lo esencial) desde el formulario de producto, para no tener
 * que salir al módulo de Proveedores. Los demás datos (teléfono, email, dirección) se completan
 * después allí. Usa el mismo endpoint, así que valida exactamente igual que el módulo completo.
 */
export function ProveedorRapidoDialog({ abierto, onCambiarAbierto, onCreado }: ProveedorRapidoDialogProps) {
  const { token } = useAuth();
  const [nombre, setNombre] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [whatsApp, setWhatsApp] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre arranca limpio.
  useEffect(() => {
    if (!abierto) return;
    setNombre('');
    setIdentificacion('');
    setWhatsApp('');
    setError(null);
  }, [abierto]);

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    // Los eventos de React también suben por el árbol de componentes a través de los portales:
    // sin esto, este submit podría disparar el del formulario de producto.
    e.stopPropagation();
    setError(null);

    if (!nombre.trim()) {
      setError('El nombre del proveedor es obligatorio.');
      return;
    }

    const whatsAppNormalizado = whatsApp.trim() || null;
    if (whatsAppNormalizado && !FORMATO_TELEFONO_E164.test(whatsAppNormalizado)) {
      setError('El número de WhatsApp debe estar en formato internacional, ej. +573001234567.');
      return;
    }

    setGuardando(true);
    try {
      const proveedor = await crearProveedor(
        {
          nombre: nombre.trim(),
          numeroIdentificacion: identificacion.trim() || null,
          numeroWhatsApp: whatsAppNormalizado,
        },
        token
      );
      toast.success(`Proveedor "${proveedor.nombre}" creado`);
      onCreado(proveedor);
      onCambiarAbierto(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el proveedor.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(valor) => !guardando && onCambiarAbierto(valor)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo proveedor</DialogTitle>
          <DialogDescription>
            Solo lo esencial. Podrás completar el resto de datos después en el módulo de Proveedores.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleGuardar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proveedor-rapido-nombre">Nombre</Label>
            <Input
              id="proveedor-rapido-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={200}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proveedor-rapido-nit">NIT / identificación (opcional)</Label>
            <Input
              id="proveedor-rapido-nit"
              value={identificacion}
              onChange={(e) => setIdentificacion(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proveedor-rapido-whatsapp">WhatsApp para avisos de stock bajo (opcional)</Label>
            <Input
              id="proveedor-rapido-whatsapp"
              placeholder="+573001234567"
              value={whatsApp}
              onChange={(e) => setWhatsApp(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onCambiarAbierto(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={guardando}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
              {guardando ? 'Creando...' : 'Crear proveedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
