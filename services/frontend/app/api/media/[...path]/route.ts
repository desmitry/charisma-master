import { createReadStream, existsSync, statSync } from "fs";
import type { NextRequest } from "next/server";
import path from "path";

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const resolvedParams = await params;
	const segments = resolvedParams.path || [];
	const mediaRoot = path.resolve(process.cwd(), "..", "media");
	const filePath = path.resolve(mediaRoot, ...segments);

	if (!filePath.startsWith(mediaRoot) || !existsSync(filePath)) {
		return new Response("Not found", { status: 404 });
	}

	const stat = statSync(filePath);
	const stream = createReadStream(filePath);

	return new Response(stream as any, {
		status: 200,
		headers: {
			"Content-Type": "video/mp4",
			"Content-Length": stat.size.toString(),
		},
	});
}
