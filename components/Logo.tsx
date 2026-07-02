"use client";

/**
 * Inline SVG logo — a shelf with a magnifying glass.
 * Uses the current --color-brand CSS variable so it follows the accent theme.
 */
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-transform duration-200 group-hover:rotate-[-6deg]"
    >
      <rect width="32" height="32" rx="8" fill="var(--color-brand, #E8501A)" />
      <path
        d="M8 12h16M8 17h16M8 22h16"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="22" cy="10" r="5" fill="#fff" fillOpacity="0.9" />
      <circle cx="22" cy="10" r="2" fill="var(--color-brand, #E8501A)" />
      <line
        x1="25.5"
        y1="13.5"
        x2="28"
        y2="16"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
