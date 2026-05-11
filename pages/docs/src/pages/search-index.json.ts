import { getCollection } from "astro:content";

export async function GET() {
  const docs = await getCollection("docs");
  const entries = docs.map((doc) => ({
    slug: doc.id.replace(/\.md$/, ""),
    title: doc.data.title || doc.id.split("/").pop()?.replace(/\.md$/, "") || "",
    content: ((doc as any).body || "").substring(0, 2000),
    section: doc.id.split("/")[0] || "",
  }));
  return new Response(JSON.stringify(entries), {
    headers: { "Content-Type": "application/json" },
  });
}
