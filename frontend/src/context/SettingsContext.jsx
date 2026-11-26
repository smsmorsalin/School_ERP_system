import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { applyDefaultTheme, cacheDefaultTheme } from "../lib/theme";

export const DEFAULT_SETTINGS = {
  school_name: "School ERP",
  short_name: "",
  tagline: "Management console",
  address: "",
  phone: "",
  email: "",
  website: "",
  logo_url: null,
  favicon_url: null,
  login_headline: "Everything your school needs, *in one calm place.*",
  login_subtext:
    "Admissions, attendance, examinations and finance — connected so your team can spend less time on admin and more time on students.",
  login_notice: "",
  accent: "forest",
  default_theme: "system",
  compact_tables: false,
  updated_by_name: null,
  updated_at: null,
};

export const ACCENTS = [
  { id: "forest", label: "Forest", color: "#17613d" },
  { id: "navy", label: "Navy", color: "#1d4e89" },
  { id: "plum", label: "Plum", color: "#6d2a52" },
  { id: "teal", label: "Teal", color: "#0f6b6b" },
  { id: "maroon", label: "Maroon", color: "#8a2c2c" },
];

const SettingsContext = createContext(null);

const DEFAULT_FAVICON =
  typeof document !== "undefined"
    ? document.querySelector('link[rel="icon"]')?.getAttribute("href") || ""
    : "";

/** Reflect branding tokens on <html>; CSS handles the rest. */
function applyBranding(settings) {
  const root = document.documentElement;
  root.setAttribute("data-accent", settings.accent || "forest");
  if (settings.compact_tables) root.setAttribute("data-density", "compact");
  else root.removeAttribute("data-density");

  const icon = document.querySelector('link[rel="icon"]');
  if (icon) {
    const version = settings.updated_at
      ? `?v=${encodeURIComponent(settings.updated_at)}`
      : "";
    icon.setAttribute(
      "href",
      settings.favicon_url ? `${settings.favicon_url}${version}` : DEFAULT_FAVICON
    );
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Wait for the first successful fetch before touching the theme: the
  // pre-paint bootstrap may already have applied a cached school default, and
  // the built-in fallback would otherwise flash over it.
  useEffect(() => {
    if (!synced) return;
    applyBranding(settings);
    cacheDefaultTheme(settings.default_theme);
    applyDefaultTheme(settings.default_theme);
  }, [settings, synced]);

  const refreshSettings = useCallback(async () => {
    try {
      const data = await api.get("/settings/", null, { retry: false });
      if (!mounted.current) return null;
      const next = { ...DEFAULT_SETTINGS, ...data };
      setSettings(next);
      setSynced(true);
      return next;
    } catch {
      // Branding is presentation only; keep the built-in defaults on failure.
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      refreshSettings,
      setSettings,
      schoolName: settings.school_name || "School ERP",
      brandLine: settings.short_name || settings.tagline || "Management console",
    }),
    [settings, loading, refreshSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}
