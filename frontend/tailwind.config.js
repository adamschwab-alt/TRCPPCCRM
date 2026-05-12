/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        redland: {
          red: "#8B1A1A",
          "red-dark": "#6e1414",
          "red-light": "#a52424",
          charcoal: "#2D2D2D",
          gold: "#C9A84C",
          "gold-light": "#dcc16f",
          gray: "#F5F5F5",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
