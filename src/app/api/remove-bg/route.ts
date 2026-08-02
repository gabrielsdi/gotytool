import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiFormData = new FormData();
    apiFormData.append("image", image);

    const response = await fetch(
      "https://clearbackdrop.com/api/v1/remove-background",
      {
        method: "POST",
        body: apiFormData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const resultBuffer = await response.arrayBuffer();
    const resultBase64 = Buffer.from(resultBuffer).toString("base64");

    return NextResponse.json({
      image: `data:image/png;base64,${resultBase64}`,
      remaining: response.headers.get("X-Remaining"),
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Internal error: ${error}` },
      { status: 500 }
    );
  }
}
