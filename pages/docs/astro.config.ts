import { defineConfig } from "astro/config";
import tailwind from "@tailwindcss/vite";
import react from "@astrojs/react";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: "https://jango-blockchained.github.io",
  base: "/hoox-setup",
  output: "static",
  integrations: [react()],
  markdown: {
    shikiConfig: {
      theme: "github-dark",
      wrap: false,
    },
  },
  vite: {
    plugins: [tailwind()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
  },
  build: {
    assets: "_assets",
  },
});
