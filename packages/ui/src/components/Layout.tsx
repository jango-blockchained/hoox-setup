import { Button } from "./Button";

export function Navbar() {
  return (
    <nav className="border-b">
      <div className="flex h-16 items-center px-4 max-w-7xl mx-auto justify-between">
        <div className="font-bold text-xl">Hoox</div>
        <div className="flex gap-4">
          <Button variant="outline">GitHub</Button>
        </div>
      </div>
    </nav>
  );
}

export function Pricing() {
  return (
    <section className="py-20 text-center px-4 bg-muted/50">
      <h2 className="text-3xl font-bold mb-4">Simple pricing for production teams</h2>
      <p className="text-muted-foreground mb-8">Deploy to Cloudflare's free tier with zero ongoing costs.</p>
      <div className="max-w-sm mx-auto border rounded-xl p-8 bg-background shadow-sm">
        <h3 className="text-2xl font-bold mb-2">Free Forever</h3>
        <p className="text-4xl font-extrabold mb-6">$0<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
        <ul className="text-left space-y-3 mb-8">
          <li>✓ 100k requests / day</li>
          <li>✓ D1 SQL Database</li>
          <li>✓ R2 Object Storage</li>
          <li>✓ Global Edge Execution</li>
        </ul>
        <Button className="w-full">Deploy Now</Button>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t py-8 text-center text-sm text-muted-foreground">
      <p>© 2026 Hoox Trading. All rights reserved.</p>
    </footer>
  );
}
