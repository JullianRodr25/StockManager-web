import { useState } from 'react';
import type { FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { actualizarCliente, obtenerClientePorId } from '@/services/clienteService';
import type { FacturaComprador } from '@/types/facturaDocumento';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AvisoClienteIncompletoProps {
  comprador: FacturaComprador;
  /** Se llama tras guardar para que la factura se vuelva a cargar con los datos nuevos. */
  onCorregido: () => void;
}

/**
 * Aviso de que a un cliente registrado le faltan datos que lleva la factura (dirección o
 * documento), con la posibilidad de completarlos ahí mismo sin salir a la pantalla de
 * Clientes. Solo la dirección es editable: el número de identificación es el usuario de
 * login del cliente y el backend no permite cambiarlo, así que si faltara se avisa nada más.
 */
export function AvisoClienteIncompleto({ comprador, onCorregido }: AvisoClienteIncompletoProps) {
  const { token } = useAuth();
  const [direccion, setDireccion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (comprador.esClienteFinal || comprador.clienteId === null) return null;
  if (!comprador.faltaDireccion && !comprador.faltaDocumento) return null;

  const clienteId = comprador.clienteId;

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    const valor = direccion.trim();
    if (valor === '') {
      setError('Escribe la dirección del cliente.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      // El PUT reemplaza nombre/correo/teléfono/dirección juntos: se parte de los datos
      // vigentes del cliente para cambiar únicamente la dirección.
      const cliente = await obtenerClientePorId(clienteId, token);
      await actualizarCliente(
        clienteId,
        { nombre: cliente.nombre, email: cliente.email, telefono: cliente.telefono, direccion: valor },
        token
      );
      toast.success('Dirección del cliente actualizada');
      onCorregido();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el cliente.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-gold bg-gold/10 px-3 py-2 text-sm text-navy print:hidden">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Al cliente le falta
        {comprador.faltaDocumento && ' la cédula'}
        {comprador.faltaDocumento && comprador.faltaDireccion && ' y'}
        {comprador.faltaDireccion && ' la dirección'} para que la factura quede completa.
      </p>
      {comprador.faltaDireccion && (
        <form onSubmit={handleGuardar} className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Dirección del cliente"
            placeholder="Dirección del cliente"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
          <Button type="submit" variant="gold" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar dirección'}
          </Button>
        </form>
      )}
      {comprador.faltaDocumento && (
        <p className="text-text-muted">
          La cédula se corrige desde la pantalla de Clientes (es el documento con el que el cliente inicia sesión).
        </p>
      )}
      {error && <p className="text-error-text" role="alert">{error}</p>}
    </div>
  );
}
