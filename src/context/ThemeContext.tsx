import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

const THEME_STORAGE_KEY = 'stockmanager_theme';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function obtenerThemeInicial(): Theme {
  const guardado = localStorage.getItem(THEME_STORAGE_KEY);
  if (guardado === 'light' || guardado === 'dark') {
    return guardado;
  }

  // Sin preferencia guardada todavía: se respeta la preferencia del
  // sistema operativo/navegador en la primera carga.
  const prefiereOscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefiereOscuro ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(obtenerThemeInicial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((nuevoTheme: Theme) => {
    setThemeState(nuevoTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((actual) => (actual === 'dark' ? 'light' : 'dark'));
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de un ThemeProvider');
  }
  return context;
}
