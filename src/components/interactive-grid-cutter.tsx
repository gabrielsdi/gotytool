"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Loader2,
  AlertCircle,
  X,
  Download,
  Grid3x3,
  Minus,
  Plus,
} from "lucide-react";
import { zipSync } from "fflate";

const SNAP_OPTIONS = [1, 5, 10, 20, 50];
const LINE_HIT_RADIUS = 10;

interface CellData {
  name: string;
  blob: Blob;
}

export function InteractiveGridCutter() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vLines, setVLines] = useState<number[]>([]);
  const [hLines, setHLines] = useState<number[]>([]);
  const [placing, setPlacing] = useState<"horizontal" | "vertical">("vertical");
  const [snap, setSnap] = useState(10);

  const [outputWidth, setOutputWidth] = useState(64);
  const [outputHeight, setOutputHeight] = useState(64);
  const [centerOutput, setCenterOutput] = useState(true);

  const [dragging, setDragging] = useState<{ type: "v" | "h"; index: number } | null>(null);
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const justDraggedRef = useRef(false);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    setError(null);
    setVLines([]);
    setHLines([]);
    setPreviews(new Map());
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (e) => setImageSrc(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleImageLoad = useCallback(() => {
    if (imgRef.current) {
      setImgNatural({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleClear = () => {
    setImageSrc(null);
    setImageFile(null);
    setImgNatural(null);
    setVLines([]);
    setHLines([]);
    setPreviews(new Map());
    setError(null);
  };

  const snapPercent = useCallback(
    (percent: number, axis: "x" | "y") => {
      if (!imgNatural) return percent;
      const imgDim = axis === "x" ? imgNatural.w : imgNatural.h;
      const px = (percent / 100) * imgDim;
      const snapped = Math.round(px / snap) * snap;
      return Math.max(0.5, Math.min(99.5, (snapped / imgDim) * 100));
    },
    [imgNatural, snap]
  );

  const getPercent = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < -2 || x > 102 || y < -2 || y > 102) return null;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, []);

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (dragging || justDraggedRef.current) return;
      const pos = getPercent(e);
      if (!pos) return;

      if (placing === "vertical") {
        const snapped = snapPercent(pos.x, "x");
        setVLines((prev) => [...prev, snapped].sort((a, b) => a - b));
      } else {
        const snapped = snapPercent(pos.y, "y");
        setHLines((prev) => [...prev, snapped].sort((a, b) => a - b));
      }
    },
    [dragging, getPercent, placing, snapPercent]
  );

  const handleLineDoubleClick = useCallback(
    (type: "v" | "h", index: number) => {
      if (type === "v") {
        setVLines((prev) => prev.filter((_, i) => i !== index));
      } else {
        setHLines((prev) => prev.filter((_, i) => i !== index));
      }
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: "v" | "h", index: number) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging({ type, index });
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !imgRef.current) return;

      const rect = imgRef.current.getBoundingClientRect();
      let percent: number;

      if (dragging.type === "v") {
        percent = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        percent = ((e.clientY - rect.top) / rect.height) * 100;
      }

      percent = Math.max(0.5, Math.min(99.5, percent));

      if (dragging.type === "v") {
        percent = snapPercent(percent, "x");
      } else {
        percent = snapPercent(percent, "y");
      }

      if (dragging.type === "v") {
        setVLines((prev) => {
          const next = [...prev];
          next[dragging.index] = percent;
          return next.sort((a, b) => a - b);
        });
      } else {
        setHLines((prev) => {
          const next = [...prev];
          next[dragging.index] = percent;
          return next.sort((a, b) => a - b);
        });
      }
    },
    [dragging, snapPercent]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
    justDraggedRef.current = true;
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 50);
  }, []);

  const handleClearLines = useCallback(() => {
    setVLines([]);
    setHLines([]);
    setPreviews(new Map());
  }, []);

  const cellCount = (hLines.length + 1) * (vLines.length + 1);

  const getBounds = useCallback(() => {
    if (!imgNatural) return { xBounds: [], yBounds: [] };
    const xBounds = [0, ...vLines.map((p) => (p / 100) * imgNatural.w), imgNatural.w];
    const yBounds = [0, ...hLines.map((p) => (p / 100) * imgNatural.h), imgNatural.h];
    xBounds.sort((a, b) => a - b);
    yBounds.sort((a, b) => a - b);
    return { xBounds, yBounds };
  }, [imgNatural, vLines, hLines]);

  const getContentBounds = useCallback(
    (img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const imageData = ctx.getImageData(0, 0, sw, sh);
      const data = imageData.data;

      let minX = sw, minY = sh, maxX = 0, maxY = 0;
      let found = false;

      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const i = (y * sw + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          const brightness = (r + g + b) / 3;
          if (a > 10 && brightness > 100) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            found = true;
          }
        }
      }

      if (!found) return { x: 0, y: 0, w: sw, h: sh };

      const pad = 2;
      return {
        x: Math.max(0, minX - pad),
        y: Math.max(0, minY - pad),
        w: Math.min(sw - Math.max(0, minX - pad), maxX - minX + pad * 2 + 1),
        h: Math.min(sh - Math.max(0, minY - pad), maxY - minY + pad * 2 + 1),
      };
    },
    []
  );

  const extractCells = useCallback(async (): Promise<CellData[]> => {
    if (!imgRef.current || !imgNatural || cellCount === 0) return [];

    const img = imgRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const { xBounds, yBounds } = getBounds();

    const results: CellData[] = [];
    const baseName = imageFile?.name.replace(/\.[^.]+$/, "") || "sprite";

    for (let row = 0; row < yBounds.length - 1; row++) {
      for (let col = 0; col < xBounds.length - 1; col++) {
        const sx = Math.round(xBounds[col]);
        const sy = Math.round(yBounds[row]);
        const sw = Math.round(xBounds[col + 1] - sx);
        const sh = Math.round(yBounds[row + 1] - sy);

        if (sw <= 0 || sh <= 0) continue;

        if (centerOutput) {
          const bounds = getContentBounds(img, sx, sy, sw, sh);

          canvas.width = outputWidth;
          canvas.height = outputHeight;
          ctx.clearRect(0, 0, outputWidth, outputHeight);

          const fitScale = Math.min(outputWidth / bounds.w, outputHeight / bounds.h);
          const drawW = Math.round(bounds.w * fitScale);
          const drawH = Math.round(bounds.h * fitScale);
          const drawX = Math.round((outputWidth - drawW) / 2);
          const drawY = Math.round((outputHeight - drawH) / 2);

          ctx.drawImage(
            img,
            sx + bounds.x, sy + bounds.y, bounds.w, bounds.h,
            drawX, drawY, drawW, drawH
          );
        } else {
          canvas.width = sw;
          canvas.height = sh;
          ctx.clearRect(0, 0, sw, sh);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        }

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/png"
          );
        });

        const name = `${baseName}_r${String(row + 1).padStart(2, "0")}_c${String(col + 1).padStart(2, "0")}.png`;
        results.push({ name, blob });
      }
    }

    return results;
  }, [imgNatural, vLines, hLines, cellCount, imageFile, centerOutput, outputWidth, outputHeight, getBounds, getContentBounds]);

  const generatePreviews = useCallback(async () => {
    if (!imgRef.current || !imgNatural || cellCount === 0) {
      setPreviews(new Map());
      return;
    }

    const img = imgRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const { xBounds, yBounds } = getBounds();

    const prev = new Map<string, string>();
    const previewSize = 80;

    for (let row = 0; row < yBounds.length - 1; row++) {
      for (let col = 0; col < xBounds.length - 1; col++) {
        const sx = Math.round(xBounds[col]);
        const sy = Math.round(yBounds[row]);
        const sw = Math.round(xBounds[col + 1] - sx);
        const sh = Math.round(yBounds[row + 1] - sy);

        if (sw <= 0 || sh <= 0) continue;

        canvas.width = previewSize;
        canvas.height = previewSize;
        ctx.clearRect(0, 0, previewSize, previewSize);

        if (centerOutput) {
          const bounds = getContentBounds(img, sx, sy, sw, sh);
          const fitScale = Math.min(previewSize / bounds.w, previewSize / bounds.h);
          const drawW = Math.round(bounds.w * fitScale);
          const drawH = Math.round(bounds.h * fitScale);
          const drawX = Math.round((previewSize - drawW) / 2);
          const drawY = Math.round((previewSize - drawH) / 2);

          ctx.drawImage(
            img,
            sx + bounds.x, sy + bounds.y, bounds.w, bounds.h,
            drawX, drawY, drawW, drawH
          );
        } else {
          const fitScale = Math.min(previewSize / sw, previewSize / sh);
          const drawW = Math.round(sw * fitScale);
          const drawH = Math.round(sh * fitScale);
          const drawX = Math.round((previewSize - drawW) / 2);
          const drawY = Math.round((previewSize - drawH) / 2);

          ctx.drawImage(img, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
        }

        const key = `${row}-${col}`;
        prev.set(key, canvas.toDataURL("image/png"));
      }
    }

    setPreviews(prev);
  }, [imgNatural, vLines, hLines, cellCount, getBounds, getContentBounds, centerOutput]);

  useEffect(() => {
    const timer = setTimeout(() => generatePreviews(), 100);
    return () => clearTimeout(timer);
  }, [generatePreviews]);

  const handleDownloadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const cells = await extractCells();
      if (cells.length === 0) throw new Error("No cells to export");

      const entries: Record<string, Uint8Array> = {};
      for (const cell of cells) {
        const buffer = await cell.blob.arrayBuffer();
        entries[cell.name] = new Uint8Array(buffer);
      }

      const zipBuffer = zipSync(entries, { level: 0 });
      const zipBlob = new Blob([zipBuffer], { type: "application/zip" });

      const url = URL.createObjectURL(zipBlob);
      const baseName = imageFile?.name.replace(/\.[^.]+$/, "") || "sprites";
      const link = document.createElement("a");
      link.href = url;
      link.download = `${baseName}-grid.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }, [extractCells, imageFile]);

  const handleDownloadSingle = useCallback(
    async (row: number, col: number) => {
      if (!imgRef.current || !imgNatural) return;

      const img = imgRef.current;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const { xBounds, yBounds } = getBounds();

      const sx = Math.round(xBounds[col]);
      const sy = Math.round(yBounds[row]);
      const sw = Math.round(xBounds[col + 1] - sx);
      const sh = Math.round(yBounds[row + 1] - sy);

      if (sw <= 0 || sh <= 0) return;

      if (centerOutput) {
        const bounds = getContentBounds(img, sx, sy, sw, sh);

        canvas.width = outputWidth;
        canvas.height = outputHeight;
        ctx.clearRect(0, 0, outputWidth, outputHeight);

        const fitScale = Math.min(outputWidth / bounds.w, outputHeight / bounds.h);
        const drawW = Math.round(bounds.w * fitScale);
        const drawH = Math.round(bounds.h * fitScale);
        const drawX = Math.round((outputWidth - drawW) / 2);
        const drawY = Math.round((outputHeight - drawH) / 2);

        ctx.drawImage(
          img,
          sx + bounds.x, sy + bounds.y, bounds.w, bounds.h,
          drawX, drawY, drawW, drawH
        );
      } else {
        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      }

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const baseName = imageFile?.name.replace(/\.[^.]+$/, "") || "sprite";
        const link = document.createElement("a");
        link.href = url;
        link.download = `${baseName}_r${String(row + 1).padStart(2, "0")}_c${String(col + 1).padStart(2, "0")}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    },
    [imgNatural, vLines, hLines, imageFile, centerOutput, outputWidth, outputHeight, getBounds, getContentBounds]
  );

  useEffect(() => {
    if (dragging) {
      const handleUp = () => setDragging(null);
      window.addEventListener("pointerup", handleUp);
      return () => window.removeEventListener("pointerup", handleUp);
    }
  }, [dragging]);

  const gridCols = vLines.length + 1;
  const gridRows = hLines.length + 1;

  return (
    <div className="w-full max-w-6xl space-y-6">
      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !imageSrc && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          imageSrc
            ? "border-zinc-700"
            : "border-zinc-700 cursor-pointer hover:border-amber-500/50 hover:bg-zinc-800/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = "";
          }}
        />
        {imageSrc ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Grid3x3 className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-zinc-300">
                {imageFile?.name} • {imgNatural?.w}x{imgNatural?.h}px
              </span>
            </div>
            <button
              onClick={handleClear}
              className="w-7 h-7 rounded-full bg-zinc-700 hover:bg-red-600 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-zinc-300 hover:text-white" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-10 h-10 mx-auto text-zinc-500" />
            <p className="text-zinc-300 font-medium">Drop a sprite sheet to cut</p>
            <p className="text-zinc-500 text-sm">PNG, JPG, WEBP</p>
          </div>
        )}
      </div>

      {imageSrc && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Controls */}
          <div className="lg:w-56 shrink-0 space-y-4">
            {/* Place lines */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Place Lines</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPlacing("horizontal")}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    placing === "horizontal"
                      ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  Horizontal
                </button>
                <button
                  onClick={() => setPlacing("vertical")}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    placing === "vertical"
                      ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  <Plus className="w-4 h-4 rotate-90" />
                  Vertical
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{hLines.length}H + {vLines.length}V lines</span>
                <button onClick={handleClearLines} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Clear Lines
                </button>
              </div>
            </div>

            {/* Snap */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Snap to pixels</p>
              <div className="flex flex-wrap gap-1.5">
                {SNAP_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSnap(s)}
                    className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                      snap === s
                        ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                        : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600"
                    }`}
                  >
                    {s}px
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600">
                Align cuts to pixel grid for clean edges.
              </p>
            </div>

            {/* Output size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Output</p>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={centerOutput}
                    onChange={(e) => setCenterOutput(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${centerOutput ? "bg-amber-500 border-amber-500" : "bg-zinc-800 border-zinc-600"}`}>
                    {centerOutput && (
                      <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500">Fit content</span>
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={1024}
                  value={outputWidth}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOutputWidth(v === "" ? 64 : Math.max(1, Math.min(1024, Number(v))));
                  }}
                  disabled={!centerOutput}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white disabled:opacity-40 focus:outline-none focus:border-amber-500/50"
                  placeholder="W"
                />
                <input
                  type="number"
                  min={1}
                  max={1024}
                  value={outputHeight}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOutputHeight(v === "" ? 64 : Math.max(1, Math.min(1024, Number(v))));
                  }}
                  disabled={!centerOutput}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white disabled:opacity-40 focus:outline-none focus:border-amber-500/50"
                  placeholder="H"
                />
              </div>
            </div>

            {/* Cell count */}
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{cellCount}</p>
              <p className="text-xs text-zinc-500">cells</p>
            </div>

            {/* Download */}
            <Button
              onClick={handleDownloadAll}
              disabled={cellCount === 0 || loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {loading ? "Exporting..." : "Download All as ZIP"}
            </Button>
          </div>

          {/* Center: Image with grid overlay */}
          <div className="flex-1 min-w-0">
            <div
              ref={containerRef}
              className="relative inline-block cursor-crosshair select-none"
              onClick={handleContainerClick}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Sprite sheet"
                className="block max-w-full max-h-[60vh] object-contain"
                onLoad={handleImageLoad}
                draggable={false}
              />

              {/* Snap grid guide */}
              {imgNatural && snap > 0 && (
                <>
                  {Array.from({ length: Math.floor(imgNatural.w / snap) }, (_, i) => {
                    const px = snap * (i + 1);
                    if (px >= imgNatural.w) return null;
                    const pct = (px / imgNatural.w) * 100;
                    return (
                      <div
                        key={`sv-${i}`}
                        className="absolute top-0 bottom-0 pointer-events-none"
                        style={{ left: `${pct}%`, width: 0 }}
                      >
                        <div className="absolute top-0 bottom-0 w-px -translate-x-1/2 bg-cyan-400/10" />
                      </div>
                    );
                  })}
                  {Array.from({ length: Math.floor(imgNatural.h / snap) }, (_, i) => {
                    const px = snap * (i + 1);
                    if (px >= imgNatural.h) return null;
                    const pct = (px / imgNatural.h) * 100;
                    return (
                      <div
                        key={`sh-${i}`}
                        className="absolute left-0 right-0 pointer-events-none"
                        style={{ top: `${pct}%`, height: 0 }}
                      >
                        <div className="absolute left-0 right-0 h-px -translate-y-1/2 bg-cyan-400/10" />
                      </div>
                    );
                  })}
                </>
              )}

              {/* Vertical lines */}
              {imgNatural &&
                vLines.map((pos, i) => (
                  <div
                    key={`v-${i}`}
                    className="absolute top-0 bottom-0 z-10"
                    style={{ left: `${pos}%`, width: 0 }}
                    onPointerDown={(e) => handlePointerDown(e, "v", i)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onDoubleClick={() => handleLineDoubleClick("v", i)}
                  >
                    <div
                      className={`absolute top-0 bottom-0 w-px -translate-x-1/2 transition-colors ${
                        dragging?.type === "v" && dragging.index === i ? "bg-white" : "bg-cyan-400"
                      }`}
                    />
                    <div
                      className="absolute top-0 bottom-0 cursor-col-resize"
                      style={{ left: -LINE_HIT_RADIUS, width: LINE_HIT_RADIUS * 2 }}
                    />
                  </div>
                ))}

              {/* Horizontal lines */}
              {imgNatural &&
                hLines.map((pos, i) => (
                  <div
                    key={`h-${i}`}
                    className="absolute left-0 right-0 z-10"
                    style={{ top: `${pos}%`, height: 0 }}
                    onPointerDown={(e) => handlePointerDown(e, "h", i)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onDoubleClick={() => handleLineDoubleClick("h", i)}
                  >
                    <div
                      className={`absolute left-0 right-0 h-px -translate-y-1/2 transition-colors ${
                        dragging?.type === "h" && dragging.index === i ? "bg-white" : "bg-cyan-400"
                      }`}
                    />
                    <div
                      className="absolute left-0 right-0 cursor-row-resize"
                      style={{ top: -LINE_HIT_RADIUS, height: LINE_HIT_RADIUS * 2 }}
                    />
                  </div>
                ))}

              {/* Cell count label */}
              {cellCount > 0 && (
                <div className="absolute top-2 left-2 bg-black/70 text-cyan-400 text-xs font-bold px-2 py-1 rounded z-20">
                  {cellCount} cells
                </div>
              )}
            </div>
          </div>

          {/* Right: Preview grid */}
          {cellCount > 0 && (
            <div className="lg:w-56 shrink-0 space-y-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Sprite Preview ({cellCount})
              </p>
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 max-h-[60vh] overflow-y-auto">
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${Math.min(gridCols, 4)}, 1fr)` }}
                >
                  {Array.from({ length: gridRows }, (_, row) =>
                    Array.from({ length: gridCols }, (_, col) => {
                      const key = `${row}-${col}`;
                      const previewUrl = previews.get(key);
                      return (
                        <button
                          key={key}
                          onClick={() => handleDownloadSingle(row, col)}
                          className="group relative aspect-square rounded overflow-hidden border border-zinc-700 hover:border-amber-500/50 transition-colors cursor-pointer"
                          style={{
                            background: "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 50% / 6px 6px",
                          }}
                          title={`r${row + 1}_c${col + 1} — click to download`}
                        >
                          {previewUrl ? (
                            <img src={previewUrl} alt={`r${row + 1}c${col + 1}`} className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Loader2 className="w-3 h-3 text-zinc-600 animate-spin" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Download className="w-3.5 h-3.5 text-white" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 text-center">
                  Click any sprite to download
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Info */}
      <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">How to use Grid Cutter</h3>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>
            Toggle <span className="text-zinc-400">Horizontal</span> / <span className="text-zinc-400">Vertical</span> then click on the image to place cut lines.
          </li>
          <li>
            <span className="text-zinc-400">Double-click</span> a line to remove it.
          </li>
          <li>
            <span className="text-zinc-400">Drag</span> a line to reposition it.
          </li>
          <li>
            <span className="text-zinc-400">Snap to pixels</span> aligns lines to clean pixel boundaries.
          </li>
          <li>
            Enable <span className="text-zinc-400">Fit content</span> to auto-detect the icon inside each cell and center it on a transparent canvas.
          </li>
          <li>
            Click any sprite in the preview to download individually, or <span className="text-zinc-400">Download All</span> for a ZIP.
          </li>
        </ul>
      </div>
    </div>
  );
}
