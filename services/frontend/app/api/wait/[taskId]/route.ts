import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ taskId: string }> | { taskId: string } },
) {
	const resolvedParams = await Promise.resolve(params);

	try {
		const response = await fetch(
			`${BACKEND_URL}/api/v1/tasks/${resolvedParams.taskId}/wait`,
			{
				method: "GET",
				cache: "no-store",
			},
		);

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
			{ error: "Failed to fetch wait status from backend" },
			{ status: 502 },
		);
	}
}
