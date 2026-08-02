import { NextRequest, NextResponse } from "next/server";

type Provider = "clearbackdrop" | "removebg";
type SizeOption = "auto" | "full" | "50MP";

async function clearbackdrop(image: File) {
  const formData = new FormData();
  formData.append("image", image);

  const res = await fetch(
    "https://clearbackdrop.com/api/v1/remove-background",
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ClearBackdrop ${res.status}: ${text}`);
  }

  const buf = await res.arrayBuffer();
  return {
    image: `data:image/png;base64,${Buffer.from(buf).toString("base64")}`,
    remaining: res.headers.get("X-Remaining"),
    creditsUsed: null,
    creditsTotal: null,
  };
}

async function removebg(image: File, size: SizeOption) {
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) {
    throw new Error(
      "remove.bg API key not configured. Set REMOVEBG_API_KEY in .env.local"
    );
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
    const text = await res.text();
    throw new Error(`remove.bg ${res.status}: ${text}`);
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
    return {
      credits: data.data?.credits?.subscription,
      photos: data.data?.photos?.subscription,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const accountInfo = await getRemoveBgAccountInfo();
  return NextResponse.json({ removebg: accountInfo });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;
    const provider = (formData.get("provider") as Provider) || "clearbackdrop";
    const size = (formData.get("size") as SizeOption) || "auto";

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
        result = await clearbackdrop(image);
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: `${error}` }, { status: 500 });
  }
}
