import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        craft: ["Inter", "system-ui", "sans-serif"],
        display: ["Cal Sans", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        background: "#ffffff",
        foreground: "#111827",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#111827",
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#111827",
        },
        primary: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
          DEFAULT: "#f97316",
          foreground: "#ffffff",
        },
        secondary: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
          DEFAULT: "#fff3e8",
          foreground: "#7c2d12",
        },
        muted: {
          DEFAULT: "#f4f4f5",
          foreground: "#52525b",
        },
        accent: {
          DEFAULT: "#fff3e8",
          foreground: "#7c2d12",
        },
        gray: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },
        white: "#ffffff",
        cream: "#fefcf7",
        destructive: {
          DEFAULT: "#ff4d4d",
          foreground: "#ffffff",
        },
        border: "#e5e7eb",
        input: "#e5e7eb",
        ring: "#ff7a18",
        brand: {
          white: "#ffffff",
          orange: "#ff7a18",
          red: "#ff4d4d",
        },
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
        "gradient-secondary": "linear-gradient(135deg, #fff7ed 0%, #fef2f2 100%)",
        "gradient-card": "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,247,237,0.9) 100%)",
        "gradient-glass": "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
      },
      boxShadow: {
        craft: "0 25px 50px -12px rgba(0, 0, 0, 0.1)",
        "craft-lg": "0 35px 60px -12px rgba(0, 0, 0, 0.15)",
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        128: "32rem",
        section: "5rem",
        element: "2rem",
        component: "1.5rem",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;