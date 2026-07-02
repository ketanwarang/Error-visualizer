import type { Config } from "tailwindcss";

function cv(variable: string): any {
  return ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue !== undefined) {
      return `color-mix(in srgb, var(${variable}) calc(${opacityValue} * 100%), transparent)`;
    }
    return `var(${variable})`;
  };
}

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: cv("--color-ink"),
        soot: cv("--color-soot"),
        mute: cv("--color-mute"),
        line: cv("--color-line"),
        paper: cv("--color-paper"),
        wash: cv("--color-wash"),
        stage: cv("--color-stage"),
        brand: cv("--color-brand"),
        "brand-soft": cv("--color-brand-soft"),
        "err-both": cv("--color-err-both"),
        "err-group": cv("--color-err-group"),
        "err-class": cv("--color-err-class"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,16,20,.04), 0 8px 24px -12px rgba(16,16,20,.10)",
        lens: "0 12px 40px rgba(0,0,0,.45)",
        pop: "0 4px 12px rgba(16,16,20,.08), 0 16px 48px -16px rgba(16,16,20,.18)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: { shimmer: "shimmer 1.4s linear infinite" },
    },
  },
  plugins: [],
};
export default config;
