"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Terminal, Loader2, Shield, ArrowRight, Lock, Key } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Credentials are validated server-side against configured auth settings
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError("Invalid credentials");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden p-4">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-neutral-800 bg-neutral-950/80 backdrop-blur-xl shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          
          <CardHeader className="space-y-3 pb-6 text-center">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-12 h-12 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center shadow-inner mb-2"
            >
              <Terminal className="h-6 w-6 text-primary" />
            </motion.div>
            <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
              Hoox Gateway
            </CardTitle>
            <CardDescription className="text-neutral-500 font-medium">
              Authenticate to access the command center
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <Alert variant="destructive" className="border-red-900/50 bg-red-950/20 text-red-400">
                    <AlertDescription className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {error}
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-neutral-900/50 border-border focus-visible:border-primary/50 focus-visible:ring-primary/20 text-foreground placeholder:text-muted-foreground transition-all"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
                      Password
                    </Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-neutral-900/50 border-border focus-visible:border-primary/50 focus-visible:ring-primary/20 text-foreground placeholder:text-muted-foreground transition-all"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all flex items-center justify-center gap-2 h-11"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Access System
                      <ArrowRight className="h-4 w-4 opacity-70" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Footer text */}
        <div className="flex flex-col items-center justify-center mt-6 gap-2">
          <div className="flex items-center justify-center gap-3 text-neutral-600">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-mono bg-neutral-900/50 px-2 py-1 rounded border border-neutral-800/50">
              <Shield className="h-3 w-3 text-emerald-500/70" />
              <span>Zero Trust</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-mono bg-neutral-900/50 px-2 py-1 rounded border border-neutral-800/50">
              <Lock className="h-3 w-3 text-blue-500/70" />
              <span>End-to-End</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-mono bg-neutral-900/50 px-2 py-1 rounded border border-neutral-800/50">
              <Key className="h-3 w-3 text-primary/70" />
              <span>Edge Auth</span>
            </div>
          </div>
          <p className="text-center text-[10px] uppercase tracking-widest text-neutral-600 font-mono">
            Secured by Cloudflare Infrastructure
          </p>
        </div>
      </motion.div>
    </div>
  );
}