"use client";

import { useState, useEffect } from "react";
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
  Timer,
  Coins,
  Cpu,
  Image as ImageIcon,
  Loader2,
  Check,
  AlertTriangle,
} from "lucide-react";

interface AssetsGalleryProps {
  assets: Asset[];
  deleting: boolean;
  selecting: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onDeleteSelected: () => void;
  onToggleSelect: () => void;
  isGuest?: boolean;
  onAuthClick?: () => void;
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

const EXPIRATION_DAYS = 5;

function getRemainingTime(timestamp: number): { days: number; hours: number; minutes: number; expired: boolean } {
  const createdAt = new Date(timestamp);
  const expiresAt = new Date(createdAt.getTime() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, expired: false };
}

function ExpirationBadge({ timestamp, isGuest }: { timestamp: number; isGuest?: boolean }) {
  const [remaining, setRemaining] = useState(() => getRemainingTime(timestamp));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(getRemainingTime(timestamp));
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [timestamp]);

  if (isGuest) return null;

  if (remaining.expired) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
        <Timer className="w-3 h-3" />
        Expired
      </span>
    );
  }

  const totalHours = remaining.days * 24 + remaining.hours;
  const isUrgent = remaining.days < 1;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
      isUrgent ? "text-amber-400 bg-amber-500/10" : "text-zinc-400 bg-zinc-700/50"
    }`}>
      <Timer className="w-3 h-3" />
      {remaining.days > 0 && `${remaining.days}d `}
      {remaining.hours}h
    </span>
  );
}

export function AssetsGallery({
  assets,
  deleting,
  selecting,
  selectedIds,
  onSelect,
  onDeleteSelected,
  onToggleSelect,
  isGuest,
  onAuthClick,
}: AssetsGalleryProps) {
  const [selected, setSelected] = useState<Asset | null>(null);
  const [open, setOpen] = useState(false);

  const handleSelect = (asset: Asset) => {
    if (selecting) {
      onSelect(asset.id);
    } else {
      setSelected(asset);
      setOpen(true);
    }
  };

  const handleDownload = async (asset: Asset) => {
    const baseName = asset.originalName.replace(/\.[^.]+$/, "");
    const sizeLabel = asset.size || "default";
    const dateStr = formatTimestamp(asset.timestamp);
    const filename = `${baseName}-${asset.provider}-${sizeLabel}-${dateStr}-no-bg.png`;
    const response = await fetch(asset.resultImage);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (assets.length === 0 && !deleting) {
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
      {/* Deleting overlay */}
      {deleting && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-zinc-300 font-medium">Deleting assets...</p>
          </div>
        </div>
      )}

      {/* Guest warning */}
      {isGuest && assets.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-400 font-medium">
              Guest session - images are temporary
            </p>
            <p className="text-xs text-zinc-400">
              Your images will be lost when you close or refresh the browser.{" "}
              <button
                onClick={onAuthClick}
                className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
              >
                Sign in
              </button>{" "}
              to save them permanently.
            </p>
          </div>
        </div>
      )}

      {/* Selection bar */}
      {selecting && (
        <div className="flex items-center justify-between bg-zinc-800/80 border border-zinc-700 rounded-lg p-3 mb-4">
          <p className="text-sm text-zinc-300">
            <span className="font-bold text-white">{selectedIds.size}</span> selected
          </p>
          <div className="flex gap-2">
            <Button
              onClick={onToggleSelect}
              variant="secondary"
              className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm h-8"
            >
              Cancel
            </Button>
            <Button
              onClick={onDeleteSelected}
              disabled={selectedIds.size === 0}
              className="bg-red-600 hover:bg-red-700 text-white text-sm h-8"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 ${deleting ? "pointer-events-none opacity-50" : ""}`}>
        {assets.map((asset) => {
          const isSelected = selectedIds.has(asset.id);
          return (
            <div
              key={asset.id}
              className={`group relative bg-zinc-800 rounded-xl overflow-hidden border transition-all cursor-pointer ${
                isSelected
                  ? "border-amber-500 ring-2 ring-amber-500/30"
                  : "border-zinc-700/50 hover:border-amber-500/30"
              }`}
              onClick={() => handleSelect(asset)}
            >
              {/* Checkbox */}
              {selecting && (
                <div className="absolute top-2 left-2 z-10">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-amber-500 text-black"
                        : "bg-zinc-700/80 border border-zinc-500"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              )}

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
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-zinc-300 font-medium truncate">
                      {asset.originalName}
                    </p>
                    <ExpirationBadge timestamp={asset.timestamp} isGuest={isGuest} />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    {asset.provider} • {formatDateTime(asset.timestamp)}
                  </p>
                </div>
                {!selecting && (
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
                        onSelect(asset.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-zinc-300" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (deleting) return;
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
                  {!isGuest && (
                    <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 min-w-0 shrink-0">
                      <Timer className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-zinc-500 text-xs">Expires in</p>
                        <ExpirationBadge timestamp={selected.timestamp} isGuest={isGuest} />
                      </div>
                    </div>
                  )}
                  {selected.creditsUsed != null && (
                    <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 min-w-0 shrink-0">
                      <Coins className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-zinc-500 text-xs">Credits used</p>
                        <p className="text-zinc-300 font-medium whitespace-nowrap">
                          {selected.creditsUsed === 0 ? "Free call" : selected.creditsUsed}
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
                      onSelect(selected.id);
                      setOpen(false);
                      setSelected(null);
                    }}
                    disabled={deleting}
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
