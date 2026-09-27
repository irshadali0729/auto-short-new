import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        rausch: {
          DEFAULT: "#ff385c",
          active: "#e00b41",
          disabled: "#ffd1da",
        },
        // Neutral tokens are RGB channel variables (see globals.css) so they
        // flip in dark mode and still support opacity modifiers (bg-ink/80).
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        body: "rgb(var(--body-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        hairline: "rgb(var(--hairline-rgb) / <alpha-value>)",
        "hairline-soft": "rgb(var(--hairline-soft-rgb) / <alpha-value>)",
        "surface-soft": "rgb(var(--surface-soft-rgb) / <alpha-value>)",
        "surface-strong": "rgb(var(--surface-strong-rgb) / <alpha-value>)",
        canvas: "rgb(var(--canvas-rgb) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong-rgb) / <alpha-value>)",
      },
      boxShadow: {
        airbnb: "rgba(0, 0, 0, 0.02) 0 0 0 1px, rgba(0, 0, 0, 0.04) 0 2px 6px 0, rgba(0, 0, 0, 0.1) 0 4px 8px 0",
        "airbnb-hover": "rgba(0, 0, 0, 0.04) 0 0 0 1px, rgba(0, 0, 0, 0.08) 0 6px 16px 0, rgba(0, 0, 0, 0.12) 0 8px 24px 0",
      },
      borderRadius: {
        'airbnb-card': '14px',
        'airbnb-btn': '8px',
      }
    },
  },
  plugins: [],
} satisfies Config;
