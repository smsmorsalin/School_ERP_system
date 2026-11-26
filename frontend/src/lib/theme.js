import { useEffect } from "react";

const STORAGE_KEY = "school-erp-theme";
const DEFAULT_KEY = "school-erp-default-theme";
const THEME_COLORS = { light: "#17613d", dark: "#0f1a15" };

/** Resolve the OS colour scheme. */
export function systemTheme() {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

/** True when this browser has an explicit light/dark choice. */
export function hasStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light";
  } catch {
    return false;
  }
}

/** Resolve the theme a fresh visitor should see. */
function resolveInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    // The school-wide default is cached after the first settings fetch so
    // repeat visits paint the right theme before React mounts.
    const schoolDefault = localStorage.getItem(DEFAULT_KEY);
    if (schoolDefault === "light" || schoolDefault === "dark") return schoolDefault;
  } catch {
    /* storage unavailable (private mode) — fall through to system preference */
  }
  return systemTheme();
}

/** Apply a theme by toggling a data attribute on <html>. */
export function applyTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[resolved]);
}

/** Current theme, resolved once. */
export function initialTheme() {
  const theme = resolveInitialTheme();
  applyTheme(theme);
  return theme;
}

/** Persist and apply an explicit user choice. */
export function setStoredTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}

/** Remember the admin's default so the next page load can use it immediately. */
export function cacheDefaultTheme(preference) {
  const value = preference === "light" || preference === "dark" ? preference : "system";
  try {
    localStorage.setItem(DEFAULT_KEY, value);
  } catch {
    /* ignore */
  }
}

/** Apply the school default unless this browser has already chosen a theme. */
export function applyDefaultTheme(preference) {
  if (hasStoredTheme()) return;
  const theme =
    preference === "light" || preference === "dark" ? preference : systemTheme();
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
      if (hasStoredTheme()) return; // respect an explicit choice
      setTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [setTheme]);
}
