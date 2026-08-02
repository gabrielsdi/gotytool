"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const PROVIDERS = [
  {
    id: "clearbackdrop",
    name: "ClearBackdrop",
    needsKey: false,
    description: "Free - 100 images/hour",
  },
  {
    id: "removebg",
    name: "remove.bg",
    needsKey: true,
    description: "Best quality - needs API key",
  },
  {
    id: "pixian",
    name: "Pixian.AI",
    needsKey: true,
    description: "High quality - needs API key",
  },
] as const;

export function BackgroundRemoval() {
  const [original, setOriginal] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("clearbackdrop");
  const [apiKey, setApiKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProvider = PROVIDERS.find((p) => p.id === provider);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    setError(null);
    setResult(null);
    setOriginalFile(file);

    const reader = new FileReader();
    reader.onload = (e) => setOriginal(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveBackground = useCallback(async () => {
    if (!originalFile) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", originalFile);
      formData.append("provider", provider);
      if (apiKey) formData.append("apiKey", apiKey);

      const res = await fetch("/api/remove-bg", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to remove background");
      }

      setResult(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [originalFile, provider, apiKey]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result;
    link.download = "no-background.png";
    link.click();
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 w-full space-y-1">
          <label className="text-sm font-medium text-zinc-300">Engine</label>
          <Select value={provider} onValueChange={(v) => v && setProvider(v)}>
            <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {PROVIDERS.map((p) => (
                <SelectItem
                  key={p.id}
                  value={p.id}
                  className="text-white focus:bg-zinc-700 focus:text-white"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-zinc-400 text-xs">
                    {p.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProvider?.needsKey && (
          <div className="flex-1 w-full space-y-1">
            <label className="text-sm font-medium text-zinc-300">
              API Key
            </label>
            <Input
              type="password"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>
        )}
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-zinc-700 rounded-xl p-12 text-center cursor-pointer transition-all hover:border-amber-500/50 hover:bg-zinc-800/50"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />
        {loading ? (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400">Processing image...</p>
          </div>
        ) : original ? (
          <div className="space-y-2">
            <p className="text-zinc-300 font-medium">
              Image loaded. Click &quot;Remove Background&quot; or drop another
              image.
            </p>
            <p className="text-zinc-500 text-sm">
              {originalFile?.name} •{" "}
              {originalFile && (originalFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-zinc-300 font-medium">
              Drag & drop an image here
            </p>
            <p className="text-zinc-500 text-sm">
              or click to browse • PNG, JPG, WEBP
            </p>
          </div>
        )}
      </div>

      <Button
        onClick={handleRemoveBackground}
        disabled={!originalFile || loading}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-base py-6 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Processing..." : "Remove Background"}
      </Button>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {(original || result) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {original && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Original
              </p>
              <div className="rounded-lg overflow-hidden border border-zinc-700">
                <img
                  src={original}
                  alt="Original"
                  className="w-full object-contain bg-zinc-900"
                />
              </div>
            </div>
          )}
          {result && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                Result
              </p>
              <div className="rounded-lg overflow-hidden border border-zinc-700">
                <img
                  src={result}
                  alt="No background"
                  className="w-full object-contain"
                  style={{
                    background:
                      "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 12px 12px",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <Button
          onClick={handleDownload}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base py-6"
        >
          Download PNG
        </Button>
      )}

      <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">
          About the engines
        </h3>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>
            <span className="text-zinc-400 font-medium">ClearBackdrop</span> —
            Free, no API key needed. 100 images per hour.
          </li>
          <li>
            <span className="text-zinc-400 font-medium">remove.bg</span> — Best
            quality. Free API key at remove.bg/api (50 free credits).
          </li>
          <li>
            <span className="text-zinc-400 font-medium">Pixian.AI</span> — High
            quality. Free tier available at pixian.ai/api.
          </li>
        </ul>
      </div>
    </div>
  );
}
