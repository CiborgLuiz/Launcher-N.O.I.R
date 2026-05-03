module.exports = {
  content: [
    "./apps/desktop/index.html",
    "./apps/desktop/src/**/*.{ts,tsx}",
    "./packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        noir: {
          background: "#050505",
          surface: "#0C0C0C",
          panel: "#111111",
          gold: "#C9A24E",
          brass: "#B98A35",
          sand: "#E8CB83",
          ink: "#050505",
          mist: "#F7E8C3",
          muted: "#B89A55",
          bronze: "#6B521F",
          success: "#8FCB8C",
          error: "#E28A74"
        }
      },
      fontFamily: {
        display: ["'Rajdhani'", "'Segoe UI'", "sans-serif"],
        body: ["'Space Grotesk'", "'Segoe UI'", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 38px rgba(201, 162, 78, 0.24), 0 0 18px rgba(157, 120, 48, 0.16)",
        card: "0 18px 48px rgba(0, 0, 0, 0.45)"
      },
      backgroundImage: {
        "noir-grid":
          "linear-gradient(rgba(201,162,78,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(157,120,48,0.08) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};
