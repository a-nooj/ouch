/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#FDFCF8",
        foreground: "#2C2C24",
        primary: {
          DEFAULT: "#5D7052",
          foreground: "#F3F4F1",
        },
        secondary: {
          DEFAULT: "#C18C5D",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#E6DCCD",
          foreground: "#4A4A40",
        },
        muted: {
          DEFAULT: "#F0EBE5",
          foreground: "#78786C",
        },
        border: "#DED8CF",
        destructive: {
          DEFAULT: "#A85448",
          foreground: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "'Fira Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(93, 112, 82, 0.15)",
        float: "0 10px 40px -10px rgba(193, 140, 93, 0.20)",
        panel:
          "0 24px 64px -12px rgba(44, 44, 36, 0.28), 0 4px 20px -4px rgba(93, 112, 82, 0.14)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
