"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function BackgroundRemoval() {
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => setOriginal(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/remove-bg", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to remove background");
      }

      setResult(data.image);
      if (data.remaining) setRemaining(data.remaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result;
    link.download = "no-background.png";
    link.click();
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Background Removal</CardTitle>
        <CardDescription>
          Upload an image and get it back without the background (PNG format)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary/50"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {loading ? (
            <div className="space-y-3">
              <div className="animate-pulse text-muted-foreground">
                Processing...
              </div>
              <Progress value={66} className="w-full" />
            </div>
          ) : (
            <p className="text-muted-foreground">
              Drag & drop an image here, or click to select
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {remaining && (
          <p className="text-xs text-muted-foreground">
            API remaining this hour: {remaining}
          </p>
        )}

        {(original || result) && (
          <div className="grid grid-cols-2 gap-4">
            {original && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">Original</p>
                <img
                  src={original}
                  alt="Original"
                  className="w-full rounded-lg border"
                />
              </div>
            )}
            {result && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">Result</p>
                <img
                  src={result}
                  alt="No background"
                  className="w-full rounded-lg border"
                  style={{
                    background:
                      "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 16px 16px",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {result && (
          <Button onClick={handleDownload} className="w-full">
            Download PNG
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
