/**
 * Client-side FBX / OBJ processor for the "Rig Tools" feature.
 *
 * Pipeline:
 *  1. Parse the source file with three.js (FBXLoader / OBJLoader).
 *  2. Rename every Mixamo bone to the target Unreal skeleton name and
 *     rewrite the animation tracks so they keep pointing at the renamed
 *     bones (otherwise the exported FBX would have dangling tracks).
 *  3. Re-serialize to binary FBX with the Unreal axis/unit preset via
 *     @comfyorg/fbx-exporter-three (preserves skinning + animation).
 *
 * This module is intentionally NOT imported statically by the component:
 * it is loaded on demand (dynamic import) so the ~1MB three.js graph is
 * code-split out of the initial client bundle.
 */

import { Group, PropertyBinding, type Object3D } from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXExporter } from "@comfyorg/fbx-exporter-three";

import { getBoneMap, resolveBoneName, type SkeletonTarget } from "./bone-map";

export interface BoneRenameEntry {
  original: string;
  converted: string;
}

export interface ProcessResult {
  fileName: string;
  extension: "fbx" | "obj";
  target: SkeletonTarget;
  bytes: Uint8Array;
  renames: BoneRenameEntry[];
  boneCount: number;
  animationClipCount: number;
}

interface RenamePlan {
  oldToNew: Map<string, string>;
  list: BoneRenameEntry[];
}

function collectBones(root: Object3D): Object3D[] {
  const bones: Object3D[] = [];
  root.traverse((o) => {
    if ((o as { isBone?: boolean }).isBone) bones.push(o);
  });
  return bones;
}

function buildRenamePlan(root: Object3D, target: SkeletonTarget): RenamePlan {
  const map = getBoneMap(target);
  const oldToNew = new Map<string, string>();
  const list: BoneRenameEntry[] = [];

  for (const bone of collectBones(root)) {
    const converted = resolveBoneName(bone.name, map);
    if (converted !== bone.name) {
      oldToNew.set(bone.name, converted);
      list.push({ original: bone.name, converted });
    }
  }
  return { oldToNew, list };
}

function applyBoneRenames(root: Object3D, oldToNew: Map<string, string>): void {
  for (const bone of collectBones(root)) {
    const converted = oldToNew.get(bone.name);
    if (converted) bone.name = converted;
  }
}

function rewriteAnimationTracks(root: Object3D, oldToNew: Map<string, string>): void {
  const clips =
    (root as unknown as { animations?: Array<{ tracks: Array<{ name: string }> }> }).animations ?? [];
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const parsed = PropertyBinding.parseTrackName(track.name);
      if (!parsed || !parsed.nodeName) continue;
      const converted = oldToNew.get(parsed.nodeName);
      if (!converted) continue;
      const indexSuffix =
        parsed.propertyIndex != null ? `[${parsed.propertyIndex}]` : "";
      track.name = `${converted}.${parsed.propertyName}${indexSuffix}`;
    }
  }
}

function exportFbx(root: Object3D, fps = 30): Uint8Array {
  const exporter = new FBXExporter();
  return exporter.parseSync(root, {
    // Mixamo source files are Y-up / Z-forward, and three.js keeps them in
    // that orientation. We must declare the TRUE axes of the data — not
    // Unreal's Z-up — so Unreal's FBX importer applies its own Y-up -> Z-up
    // conversion and the model stands upright, exactly like the original.
    // Declaring Z-up here would leave the Y-up data "rotated" on import.
    // Front is declared -Z (Unreal's forward faces the camera) so the
    // character imports facing forward instead of 180° backwards.
    axisUp: "Y",
    axisForward: "-Z",
    unitScale: 1,
    fps,
  });
}

export async function processFbx(
  buffer: ArrayBuffer,
  fileName: string,
  target: SkeletonTarget
): Promise<ProcessResult> {
  const root = new FBXLoader().parse(buffer, "");

  const plan = buildRenamePlan(root, target);
  applyBoneRenames(root, plan.oldToNew);
  rewriteAnimationTracks(root, plan.oldToNew);

  const bytes = exportFbx(root);

  return {
    fileName,
    extension: "fbx",
    target,
    bytes,
    renames: plan.list,
    boneCount: collectBones(root).length,
    animationClipCount:
      (root as unknown as { animations?: unknown[] }).animations?.length ?? 0,
  };
}

export async function processObj(
  text: string,
  fileName: string,
  target: SkeletonTarget
): Promise<ProcessResult> {
  const mesh = new OBJLoader().parse(text);

  const group = new Group();
  group.name = "group";
  group.add(mesh);
  (group as unknown as { animations: unknown[] }).animations = [];

  const bytes = exportFbx(group);

  return {
    fileName,
    extension: "obj",
    target,
    bytes,
    renames: [],
    boneCount: 0,
    animationClipCount: 0,
  };
}