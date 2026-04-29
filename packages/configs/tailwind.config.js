/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [],
  theme: {
    extend: {
      colors: {
        primary: "#ff385c",
        "primary-hover": "#e00b41",
        ink: "#222222",
        charcoal: "#3f3f3f",
        ash: "#6a6a6a",
        mute: "#929292",
        stone: "#c1c1c1",
        border: "#dddddd",
        surface: "#f7f7f7",
        canvas: "#ffffff",
        error: "#c13515",
        // shadcn/ui compatible aliases
        background: "#ffffff",
        foreground: "#222222",
        muted: {
          DEFAULT: "#f7f7f7",
          foreground: "#6a6a6a",
        },
        accent: {
          DEFAULT: "#f7f7f7",
          foreground: "#222222",
        },
        destructive: {
          DEFAULT: "#c13515",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#222222",
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#222222",
        },
        secondary: {
          DEFAULT: "#f7f7f7",
          foreground: "#222222",
        },
        input: "#dddddd",
        ring: "#222222",
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "20px",
        xl: "32px",
        full: "9999px",
        // shadcn/ui uses DEFAULT for its radius
        DEFAULT: "8px",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "system-ui", "Roboto", "sans-serif"],
      },
      fontWeight: {
        body: "500",
        semibold: "600",
        bold: "700",
      },
      letterSpacing: {
        display: "-0.02em",
      },
      boxShadow: {
        card: "rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px 0, rgba(0,0,0,0.10) 0 4px 8px 0",
      },
      spacing: {
        // 8px base grid — key multiples
        4.5: "18px",
        13: "52px",
        18: "72px",
      },
    },
  },
  plugins: [],
};
