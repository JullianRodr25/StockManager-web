import { useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { agregarFotoProducto, eliminarFotoProducto } from '@/services/inventarioService';
import { MAX_FOTOS_PRODUCTO } from '@/types/inventario';
import type { ProductoFoto } from '@/types/inventario';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

interface GaleriaFotosProductoProps {
  productoId: number;
  fotos: ProductoFoto[];
  onCambiar: (fotos: ProductoFoto[]) => void;
}

/// Galería de fotos de un producto (hasta MAX_FOTOS_PRODUCTO), estilo Homecenter: varias fotos
/// por producto, mostradas luego en carrusel en la PWA. Solo tiene sentido con un producto ya
/// guardado (necesita su Id); ver uso condicional en Inventario.tsx.
export function GaleriaFotosProducto({ productoId, fotos, onCambiar }: GaleriaFotosProductoProps) {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);

  async function handleSeleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo si se cancela y reintenta

    if (!archivo) return;

    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      toast.error('Solo se permiten imágenes JPG, PNG o WEBP.');
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      toast.error('La imagen no puede superar los 5 MB.');
      return;
    }

    setSubiendo(true);
    try {
      const nuevaFoto = await agregarFotoProducto(productoId, archivo, token);
      onCambiar([...fotos, nuevaFoto]);
      toast.success('Foto agregada.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  async function handleEliminar(fotoId: number) {
    setEliminandoId(fotoId);
    try {
      await eliminarFotoProducto(productoId, fotoId, token);
      onCambiar(fotos.filter((f) => f.id !== fotoId));
      toast.success('Foto eliminada.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo eliminar la foto.');
    } finally {
      setEliminandoId(null);
    }
  }

  const puedeAgregar = fotos.length < MAX_FOTOS_PRODUCTO;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-navy">Fotos del producto</span>
        <span className="text-xs text-text-muted">
          {fotos.length}/{MAX_FOTOS_PRODUCTO}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {fotos.map((foto) => (
          <div key={foto.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
            <img src={foto.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => handleEliminar(foto.id)}
              disabled={eliminandoId === foto.id}
              aria-label="Eliminar foto"
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
            >
              {eliminandoId === foto.id ? (
                <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          </div>
        ))}

        {puedeAgregar && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border text-text-muted hover:border-gold hover:text-gold disabled:opacity-60"
          >
            {subiendo ? (
              <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleSeleccionarArchivo}
      />

      {fotos.length === 0 && (
        <p className="text-xs text-text-muted">Agrega hasta {MAX_FOTOS_PRODUCTO} fotos para mostrar un carrusel en el catálogo.</p>
      )}
    </div>
  );
}
