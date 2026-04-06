import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'iqac-dashboard-theme';
const THEME_CLASSES = ['dark-theme', 'light-theme'];

const readStoredTheme = () => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);

    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
  } catch {
    // Ignore storage access errors and fall back to the default theme.
  }

  return 'dark';
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const themeClass = `${theme}-theme`;
    const targets = [document.documentElement, document.body];

    targets.forEach((element) => {
      if (!element) {
        return;
      }

      element.classList.remove(...THEME_CLASSES);
      element.classList.add(themeClass);
    });

    document.documentElement.style.colorScheme = theme;

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage access errors so the theme still applies in-memory.
    }

    return undefined;
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncTheme = (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      if (event.newValue === 'light' || event.newValue === 'dark') {
        setTheme(event.newValue);
      }
    };

    window.addEventListener('storage', syncTheme);

    return () => {
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark')),
      isDarkTheme: theme === 'dark',
      isLightTheme: theme === 'light',
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider.');
  }

  return context;
}
