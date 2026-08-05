import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const rawPort = process.env.PORT ?? env.PORT;
  const basePath = process.env.BASE_PATH ?? env.BASE_PATH ?? "/";
  const portalMode = env.VITE_PORTAL === "staff" || env.VITE_PORTAL === "client" ? env.VITE_PORTAL : "all";
  const outDir = portalMode === "all" ? "dist/public" : `dist/${portalMode}`;
  const port = parsePort(rawPort, 5173);

  return {
    base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, outDir),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(import.meta.dirname, "index.html"),
        "booth-render": path.resolve(import.meta.dirname, "booth-render.html"),
      },
      // Radix UI packages ship without source maps. Suppress the cascade of
      // SOURCEMAP_ERROR warnings that Rollup emits when it tries to link
      // shadcn/ui component imports back to Radix internals.
      onwarn(warning, defaultHandler) {
        if (warning.code === "SOURCEMAP_ERROR") return;
        defaultHandler(warning);
      },
      output: {
        manualChunks: splitVendorChunks,
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    watch: {
      ignored: ["**/.dev-data/**"],
    },
    fs: {
      strict: true,
    },
    // Proxy all /api calls to the Express backend in development.
    // Start the backend with: npm run server
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? 5000}`,
        changeOrigin: true,
      },
      "/workspace-assets": {
        target: `http://localhost:${process.env.API_PORT ?? 5000}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  };
});

function parsePort(rawPort: string | undefined, fallback: number) {
  if (!rawPort) return fallback;

  const parsed = Number(rawPort);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return parsed;
}

function splitVendorChunks(id: string) {
  const normalizedId = id.replace(/\\/g, "/");

  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  if (
    normalizedId.includes("/react/") ||
    normalizedId.includes("/react-dom/") ||
    normalizedId.includes("/scheduler/")
  ) {
    return "vendor-react";
  }

  if (normalizedId.includes("/@radix-ui/")) {
    return "vendor-radix";
  }

  if (
    normalizedId.includes("/recharts/") ||
    normalizedId.includes("/d3-") ||
    normalizedId.includes("/victory-vendor/")
  ) {
    return "vendor-charts";
  }

  if (normalizedId.includes("/three/") || normalizedId.includes("/@react-three/")) {
    return "vendor-three";
  }

  if (normalizedId.includes("/i18next/") || normalizedId.includes("/react-i18next/")) {
    return "vendor-i18n";
  }

  if (normalizedId.includes("/framer-motion/")) {
    return "vendor-motion";
  }

  if (normalizedId.includes("/lucide-react/")) {
    return "vendor-icons";
  }

  return undefined;
}
