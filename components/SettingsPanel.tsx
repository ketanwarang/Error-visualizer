"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "./SettingsContext";
import { ACCENT_PRESETS, DEFAULT_SETTINGS, ThemeMode } from "@/lib/settings";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "system", label: "System", icon: "💻" },
];

const ERROR_LABELS: { key: "both" | "group" | "class"; label: string }[] = [
  { key: "both", label: "Wrong group" },
  { key: "group", label: "Wrong group" },
  { key: "class", label: "Wrong class" },
];

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const { settings, update, updateErrorColor } = useSettings();
  const panelRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    setSpinning(true);
    setOpen((o) => !o);
    setTimeout(() => setSpinning(false), 500);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Gear icon */}
      <button
        onClick={toggleOpen}
        className="grid h-9 w-9 place-items-center rounded-lg transition-colors hover:bg-wash"
        title="Settings"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-mute transition-transform duration-500 ${
            spinning ? "rotate-180" : ""
          }`}
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed right-4 top-16 z-[60] w-[320px] overflow-hidden rounded-2xl border border-line bg-paper shadow-pop"
          >
            <div className="border-b border-line px-5 py-3.5">
              <h3 className="text-[14px] font-bold text-ink">Settings</h3>
              <p className="mt-0.5 text-[11px] text-mute">
                Preferences are saved automatically
              </p>
            </div>

            <div className="slim-scroll max-h-[calc(100vh-120px)] overflow-y-auto px-5 py-4 space-y-5">
              {/* ── Theme ── */}
              <Section title="Theme">
                <div className="grid grid-cols-3 gap-1.5">
                  {THEME_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => update({ theme: t.value })}
                      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition-all duration-150 ${
                        settings.theme === t.value
                          ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]"
                          : "border-line text-mute hover:border-[var(--color-brand)]/40"
                      }`}
                    >
                      <span className="text-base">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </Section>

              {/* ── Accent Color ── */}
              <Section title="Accent color">
                <div className="flex flex-wrap gap-2">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => update({ accentColor: c.hex })}
                      className={`group/swatch relative h-8 w-8 rounded-full border-2 transition-all duration-150 ${
                        settings.accentColor === c.hex
                          ? "border-ink scale-110 shadow-card"
                          : "border-transparent hover:scale-105"
                      }`}
                      title={c.name}
                    >
                      <span
                        className="absolute inset-[2px] rounded-full"
                        style={{ background: c.hex }}
                      />
                    </button>
                  ))}
                </div>
              </Section>

              {/* ── Image Viewer Size ── */}
              <Section title="Image viewer size">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={settings.viewerScale}
                    onChange={(e) =>
                      update({ viewerScale: Number(e.target.value) })
                    }
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-[var(--color-brand)]"
                  />
                  <span className="w-12 text-right font-mono text-[12px] font-semibold text-ink">
                    {Math.round(settings.viewerScale * 100)}%
                  </span>
                </div>
                <button
                  onClick={() =>
                    update({
                      viewerScale: DEFAULT_SETTINGS.viewerScale,
                    })
                  }
                  className="mt-1.5 text-[11px] font-medium text-mute transition-colors hover:text-[var(--color-brand)]"
                >
                  Reset to {Math.round(DEFAULT_SETTINGS.viewerScale * 100)}%
                </button>
              </Section>

              {/* ── Error Colors ── */}
              <Section title="Error colors">
                <div className="space-y-2">
                  {ERROR_LABELS.map((e) => (
                    <div key={e.key} className="flex items-center gap-3">
                      <label className="flex-1 text-[12px] font-medium text-soot">
                        {e.label}
                      </label>
                      <div className="relative">
                        <input
                          type="color"
                          value={settings.errorColors[e.key]}
                          onChange={(ev) =>
                            updateErrorColor(e.key, ev.target.value)
                          }
                          className="h-7 w-10 cursor-pointer rounded border border-line bg-transparent"
                        />
                      </div>
                      <span className="w-16 font-mono text-[10px] text-mute">
                        {settings.errorColors[e.key]}
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      update({ errorColors: DEFAULT_SETTINGS.errorColors })
                    }
                    className="text-[11px] font-medium text-mute transition-colors hover:text-[var(--color-brand)]"
                  >
                    Reset to defaults
                  </button>
                </div>
              </Section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-mute">
        {title}
      </p>
      {children}
    </div>
  );
}
