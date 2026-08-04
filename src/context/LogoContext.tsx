import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import logoPredeterminado from '../assets/logo-ferreteria-gold.jpg';

const LOGO_STORAGE_KEY = 'stockmanager_logo';

interface LogoContextValue {
  logoUrl: string;
  esLogoPersonalizado: boolean;
  actualizarLogo: (dataUrl: string) => void;
  restaurarLogoPredeterminado: () => void;
}

const LogoContext = createContext<LogoContextValue | undefined>(undefined);

export function LogoProvider({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    return localStorage.getItem(LOGO_STORAGE_KEY) ?? logoPredeterminado;
  });

  const actualizarLogo = useCallback((dataUrl: string) => {
    localStorage.setItem(LOGO_STORAGE_KEY, dataUrl);
    setLogoUrl(dataUrl);
  }, []);

  const restaurarLogoPredeterminado = useCallback(() => {
    localStorage.removeItem(LOGO_STORAGE_KEY);
    setLogoUrl(logoPredeterminado);
  }, []);

  return (
    <LogoContext.Provider
      value={{
        logoUrl,
        esLogoPersonalizado: logoUrl !== logoPredeterminado,
        actualizarLogo,
        restaurarLogoPredeterminado,
      }}
    >
      {children}
    </LogoContext.Provider>
  );
}

export function useLogo(): LogoContextValue {
  const context = useContext(LogoContext);
  if (!context) {
    throw new Error('useLogo debe usarse dentro de un LogoProvider');
  }
  return context;
}
