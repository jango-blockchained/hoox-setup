import type { ReactNode } from "react";
import { CodeEditorMockup, ShieldMockup, ServerMockup, TerminalMockup, StorageMockup } from "./Placeholders";

interface FeatureCardProps {
  title: string;
  description: string;
  mockup: ReactNode;
}

interface FeatureGridProps {
  features?: FeatureCardProps[];
}

const defaultFeatures: FeatureCardProps[] = [
  {
    title: "Edge Execution Engine",
    description: "Dynamic routing with sub-millisecond latency to exchanges via Cloudflare Workers.",
    mockup: <CodeEditorMockup />
  },
  {
    title: "Enterprise-Grade Security",
    description: "WAF, IP allowlists, and KV kill-switches inherited from Cloudflare's infrastructure.",
    mockup: <ShieldMockup />
  },
  {
    title: "Microservice Architecture",
    description: "8 specialized workers communicating via Service Bindings for fault isolation.",
    mockup: <ServerMockup />
  },
  {
    title: "Async Queues & Logging",
    description: "Guaranteed trade delivery via Cloudflare Queues with R2 log offloading.",
    mockup: <TerminalMockup />
  },
  {
    title: "Command Center",
    description: "Real-time React dashboard with embedded risk manager and live portfolio tracking.",
    mockup: <StorageMockup />
  }
];

export function FeatureGrid({ features = defaultFeatures }: FeatureGridProps) {
  return (
    <section className="py-16 px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {features.map((feature, i) => (
          <div key={i} className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
            <p className="text-muted-foreground mb-4">{feature.description}</p>
            <div className="bg-muted rounded-md p-4 min-h-[200px] flex items-center justify-center">
              {feature.mockup}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
