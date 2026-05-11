import { defineConfig } from "astro/config";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  site: "https://jango-blockchained.github.io",
  base: "/hoox-setup",
  output: "static",
  vite: {
    plugins: [tailwind()],
  },
  build: {
    assets: "_assets",
  },
});
