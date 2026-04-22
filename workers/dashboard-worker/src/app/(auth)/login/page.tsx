"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

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
      // For demo purposes, accept any credentials if env vars are set
      // In production, validate against configured credentials
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 to-neutral-900 p-4">
      <Card className="w-full max-w-md border-neutral-800 bg-neutral-900/50 backdrop-blur">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="h-6 w-6 text-orange-500" />
            <CardTitle className="text-2xl font-bold">hoox</CardTitle>
          </div>
          <CardDescription className="text-neutral-400">
            Enter your credentials to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-900 bg-red-950/50">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-neutral-300">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-neutral-100 placeholder:text-neutral-600"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-neutral-100 placeholder:text-neutral-600"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}