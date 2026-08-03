import sharp from "sharp";

export interface PreprocessOptions {
  maxWidth?: number;
  maxHeight?: number;
  normalize?: boolean;
  sharpen?: boolean;
  denoise?: boolean;
}

export async function preprocessForBackgroundRemoval(
  imageBuffer: Buffer,
  options: PreprocessOptions = {}
): Promise<Buffer> {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    normalize = true,
    sharpen = true,
    denoise = true,
  } = options;

  let pipeline = sharp(imageBuffer).autoOrient();

  pipeline = pipeline.resize({
    width: maxWidth,
    height: maxHeight,
    fit: "inside",
    withoutEnlargement: true,
    kernel: "lanczos3",
  });

  if (normalize) {
    pipeline = pipeline.normalise({ lower: 1, upper: 99 });
  }

  if (denoise) {
    pipeline = pipeline.median(3);
  }

  if (sharpen) {
    pipeline = pipeline.sharpen({ sigma: 1.0, m1: 0, m2: 1.5 });
  }

  return pipeline.png({ quality: 95 }).toBuffer();
}

export interface RefineOptions {
  edgeSmoothing?: number;
  removeHalo?: boolean;
  haloRadius?: number;
  preserveDetail?: boolean;
}

export async function refineEdges(
  imageBuffer: Buffer,
  options: RefineOptions = {}
): Promise<Buffer> {
  const {
    edgeSmoothing = 2,
    removeHalo = true,
    haloRadius = 3,
    preserveDetail = true,
  } = options;

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    return imageBuffer;
  }

  const { width, height } = metadata;

  const alphaMask = await image
    .clone()
    .extractChannel("alpha")
    .raw()
    .toBuffer();

  let refinedMask = await smoothEdges(alphaMask, width, height, edgeSmoothing);

  if (removeHalo) {
    refinedMask = await removeHaloEffect(
      refinedMask,
      width,
      height,
      haloRadius
    );
  }

  if (preserveDetail) {
    refinedMask = await preserveFineDetails(
      alphaMask,
      refinedMask,
      width,
      height
    );
  }

  const rgbImage = await image.clone().ensureAlpha().raw().toBuffer();

  const result = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    result[idx] = rgbImage[idx];
    result[idx + 1] = rgbImage[idx + 1];
    result[idx + 2] = rgbImage[idx + 2];
    result[idx + 3] = refinedMask[i];
  }

  return sharp(result, {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toBuffer();
}

async function smoothEdges(
  alphaMask: Buffer,
  width: number,
  height: number,
  radius: number
): Promise<Buffer> {
  const blurred = await sharp(alphaMask, {
    raw: { width, height, channels: 1 },
  })
    .blur(radius * 1.5)
    .raw()
    .toBuffer();

  const edges = detectEdges(alphaMask, width, height);

  const result = Buffer.alloc(width * height);

  for (let i = 0; i < width * height; i++) {
    const original = alphaMask[i];
    const blurredVal = blurred[i];
    const isEdge = edges[i];

    if (isEdge) {
      const factor = 0.6;
      result[i] = Math.round(original * (1 - factor) + blurredVal * factor);
    } else {
      result[i] = original;
    }
  }

  return result;
}

function detectEdges(
  alphaMask: Buffer,
  width: number,
  height: number
): Buffer {
  const edges = Buffer.alloc(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      const center = alphaMask[idx];
      const left = alphaMask[idx - 1];
      const right = alphaMask[idx + 1];
      const top = alphaMask[idx - width];
      const bottom = alphaMask[idx + width];

      const gx = Math.abs(right - left);
      const gy = Math.abs(bottom - top);
      const gradient = Math.sqrt(gx * gx + gy * gy);

      const threshold = 30;
      const isTransparentEdge =
        (center > 50 && center < 200) ||
        gradient > threshold ||
        (center > 10 && left < 5) ||
        (center > 10 && right < 5) ||
        (center > 10 && top < 5) ||
        (center > 10 && bottom < 5);

      edges[idx] = isTransparentEdge ? 1 : 0;
    }
  }

  return edges;
}

async function removeHaloEffect(
  alphaMask: Buffer,
  width: number,
  height: number,
  radius: number
): Promise<Buffer> {
  const eroded = await sharp(alphaMask, {
    raw: { width, height, channels: 1 },
  })
    .median(3)
    .raw()
    .toBuffer();

  const result = Buffer.alloc(width * height);

  for (let i = 0; i < width * height; i++) {
    const original = alphaMask[i];
    const smoothed = eroded[i];

    if (original > 10 && original < 245) {
      const diff = smoothed - original;
      if (diff > 5) {
        result[i] = Math.min(255, original + Math.round(diff * 0.4));
      } else if (diff < -5) {
        result[i] = Math.max(0, original + Math.round(diff * 0.4));
      } else {
        result[i] = original;
      }
    } else {
      result[i] = original;
    }
  }

  return result;
}

async function preserveFineDetails(
  originalMask: Buffer,
  refinedMask: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  const result = Buffer.alloc(width * height);

  for (let i = 0; i < width * height; i++) {
    const original = originalMask[i];
    const refined = refinedMask[i];

    if (original > 200) {
      result[i] = Math.max(refined, original);
    } else if (original < 30) {
      result[i] = Math.min(refined, original);
    } else {
      result[i] = refined;
    }
  }

  return result;
}
