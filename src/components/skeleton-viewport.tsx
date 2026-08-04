"use client";

import { Suspense, useMemo, useRef, useCallback, useState, useEffect } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, Grid } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";
import { Loader2, RotateCcw, ZoomIn, ZoomOut, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";

interface Bone {
  name: string;
  position: [number, number, number];
  parent: string | null;
}

interface PlacedMarker {
  name: string;
  position: [number, number, number];
  color: string;
}

interface ViewportProps {
  modelUrl: string | null;
  modelFormat: string | null;
  skeleton: Bone[];
  placementMode?: boolean;
  showMarkers?: boolean;
  activeMarkerId?: string | null;
  markers?: PlacedMarker[];
  onMarkerPlace?: (position: [number, number, number]) => void;
  className?: string;
}

function GltfModel({
  url,
  onPlace,
  visible,
}: {
  url: string;
  onPlace?: (pos: [number, number, number]) => void;
  visible?: boolean;
}) {
  const gltf = useLoader(GLTFLoader, url);

  useMemo(() => {
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [gltf]);

  return (
    <group
      visible={visible !== false}
      onClick={(e: any) => {
        if (!onPlace) return;
        e.stopPropagation();
        if (e.intersections.length > 0) {
          const point = e.intersections[0].point;
          onPlace([point.x, point.y, point.z]);
        }
      }}
    >
      <primitive object={gltf.scene} />
    </group>
  );
}

function ObjModel({
  url,
  onPlace,
  visible,
}: {
  url: string;
  onPlace?: (pos: [number, number, number]) => void;
  visible?: boolean;
}) {
  const obj = useLoader(OBJLoader, url);

  useMemo(() => {
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0x888888,
          roughness: 0.7,
          metalness: 0.1,
        });
      }
    });
  }, [obj]);

  return (
    <group
      visible={visible !== false}
      onClick={(e: any) => {
        if (!onPlace) return;
        e.stopPropagation();
        if (e.intersections.length > 0) {
          const point = e.intersections[0].point;
          onPlace([point.x, point.y, point.z]);
        }
      }}
    >
      <primitive object={obj} />
    </group>
  );
}

function Model({
  url,
  format,
  onPlace,
  visible,
}: {
  url: string;
  format: string;
  onPlace?: (pos: [number, number, number]) => void;
  visible?: boolean;
}) {
  const ext = format.replace(".", "").toLowerCase();
  if (ext === "obj") return <ObjModel url={url} onPlace={onPlace} visible={visible} />;
  return <GltfModel url={url} onPlace={onPlace} visible={visible} />;
}

function SkeletonOverlay({ skeleton }: { skeleton: Bone[] }) {
  const { lines } = useMemo(() => {
    if (!skeleton.length) return { lines: [] };

    const boneMap = new Map<string, THREE.Vector3>();
    skeleton.forEach((b) => {
      boneMap.set(b.name, new THREE.Vector3(...b.position));
    });

    const linePositions: number[] = [];
    skeleton.forEach((b) => {
      if (b.parent && boneMap.has(b.parent)) {
        const childPos = boneMap.get(b.name)!;
        const parentPos = boneMap.get(b.parent)!;
        linePositions.push(parentPos.x, parentPos.y, parentPos.z);
        linePositions.push(childPos.x, childPos.y, childPos.z);
      }
    });

    return { lines: linePositions };
  }, [skeleton]);

  if (!skeleton.length) return null;

  return (
    <group>
      {skeleton.map((b) => (
        <mesh key={b.name} position={b.position}>
          <sphereGeometry args={[0.02, 12, 12]} />
          <meshBasicMaterial color="#FF6B35" />
        </mesh>
      ))}
      {lines.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(lines), 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#4ECDC4" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

function MarkerSpheres({ markers, activeMarkerId }: { markers: PlacedMarker[]; activeMarkerId?: string | null }) {
  return (
    <group>
      {markers.map((m) => {
        const isActive = m.name === activeMarkerId;
        return (
          <group key={m.name}>
            <mesh position={m.position} rotation={[0, 0, 0]}>
              <ringGeometry args={[isActive ? 0.04 : 0.03, isActive ? 0.05 : 0.04, 32]} />
              <meshBasicMaterial color={m.color} side={THREE.DoubleSide} transparent opacity={isActive ? 1 : 0.8} />
            </mesh>
            <mesh position={m.position}>
              <sphereGeometry args={[isActive ? 0.02 : 0.015, 16, 16]} />
              <meshBasicMaterial color={m.color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

const CAMERA_FRONT = [0, 1.0, 3.5] as const;
const DEFAULT_TARGET = [0, 0.8, 0] as const;

function CameraController({
  controlsRef,
  cameraAction,
}: {
  controlsRef: React.RefObject<any>;
  cameraAction: "zoomIn" | "zoomOut" | "up" | "down" | null;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (!cameraAction) return;

    const moveSpeed = 0.3;
    const zoomSpeed = 0.8;

    switch (cameraAction) {
      case "zoomIn": {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        camera.position.addScaledVector(dir, zoomSpeed);
        break;
      }
      case "zoomOut": {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        camera.position.addScaledVector(dir, -zoomSpeed);
        break;
      }
      case "up":
        camera.position.y += moveSpeed;
        if (controlsRef.current) {
          controlsRef.current.target.y += moveSpeed;
          controlsRef.current.update();
        }
        break;
      case "down":
        camera.position.y -= moveSpeed;
        if (controlsRef.current) {
          controlsRef.current.target.y -= moveSpeed;
          controlsRef.current.update();
        }
        break;
    }
  }, [cameraAction]);

  return null;
}

function Scene({
  modelUrl,
  modelFormat,
  skeleton,
  controlsRef,
  placementMode,
  showMarkers,
  markers,
  activeMarkerId,
  onPlace,
  cameraAction,
  showMesh,
}: {
  modelUrl: string;
  modelFormat: string;
  skeleton: Bone[];
  controlsRef: React.RefObject<any>;
  placementMode: boolean;
  showMarkers: boolean;
  markers: PlacedMarker[];
  activeMarkerId?: string | null;
  onPlace?: (pos: [number, number, number]) => void;
  cameraAction: "zoomIn" | "zoomOut" | "up" | "down" | null;
  showMesh: boolean;
}) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(...CAMERA_FRONT);
    if (controlsRef.current) {
      controlsRef.current.target.set(...DEFAULT_TARGET);
      controlsRef.current.update();
    }
  }, []);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 10, 7]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.4} />
      <hemisphereLight args={["#b1e1ff", "#362907", 0.6]} />
      <Environment preset="studio" />

      <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
      <Grid
        position={[0, -0.01, 0]}
        args={[10, 10]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#444"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#222"
        fadeDistance={15}
        fadeStrength={1}
        infiniteGrid
      />

      <Suspense fallback={null}>
        <Model url={modelUrl} format={modelFormat} onPlace={onPlace} visible={showMesh} />
      </Suspense>
      <Suspense fallback={null}>
        <SkeletonOverlay skeleton={skeleton} />
      </Suspense>

      {showMarkers && markers.length > 0 && (
        <MarkerSpheres markers={markers} activeMarkerId={activeMarkerId} />
      )}

      <CameraController controlsRef={controlsRef} cameraAction={cameraAction} />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        minDistance={1}
        maxDistance={20}
        target={DEFAULT_TARGET}
        enabled={!placementMode}
      />
    </>
  );
}

export default function SkeletonViewport({
  modelUrl,
  modelFormat,
  skeleton,
  placementMode = false,
  showMarkers = true,
  activeMarkerId = null,
  markers = [],
  onMarkerPlace,
  className = "",
}: ViewportProps) {
  const controlsRef = useRef<any>(null);
  const [cameraAction, setCameraAction] = useState<"zoomIn" | "zoomOut" | "up" | "down" | null>(null);
  const [showMesh, setShowMesh] = useState(true);

  const triggerAction = useCallback((action: "zoomIn" | "zoomOut" | "up" | "down") => {
    setCameraAction(action);
    requestAnimationFrame(() => setCameraAction(null));
  }, []);

  const handleReset = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(...DEFAULT_TARGET);
      controlsRef.current.update();
    }
  }, []);

  const handlePlace = useCallback(
    (position: [number, number, number]) => {
      if (placementMode && onMarkerPlace) {
        onMarkerPlace(position);
      }
    },
    [placementMode, onMarkerPlace]
  );

  return (
    <div
      className={`relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 ${className} ${
        placementMode ? "ring-2 ring-amber-500/50" : ""
      }`}
    >
      {!modelUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 z-10">
          <div className="text-center">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-sm">Upload a model to preview</p>
          </div>
        </div>
      )}

      {placementMode && (
        <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-amber-500/90 text-black text-xs font-medium rounded-lg">
          {activeMarkerId
            ? `Click on model to place marker`
            : "Select a marker from the panel"}
        </div>
      )}

      {/* Mesh toggle - visible in rig/rename/export steps */}
      {!placementMode && modelUrl && (
        <button
          onClick={() => setShowMesh((v) => !v)}
          className="absolute top-3 left-3 z-10 p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
          title={showMesh ? "Hide mesh" : "Show mesh"}
        >
          {showMesh ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          <span className="text-[10px]">{showMesh ? "Mesh" : "Mesh off"}</span>
        </button>
      )}

      {/* Camera controls for placement mode */}
      {placementMode && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1">
          <button
            onClick={() => triggerAction("zoomIn")}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => triggerAction("zoomOut")}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-full h-px bg-zinc-700 my-1" />
          <button
            onClick={() => triggerAction("up")}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Move up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => triggerAction("down")}
            className="p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Move down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {modelUrl && (
        <button
          onClick={handleReset}
          className="absolute top-3 right-3 z-10 p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
          title="Reset camera"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}

      <Canvas
        shadows
        camera={{ position: [...CAMERA_FRONT] as [number, number, number], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#18181b");
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        <Suspense fallback={null}>
          {modelUrl && modelFormat && (
            <Scene
              modelUrl={modelUrl}
              modelFormat={modelFormat}
              skeleton={skeleton}
              controlsRef={controlsRef}
              placementMode={placementMode}
              showMarkers={showMarkers}
              markers={markers}
              activeMarkerId={activeMarkerId}
              onPlace={handlePlace}
              cameraAction={cameraAction}
              showMesh={showMesh}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
