/**
 * Bone naming map: Mixamo skeleton -> Unreal Engine mannequin skeleton.
 *
 * Source: https://github.com/enziop/mixamo_converter (mixamoconv.py)
 * Mixamo rigs export bones under a namespace (e.g. "mixamorig:Hips").
 * Before matching, the namespace is stripped the same way the Blender
 * add-on does it (keep the text after the last ":" or "_").
 */

export type SkeletonTarget = "ue4" | "ue5";

const MIXAMO_TO_UNREAL: Record<string, string> = {
  root: "Root",
  Hips: "Pelvis",
  Spine: "spine_01",
  Spine1: "spine_02",
  Spine2: "spine_03",
  LeftShoulder: "clavicle_l",
  LeftArm: "upperarm_l",
  LeftForeArm: "lowerarm_l",
  LeftHand: "hand_l",
  RightShoulder: "clavicle_r",
  RightArm: "upperarm_r",
  RightForeArm: "lowerarm_r",
  RightHand: "hand_r",
  Neck: "neck_01",
  Neck1: "neck_01",
  Head: "head",
  LeftUpLeg: "thigh_l",
  LeftLeg: "calf_l",
  LeftFoot: "foot_l",
  RightUpLeg: "thigh_r",
  RightLeg: "calf_r",
  RightFoot: "foot_r",
  LeftHandIndex1: "index_01_l",
  LeftHandIndex2: "index_02_l",
  LeftHandIndex3: "index_03_l",
  LeftHandMiddle1: "middle_01_l",
  LeftHandMiddle2: "middle_02_l",
  LeftHandMiddle3: "middle_03_l",
  LeftHandPinky1: "pinky_01_l",
  LeftHandPinky2: "pinky_02_l",
  LeftHandPinky3: "pinky_03_l",
  LeftHandRing1: "ring_01_l",
  LeftHandRing2: "ring_02_l",
  LeftHandRing3: "ring_03_l",
  LeftHandThumb1: "thumb_01_l",
  LeftHandThumb2: "thumb_02_l",
  LeftHandThumb3: "thumb_03_l",
  RightHandIndex1: "index_01_r",
  RightHandIndex2: "index_02_r",
  RightHandIndex3: "index_03_r",
  RightHandMiddle1: "middle_01_r",
  RightHandMiddle2: "middle_02_r",
  RightHandMiddle3: "middle_03_r",
  RightHandPinky1: "pinky_01_r",
  RightHandPinky2: "pinky_02_r",
  RightHandPinky3: "pinky_03_r",
  RightHandRing1: "ring_01_r",
  RightHandRing2: "ring_02_r",
  RightHandRing3: "ring_03_r",
  RightHandThumb1: "thumb_01_r",
  RightHandThumb2: "thumb_02_r",
  RightHandThumb3: "thumb_03_r",
  LeftToeBase: "ball_l",
  RightToeBase: "ball_r",
};

/**
 * UE4 and UE5 both ship the standard Unreal mannequin skeleton, so the
 * target bone names are identical. This per-profile override table exists
 * so a profile can diverge in the future without touching the shared map.
 */
const PROFILE_OVERRIDES: Record<SkeletonTarget, Record<string, string>> = {
  ue4: {},
  ue5: {},
};

export function getBoneMap(target: SkeletonTarget): Readonly<Record<string, string>> {
  return { ...MIXAMO_TO_UNREAL, ...PROFILE_OVERRIDES[target] };
}

/**
 * Normalize a raw bone name to its Mixamo base name so it can be matched
 * against the map keys (e.g. "Hips", "LeftArm", ...).
 *
 * Mixamo exports bones under a namespace token. Depending on the importer
 * the token is separated (Blender keeps "mixamorig:Hips") or glued by
 * three.js's FBXLoader, which runs the name through
 * `PropertyBinding.sanitizeNodeName` removing the ":" (producing
 * "mixamorigHips"). We handle both shapes.
 */
export function stripNamespace(name: string): string {
  // Blender-style namespace: keep everything after the last ":" or "_".
  const sepMatch = /[:_][^:_]*$/.exec(name);
  const afterSep = sepMatch ? name.slice(sepMatch.index + 1) : name;
  // three.js glue: drop a leading "mixamorig" token glued to the bone name.
  return afterSep.replace(/^mixamorig/i, "");
}

/** Resolve a raw bone name to its target name (falls back to stripped name). */
export function resolveBoneName(name: string, map: Readonly<Record<string, string>>): string {
  const base = stripNamespace(name);
  return map[base] ?? base;
}

export function targetLabel(target: SkeletonTarget): string {
  return target === "ue5" ? "Unreal Engine 5" : "Unreal Engine 4";
}
