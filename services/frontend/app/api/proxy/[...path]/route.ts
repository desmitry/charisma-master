import { type NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> | { path: string[] } },
) {
	const resolvedParams = await Promise.resolve(params);
	return proxyRequest(request, resolvedParams.path, "GET");
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> | { path: string[] } },
) {
	const resolvedParams = await Promise.resolve(params);
	return proxyRequest(request, resolvedParams.path, "POST");
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> | { path: string[] } },
) {
	const resolvedParams = await Promise.resolve(params);
	return proxyRequest(request, resolvedParams.path, "PUT");
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> | { path: string[] } },
) {
	const resolvedParams = await Promise.resolve(params);
	return proxyRequest(request, resolvedParams.path, "DELETE");
}

async function proxyRequest(
	request: NextRequest,
	pathSegments: string[],
	method: string,
) {
	const path = pathSegments.join("/");
	const url = new URL(request.url);
	const queryString = url.search;

	const backendUrl = `${BACKEND_URL}/${path}${queryString ? `?${queryString}` : ""}`;

	try {
		const contentType = request.headers.get("content-type") || "";
		const isFormData = contentType.includes("multipart/form-data");
		const isMediaRequest = path.includes("/media/");

		const options: RequestInit = {
			method,
		};

		const headersToForward: HeadersInit = {};
		request.headers.forEach((value, key) => {
			const lowerKey = key.toLowerCase();
			if (lowerKey !== "host" && lowerKey !== "content-length") {
				headersToForward[key] = value;
			}
		});

		if (method !== "GET" && method !== "DELETE") {
			if (isFormData) {
				options.headers = headersToForward;

				if (request.body) {
					options.body = request.body as any;
				} else {
					const formData = await request.formData();
					options.body = formData;
					delete (options.headers as any)["content-type"];
				}
			} else {
				options.headers = {
					...headersToForward,
					"Content-Type": contentType || "application/json",
				};

				if (request.body) {
					options.body = request.body as any;
				} else {
					const body = await request.text();
					if (body) {
						options.body = body;
					}
				}
			}
		} else {
			options.headers = headersToForward;
		}

		const response = await fetch(backendUrl, options);

		const responseContentType = response.headers.get("content-type") || "";
		const isMediaResponse =
			isMediaRequest ||
			responseContentType.startsWith("video/") ||
			responseContentType.startsWith("audio/") ||
			responseContentType.startsWith("image/");

		if (isMediaResponse) {
			const responseHeaders: HeadersInit = {};
			response.headers.forEach((value, key) => {
				responseHeaders[key] = value;
			});

			if (response.body) {
				return new NextResponse(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: responseHeaders,
				});
			} else {
				const arrayBuffer = await response.arrayBuffer();
				return new NextResponse(arrayBuffer, {
					status: response.status,
					statusText: response.statusText,
					headers: responseHeaders,
				});
			}
		}

		const data = await response.text();

		return new NextResponse(data, {
			status: response.status,
			statusText: response.statusText,
			headers: {
				"Content-Type": responseContentType || "application/json",
			},
		});
	} catch {
		return NextResponse.json(
			{ error: "Failed to proxy request to backend" },
			{ status: 502 },
		);
	}
}
