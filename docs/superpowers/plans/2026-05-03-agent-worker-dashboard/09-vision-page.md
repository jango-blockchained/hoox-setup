### Task 9: Vision Page

**Files:**
- Create: `src/app/dashboard/agent/vision/page.tsx`
- Create: `src/components/agent/vision-upload.tsx`

- [ ] **Step 1: Create vision-upload.tsx component**

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function VisionUpload() {
  const [imageUrl, setImageUrl] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Analyze this chart and identify key support and resistance levels");
  const [model, setModel] = useState("@cf/meta/llama-3.2-11b-vision-instruct");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImageBase64(base64);
      setPreviewUrl(base64);
      setImageUrl("");
    };
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    setPreviewUrl(url);
    setImageBase64(null);
  };

  const analyzeImage = async () => {
    if (!previewUrl) {
      toast.error("Please provide an image");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/agent/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageBase64,
          imageUrl: imageBase64 ? undefined : imageUrl,
          prompt,
          model,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.response);
        toast.success("Analysis complete");
      } else {
        toast.error(data.error || "Analysis failed");
      }
    } catch (e) {
      toast.error("Failed to analyze image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Image
          </CardTitle>
          <CardDescription>
            Upload a chart image or provide a URL for AI analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="image-url">Image URL</Label>
            <Input
              id="image-url"
              value={imageUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/chart.png"
              disabled={!!imageBase64}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="image-upload">Upload File</Label>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
          </div>

          {previewUrl && (
            <div className="rounded-lg border overflow-hidden">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-auto object-contain max-h-[300px]"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What would you like the AI to analyze?"
              className="min-h-[80px]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="@cf/meta/llama-3.2-11b-vision-instruct">
                  Llama 3.2 Vision (Workers AI)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={analyzeImage}
            disabled={loading || !previewUrl}
            className="w-full"
          >
            {loading ? (
              <>
                <Spinner className="h-4 w-4" data-icon="inline-start" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" data-icon="inline-start" />
                Analyze Image
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className={cn("bg-card border-border", !result && "flex items-center justify-center")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Analysis Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <div className="text-center text-muted-foreground py-8">
              Upload an image and click analyze to see results
            </div>
          ) : (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertTitle>Vision Analysis</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap mt-2">
                {result}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create vision/page.tsx**

```tsx
"use client";

import { VisionUpload } from "@/components/agent/vision-upload";
import { Eye } from "lucide-react";
import { motion } from "framer-motion";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function VisionPage() {
  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <Eye className="h-8 w-8 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vision Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Analyze chart images with AI vision models
          </p>
        </div>
      </motion.div>

      <VisionUpload />
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd /home/jango/Git/hoox-setup/pages/dashboard && bunx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/app/dashboard/agent/vision/page.tsx
git add pages/dashboard/src/components/agent/vision-upload.tsx
git commit -m "feat(dashboard): add agent vision analysis page"
```
