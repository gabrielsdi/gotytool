"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Scissors,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Coins,
  Zap,
  X,
  Sliders,
} from "lucide-react";

const PROVIDERS = [
  {
    id: "clearbackdrop",
    name: "ClearBackdrop",
    description: "Free - 100 images/hour - No API key",
  },
  {
    id: "removebg",
    name: "remove.bg",
    description: "Best quality - 50 free credits/month",
  },
] as const;

const SIZE_OPTIONS = [
  {
    id: "auto",
    name: "Auto",
    description: "Up to 25MP • Uses free monthly calls",
    credits: 0,
    freeTier: true,
  },
  {
    id: "full",
    name: "Full Resolution",
    description: "Up to 25MP • 1 paid credit per image",
    credits: 1,
    freeTier: false,
  },
  {
    id: "50MP",
    name: "Ultra (50MP)",
    description: "Up to 50MP • 1 paid credit per image",
    credits: 1,
    freeTier: false,
  },
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  insufficient_credits:
    "You don't have enough credits for this quality. Try using Auto mode or upgrade your remove.bg plan.",
  rate_limit:
    "Too many requests. Please wait a moment and try again.",
  api_key_missing:
    "Service not configured. Please contact the administrator.",
  clearbackdrop_failed:
    "ClearBackdrop is temporarily unavailable. Please try again later.",
  removebg_failed:
    "remove.bg encountered an error. Please try again later.",
  forbidden:
    "Access denied. Please check your API key configuration.",
  storage_limit_exceeded:
    "Storage limit reached. Delete some assets to free up space.",
};

interface AccountInfo {
  credits: number | null;
  photos: number | null;
}

interface ClearBackdropQuota {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
}

interface BackgroundRemovalProps {
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

export function BackgroundRemoval({ onAssetCreated, isGuest }: BackgroundRemovalProps) {
  const [original, setOriginal] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("clearbackdrop");
  const [size, setSize] = useState<string>("auto");
  const [remaining, setRemaining] = useState<string | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [clearBackdropQuota, setClearBackdropQuota] = useState<ClearBackdropQuota | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preprocess, setPreprocess] = useState({
    normalize: true,
    denoise: true,
    sharpen: true,
  });
  const [postprocess, setPostprocess] = useState({
    edgeSmoothing: true,
    removeHalo: true,
    preserveDetail: true,
  });

  const isRemovebg = provider === "removebg";
  const isClearBackdrop = provider === "clearbackdrop";

  const availableProviders = isGuest
    ? PROVIDERS.filter((p) => p.id === "clearbackdrop")
    : PROVIDERS;

  useEffect(() => {
    if (isGuest && provider === "removebg") {
      setProvider("clearbackdrop");
    }
  }, [isGuest, provider]);

  useEffect(() => {
    if (isRemovebg) {
      fetch("/api/remove-bg")
        .then((r) => r.json())
        .then((data) => {
          if (data.removebg) setAccountInfo(data.removebg);
          if (data.clearbackdrop) setClearBackdropQuota(data.clearbackdrop);
        })
        .catch(() => {});
    } else if (isClearBackdrop) {
      fetch("/api/remove-bg")
        .then((r) => r.json())
        .then((data) => {
          if (data.clearbackdrop) setClearBackdropQuota(data.clearbackdrop);
        })
        .catch(() => {});
    }
  }, [isRemovebg, isClearBackdrop]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    setError(null);
    setResult(null);
    setOriginalFile(file);
    setCreditsUsed(null);

    const reader = new FileReader();
    reader.onload = (e) => setOriginal(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveBackground = useCallback(async () => {
    if (!originalFile) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCreditsUsed(null);

    try {
      const formData = new FormData();
      formData.append("image", originalFile);
      formData.append("provider", provider);
      if (isRemovebg) formData.append("size", size);

      if (isClearBackdrop) {
        formData.append("preprocess", JSON.stringify(preprocess));
        formData.append("postprocess", JSON.stringify(postprocess));
      }

      const res = await fetch("/api/remove-bg", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const friendlyMessage = ERROR_MESSAGES[data.error] || "Something went wrong. Please try again.";
        throw new Error(friendlyMessage);
      }

      setResult(data.image);
      if (data.remaining) setRemaining(data.remaining);
      if (data.creditsUsed) setCreditsUsed(data.creditsUsed);

      const usedCredits = data.creditsUsed ?? 0;
      if (isRemovebg) {
        setAccountInfo((prev) =>
          prev
            ? { ...prev, credits: (prev.credits ?? 0) - usedCredits }
            : prev
        );
      }

      // Refresh credits/quota after successful removal
      fetch("/api/remove-bg")
        .then((r) => r.json())
        .then((refreshData) => {
          if (refreshData.removebg) setAccountInfo(refreshData.removebg);
          if (refreshData.clearbackdrop) setClearBackdropQuota(refreshData.clearbackdrop);
        })
        .catch(() => {});

      const imgResponse = await fetch(data.image);
      const blob = await imgResponse.blob();

      const saved = await onAssetCreated?.({
        originalName: originalFile.name,
        resultImage: data.image,
        provider,
        size: isRemovebg ? size : undefined,
        creditsUsed: data.creditsUsed ?? undefined,
        file: blob,
      });

      if (saved === false) {
        throw new Error("storage_limit_exceeded");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [originalFile, provider, size, isRemovebg, isClearBackdrop, preprocess, postprocess, onAssetCreated]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (loading) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect, loading]
  );

  const handleClearImage = () => {
    setOriginal(null);
    setOriginalFile(null);
    setResult(null);
    setCreditsUsed(null);
    setError(null);
  };

  const handleDownload = () => {
    if (!result || !originalFile) return;
    const baseName = originalFile.name.replace(/\.[^.]+$/, "");
    const sizeLabel = isRemovebg ? size : "default";
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `${baseName}-${provider}-${sizeLabel}-${dateStr}-no-bg.png`;
    const link = document.createElement("a");
    link.href = result;
    link.download = filename;
    link.click();
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Provider selector */}
      {isGuest ? (
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-300">Engine</label>
          <div className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-300">
            <span className="font-medium">ClearBackdrop</span>
            <span className="ml-2 text-zinc-500 text-xs">Free - 100 images/hour</span>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-300">Engine</label>
          <Select
            value={provider}
            onValueChange={(v) => {
              if (v && !loading) {
                setProvider(v);
                setRemaining(null);
                setCreditsUsed(null);
                if (v === "clearbackdrop") {
                  fetch("/api/remove-bg")
                    .then((r) => r.json())
                    .then((data) => {
                      if (data.clearbackdrop) setClearBackdropQuota(data.clearbackdrop);
                    })
                    .catch(() => {});
                }
              }
            }}
            disabled={loading}
          >
            <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white disabled:opacity-50">
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
      )}

      {/* Size selector (remove.bg only) */}
      {isRemovebg && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Quality
          </label>
          <Select
            value={size}
            onValueChange={(v) => v && setSize(v)}
            disabled={loading}
          >
            <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white disabled:opacity-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {SIZE_OPTIONS.map((s) => (
                <SelectItem
                  key={s.id}
                  value={s.id}
                  className="text-white focus:bg-zinc-700 focus:text-white"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-zinc-400 text-xs">
                    {s.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {size !== "auto" && (
            <p className="text-xs text-amber-400/80 mt-1">
              This option uses paid credits. Free tier only supports &quot;Auto&quot; (uses free monthly calls).
            </p>
          )}
        </div>
      )}

      {/* Processing options (ClearBackdrop only) */}
      {isClearBackdrop && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            <Sliders className="w-4 h-4" />
            Processing Options
            <svg
              className={`w-3 h-3 transition-transform ${showOptions ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showOptions && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Before removal (preprocessing)
                </p>
                <div className="space-y-2">
                  <Checkbox
                    checked={preprocess.normalize}
                    onCheckedChange={(v) => setPreprocess((p) => ({ ...p, normalize: v }))}
                    label="Normalize contrast"
                    description="Enhance contrast for better edge detection"
                  />
                  <Checkbox
                    checked={preprocess.denoise}
                    onCheckedChange={(v) => setPreprocess((p) => ({ ...p, denoise: v }))}
                    label="Reduce noise"
                    description="Remove camera noise that can confuse the model"
                  />
                  <Checkbox
                    checked={preprocess.sharpen}
                    onCheckedChange={(v) => setPreprocess((p) => ({ ...p, sharpen: v }))}
                    label="Sharpen edges"
                    description="Mild sharpening for clearer boundaries"
                  />
                </div>
              </div>

              <div className="h-px bg-zinc-700/50" />

              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  After removal (postprocessing)
                </p>
                <div className="space-y-2">
                  <Checkbox
                    checked={postprocess.edgeSmoothing}
                    onCheckedChange={(v) => setPostprocess((p) => ({ ...p, edgeSmoothing: v }))}
                    label="Smooth edges"
                    description="Soften jagged edges for a cleaner look"
                  />
                  <Checkbox
                    checked={postprocess.removeHalo}
                    onCheckedChange={(v) => setPostprocess((p) => ({ ...p, removeHalo: v }))}
                    label="Remove color halos"
                    description="Eliminate color fringe around subject edges"
                  />
                  <Checkbox
                    checked={postprocess.preserveDetail}
                    onCheckedChange={(v) => setPostprocess((p) => ({ ...p, preserveDetail: v }))}
                    label="Preserve fine details"
                    description="Keep hair, text, and thin structures intact"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Credits / Remaining info */}
      <div className="flex flex-wrap gap-3">
        {isRemovebg && accountInfo && accountInfo.credits !== null && (
          <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-zinc-300">
              Free calls remaining:{" "}
              <span className="font-bold text-white">
                {accountInfo.credits}
              </span>
            </span>
            <span className="text-xs text-zinc-500">/ 50 monthly</span>
          </div>
        )}
        {isClearBackdrop && clearBackdropQuota && (
          <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-zinc-300">
              Images remaining this hour:{" "}
              <span className="font-bold text-white">
                {clearBackdropQuota.remaining}
              </span>
            </span>
            <span className="text-xs text-zinc-500">
              / {clearBackdropQuota.limit}
            </span>
          </div>
        )}
        {remaining && (
          <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-zinc-300">
              Images remaining this hour:{" "}
              <span className="font-bold text-white">{remaining}</span>
            </span>
          </div>
        )}
        {creditsUsed && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-400">
              This request used{" "}
              <span className="font-bold">{creditsUsed}</span>{" "}
              {creditsUsed === 1 ? "credit" : "credits"}
            </span>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !original && !loading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          loading
            ? "border-zinc-600 bg-zinc-800/30 cursor-not-allowed"
            : "border-zinc-700 cursor-pointer hover:border-amber-500/50 hover:bg-zinc-800/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = "";
          }}
        />
        {original && !loading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearImage();
            }}
            className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-zinc-700 hover:bg-red-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-zinc-300 hover:text-white" />
          </button>
        )}
        {loading ? (
          <div className="space-y-3">
            <Loader2 className="w-12 h-12 mx-auto text-amber-500 animate-spin" />
            <p className="text-zinc-400">Processing image...</p>
          </div>
        ) : original ? (
          <div className="space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <p className="text-zinc-300 font-medium">
              Image loaded. Click &quot;Remove Background&quot; or drop
              another.
            </p>
            <p className="text-zinc-500 text-sm">
              {originalFile?.name} •{" "}
              {originalFile && (originalFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-12 h-12 mx-auto text-zinc-500" />
            <p className="text-zinc-300 font-medium">
              Drag & drop an image here
            </p>
            <p className="text-zinc-500 text-sm">
              or click to browse • PNG, JPG, WEBP
            </p>
          </div>
        )}
      </div>

      {/* Action button */}
      <Button
        onClick={handleRemoveBackground}
        disabled={!originalFile || loading}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-base py-6 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Scissors className="w-5 h-5 mr-2" />
        {loading ? "Processing..." : "Remove Background"}
      </Button>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Preview */}
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

      {/* Download */}
      {result && (
        <Button
          onClick={handleDownload}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base py-6"
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Download PNG
        </Button>
      )}

      {/* Info */}
      <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">
          About the engines
        </h3>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>
            <span className="text-zinc-400 font-medium">ClearBackdrop</span> —
            Free, no API key needed. 100 images per hour.
          </li>
          {!isGuest && (
            <li>
              <span className="text-zinc-400 font-medium">remove.bg</span> — Best
              quality. 50 free credits/month. Each image costs 1 credit.
            </li>
          )}
        </ul>
        {isGuest && (
          <p className="text-xs text-amber-400/70 mt-2">
            Sign in to unlock remove.bg for best quality results.
          </p>
        )}
      </div>
    </div>
  );
}
