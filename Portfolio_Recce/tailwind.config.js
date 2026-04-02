/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        body: ["Sora", "sans-serif"],
      },
      colors: {
        skyaccent: "#27d2ff",
        warmaccent: "#ff8f3f",
      },
      boxShadow: {
        panel: "0 24px 55px rgba(0,0,0,0.35)",
      },
      keyframes: {
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        floatIn: "floatIn 0.7s ease forwards",
      },
    },
  },
  plugins: [],
};
