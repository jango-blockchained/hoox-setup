"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/sonner";

interface ProviderHealth {
  name: string;
  healthy: boolean;
  latency?: number;
  error?: string;
}

export function HealthCheck() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/agent/health");
      const data = await res.json();
      if (data.success) {
        setProviders(
          Object.entries(data.providers).map(([name, info]: [string, any]) => ({
            name, healthy: info.healthy, latency: info.latency, error: info.error,
          }))
        );
      }
    } catch (e) { toast.error("Failed to fetch health status"); } 
    finally { setLoading(false); setChecking(false); }
  };

  useEffect(() => { fetchHealth(); }, []);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Health Check</CardTitle>
          <CardDescription>AI provider health status</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHealth} disabled={checking}>
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} data-icon="inline-end" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-secondary/30 rounded-lg animate-pulse" />)}</div>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Status</TableHead><TableHead>Latency</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {providers.map(p => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant={p.healthy ? "default" : "destructive"}>{p.healthy ? "Healthy" : "Error"}</Badge></TableCell>
                  <TableCell>{p.latency ? `${p.latency}ms` : "-"}</TableCell>
                  <TableCell>{p.error && <span className="text-sm text-destructive">{p.error}</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
