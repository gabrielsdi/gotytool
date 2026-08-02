"use client";

import { BackgroundRemoval } from "@/components/background-removal";
import { AssetsGallery } from "@/components/assets-gallery";
import { useAssets } from "@/hooks/use-assets";
import { useState } from "react";
import {
  Scissors,
  Grid3x3,
  ZoomIn,
  Palette,
  Volume2,
  Gamepad2,
  Hammer,
  Wrench,
  FolderOpen,
  ImageIcon,
} from "lucide-react";

const TOOLS = [
  {
    id: "bg-removal",
    name: "Background Removal",
    icon: Scissors,
    description: "Remove image backgrounds",
  },
  {
    id: "coming-1",
    name: "Sprite Sheet Cutter",
    icon: Grid3x3,
    description: "Coming soon",
    disabled: true,
  },
  {
    id: "coming-2",
    name: "Pixel Art Scaler",
    icon: ZoomIn,
    description: "Coming soon",
    disabled: true,
  },
  {
    id: "coming-3",
    name: "Color Palette Extractor",
    icon: Palette,
    description: "Coming soon",
    disabled: true,
  },
  {
    id: "coming-4",
    name: "Audio Converter",
    icon: Volume2,
    description: "Coming soon",
    disabled: true,
  },
];

export default function Home() {
  const [activeTool, setActiveTool] = useState("bg-removal");
  const { assets, addAsset, removeAsset, clearAssets } = useAssets();

  return (
    <div className="flex min-h-screen bg-[#0f0f1a] text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#16162a] border-r border-zinc-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
              <Gamepad2 className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-bold text-white leading-tight">
                GameDev Tools
              </h1>
              <p className="text-xs text-zinc-500">Free utilities</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
            Tools
          </p>
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => !tool.disabled && setActiveTool(tool.id)}
                disabled={tool.disabled}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeTool === tool.id
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : tool.disabled
                      ? "text-zinc-600 cursor-not-allowed"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent"
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    activeTool === tool.id
                      ? "text-amber-400"
                      : tool.disabled
                        ? "text-zinc-600"
                        : "text-zinc-500"
                  }`}
                />
                <div className="text-left">
                  <div className="font-medium">{tool.name}</div>
                  {tool.disabled && (
                    <div className="text-[10px] text-zinc-600">
                      {tool.description}
                    </div>
                  )}
                </div>
                {tool.disabled && (
                  <span className="ml-auto text-[10px] bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded">
                    SOON
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">
              Library
            </p>
            <button
              onClick={() => setActiveTool("assets")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeTool === "assets"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <FolderOpen
                className={`w-5 h-5 shrink-0 ${
                  activeTool === "assets" ? "text-amber-400" : "text-zinc-500"
                }`}
              />
              <div className="text-left font-medium">Assets</div>
              {assets.length > 0 && (
                <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                  {assets.length}
                </span>
              )}
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center justify-center gap-2 text-zinc-600">
            <Hammer className="w-3.5 h-3.5" />
            <p className="text-[10px]">Built for game developers</p>
            <Wrench className="w-3.5 h-3.5" />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
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
                    onClick={clearAssets}
                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <AssetsGallery assets={assets} onDelete={removeAsset} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
