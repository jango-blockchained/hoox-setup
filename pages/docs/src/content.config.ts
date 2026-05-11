import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsBase = path.resolve(__dirname, "../../..", "docs");

const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: docsBase }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const collections = { docs };
