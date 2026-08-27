/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05070d",
          900: "#0a0e18",
          800: "#12182a",
          700: "#1b2338",
        },
        brand: {
          400: "#8b7bf0",
          500: "#6c56e8",
          600: "#5641c9",
        },
        gold: {
          300: "#f3d78a",
          400: "#e6bd5c",
          500: "#cf9d3a",
        },
        signal: {
          400: "#4fd6d0",
          500: "#2bb8b2",
        },
        // Semantic alias for Tailwind's own rose values — formalizes the error/danger
        // color already used ad hoc (text-rose-400) across auth/form error messages.
        danger: {
          400: "#fb7185",
          500: "#f43f5e",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
