import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101014",
        soot: "#4B4B52",
        mute: "#9B9BA3",
        line: "#ECECEE",
        paper: "#FFFFFF",
        wash: "#F7F7F8",
        stage: "#0E0E11",
        brand: "#E8501A",
        "brand-soft": "#FDEEE7",
        "err-both": "#7C3AED",
        "err-group": "#F59E0B",
        "err-class": "#EF4444",
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
