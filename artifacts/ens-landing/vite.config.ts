import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const rawPort = process.env.PORT ?? env.PORT;
  const basePath = process.env.BASE_PATH ?? env.BASE_PATH ?? "/";
  const requestedPortal =
    mode === "staff" || mode === "client"
      ? mode
      : process.env.VITE_PORTAL ?? env.VITE_PORTAL;
  const portalMode =
    requestedPortal === "staff" || requestedPortal === "client"
      ? requestedPortal
      : "all";
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
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets",
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    define: {
      "import.meta.env.VITE_PORTAL": JSON.stringify(portalMode),
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, outDir),
      emptyOutDir: true,
      // Three.js is route-loaded and governed by check-frontend-budgets.mjs.
      // Keep Vite's generic warning threshold aligned with that release gate.
      chunkSizeWarningLimit: 640,
      rollupOptions: {
        input: {
          index: path.resolve(import.meta.dirname, "index.html"),
          "booth-render": path.resolve(
            import.meta.dirname,
            "booth-render.html",
          ),
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

  // These helpers are used by the application shell and by Recharts. Keep
  // them out of the lazy chart chunk so landing pages do not preload Recharts.
  if (
    normalizedId.includes("/clsx/") ||
    normalizedId.includes("/tailwind-merge/")
  ) {
    return "vendor-utils";
  }

  if (
    normalizedId.includes("/recharts/") ||
    normalizedId.includes("/d3-") ||
    normalizedId.includes("/victory-vendor/")
  ) {
    return "vendor-charts";
  }

  if (
    normalizedId.includes("/three/") ||
    normalizedId.includes("/@react-three/")
  ) {
    return "vendor-three";
  }

  if (
    normalizedId.includes("/i18next/") ||
    normalizedId.includes("/react-i18next/")
  ) {
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
