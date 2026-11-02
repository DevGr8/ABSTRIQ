/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        laboratory: {
          bg: "#050811",
          surface: "#0c1220",
          card: "rgba(14, 23, 42, 0.75)",
          border: "rgba(30, 41, 59, 0.8)",
          subtle: "#1e293b",
        },
        cyber: {
          green: "#00ff88",
          emerald: "#10b981",
          teal: "#14b8a6",
          cyan: "#06b6d4",
          blue: "#3b82f6",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        "neon-green": "0 0 20px rgba(0, 255, 136, 0.25), 0 0 40px rgba(0, 255, 136, 0.1)",
        "neon-green-sm": "0 0 10px rgba(0, 255, 136, 0.3)",
        "neon-cyan": "0 0 20px rgba(6, 182, 212, 0.25)",
        "glow-card": "0 8px 32px 0 rgba(0, 0, 0, 0.45)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "scan": "scan 3s linear infinite",
        "spin-slow": "spin 20s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1000%)" },
        },
      },
    },
  },
  plugins: [],
}
