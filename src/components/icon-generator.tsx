"use client";

import { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Gamepad2,
  Loader2,
  AlertCircle,
  Coins,
  Download,
  Sparkles,
} from "lucide-react";

const STYLES = [
  { id: "glyph", name: "Glyph (GTA Style)", description: "Minimalist silhouette, radar/HUD icons" },
  { id: "flat", name: "Flat Design", description: "Clean, minimal, iOS/Material" },
  { id: "3d", name: "3D Rendered", description: "Volumetric lighting, hero icons" },
  { id: "gradient", name: "Gradient", description: "Modern SaaS style" },
  { id: "neumorphic", name: "Neumorphic", description: "Soft shadows, subtle depth" },
] as const;

const MODELS = [
  { id: "sdxl", name: "SDXL (Free)", description: "~1,000 tokens • Good quality" },
  { id: "flux", name: "FLUX.2 (Premium)", description: "~5,000 tokens • Best quality" },
] as const;

const EXAMPLE_PROMPTS = [
  "airplane silhouette, travel vehicle",
  "pistol handgun, weapon icon",
  "anchor ship boat, nautical symbol",
  "scissors cutting tool, barbershop",
  "hamburger food meal, restaurant",
  "dollar money cash, currency symbol",
  "house home building, real estate",
  "heart health life, medical symbol",
  "car vehicle automobile, transportation",
  "pizza food slice, restaurant",
];

interface IconGeneratorProps {
  onAssetCreated?: (asset: {
    originalName: string;
    resultImage: string;
    provider: string;
    size?: string;
    creditsUsed?: number;
    file: Blob;
  }) => boolean | void | Promise<boolean | void>;
  isGuest?: boolean;
}

export function IconGenerator({ onAssetCreated, isGuest }: IconGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>("glyph");
  const [model, setModel] = useState<string>("sdxl");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<Record<string, string | null> | null>(null);
  const [tokensUsed, setTokensUsed] = useState<number | null>(null);
  const [history, setHistory] = useState<Array<{ prompt: string; image: string; timestamp: number }>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setTokensUsed(null);
    setRateLimitInfo(null);

    try {
      const res = await fetch("/api/generate-icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: prompt.trim(),
          style,
          model,
          transparent: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.rateLimitInfo) {
          setRateLimitInfo(data.rateLimitInfo);
        }
        throw new Error(data.message || "Failed to generate icon");
      }

      setResult(data.image);
      setTokensUsed(data.tokensUsed);

      setHistory((prev) => [
        { prompt: prompt.trim(), image: data.image, timestamp: Date.now() },
        ...prev.slice(0, 9),
      ]);

      if (data.image) {
        const imgResponse = await fetch(data.image);
        const blob = await imgResponse.blob();

        await onAssetCreated?.({
          originalName: `icon-${prompt.trim().slice(0, 30).replace(/\s+/g, "-")}-${Date.now()}.png`,
          resultImage: data.image,
          provider: "freeai",
          size: model,
          creditsUsed: data.tokensUsed,
          file: blob,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [prompt, style, model, onAssetCreated]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result;
    link.download = `icon-${prompt.trim().slice(0, 30).replace(/\s+/g, "-")}-${Date.now()}.png`;
    link.click();
  }, [result, prompt]);

  const handleExampleClick = (example: string) => {
    setPrompt(example);
    textareaRef.current?.focus();
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Model selector */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-300">Model</label>
        <Select value={model} onValueChange={(v) => v && setModel(v)} disabled={loading}>
          <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white disabled:opacity-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {MODELS.map((m) => (
              <SelectItem
                key={m.id}
                value={m.id}
                className="text-white focus:bg-zinc-700 focus:text-white"
              >
                <span className="font-medium">{m.name}</span>
                <span className="ml-2 text-zinc-400 text-xs">{m.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isGuest && model === "flux" && (
          <p className="text-xs text-amber-400/80 mt-1">
            FLUX.2 requires tokens. Using SDXL instead.
          </p>
        )}
      </div>

      {/* Style selector */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Icon Style
        </label>
        <Select value={style} onValueChange={(v) => v && setStyle(v)} disabled={loading}>
          <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white disabled:opacity-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {STYLES.map((s) => (
              <SelectItem
                key={s.id}
                value={s.id}
                className="text-white focus:bg-zinc-700 focus:text-white"
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-zinc-400 text-xs">{s.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Prompt input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">Describe your icon</label>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. red health potion, glowing liquid, fantasy RPG item"
          disabled={loading}
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 disabled:opacity-50 resize-none"
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.slice(0, 4).map((example) => (
            <button
              key={example}
              onClick={() => handleExampleClick(example)}
              disabled={loading}
              className="text-[10px] text-zinc-500 hover:text-amber-400 bg-zinc-800/50 hover:bg-zinc-800 px-2 py-1 rounded border border-zinc-700/50 hover:border-amber-500/30 transition-colors disabled:opacity-50"
            >
              {example.slice(0, 35)}...
            </button>
          ))}
        </div>
      </div>

      {/* Tokens info */}
      <div className="flex flex-wrap gap-3">
        {tokensUsed && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-400">
              This request used{" "}
              <span className="font-bold">{tokensUsed}</span> tokens
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2">
          <Coins className="w-4 h-4 text-emerald-500" />
          <span className="text-sm text-zinc-300">
            Free tier: ~30 icons/day with SDXL
          </span>
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={!prompt.trim() || loading}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-base py-6 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Generating icon...
          </>
        ) : (
          <>
            <Gamepad2 className="w-5 h-5 mr-2" />
            Generate Icon
          </>
        )}
      </Button>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
          {rateLimitInfo && (
            <div className="text-xs text-zinc-400 space-y-1 ml-6">
              {rateLimitInfo["retry-after"] && (
                <p>Retry after: {rateLimitInfo["retry-after"]} seconds</p>
              )}
              {(rateLimitInfo["x-ratelimit-limit"] || rateLimitInfo["x-rate-limit-limit"]) && (
                <p>
                  Limit: {rateLimitInfo["x-ratelimit-limit"] || rateLimitInfo["x-rate-limit-limit"]} requests
                </p>
              )}
              {(rateLimitInfo["x-ratelimit-remaining"] || rateLimitInfo["x-rate-limit-remaining"]) && (
                <p>
                  Remaining: {rateLimitInfo["x-ratelimit-remaining"] || rateLimitInfo["x-rate-limit-remaining"]}
                </p>
              )}
              {(rateLimitInfo["x-ratelimit-reset"] || rateLimitInfo["x-rate-limit-reset"]) && (
                <p>
                  Resets at: {new Date(
                  (Number(rateLimitInfo["x-ratelimit-reset"] || rateLimitInfo["x-rate-limit-reset"])) * 1000
                  ).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Result preview */}
      {result && (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              Generated Icon
            </p>
            <div
              className="rounded-lg overflow-hidden border border-zinc-700 max-w-xs mx-auto"
              style={{
                background:
                  "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 12px 12px",
              }}
            >
              <img
                src={result}
                alt="Generated icon"
                className="w-full object-contain"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleDownload}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PNG
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Recent Generations
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {history.map((item) => (
              <button
                key={item.timestamp}
                onClick={() => setResult(item.image)}
                className="aspect-square rounded-lg overflow-hidden border border-zinc-700/50 hover:border-amber-500/30 transition-colors cursor-pointer"
                style={{
                  background:
                    "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 8px 8px",
                }}
              >
                <img
                  src={item.image}
                  alt={item.prompt}
                  className="w-full h-full object-contain"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">
          About Game Icon Generator
        </h3>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>
            <span className="text-zinc-400 font-medium">Powered by Free.ai</span> —
            30,000 free tokens daily, no credit card required.
          </li>
          <li>
            <span className="text-zinc-400 font-medium">SDXL model</span> — Free,
            ~1,000 tokens per icon. Good for most use cases.
          </li>
          <li>
            <span className="text-zinc-400 font-medium">FLUX.2 model</span> — Premium,
            ~5,000 tokens. Best quality for 3D and gradient styles.
          </li>
          <li>
            <span className="text-zinc-400 font-medium">Commercial use</span> — Icons
            are yours to use in games, apps, and projects.
          </li>
        </ul>
        {isGuest && (
          <p className="text-xs text-amber-400/70 mt-2">
            Sign in to save generated icons permanently.
          </p>
        )}
      </div>
    </div>
  );
}
