import { AnalysisResult, TaskStatusResponse } from "@/types/analysis";

// Use proxy route in production (Docker), or direct URL in development
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || 
  (typeof window !== "undefined" ? "/api/proxy" : "http://localhost:8000");

async function checkResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || response.statusText);
  }
  return response.json() as Promise<T>;
}

export async function uploadVideo(
  file: File | null,
  videoUrl: string | null,
  persona?: string
): Promise<{ task_id: string }> {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  if (videoUrl) {
    formData.append("video_url", videoUrl);
  }
  if (persona) {
    formData.append("persona", persona);
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/process`, {
    method: "POST",
    body: formData,
  });

  return checkResponse<{ task_id: string }>(response);
}

export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tasks/${taskId}/status`);
  return checkResponse<TaskStatusResponse>(response);
}

export async function getAnalysis(taskId: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analysis/${taskId}`);
  return checkResponse<AnalysisResult>(response);
}

export async function pollForAnalysis(
  taskId: string,
  onProgress?: (status: TaskStatusResponse) => void,
  timeoutMs = 60_000
): Promise<AnalysisResult> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const status = await getTaskStatus(taskId);
    onProgress?.(status);

    if (status.state === "finished") {
      return getAnalysis(taskId);
    }
    if (status.state === "failed") {
      throw new Error(status.error || "Обработка завершилась с ошибкой");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("Таймаут ожидания анализа");
}

export function getPdfUrl(taskId: string): string {
  return `${API_BASE_URL}/api/v1/analysis/${taskId}/pdf`;
}

export function resolveVideoUrl(videoPath: string): string {
  if (!videoPath) return "";
  if (videoPath.startsWith("http")) return videoPath;
  if (videoPath.startsWith("/") && !videoPath.startsWith("/media/")) return videoPath;
  return `${API_BASE_URL}${videoPath}`;
}

