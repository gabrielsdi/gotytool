import { NextRequest, NextResponse } from "next/server";

type IconStyle = "flat" | "gradient" | "neumorphic" | "3d" | "glyph";
type IconModel = "sdxl" | "flux";

interface GenerateIconRequest {
  description: string;
  style?: IconStyle;
  model?: IconModel;
  transparent?: boolean;
}

const STYLE_PROMPTS: Record<IconStyle, string> = {
  flat: "flat design icon, minimal clean style, solid colors, vector style, no gradients",
  gradient: "modern gradient icon, smooth color transitions, polished professional look",
  neumorphic: "neumorphic soft icon, subtle shadows, 3D depth effect, soft lighting",
  "3d": "3D rendered icon, volumetric lighting, metallic or glossy materials, hero icon quality, game asset style",
  glyph: "minimalist glyph icon, single color solid silhouette, simple bold shape, GTA V radar icon style, HUD game icon, thick clean outlines, highly readable at small sizes, no detail, abstract symbol",
};

const QUALITY_MODIFIERS =
  "high quality, detailed, sharp edges, professional game art, masterpiece";

const NEGATIVE_PROMPTS: Record<IconStyle, string> = {
  flat: "blurry, low quality, photorealistic, 3D, shadows, gradients",
  gradient: "blurry, low quality, flat, cartoon, pixelated",
  neumorphic: "blurry, low quality, flat, sharp edges, harsh shadows",
  "3d": "blurry, low quality, flat, 2D, cartoon, simple",
  glyph: "blurry, low quality, detailed, complex, colorful, gradients, photorealistic, 3D, text, letters, words, multiple colors, shading, texture",
};

const MODEL_MAP: Record<IconModel, string> = {
  sdxl: "sdxl",
  flux: "flux",
};

const ERROR_MESSAGES: Record<string, string> = {
  rate_limit: "Too many requests. Please wait a moment and try again.",
  daily_limit:
    "Daily free token limit reached. Resets in ~24 hours. Try again tomorrow or use a different model.",
  insufficient_credits:
    "Not enough tokens. The SDXL model is free, FLUX.2 requires purchased tokens.",
  api_key_missing:
    "Free.ai API key not configured. Get one at https://free.ai/signup/",
  invalid_key:
    "Invalid API key. Check your key at https://free.ai/account/?tab=api",
  daily_pool_exhausted:
    "Daily free pool exhausted. Resets in ~24 hours. Try again tomorrow.",
};

function getErrorMessage(status: number, errorData: unknown): string {
  const data = errorData as Record<string, unknown>;
  const errorObj = data?.error as Record<string, unknown> | undefined;
  const errorCode = errorObj?.code as string | undefined;
  const errorMsg = errorObj?.message as string | undefined;

  if (status === 429) {
    if (errorCode === "daily_pool_exhausted" || errorMsg?.includes("daily")) {
      return ERROR_MESSAGES.daily_pool_exhausted;
    }
    if (errorMsg?.includes("rate") || errorMsg?.includes("too many")) {
      return ERROR_MESSAGES.rate_limit;
    }
    return ERROR_MESSAGES.rate_limit;
  }

  if (status === 401 || status === 403) {
    return ERROR_MESSAGES.invalid_key;
  }

  if (status === 402) {
    return ERROR_MESSAGES.insufficient_credits;
  }

  return errorMsg || `Free.ai API error: ${status}`;
}

function buildPrompt(
  description: string,
  style: IconStyle,
  transparent: boolean
): string {
  const stylePrompt = STYLE_PROMPTS[style];
  const negativePrompt = NEGATIVE_PROMPTS[style];

  const parts = [
    `${description} icon`,
    stylePrompt,
    QUALITY_MODIFIERS,
    "game UI element",
    "centered composition",
    "isolated on background",
    transparent ? "transparent background" : "dark solid background",
  ];

  let prompt = parts.join(", ");

  if (negativePrompt) {
    prompt += ` --no ${negativePrompt}`;
  }

  return prompt;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;
  let lastHeaders: Record<string, string> = {};
  let lastBody: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      lastHeaders = Object.fromEntries(response.headers.entries());
      lastBody = await response.json().catch(() => null);

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get("retry-after");
        const waitTime = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * 2000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      throw new Error(getErrorMessage(response.status, lastBody));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  const detailedError = new Error(lastError?.message || "Failed after retries");
  (detailedError as Error & { headers?: Record<string, string>; body?: unknown }).headers = lastHeaders;
  (detailedError as Error & { headers?: Record<string, string>; body?: unknown }).body = lastBody;
  throw detailedError;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.FREEAI_API_TOKEN;
    if (!apiKey || apiKey === "sk-free-REEMPLAZAR_CON_TU_KEY") {
      return NextResponse.json(
        {
          error: "api_key_missing",
          message: ERROR_MESSAGES.api_key_missing,
        },
        { status: 500 }
      );
    }

    const body: GenerateIconRequest = await request.json();
    const {
      description,
      style = "3d",
      model = "sdxl",
      transparent = true,
    } = body;

    if (!description || description.trim().length === 0) {
      return NextResponse.json(
        {
          error: "missing_description",
          message: "Please provide a description for the icon",
        },
        { status: 400 }
      );
    }

    const fullPrompt = buildPrompt(description.trim(), style, transparent);

    const requestBody: Record<string, unknown> = {
      prompt: fullPrompt,
      model: MODEL_MAP[model],
      tool: "image-icon",
      aspect_ratio: "1:1",
    };

    const response = await fetchWithRetry(
      "https://api.free.ai/v1/image/generate/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (!data.image_url && !data.image) {
      throw new Error("No image returned from Free.ai API");
    }

    const imageUrl = data.image_url || data.image;
    const tokensUsed = data.free_ai_usage?.tokens_charged || 0;

    return NextResponse.json({
      image: imageUrl,
      tokensUsed,
      model,
      style,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const err = error as Error & { headers?: Record<string, string>; body?: unknown };
    
    const rateLimitInfo = err.headers ? {
      "retry-after": err.headers["retry-after"],
      "x-ratelimit-limit": err.headers["x-ratelimit-limit"],
      "x-ratelimit-remaining": err.headers["x-ratelimit-remaining"],
      "x-ratelimit-reset": err.headers["x-ratelimit-reset"],
      "x-rate-limit-limit": err.headers["x-rate-limit-limit"],
      "x-rate-limit-remaining": err.headers["x-rate-limit-remaining"],
      "x-rate-limit-reset": err.headers["x-rate-limit-reset"],
    } : null;

    const errorBody = err.body ? JSON.stringify(err.body) : null;

    console.error("[Icon Generator Error]", {
      message,
      rateLimitInfo,
      errorBody,
    });

    return NextResponse.json(
      { 
        error: "generation_failed", 
        message,
        rateLimitInfo,
        errorBody,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "Game Icon Generator",
    provider: "Free.ai",
    models: ["sdxl", "flux"],
    styles: ["flat", "gradient", "neumorphic", "3d", "glyph"],
    sizes: [16, 32, 64, 128, 256, 512, 1024],
    docs: "https://free.ai/api/",
  });
}
