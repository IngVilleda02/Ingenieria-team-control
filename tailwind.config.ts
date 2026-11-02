import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 50: "#eef3f9", 100: "#d6e2f0", 600: "#1d3f6e", 700: "#163257", 800: "#102542", 900: "#0b1a30" },
        sky: { 50: "#eff7ff", 100: "#dbeefe", 400: "#4aa8f0", 500: "#2b8fe0", 600: "#1c74c2" },
        line: "#e6e9ef",
        surface: "#f6f7f9",
        ok: { 50: "#ecfdf3", 600: "#16a34a", 700: "#15803d" },
        warn: { 50: "#fffbeb", 500: "#eab308", 700: "#a16207" },
        bad: { 50: "#fef2f2", 600: "#dc2626", 700: "#b91c1c" },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI Variable", "Segoe UI", "system-ui", "-apple-system", "Roboto", "sans-serif"],
      },
      fontSize: { "2xs": ["0.6875rem", "1rem"] },
    },
  },
  plugins: [],
} satisfies Config;
