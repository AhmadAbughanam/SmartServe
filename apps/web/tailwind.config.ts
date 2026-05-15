import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#1a1f2e",
          ember: "#d4581d",
          "ember-light": "#f0a06a",
          "ember-soft": "#fef3eb",
          sand: "#f3f1ec",
          "sand-warm": "#f9f6f0",
          mint: "#1a9a6b",
          "mint-soft": "#e8f8f0",
        },
      },
      boxShadow: {
        "card": "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
        "float": "0 8px 32px rgba(0,0,0,0.10)",
        "glow-ember": "0 0 24px rgba(212,88,29,0.15)",
      },
      borderRadius: {
        "2.5xl": "20px",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
    },
  },
  plugins: [],
};

export default config;
