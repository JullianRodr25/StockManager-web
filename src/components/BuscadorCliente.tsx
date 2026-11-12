import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { buscarClientes } from '@/services/clienteService';
import type { Cliente } from '@/types/clientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const MIN_LETRAS_SERVIDOR = 2;
const DEBOUNCE_MS = 250;
const MAX_RESULTADOS = 8;

interface BuscadorClienteProps {
  token: string | null;
  seleccionado: { id: number; nombre: string } | null;
  onSeleccionar: (cliente: Cliente | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Busca un cliente registrado (activo) por nombre o documento. Mismo comportamiento que el
 * buscador de productos: al entrar al campo (clic o foco) ya muestra clientes sin escribir,
 * al escribir consulta al servidor, se elige con un clic o con flechas + Enter, y se cierra
 * con Esc o al salir del campo. El elegido se muestra con una X para quitarlo.
 */
export function BuscadorCliente({
  token,
  seleccionado,
  onSeleccionar,
  disabled,
  placeholder = 'Buscar cliente por nombre o documento...',
}: BuscadorClienteProps) {
  const [termino, setTermino] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(-1);
  // Carga inicial (los primeros clientes activos), para mostrar algo apenas se entra al campo.
  const [iniciales, setIniciales] = useState<Cliente[] | null>(null);
  const [resultadosServidor, setResultadosServidor] = useState<Cliente[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const cargandoInicialesRef = useRef(false);

  const consulta = termino.trim();
  const buscaEnServidor = consulta.length >= MIN_LETRAS_SERVIDOR;

  // La primera vez que se abre la lista se traen los clientes activos (una sola vez).
  useEffect(() => {
    if (!abierto || iniciales !== null || cargandoInicialesRef.current) return;
    cargandoInicialesRef.current = true;
    setBuscando(true);
    buscarClientes('', token, true)
      .then((c) => setIniciales(c))
      .catch(() => setIniciales([]))
      .finally(() => {
        cargandoInicialesRef.current = false;
        setBuscando(false);
      });
  }, [abierto, iniciales, token]);

  // Al escribir, se consulta al servidor: la carga inicial no contiene a todos los clientes.
  useEffect(() => {
    if (!buscaEnServidor) {
      setResultadosServidor(null);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const espera = setTimeout(() => {
      buscarClientes(consulta, token, true)
        .then((c) => !cancelado && setResultadosServidor(c))
        .catch(() => !cancelado && setResultadosServidor(null))
        .finally(() => !cancelado && setBuscando(false));
    }, DEBOUNCE_MS);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [consulta, buscaEnServidor, token]);

  const minusculas = consulta.toLowerCase();
  const lista: Cliente[] = (
    buscaEnServidor && resultadosServidor
      ? resultadosServidor
      : (iniciales ?? []).filter(
          (c) =>
            !minusculas ||
            c.nombre.toLowerCase().includes(minusculas) ||
            c.numeroIdentificacion.toLowerCase().includes(minusculas)
        )
  ).slice(0, MAX_RESULTADOS);
  const indiceResaltado = Math.min(resaltado, lista.length - 1);

  function elegir(cliente: Cliente) {
    onSeleccionar(cliente);
    setTermino('');
    setAbierto(false);
    setResaltado(-1);
  }

  function manejarTeclas(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAbierto(true);
      setResaltado((r) => (lista.length === 0 ? -1 : Math.min(r + 1, lista.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltado((r) => Math.max(r - 1, 0));
    } else if (e.key === 'Enter') {
      // Dentro de un formulario, Enter no debe enviarlo: solo elige el cliente resaltado.
      e.preventDefault();
      const elegido = indiceResaltado >= 0 ? lista[indiceResaltado] : lista.length === 1 ? lista[0] : null;
      if (elegido) elegir(elegido);
    } else if (e.key === 'Escape' && abierto) {
      // Evita que Esc cierre también el diálogo que contiene el campo.
      e.stopPropagation();
      setAbierto(false);
    }
  }

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
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        autoComplete="off"
        value={termino}
        onChange={(e) => {
          setTermino(e.target.value);
          setResaltado(-1);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        // Si el campo ya tiene el foco, el clic no dispara onFocus: se reabre aquí.
        onClick={() => setAbierto(true)}
        onBlur={() => {
          setAbierto(false);
          setResaltado(-1);
        }}
        onKeyDown={manejarTeclas}
        placeholder={placeholder}
        disabled={disabled}
      />
      {abierto && (
        <div
          className="max-h-60 overflow-y-auto rounded-md border border-border bg-card text-sm"
          // Presionar dentro de la lista no le quita el foco al campo: un solo clic basta.
          onMouseDown={(e) => e.preventDefault()}
        >
          {lista.length === 0 ? (
            <p className="px-3 py-2 text-text-muted">
              {buscando ? 'Buscando...' : consulta ? 'Sin resultados.' : 'No hay clientes registrados.'}
            </p>
          ) : (
            lista.map((cliente, indice) => (
              <button
                key={cliente.id}
                type="button"
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  elegir(cliente);
                }}
                onClick={(e) => {
                  // Solo activación por teclado (detail = 0); el ratón ya eligió en mousedown.
                  if (e.detail === 0) elegir(cliente);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-background',
                  indice === indiceResaltado && 'bg-background ring-1 ring-inset ring-gold'
                )}
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
