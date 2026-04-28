"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Server, Layout, Copy, ExternalLink, Zap, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { CFServiceBadge, CFServiceType, CF_SERVICES } from "@/components/ui/cf-service-badge"

const WORKER_SERVICES: Record<string, CFServiceType[]> = {
  "hoox": ["Rate Limiting", "Queues", "Service Binding", "Durable Objects", "KV"],
  "trade-worker": ["D1", "Queues", "KV", "R2", "Service Binding"],
  "d1-worker": ["D1", "Service Binding"],
  "agent-worker": ["Workers AI", "D1", "Service Binding", "KV"],
  "telegram-worker": ["Service Binding", "R2", "KV", "Workers AI"],
  "email-worker": ["Service Binding"],
};

const DEPLOYED_WORKERS = [
  { name: "hoox", role: "Webhook Gateway", url: "https://hoox.cryptolinx.workers.dev", status: "active" },
  { name: "trade-worker", role: "Execution Engine", url: "https://trade-worker.cryptolinx.workers.dev", status: "active" },
  { name: "agent-worker", role: "AI Risk Manager", url: "https://agent-worker.cryptolinx.workers.dev", status: "active" },
  { name: "telegram-worker", role: "Notifications", url: "https://telegram-worker.cryptolinx.workers.dev", status: "active" },
  { name: "d1-worker", role: "Database Layer", url: "https://d1-worker.cryptolinx.workers.dev", status: "active" },
  { name: "email-worker", role: "IMAP Scanner", url: "https://email-worker.cryptolinx.workers.dev", status: "active" },
  { name: "web3-wallet-worker", role: "On-Chain DEX", url: "https://web3-wallet-worker.cryptolinx.workers.dev", status: "active" },

]

const DEPLOYED_PAGES = [
  { name: "dashboard", role: "Command Center UI", url: "https://hoox-dashboard.pages.dev", status: "active" },
]

export function DeployedInfrastructure() {
  const copyUrl = (url: string) => {
    if (url === "-") return;
    navigator.clipboard.writeText(url)
    toast.success("URL copied to clipboard")
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            Cloudflare Infrastructure
          </CardTitle>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Zap className="h-3 w-3 mr-1" /> Edge Network
          </Badge>
        </div>
        <CardDescription>
          Your deployed serverless functions and frontend pages
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid lg:grid-cols-[1fr_400px] divide-y lg:divide-y-0 lg:divide-x divide-border">
          <div className="flex flex-col divide-y divide-border">
          {/* Workers Section */}
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground/80 mb-2">
              <Server className="h-4 w-4" /> Workers
            </div>
            <div className="space-y-2">
              {DEPLOYED_WORKERS.map((worker) => (
                <div key={worker.name} className={`flex items-center justify-between p-2.5 rounded-md border ${worker.status === 'active' ? 'border-border/50 bg-secondary/20 hover:bg-secondary/40' : 'border-border/20 bg-muted/10 opacity-70'} transition-colors group`}>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{worker.name}</span>
                      {worker.status === 'active' ? (
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate">{worker.role}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {WORKER_SERVICES[worker.name]?.map((service) => (
                        <CFServiceBadge key={service} service={service} mini />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {worker.status === 'active' && worker.url !== "-" && (
                      <>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => copyUrl(worker.url)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" asChild>
                          <a href={worker.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

                    {/* Pages Section */}
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground/80 mb-2">
              <Layout className="h-4 w-4" /> Pages
            </div>
            <div className="space-y-2">
              {DEPLOYED_PAGES.map((page) => (
                <div key={page.name} className={`flex items-center justify-between p-2.5 rounded-md border ${page.status === 'active' ? 'border-border/50 bg-secondary/20 hover:bg-secondary/40' : 'border-border/20 bg-muted/10 opacity-70'} transition-colors group`}>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{page.name}</span>
                      {page.status === 'active' ? (
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)] animate-pulse" />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate">{page.role}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {page.status === 'active' && page.url !== "-" && (
                      <>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => copyUrl(page.url)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" asChild>
                          <a href={page.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
                
          {/* Storage & Databases Section */}
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground/80 mb-2">
              <Server className="h-4 w-4" /> Storage & Databases
            </div>
            <div className="space-y-2">
              {[
                { name: "trade_data", role: "D1 Relational Database", type: "D1", status: "active" },
                { name: "my-rag-index", role: "Vectorize Database", type: "Vectorize", status: "active" },
                { name: "trade-reports", role: "R2 Object Storage", type: "R2", status: "active" },
                { name: "hoox_config", role: "KV Namespace", type: "KV", status: "active" },
              ].map((resource) => (
                <div key={resource.name} className={`flex items-center justify-between p-2.5 rounded-md border ${resource.status === 'active' ? 'border-border/50 bg-secondary/20 hover:bg-secondary/40' : 'border-border/20 bg-muted/10 opacity-70'} transition-colors group`}>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{resource.name}</span>
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate">{resource.role}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">{resource.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

          {/* Legend Section */}
          <div className="p-4 space-y-4">
            <h3 className="text-sm font-semibold tracking-tight text-foreground/80 mb-2">Infrastructure Legend</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.values(CF_SERVICES).map((service) => {
                const Icon = service.icon;
                return (
                  <div key={service.name} className={`flex items-start gap-3 p-3 rounded-xl border ${service.bgColorClass} bg-opacity-50 transition-all hover:scale-[1.02]`}>
                    <div className={`p-2 rounded-lg bg-background/50 backdrop-blur-sm ${service.colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{service.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
