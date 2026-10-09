import { useEffect } from 'react';

const TAMANO_FAVICON = 64;

// Un favicon se dibuja a 16-32 px: mandarle la imagen original (el logo puede pesar hasta
// 3 MB) es desperdicio. Se reduce a 64x64 en un canvas; si algo falla (imagen no cargable,
// canvas bloqueado) se usa la URL original tal cual, que igual funciona.
function reducirLogo(url: string): Promise<string> {
  return new Promise((resolve) => {
    const imagen = new Image();
    imagen.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = TAMANO_FAVICON;
        canvas.height = TAMANO_FAVICON;
        const contexto = canvas.getContext('2d');
        if (!contexto) return resolve(url);
        // "cover" centrado: el logo es casi cuadrado, así no se deforma si no lo es.
        const lado = Math.min(imagen.naturalWidth, imagen.naturalHeight);
        contexto.drawImage(
          imagen,
          (imagen.naturalWidth - lado) / 2,
          (imagen.naturalHeight - lado) / 2,
          lado,
          lado,
          0,
          0,
          TAMANO_FAVICON,
          TAMANO_FAVICON
        );
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(url);
      }
    };
    imagen.onerror = () => resolve(url);
    imagen.src = url;
  });
}

/** Mantiene el ícono de la pestaña del navegador sincronizado con la imagen indicada. */
export function useFavicon(url: string): void {
  useEffect(() => {
    let vigente = true;

    reducirLogo(url).then((href) => {
      if (!vigente) return;
      let enlace = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!enlace) {
        enlace = document.createElement('link');
        enlace.rel = 'icon';
        document.head.appendChild(enlace);
      }
      enlace.type = href.startsWith('data:image/png') ? 'image/png' : '';
      enlace.href = href;
    });

    // Evita que una carga lenta pise a una más reciente (cambios seguidos de logo).
    return () => {
      vigente = false;
    };
  }, [url]);
}
