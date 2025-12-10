import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params);
  return proxyRequest(request, resolvedParams.path, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params);
  return proxyRequest(request, resolvedParams.path, "POST");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params);
  return proxyRequest(request, resolvedParams.path, "PUT");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const resolvedParams = await Promise.resolve(params);
  return proxyRequest(request, resolvedParams.path, "DELETE");
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  const path = pathSegments.join("/");
  const url = new URL(request.url);
  const queryString = url.search;

  const backendUrl = `${BACKEND_URL}/${path}${queryString ? `?${queryString}` : ""}`;

  try {
    const contentType = request.headers.get("content-type") || "";
    const isFormData = contentType.includes("multipart/form-data");

    const options: RequestInit = {
      method,
    };

    if (method !== "GET" && method !== "DELETE") {
      if (isFormData) {
        // For FormData, pass it directly without setting Content-Type header
        // The browser will set it with the correct boundary
        const formData = await request.formData();
        options.body = formData;
      } else {
        const headers: HeadersInit = {
          "Content-Type": contentType || "application/json",
        };
        options.headers = headers;
        const body = await request.text();
        if (body) {
          options.body = body;
        }
      }
    }

    const response = await fetch(backendUrl, options);
    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to backend" },
      { status: 502 }
    );
  }
}
