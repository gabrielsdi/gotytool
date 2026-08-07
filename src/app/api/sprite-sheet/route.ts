import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

interface CutOptions {
  mode: "ai" | "local";
  outputWidth: number;
  outputHeight: number;
  threshold: number;
  padding: number;
  format: "png" | "webp" | "jpg";
}

interface DetectedSprite {
  box_2d: [number, number, number, number];
  label: string;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

class UnionFind {
  parent: Int32Array;
  rank: Int32Array;
  count: number;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    this.rank = new Int32Array(size);
    this.count = size;
    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
      this.rank[i] = 0;
    }
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }

  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
    this.count--;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const opts: CutOptions = {
      mode: (formData.get("mode") as CutOptions["mode"]) || "ai",
      outputWidth: clamp(Number(formData.get("outputWidth")) || 64, 1, 1024),
      outputHeight: clamp(Number(formData.get("outputHeight")) || 64, 1, 1024),
      threshold: clamp(Number(formData.get("threshold")) || 30, 1, 255),
      padding: clamp(Number(formData.get("padding")) || 0, 0, 128),
      format: (formData.get("format") as CutOptions["format"]) || "png",
    };

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width ?? 0;
    const imgHeight = metadata.height ?? 0;

    if (imgWidth === 0 || imgHeight === 0) {
      return NextResponse.json(
        { error: "Could not read image dimensions" },
        { status: 400 }
      );
    }

    let detected: DetectedSprite[] = [];

    if (opts.mode === "ai") {
      detected = await detectWithGemini(imageBuffer, image.type || "image/png");
      if (detected.length === 0) {
        return NextResponse.json(
          { error: "Gemini did not detect any sprites. Try local mode or adjust the image." },
          { status: 400 }
        );
      }
    } else {
      const boxes = await detectLocal(imageBuffer, imgWidth, imgHeight, opts.threshold, opts.padding);
      detected = boxes.map((box, i) => ({
        box_2d: [box.y, box.x, box.y + box.height, box.x + box.width] as [number, number, number, number],
        label: `sprite_${String(i + 1).padStart(3, "0")}`,
      }));
    }

    const mimeMap = { png: "image/png", webp: "image/webp", jpg: "image/jpeg" };
    const extMap = { png: "png", webp: "webp", jpg: "jpg" };
    const sharpFormatMap: Record<string, "png" | "webp" | "jpeg"> = {
      png: "png",
      webp: "webp",
      jpg: "jpeg",
    };

    const sprites: { name: string; data: string; box: BoundingBox; label: string }[] = [];

    for (let i = 0; i < detected.length; i++) {
      const d = detected[i];
      const [yMin, xMin, yMax, xMax] = d.box_2d;

      const left = clamp(Math.round((xMin / 1000) * imgWidth), 0, imgWidth - 1);
      const top = clamp(Math.round((yMin / 1000) * imgHeight), 0, imgHeight - 1);
      const right = clamp(Math.round((xMax / 1000) * imgWidth), 0, imgWidth);
      const bottom = clamp(Math.round((yMax / 1000) * imgHeight), 0, imgHeight);

      const extractWidth = Math.max(1, right - left);
      const extractHeight = Math.max(1, bottom - top);

      let pipeline = sharp(imageBuffer).extract({
        left,
        top,
        width: extractWidth,
        height: extractHeight,
      });

      pipeline = pipeline.resize(opts.outputWidth, opts.outputHeight, {
        fit: "contain",
        kernel: "lanczos3",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });

      pipeline = pipeline.toFormat(sharpFormatMap[opts.format], {
        quality: 90,
        mozjpeg: opts.format === "jpg",
      });

      const buffer = await pipeline.toBuffer();
      const base64 = buffer.toString("base64");

      const safeLabel = d.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      const name = `${safeLabel || `sprite_${String(i + 1).padStart(3, "0")}`}.${extMap[opts.format]}`;

      sprites.push({
        name,
        data: `data:${mimeMap[opts.format]};base64,${base64}`,
        box: { x: left, y: top, width: extractWidth, height: extractHeight },
        label: d.label,
      });
    }

    const zipEntries: Record<string, Uint8Array> = {};
    for (const sprite of sprites) {
      const base64Data = sprite.data.split(",")[1];
      zipEntries[sprite.name] = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );
    }

    const { zipSync } = await import("fflate");
    const zipBuffer = zipSync(zipEntries, { level: 6 });
    const zipBase64 = Buffer.from(zipBuffer).toString("base64");

    return NextResponse.json({
      sprites: sprites.map((s) => ({
        name: s.name,
        data: s.data,
        box: s.box,
        label: s.label,
      })),
      zip: `data:application/zip;base64,${zipBase64}`,
      imageWidth: imgWidth,
      imageHeight: imgHeight,
      total: sprites.length,
      mode: opts.mode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function detectWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<DetectedSprite[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("gemini_api_key_missing");
  }

  const genAI = new GoogleGenAI({ apiKey });

  const base64Image = imageBuffer.toString("base64");

  const response = await genAI.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze this sprite sheet image. Detect ALL individual icons, sprites, or objects visible in the image.

Return a JSON array of bounding boxes. Each entry must have:
- "box_2d": [y_min, x_min, y_max, x_max] — normalized coordinates from 0 to 1000 (where 0,0 is top-left and 1000,1000 is bottom-right, regardless of actual image dimensions)
- "label": a short descriptive name for the object (e.g. "valve", "pistol", "bullet", "first aid kit")

Rules:
- Detect EVERY distinct object, even if similar objects appear multiple times
- Give each instance a unique label if there are duplicates (e.g. "first aid kit 1", "first aid kit 2")
- Return ONLY the JSON array, no markdown code blocks, no explanation
- Box coordinates must be tight around each object's visible pixels

Example format:
[{"box_2d": [10, 20, 150, 200], "label": "valve"}, {"box_2d": [10, 250, 150, 450], "label": "pistol"}]`,
          },
          {
            inlineData: {
              mimeType: mimeType || "image/png",
              data: base64Image,
            },
          },
        ],
      },
    ],
    config: {},
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as DetectedSprite[];
    return parsed.filter(
      (item) =>
        Array.isArray(item.box_2d) &&
        item.box_2d.length === 4 &&
        typeof item.label === "string"
    );
  } catch {
    return [];
  }
}

async function detectLocal(
  imageBuffer: Buffer,
  imgWidth: number,
  imgHeight: number,
  threshold: number,
  padding: number
): Promise<BoundingBox[]> {
  const raw = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = raw.data;
  const channels = 4;
  const totalPixels = imgWidth * imgHeight;

  const bgColor = detectBackground(pixels, imgWidth, imgHeight, channels);

  const mask = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * channels;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const a = pixels[offset + 3];

    if (a < 128) {
      mask[i] = 0;
      continue;
    }

    const dr = r - bgColor.r;
    const dg = g - bgColor.g;
    const db = b - bgColor.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    mask[i] = dist > threshold ? 1 : 0;
  }

  const uf = new UnionFind(totalPixels);

  for (let y = 0; y < imgHeight; y++) {
    for (let x = 0; x < imgWidth; x++) {
      const idx = y * imgWidth + x;
      if (!mask[idx]) continue;

      if (x + 1 < imgWidth && mask[idx + 1]) {
        uf.union(idx, idx + 1);
      }
      if (y + 1 < imgHeight && mask[idx + imgWidth]) {
        uf.union(idx, idx + imgWidth);
      }
    }
  }

  const componentBounds = new Map<
    number,
    { minX: number; minY: number; maxX: number; maxY: number; count: number }
  >();

  for (let y = 0; y < imgHeight; y++) {
    for (let x = 0; x < imgWidth; x++) {
      const idx = y * imgWidth + x;
      if (!mask[idx]) continue;

      const root = uf.find(idx);
      let bounds = componentBounds.get(root);
      if (!bounds) {
        bounds = { minX: x, minY: y, maxX: x, maxY: y, count: 0 };
        componentBounds.set(root, bounds);
      }
      if (x < bounds.minX) bounds.minX = x;
      if (y < bounds.minY) bounds.minY = y;
      if (x > bounds.maxX) bounds.maxX = x;
      if (y > bounds.maxY) bounds.maxY = y;
      bounds.count++;
    }
  }

  const minArea = 20;
  let boxes: BoundingBox[] = [];

  for (const bounds of componentBounds.values()) {
    if (bounds.count < minArea) continue;

    boxes.push({
      x: Math.max(0, bounds.minX - padding),
      y: Math.max(0, bounds.minY - padding),
      width: Math.min(imgWidth, bounds.maxX - bounds.minX + 1 + padding * 2),
      height: Math.min(imgHeight, bounds.maxY - bounds.minY + 1 + padding * 2),
    });
  }

  boxes = mergeCloseBoxes(boxes, 15);
  boxes.sort((a, b) => a.y - b.y || a.x - b.x);

  return boxes;
}

function mergeCloseBoxes(boxes: BoundingBox[], distance: number): BoundingBox[] {
  const merged: boolean[] = new Array(boxes.length).fill(false);
  const result: BoundingBox[] = [];

  for (let i = 0; i < boxes.length; i++) {
    if (merged[i]) continue;

    let current = { ...boxes[i] };
    merged[i] = true;

    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < boxes.length; j++) {
        if (merged[j]) continue;

        const other = boxes[j];
        const overlaps =
          current.x - distance <= other.x + other.width &&
          current.x + current.width + distance >= other.x &&
          current.y - distance <= other.y + other.height &&
          current.y + current.height + distance >= other.y;

        if (overlaps) {
          const newX = Math.min(current.x, other.x);
          const newY = Math.min(current.y, other.y);
          const newRight = Math.max(
            current.x + current.width,
            other.x + other.width
          );
          const newBottom = Math.max(
            current.y + current.height,
            other.y + other.height
          );

          current = {
            x: newX,
            y: newY,
            width: newRight - newX,
            height: newBottom - newY,
          };
          merged[j] = true;
          changed = true;
        }
      }
    }

    result.push(current);
  }

  return result;
}

function detectBackground(
  pixels: Buffer,
  width: number,
  height: number,
  channels: number
): { r: number; g: number; b: number } {
  const colorCounts = new Map<
    string,
    { r: number; g: number; b: number; count: number }
  >();

  const sampleStep = Math.max(1, Math.floor((width * height) / 10000));

  for (let i = 0; i < width * height; i += sampleStep) {
    const offset = i * channels;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const a = pixels[offset + 3];

    if (a < 128) continue;

    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const existing = colorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorCounts.set(key, { r, g, b, count: 1 });
    }
  }

  let maxCount = 0;
  let bg = { r: 0, g: 0, b: 0 };

  for (const color of colorCounts.values()) {
    if (color.count > maxCount) {
      maxCount = color.count;
      bg = { r: color.r, g: color.g, b: color.b };
    }
  }

  return bg;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
