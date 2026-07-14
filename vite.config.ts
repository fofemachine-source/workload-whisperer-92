import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    // Compatibilidade com navegadores antigos (Smart TVs WebOS/Tizen,
    // Chromium antigo). Sem isso o bundle ES2020+ não roda e a tela fica preta.
    legacy({
      targets: ["chrome >= 64", "edge >= 79", "safari >= 12", "firefox >= 67"],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  // build.target removido para o plugin-legacy gerenciar os targets nativamente
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
