"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/sidebar";
import { AuthModalLogin, AuthModalRegister } from "@/components/auth-modal";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  Bone,
  Upload,
  Film,
  Download,
  AlertCircle,
  Loader2,
  Check,
  Eye,
} from "lucide-react";

const SkeletonViewport = dynamic(() => import("@/components/skeleton-viewport"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a14] rounded-lg border border-zinc-800">
      <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
    </div>
  ),
});

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

interface Bone {
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  parent: string | null;
}

interface Animation {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
}

interface MarkerGroup {
  id: string;
  label: string;
  color: string;
  position: [number, number, number] | null;
  symmetric: boolean;
}

type Step = "upload" | "mark" | "animate" | "export";

const STEPS: { id: Step; label: string; icon: any }[] = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "mark", label: "Mark", icon: Eye },
  { id: "animate", label: "Animate", icon: Film },
  { id: "export", label: "Export", icon: Download },
];

const MARKER_GROUPS: Omit<MarkerGroup, "position">[] = [
  { id: "chin", label: "CHIN", color: "#00BFFF", symmetric: false },
  { id: "wrists", label: "WRISTS", color: "#90EE90", symmetric: true },
  { id: "elbows", label: "ELBOWS", color: "#FFD700", symmetric: true },
  { id: "knees", label: "KNEES", color: "#FFA500", symmetric: true },
  { id: "groin", label: "GROIN", color: "#FF69B4", symmetric: false },
];

export default function RigFlowPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

  const [step, setStep] = useState<Step>("upload");
  const [modelId, setModelId] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [modelFormat, setModelFormat] = useState<string | null>(null);
  const [skeleton, setSkeleton] = useState<Bone[]>([]);
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [selectedAnimation, setSelectedAnimation] = useState<Animation | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<any>(null);

  const [markers, setMarkers] = useState<MarkerGroup[]>(
    MARKER_GROUPS.map((m) => ({ ...m, position: null }))
  );
  const [useSymmetry, setUseSymmetry] = useState(true);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [supabase]);

  const handleMarkerPlace = useCallback(
    (position: [number, number, number]) => {
      if (!selectedMarkerId) return;
      setMarkers((prev) =>
        prev.map((m) => (m.id === selectedMarkerId ? { ...m, position } : m))
      );
      // Auto-select next empty marker
      setSelectedMarkerId((prevId) => {
        const idx = markers.findIndex((m) => m.id === prevId);
        for (let i = idx + 1; i < markers.length; i++) {
          if (!markers[i].position) return markers[i].id;
        }
        for (let i = 0; i < idx; i++) {
          if (!markers[i].position) return markers[i].id;
        }
        return null;
      });
    },
    [selectedMarkerId, markers]
  );

  const handleSelectMarker = useCallback((markerId: string) => {
    setSelectedMarkerId((prev) => (prev === markerId ? null : markerId));
  }, []);

  const handleClearMarker = useCallback((markerId: string) => {
    setMarkers((prev) =>
      prev.map((m) => (m.id === markerId ? { ...m, position: null } : m))
    );
  }, []);

  // --- Upload ---
  const handleFile = useCallback(async (file: File) => {
    setProcessing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/api/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      const data = await res.json();
      setModelId(data.model_id);
      setModelName(file.name);
      setModelFormat(data.format);
      setStep("mark");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }, []);

  // --- Rig from markers ---
  const handleRigFromMarkers = useCallback(async () => {
    if (!modelId) return;

    const placedMarkers = markers
      .filter((m) => m.position)
      .flatMap((m) => {
        if (m.symmetric) {
          const pos = m.position!;
          const boneName = m.id.replace(/s$/, "");
          // Determine side based on X coordinate:
          // X >= 0 = model's left side (right side of screen) = left_*
          // X < 0 = model's right side (left side of screen) = right_*
          if (pos[0] >= 0) {
            // User clicked on model's left side
            return [
              { name: `left_${boneName}`, position: pos },
              { name: `right_${boneName}`, position: [-pos[0], pos[1], pos[2]] as [number, number, number] },
            ];
          } else {
            // User clicked on model's right side
            return [
              { name: `right_${boneName}`, position: pos },
              { name: `left_${boneName}`, position: [-pos[0], pos[1], pos[2]] as [number, number, number] },
            ];
          }
        }
        return [{ name: m.id, position: m.position! }];
      });

    if (placedMarkers.length < 2) {
      setError("Place at least Chin and Groin markers.");
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/rig-from-markers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: modelId, markers: placedMarkers, symmetry: false }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Rigging failed");
      const data = await res.json();
      setSkeleton(data.skeleton);
      setStep("animate");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }, [modelId, markers]);

  // --- Rename ---

  // --- Animations ---
  const fetchAnimations = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/animations`);
      if (!res.ok) return;
      const data = await res.json();
      setAnimations(data.animations || []);
    } catch {
      setAnimations([]);
    }
  }, []);

  useEffect(() => {
    if (step === "animate") {
      fetchAnimations();
    }
  }, [step, fetchAnimations]);

  // --- Export ---
  const handleExport = useCallback(async (format: string, includeAnimation: boolean = true) => {
    if (!modelId) return;
    setProcessing(true);
    setError(null);
    try {
      const body: any = { model_id: modelId, format };
      if (includeAnimation && selectedAnimation) {
        body.animation_id = selectedAnimation.id;
      }
      const res = await fetch(`${API}/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Export failed");
      const data = await res.json();
      setExportResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }, [modelId, selectedAnimation]);

  const handleDownload = useCallback(async () => {
    if (!exportResult?.download_url) return;
    const res = await fetch(`${API}${exportResult.download_url}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportResult.download_url.split("/").pop() || "model.fbx";
    a.click();
    URL.revokeObjectURL(url);
  }, [exportResult]);

  const currentStepIdx = STEPS.findIndex((s) => s.id === step);
  const displaySkeleton = skeleton;
  const placedCount = markers.filter((m) => m.position !== null).length;
  const allRequiredPlaced = markers.filter((m) => m.id === "chin" || m.id === "groin").every((m) => m.position !== null);

  // Convert markers to viewport format (expand symmetric ones for display)
  const viewportMarkers = markers.flatMap((m) => {
    if (!m.position) return [];
    if (m.symmetric && useSymmetry) {
      const pos = m.position;
      // Same logic as handleRigFromMarkers: X >= 0 = left, X < 0 = right
      if (pos[0] >= 0) {
        return [
          { name: `left_${m.id}`, position: pos, color: m.color },
          { name: `right_${m.id}`, position: [-pos[0], pos[1], pos[2]] as [number, number, number], color: m.color },
        ];
      } else {
        return [
          { name: `right_${m.id}`, position: pos, color: m.color },
          { name: `left_${m.id}`, position: [-pos[0], pos[1], pos[2]] as [number, number, number], color: m.color },
        ];
      }
    }
    return [{ name: m.id, position: m.position, color: m.color }];
  });

  return (
    <div className="flex min-h-screen bg-[#0f0f1a] text-white">
      <Sidebar
        assetCount={0}
        activeTool="rigflow"
        onToolChange={() => {}}
        user={user}
        onLoginClick={() => setLoginModalOpen(true)}
        onRegisterClick={() => setRegisterModalOpen(true)}
      />
      <AuthModalLogin open={loginModalOpen} onOpenChange={setLoginModalOpen} />
      <AuthModalRegister open={registerModalOpen} onOpenChange={setRegisterModalOpen} />

      <main className="flex-1 ml-64 p-6 overflow-auto">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bone className="w-6 h-6 text-amber-500" />
            RigFlow
          </h2>
          <p className="text-zinc-400 mt-1 text-sm">
            Auto-rig, rename bones, and animate 3D models for Unreal Engine
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isComplete = i < currentStepIdx;
            return (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => isComplete && setStep(s.id)}
                  disabled={!isComplete}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-amber-500 text-black"
                      : isComplete
                        ? "bg-amber-500/20 text-amber-400 cursor-pointer"
                        : "text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 h-px mx-1 ${isComplete ? "bg-amber-500" : "bg-zinc-700"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex gap-4" style={{ height: "calc(100vh - 12rem)" }}>
          {/* Left: Controls */}
          <div className="w-96 shrink-0 bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 overflow-y-auto">
            {/* UPLOAD */}
            {step === "upload" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-white text-sm">Upload Model</h3>
                <label
                  onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 hover:border-amber-500 rounded-xl p-8 cursor-pointer transition-colors"
                >
                  <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                  <p className="text-zinc-300 font-medium text-sm">Drop your 3D model here</p>
                  <p className="text-zinc-500 text-xs mt-1">FBX, OBJ, GLB — Max 200MB</p>
                  <input
                    type="file"
                    accept=".fbx,.obj,.glb,.gltf"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* MARK - Mixamo style */}
            {step === "mark" && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-white text-sm">Place markers</h3>
                  <p className="text-zinc-400 text-xs mt-1">
                    Click a marker, then click on the model to place it.
                  </p>
                </div>

                {/* Use Symmetry */}
                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={useSymmetry}
                    onChange={(e) => setUseSymmetry(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
                  />
                  Use Symmetry
                </label>

                {/* Marker groups */}
                <div className="space-y-2">
                  {markers.map((m) => {
                    const isSelected = selectedMarkerId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelectMarker(m.id)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left cursor-pointer ${
                          isSelected
                            ? "ring-2 ring-amber-500 bg-amber-500/20"
                            : m.position
                              ? "bg-green-500/10 border border-green-500/30"
                              : "bg-zinc-800 border border-zinc-700 hover:border-zinc-600"
                        }`}
                      >
                        {/* Marker circle */}
                        <div
                          className="w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{ borderColor: m.color }}
                        >
                          {m.position ? (
                            <div
                              className="w-5 h-5 rounded-full"
                              style={{ backgroundColor: m.color }}
                            />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-zinc-600" />
                          )}
                        </div>

                        {/* Label */}
                        <div className="flex-1">
                          <span className="text-xs font-medium text-white">{m.label}</span>
                          {m.symmetric && (
                            <span className="text-[10px] text-zinc-500 ml-1">(both sides)</span>
                          )}
                        </div>

                        {/* Status / Clear */}
                        {m.position ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleClearMarker(m.id); }}
                            className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            Clear
                          </button>
                        ) : isSelected ? (
                          <div className="text-[10px] text-amber-400">Active</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Progress */}
                <div className="text-xs text-zinc-500">
                  {placedCount}/{markers.length} markers placed
                </div>

                {/* Next button */}
                <button
                  onClick={handleRigFromMarkers}
                  disabled={processing || !allRequiredPlaced}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-medium rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  {processing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <>Next</>
                  )}
                </button>
              </div>
            )}

            {/* RIG (legacy fallback) */}

            {/* ANIMATE */}
            {step === "animate" && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-white text-sm">Animations</h3>
                  <p className="text-zinc-400 text-xs mt-1">
                    {animations.length} animations available (CC0 License)
                  </p>
                </div>

                {/* T-Pose option */}
                <button
                  onClick={() => setSelectedAnimation(null)}
                  className={`w-full p-3 rounded-lg border text-left text-sm transition-all ${
                    selectedAnimation === null
                      ? "border-amber-500 bg-amber-500/20 text-amber-400"
                      : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Bone className="w-4 h-4" />
                    <span className="font-medium">T-Pose (Static)</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">No animation - export skeleton only</p>
                </button>
                
                {animations.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {(() => {
                      const categories = [...new Set(animations.map(a => a.category))];
                      return categories.map(cat => (
                        <div key={cat}>
                          <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                            {cat}
                          </h4>
                          <div className="space-y-1">
                            {animations.filter(a => a.category === cat).map(a => {
                              const isSelected = selectedAnimation?.id === a.id;
                              return (
                                <div 
                                  key={a.id} 
                                  onClick={() => setSelectedAnimation(isSelected ? null : a)}
                                  className={`p-2 rounded-lg text-xs cursor-pointer transition-all ${
                                    isSelected
                                      ? "bg-amber-500/20 border border-amber-500"
                                      : "bg-zinc-800 border border-zinc-700 hover:border-zinc-600"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <p className={`font-medium truncate ${isSelected ? "text-amber-400" : "text-white"}`}>
                                      {a.name}
                                    </p>
                                    {isSelected && (
                                      <Check className="w-3.5 h-3.5 text-amber-400" />
                                    )}
                                  </div>
                                  <p className="text-zinc-500 text-[10px]">{a.description}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs text-center py-3">Loading animations...</p>
                )}
                <button
                  onClick={() => setStep("export")}
                  className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Next: Export
                </button>
              </div>
            )}

            {/* EXPORT */}
            {step === "export" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-white text-sm">Export</h3>
                <p className="text-zinc-400 text-xs">
                  <span className="text-white">{modelName}</span> —{" "}
                  <span className="text-amber-400">{displaySkeleton.length}</span> bones
                </p>
                
                {/* Animation info */}
                <div className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs">
                  {selectedAnimation ? (
                    <div className="flex items-center gap-2">
                      <Film className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-white">{selectedAnimation.name}</span>
                      <button 
                        onClick={() => setStep("animate")}
                        className="ml-auto text-zinc-500 hover:text-amber-400"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Bone className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-zinc-400">T-Pose (no animation)</span>
                      <button 
                        onClick={() => setStep("animate")}
                        className="ml-auto text-zinc-500 hover:text-amber-400"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleExport("fbx", true)}
                    disabled={processing}
                    className="py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-700 text-black font-medium rounded-lg flex flex-col items-center gap-1 transition-colors text-sm"
                  >
                    <Download className="w-5 h-5" />
                    FBX
                    <span className="text-[10px] opacity-70">Unreal Engine</span>
                  </button>
                  <button
                    onClick={() => handleExport("glb", true)}
                    disabled={processing}
                    className="py-3 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white font-medium rounded-lg flex flex-col items-center gap-1 transition-colors text-sm border border-zinc-600"
                  >
                    <Download className="w-5 h-5" />
                    GLB
                    <span className="text-[10px] opacity-70">Blender</span>
                  </button>
                </div>

                {/* T-Pose only export */}
                <div className="border-t border-zinc-700 pt-3">
                  <p className="text-[10px] text-zinc-500 mb-2">Export without animation:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleExport("fbx", false)}
                      disabled={processing}
                      className="py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 text-zinc-300 font-medium rounded-lg flex items-center justify-center gap-1 transition-colors text-xs border border-zinc-700"
                    >
                      <Bone className="w-3.5 h-3.5" />
                      FBX T-Pose
                    </button>
                    <button
                      onClick={() => handleExport("glb", false)}
                      disabled={processing}
                      className="py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 text-zinc-300 font-medium rounded-lg flex items-center justify-center gap-1 transition-colors text-xs border border-zinc-700"
                    >
                      <Bone className="w-3.5 h-3.5" />
                      GLB T-Pose
                    </button>
                  </div>
                </div>

                {exportResult && (
                  <div className="space-y-2">
                    <div className="p-2 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-xs">
                      Ready — {(exportResult.file_size / 1024).toFixed(1)} KB
                    </div>
                    <button
                      onClick={handleDownload}
                      className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: 3D Viewport */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Eye className="w-3.5 h-3.5" />
                <span>
                  {step === "mark"
                    ? selectedMarkerId
                      ? `Click on model: ${markers.find((m) => m.id === selectedMarkerId)?.label}`
                      : `${placedCount}/${markers.length} markers placed — select one to place`
                    : displaySkeleton.length > 0
                      ? `${displaySkeleton.length} bones`
                      : "No skeleton yet"}
                </span>
              </div>
              <span className="text-[10px] text-zinc-600">
                {step === "mark" ? "Click marker in panel, then click model" : "Drag to rotate / Scroll to zoom"}
              </span>
            </div>
            <SkeletonViewport
              modelUrl={modelId ? `${API}/api/model/${modelId}/file` : null}
              modelFormat={modelFormat}
              skeleton={displaySkeleton}
              placementMode={step === "mark"}
              animationMode={step === "animate"}
              showMarkers={step === "mark"}
              activeMarkerId={selectedMarkerId}
              markers={viewportMarkers}
              onMarkerPlace={handleMarkerPlace}
              className="flex-1 min-h-0"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
