"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { targetLabel, type SkeletonTarget } from "@/lib/rig/bone-map";
import type { BoneRenameEntry } from "@/lib/rig/fbx-processor";
import {
  FileBox,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Download,
} from "lucide-react";

const TARGETS: SkeletonTarget[] = ["ue4", "ue5"];

const ERROR_MESSAGES: Record<string, string> = {
  unsupported: "Please select a valid .fbx or .obj file.",
  pipeline_failed: "Something went wrong while processing the file. Please try again.",
};

export function RigTools() {
  const [target, setTarget] = useState<SkeletonTarget>("ue5");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renames, setRenames] = useState<BoneRenameEntry[]>([]);
  const [boneCount, setBoneCount] = useState<number | null>(null);
  const [clipCount, setClipCount] = useState<number | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setSourceFile(null);
    setSourceName(null);
    setError(null);
    setRenames([]);
    setBoneCount(null);
    setClipCount(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
  }, [resultUrl]);

  const handleFile = useCallback((file: File) => {
    if (!/\.(fbx|obj)$/i.test(file.name)) {
      setError(ERROR_MESSAGES.unsupported);
      return;
    }
    setError(null);
    setRenames([]);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setSourceFile(file);
    setSourceName(file.name);
  }, [resultUrl]);

  const handleConvert = useCallback(async () => {
    const input = sourceFile;
    if (!input || !sourceName) return;

    setLoading(true);
    setError(null);
    setResultUrl(null);
    setRenames([]);
    setClipCount(null);
    setBoneCount(null);

    try {
      const isObj = /\.obj$/i.test(input.name);
      const processor = await import("@/lib/rig/fbx-processor");
      const result = isObj
        ? await processor.processObj(await input.text(), input.name, target)
        : await processor.processFbx(await input.arrayBuffer(), input.name, target);

      setRenames(result.renames);
      setBoneCount(result.boneCount);
      setClipCount(result.animationClipCount);

      const blob = new Blob([new Uint8Array(result.bytes)], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.pipeline_failed);
    } finally {
      setLoading(false);
    }
  }, [sourceFile, sourceName, target]);

  const handleDownload = useCallback(() => {
    if (!resultUrl || !sourceName) return;
    const baseName = sourceName.replace(/\.[^.]+$/, "");
    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = `${baseName}-retargeted-${target}.fbx`;
    link.click();
  }, [resultUrl, sourceName, target]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (loading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile, loading]
  );

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-300">Target skeleton</label>
        <div className="flex gap-2">
          {TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => !loading && setTarget(t)}
              className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                target === t
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-600"
              }`}
            >
              {targetLabel(t)}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          UE4 and UE5 share the standard Unreal mannequin skeleton, so both use the same
          target bone names.
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !loading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          loading
            ? "border-zinc-600 bg-zinc-800/30 cursor-not-allowed"
            : "border-zinc-700 cursor-pointer hover:border-amber-500/50 hover:bg-zinc-800/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".fbx,.obj"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        {sourceName && !loading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              reset();
            }}
            className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-zinc-700 hover:bg-red-600 flex items-center justify-center transition-colors"
            title="Reset"
          >
            <X className="w-4 h-4 text-zinc-300 hover:text-white" />
          </button>
        )}
        {loading ? (
          <div className="space-y-3">
            <Loader2 className="w-12 h-12 mx-auto text-amber-500 animate-spin" />
            <p className="text-zinc-400">Retargeting skeleton & animation...</p>
          </div>
        ) : sourceName ? (
          <div className="space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <p className="text-zinc-300 font-medium">File loaded</p>
            <p className="text-zinc-500 text-sm">{sourceName}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <FileBox className="w-12 h-12 mx-auto text-zinc-500" />
            <p className="text-zinc-300 font-medium">Drag & drop an FBX / OBJ here</p>
            <p className="text-zinc-500 text-sm">
              or click to browse • Mixamo rigs and animations (.fbx) or meshes (.obj)
            </p>
          </div>
        )}
      </div>

      <Button
        onClick={handleConvert}
        disabled={!sourceName || loading}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-base py-6 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="w-5 h-5 mr-2" />
        )}
        {loading ? "Processing..." : "Convert to Unreal skeleton"}
      </Button>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {renames.length > 0 && (
        <div className="space-y-3">
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mb-3">
              <span>
                <span className="font-semibold text-white">{boneCount}</span> skeleton bones
              </span>
              <span className="text-zinc-600">•</span>
              <span>
                <span className="font-semibold text-white">{clipCount}</span> animation
                clip{clipCount === 1 ? "" : "s"}
              </span>
              <span className="text-zinc-600">•</span>
              <span>
                <span className="font-semibold text-amber-400">{renames.length}</span>{" "}
                bone{renames.length === 1 ? "" : "s"} renamed
              </span>
            </div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Bone mapping ({targetLabel(target)})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 max-h-64 overflow-y-auto">
              {renames.map((r) => (
                <div
                  key={r.original}
                  className="flex items-center gap-2 text-xs py-0.5 font-mono"
                >
                  <span className="text-zinc-400 truncate">{r.original}</span>
                  <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                  <span className="text-emerald-400 truncate">{r.converted}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {resultUrl && (
        <Button
          onClick={handleDownload}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base py-6"
        >
          <Download className="w-5 h-5 mr-2" />
          Download retargeted FBX
        </Button>
      )}

      <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50 text-xs text-zinc-500 space-y-2">
        <h3 className="text-sm font-semibold text-zinc-300">How to use in Unreal Engine</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Import the retargeted FBX as usual. If it&apos;s an animation-only file (no mesh)
            the skeleton is preserved without skinning.
          </li>
          <li>
            When retargeting the Mixamo skeleton to the Unreal humanoid rig,{" "}
            <span className="text-zinc-300">do not press &quot;Auto Mapping&quot;</span>{" "}
            for Mixamo skeletons — map the bones manually (they are a 1:1 match).
          </li>
          <li>
            For best results retarget from a T-pose character and set both skeletons to the
            same retarget pose.
          </li>
        </ul>
        <p className="pt-1">
          Tip: The Mixamo twist bones (<span className="font-mono text-zinc-400">upperarm_twist/../</span>)
          don&apos;t have a 1:1 Unreal node — Unreal&apos;s retargeter maps them automatically.
        </p>
      </div>
    </div>
  );
}