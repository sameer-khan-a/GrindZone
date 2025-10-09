import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  // Load environment variables from .env.[mode]
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "0.0.0.0", // allows LAN access (mobile testing)
      port: Number(env.VITE_PORT) || 8080,
      open: true, // auto-open browser in dev
      cors: true,
      proxy: {
        // auto-forward API calls to backend
        "/api": {
          target: env.VITE_API_URL || "http://localhost:5000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [
      react(),
      // Only apply componentTagger in dev mode
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: "dist",
      sourcemap: mode === "development",
    },
  };
});
