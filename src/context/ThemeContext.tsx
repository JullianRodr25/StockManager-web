import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const THEME_STORAGE_KEY = 'stockmanager_theme';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function obtenerThemeInicial(): Theme {
  const guardado = localStorage.getItem(THEME_STORAGE_KEY);
  if (guardado === 'light' || guardado === 'dark') return guardado;

  // Sin preferencia guardada: se respeta el modo del sistema operativo
  // solo la primera vez que se abre la app.
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(obtenerThemeInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((actual) => (actual === 'dark' ? 'light' : 'dark'));
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de un ThemeProvider');
  }
  return context;
}
