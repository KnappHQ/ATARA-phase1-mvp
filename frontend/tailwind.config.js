module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ATARA Universal Sovereignty Design System
        obsidian: "#05010A",
        void: "#000000",
        platinum: {
          DEFAULT: "#F5F5F0",
          muted: "#c6c1b9",
        },
        primary: "#f7f7f3",
        sapphire: "#4ade80",
        bitcoin: "#F7931A",
        glass: {
          DEFAULT: "rgba(5, 1, 10, 0.6)",
          strong: "rgba(5, 1, 10, 0.8)",
          border: "rgba(224, 224, 224, 0.3)",
        },
        muted: "#8a8375",
        emarald: "#10b981",
        accent: "#3c83f6",
      },
      fontFamily: {
        sans: ["System"],
        mono: ["Courier", "monospace"],
      },
      letterSpacing: {
        ultra: "0.25em",
      },
    },
  },
  plugins: [],
};
