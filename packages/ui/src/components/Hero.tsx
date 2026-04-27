import type { ReactNode } from "react";

interface HeroProps {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}

export function Hero({ 
  title = "Zero-Latency Edge Trading Ecosystem", 
  subtitle = "An open-source algorithmic trading framework built on Cloudflare Workers for microsecond execution.",
  children 
}: HeroProps) {
  return (
    <section className="py-20 px-4 text-center">
      <h1 className="text-5xl font-bold mb-6">{title}</h1>
      <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">{subtitle}</p>
      {children}
    </section>
  );
}
