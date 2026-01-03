module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#070609",
        foreground: "#EAE0CA",
        card: "#0F0A14",
        "card-foreground": "#F2EDE3",
        popover: "#0D080F",
        "popover-foreground": "#F2EDE3",
        primary: {
          DEFAULT: "#dfcfaa",
          foreground: "#0D080F",
        },
        secondary: {
          DEFAULT: "#A855F7",
          foreground: "#B3B3B3",
        },
        muted: {
          DEFAULT: "#12101A",
          foreground: "#808080",
        },
        accent: {
          DEFAULT: "#E5D2A6",
          foreground: "#0D080F",
        },
        destructive: {
          DEFAULT: "#DC2626",
          foreground: "#FFFFFF",
        },
        border: "#241f2e",
        input: "#1A1622",
        ring: "#E5D2A6",
        ceramic: "#14111C",
        "ceramic-hover": "#1C1826",
        void: "#06040A",
        champagne: {
          DEFAULT: "hsl(48, 100%, 70%)",
          light: "#FFEFC2",
          glow: "#F0CC5F",
          neon: "#F7DC8F",
        },
        "hud-cyan": {
          DEFAULT: "#00D9FF",
          glow: "#33E0FF",
        },
        obsidian: {
          DEFAULT: "#0D080F",
          glass: "#14111C",
        },
      },
      fontFamily: {
        sans: ["System"],
        display: ["Orbitron_400Regular"],
        hud: ["Orbitron_400Regular"],
        orbitron: ["Orbitron_400Regular"],
        rajdhani: ["Rajdhani_400Regular"],
        data: ["Rajdhani_400Regular"],
        "orbitron-medium": ["Orbitron_500Medium"],
        "orbitron-semibold": ["Orbitron_600SemiBold"],
        "orbitron-bold": ["Orbitron_700Bold"],
        "rajdhani-medium": ["Rajdhani_500Medium"],
        "rajdhani-semibold": ["Rajdhani_600SemiBold"],
        "rajdhani-bold": ["Rajdhani_700Bold"],
      },

      letterSpacing: {
        hud: "0.15em",
        "hud-wide": "0.25em",
        "hud-ultra": "0.35em",
      },
      borderRadius: {
        lg: "16px",
        md: "12px",
        sm: "8px",
        xl: "20px",
        "2xl": "24px",
      },
    },
  },
  plugins: [],
};
