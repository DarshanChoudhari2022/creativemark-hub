import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Target modern browsers — safe for Android WebView (auto-updates)
    target: "es2020",
    // Smaller output with better minification
    minify: "esbuild",
    cssMinify: true,
    // Code-split large bundles for faster WebView load
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor core — cached separately from app code
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-popover", "@radix-ui/react-tabs", "@radix-ui/react-tooltip", "@radix-ui/react-dropdown-menu"],
          "vendor-charts": ["recharts"],
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-maps": ["maplibre-gl"],
        },
      },
    },
    // Reduce chunk size warnings threshold
    chunkSizeWarningLimit: 800,
  },
}));
