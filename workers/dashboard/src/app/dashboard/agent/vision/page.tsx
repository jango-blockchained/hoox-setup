import VisionClient from "./page.client";
export { metadata } from "./metadata";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function VisionPage() {
  return <VisionClient />;
}
