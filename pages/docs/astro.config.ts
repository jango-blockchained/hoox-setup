import { defineConfig } from "astro/config";
import tailwind from "@tailwindcss/vite";
import react from "@astrojs/react";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: "https://docs.hoox.sh",
  output: "static",
  integrations: [react()],
  markdown: {
    shikiConfig: {
      theme: "one-dark-pro",
      wrap: false,
    },
  },
  vite: {
    plugins: [tailwind()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
      // Vite 8.0.10+ / Rolldown regression: @tailwindcss/vite passes
      // resolve.tsconfigPaths to Rolldown's binding layer which doesn't
      // recognize the field. Explicitly disable to prevent the crash.
      // Tracked upstream: https://github.com/vitejs/vite/issues/22322
      tsconfigPaths: false,
    },
  },
  build: {
    assets: "_assets",
  },
});
