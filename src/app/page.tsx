"use client";

import { BackgroundRemoval } from "@/components/background-removal";
import { AssetsGallery } from "@/components/assets-gallery";
import { useAssets } from "@/hooks/use-assets";
import { useState, useCallback } from "react";
import {
  Scissors,
  ImageIcon,
  ListCheck,
  HardDrive,
} from "lucide-react";
import { Sidebar } from "@/components/sidebar";

export default function Home() {
  const [activeTool, setActiveTool] = useState("bg-removal");
  const {
    assets,
    deleting,
    addAsset,
    removeAssets,
    storageUsed,
    storageLimit,
  } = useAssets();

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = useCallback(() => {
    setSelecting((prev) => !prev);
    setSelectedIds(new Set());
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    removeAssets(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelecting(false);
  }, [selectedIds, removeAssets]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const storagePercent = Math.min((storageUsed / storageLimit) * 100, 100);

  return (
    <div className="flex min-h-screen bg-[#0f0f1a] text-white">
      <Sidebar
        assetCount={assets.length}
        activeTool={activeTool}
        onToolChange={setActiveTool}
      />

      {/* Main content */}
      <main className="flex-1 ml-64 p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {activeTool === "bg-removal" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Scissors className="w-6 h-6 text-amber-500" />
                  Background Removal
                </h2>
                <p className="text-zinc-400 mt-1">
                  Upload an image and remove its background. Export as
                  transparent PNG.
                </p>
              </div>
              <BackgroundRemoval onAssetCreated={addAsset} />
            </div>
          )}

          {activeTool === "assets" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-6 h-6 text-amber-500" />
                    Assets
                  </h2>
                  <p className="text-zinc-400 mt-1">
                    Your processed images gallery
                  </p>
                </div>
                {assets.length > 0 && (
                  <button
                    onClick={handleToggleSelect}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      selecting
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 hover:border-zinc-600"
                    }`}
                  >
                    <ListCheck className="w-3.5 h-3.5" />
                    {selecting ? "Exit selection" : "Select"}
                  </button>
                )}
              </div>

              {/* Storage indicator */}
              <div className="flex items-center gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3">
                <HardDrive className="w-4 h-4 text-zinc-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-400">
                      {assets.length} file{assets.length !== 1 ? "s" : ""} •{" "}
                      {formatBytes(storageUsed)} / 1 GB
                    </span>
                    <span className="text-xs text-zinc-500">
                      {storagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${storagePercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <AssetsGallery
                assets={assets}
                deleting={deleting}
                selecting={selecting}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onDeleteSelected={handleDeleteSelected}
                onToggleSelect={handleToggleSelect}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
