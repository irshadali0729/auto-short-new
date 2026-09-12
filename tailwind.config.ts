import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
        ink: "#222222",
        body: "#3f3f3f",
        muted: "#6a6a6a",
        hairline: "#dddddd",
        "hairline-soft": "#ebebeb",
        "surface-soft": "#f7f7f7",
        "surface-strong": "#f2f2f2",
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
