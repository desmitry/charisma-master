import { type NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
	try {
		const contentType = request.headers.get("content-type") || "";

		if (!contentType.includes("multipart/form-data")) {
			return NextResponse.json(
				{ error: "Expected multipart/form-data" },
				{ status: 400 },
			);
		}

		const headers: HeadersInit = {};

		request.headers.forEach((value, key) => {
			const lowerKey = key.toLowerCase();
			if (lowerKey !== "host") {
				headers[key] = value;
			}
		});

		const backendUrl = `${BACKEND_URL}/api/v1/process`;

		const response = await fetch(backendUrl, {
			method: "POST",
			headers: headers,
			body: request.body as any,
			// @ts-expect-error - 'duplex' is required for streaming request body in Node.js
			duplex: "half",
		});

		const data = await response.text();

		return new NextResponse(data, {
			status: response.status,
			statusText: response.statusText,
			headers: {
				"Content-Type":
					response.headers.get("content-type") || "application/json",
			},
		});
	} catch {
		return NextResponse.json(
			{ error: "Failed to upload file to backend" },
			{ status: 502 },
		);
	}
}
