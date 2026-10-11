import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-dropdown-menu", "@radix-ui/react-avatar", "@radix-ui/react-switch", "@radix-ui/react-label", "@radix-ui/react-separator", "@radix-ui/react-slot", "@radix-ui/react-popover", "@radix-ui/react-tooltip", "@radix-ui/react-toast"],
          "chart-vendor": ["recharts"],
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
          "state-vendor": ["zustand", "@tanstack/react-query"],
          "utils-vendor": ["date-fns", "clsx", "tailwind-merge", "class-variance-authority"],
        },
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
