import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { buscarClientes } from '@/services/clienteService';
import type { Cliente } from '@/types/clientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MIN_LETRAS = 2;
const DEBOUNCE_MS = 250;
const MAX_RESULTADOS = 6;

interface BuscadorClienteProps {
  token: string | null;
  seleccionado: { id: number; nombre: string } | null;
  onSeleccionar: (cliente: Cliente | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

/** Busca un cliente registrado (activo) por nombre o documento; muestra el elegido con una X para quitarlo. */
export function BuscadorCliente({
  token,
  seleccionado,
  onSeleccionar,
  disabled,
  placeholder = 'Buscar cliente por nombre o documento...',
}: BuscadorClienteProps) {
  const [termino, setTermino] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (termino.trim().length < MIN_LETRAS) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    const espera = setTimeout(() => {
      setBuscando(true);
      buscarClientes(termino, token, true)
        .then((clientes) => {
          if (!cancelado) setResultados(clientes.slice(0, MAX_RESULTADOS));
        })
        .catch(() => {
          if (!cancelado) setResultados([]);
        })
        .finally(() => {
          if (!cancelado) setBuscando(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [termino, token]);

  if (seleccionado) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-navy">
        <span className="font-medium">{seleccionado.nombre}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={disabled}
          onClick={() => onSeleccionar(null)}
          aria-label="Quitar cliente"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        type="search"
        value={termino}
        onChange={(e) => setTermino(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {termino.trim().length >= MIN_LETRAS && (
        <div className="rounded-md border border-border bg-card text-sm">
          {buscando ? (
            <p className="px-3 py-2 text-text-muted">Buscando...</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-text-muted">Sin resultados.</p>
          ) : (
            resultados.map((cliente) => (
              <button
                key={cliente.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/60"
                onClick={() => {
                  onSeleccionar(cliente);
                  setTermino('');
                }}
              >
                <span className="font-medium text-navy">{cliente.nombre}</span>
                <span className="text-xs text-text-muted">{cliente.numeroIdentificacion}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
