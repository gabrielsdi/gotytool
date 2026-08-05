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
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const TARGETS: SkeletonTarget[] = ["ue4", "ue5"];

const MAX_FILE_MB = 100;
const MAX_TOTAL_MB = 200;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const MAX_TOTAL_BYTES = MAX_TOTAL_MB * 1024 * 1024;

const ERROR_MESSAGES = {
  unsupported: "Please select a valid .fbx or .obj file.",
  pipeline_failed: "Something went wrong while processing the file. Please try again.",
  file_too_large: (name: string) =>
    `"${name}" exceeds the ${MAX_FILE_MB} MB per-file limit.`,
  batch_too_large: (name: string) =>
    `"${name}" would exceed the ${MAX_TOTAL_MB} MB total batch limit.`,
};

interface QueuedFile {
  id: string;
  file: File;
}

interface Result {
  id: string;
  sourceName: string;
  url: string | null;
  renames: BoneRenameEntry[];
  boneCount: number;
  clipCount: number;
  failed: boolean;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `f${idCounter}`;
}

export function RigTools() {
  const [target, setTarget] = useState<SkeletonTarget>("ue5");
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalBytes = files.reduce((acc, f) => acc + f.file.size, 0);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const array = Array.from<File>(incoming);
      if (array.length === 0) return;

      const currentTotal = files.reduce((acc, f) => acc + f.file.size, 0);
      let runningTotal = currentTotal;

      let errorMsg: string | null = null;
      const accepted: QueuedFile[] = [];

      for (const file of array) {
        if (!/\.(fbx|obj)$/i.test(file.name)) {
          errorMsg = ERROR_MESSAGES.unsupported;
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          errorMsg = ERROR_MESSAGES.file_too_large(file.name);
          continue;
        }
        if (runningTotal + file.size > MAX_TOTAL_BYTES) {
          errorMsg = ERROR_MESSAGES.batch_too_large(file.name);
          break;
        }
        runningTotal += file.size;
        accepted.push({ id: nextId(), file });
      }

      if (accepted.length > 0) {
        setFiles((prev) => [...prev, ...accepted]);
        setResults([]);
        errorMsg = null;
      }
      setError(errorMsg);
    },
    [files]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    for (const r of results) if (r.url) URL.revokeObjectURL(r.url);
    setFiles([]);
    setResults([]);
    setError(null);
  }, [results]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (processing) return;
      addFiles(e.dataTransfer.files);
    },
    [addFiles, processing]
  );

  const handleConvert = useCallback(async () => {
    if (processing || files.length === 0) return;

    setProcessing(true);
    setError(null);
    setResults([]);

    try {
      const processor = await import("@/lib/rig/fbx-processor");
      const output: Result[] = [];

      for (const item of files) {
        try {
          const isObj = /\.obj$/i.test(item.file.name);
          const res = isObj
            ? await processor.processObj(await item.file.text(), item.file.name, target)
            : await processor.processFbx(await item.file.arrayBuffer(), item.file.name, target);

          const url = URL.createObjectURL(
            new Blob([new Uint8Array(res.bytes)], { type: "application/octet-stream" })
          );
          output.push({
            id: item.id,
            sourceName: res.fileName,
            url,
            renames: res.renames,
            boneCount: res.boneCount,
            clipCount: res.animationClipCount,
            failed: false,
          });
        } catch (err) {
          output.push({
            id: item.id,
            sourceName: item.file.name,
            url: null,
            renames: [],
            boneCount: 0,
            clipCount: 0,
            failed: true,
            error: err instanceof Error ? err.message : ERROR_MESSAGES.pipeline_failed,
          });
        }
      }

      setResults(output);
    } finally {
      setProcessing(false);
    }
  }, [files, processing, target]);

  const handleDownload = useCallback(
    (r: Result) => {
      if (!r.url) return;
      const base = r.sourceName.replace(/\.[^.]+$/, "");
      const link = document.createElement("a");
      link.href = r.url;
      link.download = `${base}-retargeted-${target}.fbx`;
      link.click();
    },
    [target]
  );

  const handleDownloadAll = useCallback(() => {
    const valid = results.filter((r) => !r.failed && r.url);
    valid.forEach((r, i) => {
      // Stagger so browsers that throttle consecutive downloads don't drop files.
      setTimeout(() => {
        handleDownload(r);
      }, i * 250);
    });
  }, [results, handleDownload]);

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-300">Target skeleton</label>
        <div className="flex gap-2">
          {TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => !processing && setTarget(t)}
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
        onClick={() => !processing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all ${
          processing
            ? "border-zinc-600 bg-zinc-800/30 cursor-not-allowed"
            : "border-zinc-700 cursor-pointer hover:border-amber-500/50 hover:bg-zinc-800/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".fbx,.obj"
          multiple
          className="hidden"
          disabled={processing}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {processing ? (
          <div className="space-y-3">
            <Loader2 className="w-12 h-12 mx-auto text-amber-500 animate-spin" />
            <p className="text-zinc-400">Retargeting skeletons &amp; animations...</p>
          </div>
        ) : files.length > 0 ? (
          <div className="space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <p className="text-zinc-300 font-medium">
              {files.length} file{files.length === 1 ? "" : "s"} queued
            </p>
            <p className="text-zinc-500 text-sm">
              {formatBytes(totalBytes)} total — drop more to add
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <FileBox className="w-12 h-12 mx-auto text-zinc-500" />
            <p className="text-zinc-300 font-medium">Drag &amp; drop FBX / OBJ files here</p>
            <p className="text-zinc-500 text-sm">
              or click to browse • multiple files allowed • up to {MAX_FILE_MB} MB each,{" "}
              {MAX_TOTAL_MB} MB total
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Queue ({formatBytes(totalBytes)} / {MAX_TOTAL_MB} MB)
            </p>
            {results.length === 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm"
              >
                <FileBox className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className="text-zinc-300 max-w-52 truncate">{f.file.name}</span>
                <span className="text-zinc-500 text-xs">{formatBytes(f.file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  disabled={processing}
                  className="text-zinc-500 hover:text-red-400 disabled:opacity-40 transition-colors"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <Button
        onClick={handleConvert}
        disabled={files.length === 0 || processing}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-base py-6 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {processing ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="w-5 h-5 mr-2" />
        )}
        {processing
          ? "Processing..."
          : `Convert ${files.length} file${files.length === 1 ? "" : "s"} to Unreal skeleton`}
      </Button>

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Results ({results.filter((r) => !r.failed).length} converted)
            </p>
            {results.some((r) => !r.failed && r.url) && (
              <Button variant="secondary" size="sm" onClick={handleDownloadAll}>
                <Download className="w-3.5 h-3.5" />
                Download all
              </Button>
            )}
          </div>
          {results.map((r) => (
            <div
              key={r.id}
              className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center gap-3">
                {r.failed ? (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{r.sourceName}</p>
                  <p className="text-xs text-zinc-500">
                    {r.failed
                      ? r.error ?? "Failed"
                      : `${r.renames.length} bone${r.renames.length === 1 ? "" : "s"} renamed • ${
                          r.boneCount
                        } bones • ${r.clipCount} clip${r.clipCount === 1 ? "" : "s"}`}
                  </p>
                </div>
                {!r.failed && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(r.id)}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Mapping
                    {expanded.has(r.id) ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                {!r.failed && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDownload(r)}
                    className="text-zinc-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                )}
              </div>

              {!r.failed && expanded.has(r.id) && r.renames.length > 0 && (
                <div className="pt-2 border-t border-zinc-700/50">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Bone mapping ({targetLabel(target)})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 max-h-64 overflow-y-auto">
                    {r.renames.map((ren) => (
                      <div
                        key={ren.original}
                        className="flex items-center gap-2 text-xs py-0.5 font-mono"
                      >
                        <span className="text-zinc-400 truncate">{ren.original}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                        <span className="text-emerald-400 truncate">{ren.converted}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all &amp; start over
            </button>
          </div>
        </div>
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
          <li>
            The files are exported in their native Y-up orientation, so Unreal scales and
            orients them like the original Mixamo import (model stays upright).
          </li>
        </ul>
      </div>
    </div>
  );
}