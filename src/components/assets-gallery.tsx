"use client";

import { useState } from "react";
import { Asset } from "@/hooks/use-assets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Trash2,
  Clock,
  Coins,
  Cpu,
  Image as ImageIcon,
} from "lucide-react";

interface AssetsGalleryProps {
  assets: Asset[];
  onDelete: (id: string) => void;
}

function formatTimestamp(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AssetsGallery({ assets, onDelete }: AssetsGalleryProps) {
  const [selected, setSelected] = useState<Asset | null>(null);
  const [open, setOpen] = useState(false);

  const handleSelect = (asset: Asset) => {
    setSelected(asset);
    setOpen(true);
  };

  const handleDownload = (asset: Asset) => {
    const baseName = asset.originalName.replace(/\.[^.]+$/, "");
    const sizeLabel = asset.size || "default";
    const dateStr = formatTimestamp(asset.timestamp);
    const filename = `${baseName}-${asset.provider}-${sizeLabel}-${dateStr}-no-bg.png`;
    const link = document.createElement("a");
    link.href = asset.resultImage;
    link.download = filename;
    link.click();
  };

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ImageIcon className="w-16 h-16 text-zinc-700 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-400">No assets yet</h3>
        <p className="text-sm text-zinc-600 mt-1">
          Processed images will appear here
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="group relative bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700/50 hover:border-amber-500/30 transition-all cursor-pointer"
            onClick={() => handleSelect(asset)}
          >
            <div
              className="aspect-square"
              style={{
                background:
                  "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 10px 10px",
              }}
            >
              <img
                src={asset.resultImage}
                alt={asset.originalName}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-xs text-zinc-300 font-medium truncate">
                  {asset.originalName}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {asset.provider} • {formatDateTime(asset.timestamp)}
                </p>
              </div>
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(asset);
                  }}
                >
                  <Download className="h-3.5 w-3.5 text-zinc-300" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 bg-zinc-800/90 hover:bg-red-900 border border-zinc-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(asset.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-zinc-300" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSelected(null);
        }}
      >
        <DialogContent
          className="bg-zinc-900 border-zinc-700 p-0 gap-0 overflow-hidden [&>button]:hidden"
          style={{
            minWidth: "min(800px, 90vw)",
            maxWidth: "90vw",
            width: "fit-content",
          }}
        >
          {selected && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <DialogTitle className="text-white text-base font-semibold pr-4 whitespace-nowrap overflow-hidden text-ellipsis max-w-[80vw]">
                  {selected.originalName}
                </DialogTitle>
              </div>

              {/* Image */}
              <div
                className="flex items-center justify-center"
                style={{
                  background:
                    "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 14px 14px",
                }}
              >
                <img
                  src={selected.resultImage}
                  alt={selected.originalName}
                  className="max-h-[60vh] w-full object-contain"
                />
              </div>

              {/* Info + Actions */}
              <div className="px-6 py-4 space-y-4 border-t border-zinc-800">
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 min-w-0 shrink-0">
                    <Cpu className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-zinc-500 text-xs">Provider</p>
                      <p className="text-zinc-300 font-medium whitespace-nowrap">
                        {selected.provider}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 min-w-0 shrink-0">
                    <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-zinc-500 text-xs">Processed</p>
                      <p className="text-zinc-300 font-medium whitespace-nowrap">
                        {formatDateTime(selected.timestamp)}
                      </p>
                    </div>
                  </div>
                  {selected.creditsUsed !== undefined && (
                    <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 min-w-0 shrink-0">
                      <Coins className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-zinc-500 text-xs">Credits used</p>
                        <p className="text-zinc-300 font-medium whitespace-nowrap">
                          {selected.creditsUsed}
                        </p>
                      </div>
                    </div>
                  )}
                  {selected.size && (
                    <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 min-w-0 shrink-0">
                      <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-zinc-500 text-xs">Quality</p>
                        <p className="text-zinc-300 font-medium whitespace-nowrap">
                          {selected.size}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 w-fit">
                  <Button
                    onClick={() => handleDownload(selected)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PNG
                  </Button>
                  <Button
                    onClick={() => {
                      onDelete(selected.id);
                      setOpen(false);
                      setSelected(null);
                    }}
                    className="bg-danger hover:bg-danger/90 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
