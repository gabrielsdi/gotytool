import { NextRequest, NextResponse } from "next/server";
import {
  refineEdges,
  preprocessForBackgroundRemoval,
  type PreprocessOptions,
  type RefineOptions,
} from "@/lib/image-refine";

type Provider = "clearbackdrop" | "removebg";
type SizeOption = "auto" | "full" | "50MP";

interface PreprocessFlags {
  normalize?: boolean;
  denoise?: boolean;
  sharpen?: boolean;
}

interface PostprocessFlags {
  edgeSmoothing?: boolean;
  removeHalo?: boolean;
  preserveDetail?: boolean;
}

async function clearbackdrop(
  image: File,
  preprocessFlags: PreprocessFlags,
  postprocessFlags: PostprocessFlags
) {
  const imageBuffer = Buffer.from(await image.arrayBuffer());

  let preprocessed: Buffer;
  if (preprocessFlags.normalize || preprocessFlags.denoise || preprocessFlags.sharpen) {
    const preprocessOpts: PreprocessOptions = {};
    if (preprocessFlags.normalize) preprocessOpts.normalize = true;
    if (preprocessFlags.denoise) preprocessOpts.denoise = true;
    if (preprocessFlags.sharpen) preprocessOpts.sharpen = true;
    preprocessed = await preprocessForBackgroundRemoval(imageBuffer, preprocessOpts);
  } else {
    preprocessed = imageBuffer;
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(preprocessed)], { type: "image/png" });
  formData.append("image", blob, "image.png");

  const res = await fetch(
    "https://clearbackdrop.com/api/v1/remove-background",
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("rate_limit");
    }
    throw new Error("clearbackdrop_failed");
  }

  const buf = await res.arrayBuffer();
  const resultBuffer = Buffer.from(buf);

  let refinedBuffer: Buffer;
  if (postprocessFlags.edgeSmoothing || postprocessFlags.removeHalo || postprocessFlags.preserveDetail) {
    const refineOpts: RefineOptions = {};
    if (postprocessFlags.edgeSmoothing) refineOpts.edgeSmoothing = 2;
    if (postprocessFlags.removeHalo) {
      refineOpts.removeHalo = true;
      refineOpts.haloRadius = 3;
    }
    if (postprocessFlags.preserveDetail) refineOpts.preserveDetail = true;
    refinedBuffer = await refineEdges(resultBuffer, refineOpts);
  } else {
    refinedBuffer = resultBuffer;
  }

  return {
    image: `data:image/png;base64,${refinedBuffer.toString("base64")}`,
    remaining: res.headers.get("X-Remaining"),
    creditsUsed: null,
    creditsTotal: null,
  };
}

async function removebg(image: File, size: SizeOption) {
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) {
    throw new Error("api_key_missing");
  }

  const formData = new FormData();
  formData.append("image_file", image);
  formData.append("size", size);

  const res = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 402) {
      throw new Error("insufficient_credits");
    }
    if (res.status === 429) {
      throw new Error("rate_limit");
    }
    if (res.status === 403) {
      throw new Error("forbidden");
    }
    throw new Error("removebg_failed");
  }

  const buf = await res.arrayBuffer();
  const creditsCharged = res.headers.get("X-Credits-Charged");

  return {
    image: `data:image/png;base64,${Buffer.from(buf).toString("base64")}`,
    remaining: null,
    creditsUsed: creditsCharged ? parseFloat(creditsCharged) : null,
    creditsTotal: null,
  };
}

async function getRemoveBgAccountInfo() {
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.remove.bg/v1.0/account", {
      headers: { "X-Api-Key": apiKey },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const attrs = data.data?.attributes;
    return {
      credits: attrs?.api?.free_calls ?? attrs?.credits?.subscription ?? null,
      photos: attrs?.photos?.subscription ?? null,
    };
  } catch {
    return null;
  }
}

async function getClearBackdropQuota() {
  try {
    const res = await fetch("https://clearbackdrop.com/api/v1/quota");
    if (!res.ok) return null;
    const data = await res.json();
    return {
      limit: data.limit_per_hour ?? null,
      remaining: data.remaining ?? null,
      reset: data.reset_seconds ?? null,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const [removebg, clearbackdrop] = await Promise.all([
    getRemoveBgAccountInfo(),
    getClearBackdropQuota(),
  ]);
  return NextResponse.json({ removebg, clearbackdrop });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;
    const provider = (formData.get("provider") as Provider) || "clearbackdrop";
    const size = (formData.get("size") as SizeOption) || "auto";

    let preprocessFlags: PreprocessFlags = { normalize: true, denoise: true, sharpen: true };
    let postprocessFlags: PostprocessFlags = { edgeSmoothing: true, removeHalo: true, preserveDetail: true };

    const preprocessRaw = formData.get("preprocess");
    if (preprocessRaw) {
      try {
        preprocessFlags = JSON.parse(preprocessRaw as string);
      } catch {}
    }

    const postprocessRaw = formData.get("postprocess");
    if (postprocessRaw) {
      try {
        postprocessFlags = JSON.parse(postprocessRaw as string);
      } catch {}
    }

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    let result;

    switch (provider) {
      case "removebg":
        result = await removebg(image, size);
        break;
      case "clearbackdrop":
      default:
        result = await clearbackdrop(image, preprocessFlags, postprocessFlags);
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: `${error}` }, { status: 500 });
  }
}
