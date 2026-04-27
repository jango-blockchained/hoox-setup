import { Navbar, Hero, FeatureGrid, Pricing, Footer } from "@hoox/ui";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <FeatureGrid />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
