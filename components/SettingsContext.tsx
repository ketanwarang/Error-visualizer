"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  ThemeMode,
} from "@/lib/settings";

interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  updateErrorColor: (key: "both" | "group" | "class", hex: string) => void;
}

const Ctx = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
  updateErrorColor: () => {},
});

export function useSettings() {
  return useContext(Ctx);
}

/** Resolve "system" to a concrete mode. */
function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    setSettings(loadSettings());
    setMounted(true);
  }, []);

  // Apply theme to <html> + CSS variables whenever settings change
  useEffect(() => {
    if (!mounted) return;
    const resolved = resolveTheme(settings.theme);
    document.documentElement.setAttribute("data-theme", resolved);

    // Accent / brand
    document.documentElement.style.setProperty(
      "--color-brand",
      settings.accentColor
    );
    // Soft tint derived from accent
    document.documentElement.style.setProperty(
      "--color-brand-soft",
      settings.accentColor + "18"
    );

    // Error colours
    document.documentElement.style.setProperty(
      "--color-err-both",
      settings.errorColors.both
    );
    document.documentElement.style.setProperty(
      "--color-err-group",
      settings.errorColors.group
    );
    document.documentElement.style.setProperty(
      "--color-err-class",
      settings.errorColors.class
    );
  }, [settings, mounted]);

  // Listen for OS theme changes when "system" is selected
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.setAttribute(
        "data-theme",
        mq.matches ? "dark" : "light"
      );
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  const update = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        if (patch.errorColors)
          next.errorColors = { ...prev.errorColors, ...patch.errorColors };
        saveSettings(next);
        return next;
      });
    },
    []
  );

  const updateErrorColor = useCallback(
    (key: "both" | "group" | "class", hex: string) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          errorColors: { ...prev.errorColors, [key]: hex },
        };
        saveSettings(next);
        return next;
      });
    },
    []
  );

  const value = useMemo(
    () => ({ settings, update, updateErrorColor }),
    [settings, update, updateErrorColor]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
