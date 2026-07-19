import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { resolveTheme, type ThemeMode } from "./tokens";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  theme: ReturnType<typeof resolveTheme>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
  });
  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(themeStorageKey, next);
  }, []);
  const toggleMode = useCallback(
    () => setModeState((current) => {
      const next = current === "light" ? "dark" : "light";
      if (typeof window !== "undefined") window.localStorage.setItem(themeStorageKey, next);
      return next;
    }),
    [],
  );
  const theme = useMemo(() => resolveTheme(mode), [mode]);
  const value = useMemo(
    () => ({ mode, setMode, toggleMode, theme }),
    [mode, theme, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const themeStorageKey = "pollycar.preference.theme";

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme 必须在 ThemeProvider 内使用");
  }
  return context;
}
