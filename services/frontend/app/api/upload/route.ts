import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const headersToForward: HeadersInit = {};
    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'host' && lowerKey !== 'content-length' && lowerKey !== 'content-type') {
        headersToForward[key] = value;
      }
    });

    const formData = await request.formData();

    const backendUrl = `${BACKEND_URL}/api/v1/process`;

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: headersToForward,
      body: formData,
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (e) {
    console.error("Upload proxy error:", e);
    return NextResponse.json(
      { error: "Failed to upload file to backend" },
      { status: 502 }
    );
  }
}

