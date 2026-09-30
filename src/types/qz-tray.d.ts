// La librería "qz-tray" no publica tipos propios (es un módulo UMD sin .d.ts).
// Esta declaración cubre únicamente la superficie que usa impresionService.ts:
// conectar el WebSocket local de QZ Tray, crear una configuración de impresora
// por nombre, y enviar datos "raw" (texto/comandos ESC-POS) a imprimir.
declare module 'qz-tray' {
  interface QzPrinterConfig {
    [key: string]: unknown;
  }

  interface QzWebSocket {
    connect(options?: Record<string, unknown>): Promise<void>;
    disconnect(): Promise<void>;
    isActive(): boolean;
  }

  interface QzConfigs {
    create(printerName: string, options?: Record<string, unknown>): QzPrinterConfig;
  }

  interface QzSecurity {
    setCertificatePromise(resolver: (resolve: (cert: string) => void, reject: (err: unknown) => void) => void): void;
    setSignaturePromise(resolver: (toSign: string) => (resolve: (sig: string) => void, reject: (err: unknown) => void) => void): void;
  }

  interface Qz {
    websocket: QzWebSocket;
    configs: QzConfigs;
    security: QzSecurity;
    print(config: QzPrinterConfig, data: Array<string | Record<string, unknown>>): Promise<void>;
  }

  const qz: Qz;
  export default qz;
}
