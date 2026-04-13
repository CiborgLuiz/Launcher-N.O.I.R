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
          background: "#090806",
          surface: "#14110C",
          panel: "#1A1610",
          gold: "#C7A24A",
          brass: "#8E6A22",
          sand: "#E9D8A6",
          ink: "#040402",
          mist: "#F6F0E1",
          muted: "#A58E63",
          success: "#8FCB8C",
          error: "#E28A74"
        }
      },
      fontFamily: {
        display: ["'Rajdhani'", "'Segoe UI'", "sans-serif"],
        body: ["'Space Grotesk'", "'Segoe UI'", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 40px rgba(199, 162, 74, 0.22)",
        card: "0 18px 48px rgba(0, 0, 0, 0.45)"
      },
      backgroundImage: {
        "noir-grid":
          "linear-gradient(rgba(199,162,74,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(199,162,74,0.08) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};
