import LogsClient from "./page.client";
export { metadata } from "./metadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function LogsPage() {
  return <LogsClient />;
}
