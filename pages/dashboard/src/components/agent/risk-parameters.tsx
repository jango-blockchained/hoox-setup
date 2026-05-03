"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FieldGroup } from "@/components/ui/field";
import { toast } from "@/components/ui/sonner";
import { useState } from "react";

export function RiskParameters() {
  const [drawdown, setDrawdown] = useState(-5);
  const [trailingStop, setTrailingStop] = useState(5);
  const [takeProfit, setTakeProfit] = useState(10);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDailyDrawdownPercent: drawdown,
          trailingStopPercent: trailingStop / 100,
          takeProfitPercent: takeProfit / 100,
        }),
      });
      const data = await res.json();
      if (data.success) { toast.success("Risk parameters saved"); } 
      else { toast.error(data.error || "Save failed"); }
    } catch (e) { toast.error("Failed to save parameters"); } 
    finally { setSaving(false); }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Risk Parameters</CardTitle>
        <CardDescription>Configure risk management settings</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Max Daily Drawdown: {drawdown}%</FieldLabel>
            <Slider value={[drawdown]} onValueChange={(v) => setDrawdown(v[0])} min={-10} max={0} step={0.5} className="w-full" />
            <FieldDescription>Account will stop trading at this loss percentage</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Trailing Stop: {trailingStop}%</FieldLabel>
            <Slider value={[trailingStop]} onValueChange={(v) => setTrailingStop(v[0])} min={1} max={20} step={0.5} className="w-full" />
            <FieldDescription>Automatic stop-loss based on highest profit watermark</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Take Profit: {takeProfit}%</FieldLabel>
            <Slider value={[takeProfit]} onValueChange={(v) => setTakeProfit(v[0])} min={1} max={50} step={1} className="w-full" />
            <FieldDescription>Automatic partial close when position reaches profit target</FieldDescription>
          </Field>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <><Spinner className="h-4 w-4" data-icon="inline-start" /> Saving...</> : "Save Parameters"}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
