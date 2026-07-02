"use client";

/**
 * Modern AI Analysis computer vision scanning logo.
 * Uses the current --color-brand CSS variable so it follows the accent theme.
 */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-transform duration-300 group-hover:scale-105"
    >
      <rect width="36" height="36" rx="10" fill="var(--color-brand, #E8501A)" />
      {/* Corner inspection frame brackets */}
      <path
        d="M10 14V11.5C10 10.67 10.67 10 11.5 10H14"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M22 10H24.5C25.33 10 26 10.67 26 11.5V14"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M26 22V24.5C26 25.33 25.33 26 24.5 26H22"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M14 26H11.5C10.67 26 10 25.33 10 24.5V22"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* AI neural spark inside */}
      <path
        d="M18 12.5C18.4 15.5 20.5 17.6 23.5 18C20.5 18.4 18.4 20.5 18 23.5C17.6 20.5 15.5 18.4 12.5 18C15.5 17.6 17.6 15.5 18 12.5Z"
        fill="white"
      />
      <circle cx="24.5" cy="12.5" r="1.5" fill="white" fillOpacity="0.85" />
    </svg>
  );
}
