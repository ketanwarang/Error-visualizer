/**
 * Centralised settings store — persisted in localStorage.
 * Same persistence pattern as device.ts / sessions.ts.
 */

const SETTINGS_KEY = "sw_settings";

export type ThemeMode = "light" | "dark" | "system";

/** VIBGYOR accent presets. */
export const ACCENT_PRESETS = [
  { name: "Violet", hex: "#7C3AED" },
  { name: "Indigo", hex: "#4F46E5" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Green", hex: "#059669" },
  { name: "Yellow", hex: "#CA8A04" },
  { name: "Orange", hex: "#E8501A" },
  { name: "Red", hex: "#DC2626" },
] as const;

export interface AppSettings {
  /** Image viewer height multiplier, 0.5–1.5 (default 0.85 = 15 % smaller). */
  viewerScale: number;
  /** Image viewer width multiplier, 0.5–1.5 (default 1.0). */
  viewerWidthScale: number;
  /** Light / dark / system. */
  theme: ThemeMode;
  /** Active accent hex — one of the VIBGYOR presets. */
  accentColor: string;
  /** Per-error-type colours. */
  errorColors: {
    both: string;
    group: string;
    class: string;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  viewerScale: 0.85,
  viewerWidthScale: 1.0,
  theme: "system",
  accentColor: "#E8501A",
  errorColors: {
    both: "#7C3AED",
    group: "#F59E0B",
    class: "#EF4444",
  },
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      errorColors: {
        ...DEFAULT_SETTINGS.errorColors,
        ...(parsed.errorColors ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
