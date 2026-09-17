/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta "Monzo-inspired"
        coral: {
          DEFAULT: "#FF4F40",
          dark: "#E03D30",
          soft: "#FFE5E2",
        },
        carbon: {
          DEFAULT: "#1A1523",
          light: "#2D2438",
        },
        cream: {
          DEFAULT: "#FEFAF5",
          dark: "#F5EFE6",
        },
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
};
