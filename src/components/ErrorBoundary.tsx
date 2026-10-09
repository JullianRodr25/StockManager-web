import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Pila de componentes donde ocurrió el error (qué pantalla/componente lo provocó). */
  componentStack: string | null;
}

/**
 * Red de seguridad de toda la app: sin esto, cualquier excepción durante el renderizado de un
 * componente desmonta React por completo y el usuario se queda con una pantalla en blanco sin
 * ninguna pista de qué pasó ni cómo salir. Con esto ve un mensaje y puede recargar; el error
 * completo queda en la consola del navegador (F12) para poder diagnosticarlo.
 *
 * Tiene que ser un componente de clase: React solo expone getDerivedStateFromError /
 * componentDidCatch a través de clases (no hay un hook equivalente).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de renderizado no controlado:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="font-heading text-xl font-bold text-navy">Algo salió mal</h1>
        <p className="max-w-md text-sm text-text-muted">
          Ocurrió un error inesperado en esta pantalla. Recarga la página para continuar; si vuelve a pasar,
          avísanos qué estabas haciendo.
        </p>
        {/* Detalle técnico: no dice nada sensible, solo qué falló y dónde. Permite diagnosticar
            con una captura de pantalla, sin tener que abrir la consola del navegador. */}
        <details className="max-w-xl text-left text-xs text-text-muted">
          <summary className="cursor-pointer text-center">Detalles técnicos</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border p-3">
            {this.state.error.name}: {this.state.error.message}
            {this.state.componentStack}
          </pre>
        </details>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-brand-navy hover:opacity-90"
        >
          Recargar página
        </button>
      </div>
    );
  }
}
