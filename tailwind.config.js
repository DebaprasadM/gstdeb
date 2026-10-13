/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F6F8FB",
        primary: {
          DEFAULT: "#0F4C81",
          50: "#EDF3F9",
          100: "#D8E6F3",
          200: "#B3CDE6",
          500: "#1B6AAE",
          600: "#155C96",
          700: "#0F4C81",
          800: "#0C3B64",
          900: "#092C4B",
          950: "#061F35"
        },
        secondary: {
          DEFAULT: "#2E8B57",
          50: "#EAF5EE",
          100: "#D1E9D9",
          500: "#3AA76A",
          600: "#2E8B57",
          700: "#256F46",
          800: "#1D5A38",
          900: "#143E27"
        },
        accent: {
          DEFAULT: "#F4B400",
          50: "#FEF7E0",
          100: "#FDEFC3",
          300: "#FFD34D",
          400: "#FFC61A",
          500: "#F4B400",
          600: "#C78F00",
          700: "#9C7000"
        },
        ink: {
          DEFAULT: "#1E293B",
          soft: "#475569",
          faint: "#94A3B8"
        }
      },
      borderRadius: { card: "0.875rem" },
      boxShadow: {
        card: "0 1px 2px rgba(9, 44, 75, 0.05), 0 4px 16px -4px rgba(9, 44, 75, 0.09)",
        pop: "0 12px 40px -8px rgba(9, 44, 75, 0.24)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
      }
    }
  },
  plugins: []
};
