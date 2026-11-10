import { useEffect, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const RUTA_AUDIO = `${import.meta.env.BASE_URL}audio/mensaje-ferreteria.mp3`;

/**
 * Botón de la barra superior que reproduce el audio de la ferretería por los parlantes del PC.
 * Cada pulsación lo inicia desde el principio; si ya está sonando, la pulsación lo detiene.
 *
 * Se reproduce siempre por un clic del usuario, que además es lo que exigen los navegadores
 * para permitir sonido (una reproducción automática sería bloqueada).
 */
export function BotonAudioFerreteria() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sonando, setSonando] = useState(false);

  // El elemento se crea en el primer clic (no antes) para no descargar el archivo si nunca se usa.
  function obtenerAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      const audio = new Audio(RUTA_AUDIO);
      audio.preload = 'auto';
      audio.addEventListener('ended', () => setSonando(false));
      audio.addEventListener('pause', () => setSonando(false));
      audioRef.current = audio;
    }
    return audioRef.current;
  }

  async function alternar() {
    const audio = obtenerAudio();
    if (sonando) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }
    try {
      audio.currentTime = 0;
      await audio.play();
      setSonando(true);
    } catch {
      toast.error('No se pudo reproducir el audio');
    }
  }

  // Al salir del layout (cerrar sesión) no debe seguir sonando.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    []
  );

  const etiqueta = sonando ? 'Detener audio' : 'Reproducir audio de la ferretería';

  return (
    <Button variant="ghost" size="icon" onClick={alternar} aria-label={etiqueta} title={etiqueta}>
      {sonando ? <Square className="h-5 w-5 text-gold" /> : <Volume2 className="h-5 w-5 text-foreground" />}
    </Button>
  );
}
