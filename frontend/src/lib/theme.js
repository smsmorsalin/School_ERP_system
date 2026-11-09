import { useEffect } from "react";

const STORAGE_KEY = "school-erp-theme";

/** Resolve the theme a fresh visitor should see. */
function resolveInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* storage unavailable (private mode) — fall through to system preference */
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

/** Apply the theme by toggling a data attribute on <html>. */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1120" : "#4f46e5");
}

/** Current theme, resolved once. */
export function initialTheme() {
  const theme = resolveInitialTheme();
  applyTheme(theme);
  return theme;
}

/** Persist and apply a theme choice. */
export function setStoredTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}

/** React hook: keep <html> in sync and follow the OS setting until the user picks a side. */
export function useTheme(theme, setTheme) {
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event) => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return; // respect explicit choice
      } catch {
        /* ignore */
      }
      setTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [setTheme]);
}
