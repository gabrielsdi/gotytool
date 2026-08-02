import { NextRequest, NextResponse } from "next/server";

type Provider = "clearbackdrop" | "removebg" | "pixian";

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
  };
}

async function removebg(image: File, apiKey: string) {
  const formData = new FormData();
  formData.append("image_file", image);

  const res = await fetch(
    "https://api.remove.bg/v1.0/removebg",
    {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`remove.bg ${res.status}: ${text}`);
  }

  const buf = await res.arrayBuffer();
  return {
    image: `data:image/png;base64,${Buffer.from(buf).toString("base64")}`,
    remaining: null,
  };
}

async function pixian(image: File, apiKey: string) {
  const formData = new FormData();
  formData.append("image", image);

  const res = await fetch(
    "https://api.pixian.ai/v2/remove-background",
    {
      method: "POST",
      headers: { Authorization: `Basic ${apiKey}` },
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pixian.AI ${res.status}: ${text}`);
  }

  const buf = await res.arrayBuffer();
  return {
    image: `data:image/png;base64,${Buffer.from(buf).toString("base64")}`,
    remaining: null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;
    const provider = (formData.get("provider") as Provider) || "clearbackdrop";
    const apiKey = (formData.get("apiKey") as string) || "";

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    let result;

    switch (provider) {
      case "removebg":
        if (!apiKey) {
          return NextResponse.json(
            { error: "remove.bg requires an API key. Get one at https://www.remove.bg/api" },
            { status: 400 }
          );
        }
        result = await removebg(image, apiKey);
        break;
      case "pixian":
        if (!apiKey) {
          return NextResponse.json(
            { error: "Pixian.AI requires an API key. Get one at https://pixian.ai/api" },
            { status: 400 }
          );
        }
        result = await pixian(image, apiKey);
        break;
      case "clearbackdrop":
      default:
        result = await clearbackdrop(image);
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: `${error}` },
      { status: 500 }
    );
  }
}
