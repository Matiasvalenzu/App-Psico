"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const DEFAULT_THEME: Theme = "light";
const THEME_STORAGE_KEY = "theme";
const THEME_STORAGE_VERSION_KEY = "theme_preference_version";
const THEME_STORAGE_VERSION = "light-default-v1";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  toggle: () => {},
});

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const storageVersion = localStorage.getItem(THEME_STORAGE_VERSION_KEY);
    const initial =
      storageVersion === THEME_STORAGE_VERSION && isTheme(stored)
        ? stored
        : DEFAULT_THEME;
    setTheme(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, mounted]);

  function toggle() {
    localStorage.setItem(THEME_STORAGE_VERSION_KEY, THEME_STORAGE_VERSION);
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
