/**
 * Fondo decorativo del tema "Aurora": brillos de color y una cuadrícula con máscara.
 * Es presentacional y no interactivo (aria-hidden + pointer-events-none), así que se puede
 * montar tanto en el panel (AppLayout) como en las pantallas de acceso sin afectar la
 * accesibilidad ni los clics. Los colores salen de los tokens CSS, por eso cambia solo con el tema.
 */
export function FondoAurora() {
  return (
    <>
      <div aria-hidden="true" className="aurora-brillos pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="aurora-cuadricula pointer-events-none absolute inset-0" />
    </>
  );
}
