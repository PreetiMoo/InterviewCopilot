/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./sidepanel.html", "./popup.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted: "rgb(var(--surface-muted) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
