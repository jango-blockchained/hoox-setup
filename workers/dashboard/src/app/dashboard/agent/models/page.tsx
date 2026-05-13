import ModelsClient from "./page.client";
export { metadata } from "./metadata";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function ModelsPage() {
  return <ModelsClient />;
}
