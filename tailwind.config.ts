import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f3f6fb",
          100: "#e6ecf6",
          200: "#c5d2e6",
          300: "#9eb3d2",
          400: "#6b87b3",
          500: "#476394",
          600: "#324b76",
          700: "#243860",
          800: "#1a2a4a",
          900: "#111e38",
        },
        sky: {
          50: "#f1f8ff",
          100: "#e0efff",
          200: "#bcdcff",
        },
      },
      fontFamily: {
        sans: ['"Hiragino Sans"', '"Noto Sans JP"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,30,56,0.06), 0 4px 16px rgba(17,30,56,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
