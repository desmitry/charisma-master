import { AnalysisResult, TaskStatusResponse } from "@/types/analysis";
import { uploadVideoAction } from "@/app/actions/upload";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || 
  (typeof window !== "undefined" ? "/api/proxy" : "http://localhost:8000");

class ExpectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpectedError";
    Object.setPrototypeOf(this, ExpectedError.prototype);
  }
}

async function checkResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let errorMessage = text || response.statusText || "Ошибка сервера";
    
    try {
      const jsonData = JSON.parse(text);
      if (jsonData.detail || jsonData.error || jsonData.message) {
        errorMessage = jsonData.detail || jsonData.error || jsonData.message;
      }
    } catch {
    }
    
    if (response.status === 502 || response.status === 503) {
      console.warn("[API] Backend unavailable:", response.status);
      throw new ExpectedError("Сервер недоступен. Проверьте, запущен ли backend.");
    }
    if (response.status === 413) {
      console.warn("[API] File too large:", response.status);
      throw new ExpectedError("Файл слишком большой. Максимальный размер: 200MB.");
    }
    if (response.status === 400 || errorMessage.toLowerCase().includes("не существует") || errorMessage.toLowerCase().includes("video does not exist")) {
      throw new Error("Видео не существует");
    }
    
    throw new Error(errorMessage);
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

  try {
    // Use API route instead of Server Action to bypass body size limits
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let errorMessage = text || response.statusText || "Upload failed";
      
      try {
        const jsonData = JSON.parse(text);
        if (jsonData.detail || jsonData.error || jsonData.message) {
          errorMessage = jsonData.detail || jsonData.error || jsonData.message;
        }
      } catch {
      }
      
      if (response.status === 502 || response.status === 503) {
        throw new ExpectedError("Сервер недоступен. Проверьте, запущен ли backend.");
      }
      if (response.status === 413) {
        throw new ExpectedError("Файл слишком большой. Максимальный размер: 200MB.");
      }
      if (response.status === 400 || errorMessage.toLowerCase().includes("не существует") || errorMessage.toLowerCase().includes("video does not exist")) {
        throw new Error("Видео не существует");
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ExpectedError) {
      throw error;
    }
    if (error instanceof Error) {
      if (error.message.includes("Сервер недоступен") || error.message.includes("File too large")) {
        throw new ExpectedError(error.message);
      }
    }
    throw error;
  }
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
  const url = `${API_BASE_URL}${videoPath}`;
  console.log("[API] Resolved video URL:", { videoPath, url });
  return url;
}




