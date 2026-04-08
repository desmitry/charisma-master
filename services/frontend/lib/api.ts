import { AnalysisResult, TaskStatusResponse } from "@/types/analysis";

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
    let errorMessage = text || response.statusText || "";

    try {
      const jsonData = JSON.parse(text);
      if (jsonData.detail || jsonData.error || jsonData.message) {
        errorMessage = jsonData.detail || jsonData.error || jsonData.message;
      }
    } catch {}

    if (response.status === 502 || response.status === 503) {
      const error = new ExpectedError(errorMessage || "Сервер недоступен. Проверьте, запущен ли backend.");
      (error as any).statusCode = response.status;
      throw error;
    }
    if (response.status === 413) {
      const error = new ExpectedError(errorMessage || "Файл слишком большой. Максимальный размер: 200MB.");
      (error as any).statusCode = response.status;
      throw error;
    }

    const error = new Error(errorMessage || "Ошибка сервера");
    (error as any).statusCode = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export function normalizeAnalysisResult(payload: any): AnalysisResult {
  const confidence = payload?.confidence_index ?? {};
  const components = confidence?.components ?? {};
  const speechReport = payload?.speech_report ?? {
    summary: payload?.summary ?? "",
    structure:
      typeof payload?.structure === "string"
        ? payload.structure
        : payload?.structure
          ? Object.entries(payload.structure).map(([key, value]) => `${key}: ${String(value)}`).join("\n")
          : "",
    mistakes: Array.isArray(payload?.mistakes) ? payload.mistakes.join("\n") : payload?.mistakes ?? "",
    ideal_text: payload?.ideal_text ?? "",
    persona_feedback: payload?.persona_feedback ?? "",
    dynamic_fillers: payload?.dynamic_fillers ?? [],
    useful_links:
      Array.isArray(payload?.useful_links)
        ? payload.useful_links
        : typeof payload?.useful_links === "string"
          ? payload.useful_links.split("\n").map((item: string) => item.trim()).filter(Boolean)
          : [],
    presentation_feedback:
      payload?.presentation_feedback ??
      payload?.slide_analysis?.ocr_summary ??
      payload?.presentation_summary ??
      "",
  };

  const evaluationCriteriaReport = payload?.evaluation_criteria_report ?? {
    total_score: payload?.standard_criteria_result ?? 0,
    max_score: payload?.standard_criteria_max ?? 0,
    criteria: (payload?.standard_criteria_scores ?? []).map((item: any) => ({
      name: item?.criterion_name ?? "",
      description: item?.criterion_description ?? "",
      max_value: item?.criterion_max_value ?? 0,
      current_value: item?.criterion_current_value ?? 0,
      feedback: item?.criterion_feetback ?? item?.criterion_feedback ?? "",
    })),
  };

  let volumeScore = components?.volume_score ?? 0;
  if (volumeScore < 1 && volumeScore > 0) {
    volumeScore *= 100;
  }

  return {
    task_id: payload?.task_id ?? "",
    video_path: payload?.video_path ?? "",
    transcript: payload?.transcript ?? [],
    tempo: payload?.tempo ?? [],
    long_pauses: payload?.long_pauses ?? [],
    fillers_summary: {
      count: payload?.fillers_summary?.count ?? 0,
      ratio: payload?.fillers_summary?.ratio ?? 0,
    },
    confidence_index: {
      total: Math.min(100, Math.max(0, confidence?.total ?? 0)),
      total_label: confidence?.total_label ?? "",
      components: {
        volume_level: components?.volume_level ?? "",
        volume_score: Math.min(100, Math.max(0, volumeScore)),
        volume_label: components?.volume_label ?? components?.volume_score_label ?? "",
        filler_score: Math.min(100, Math.max(0, components?.filler_score ?? 0)),
        filler_label: components?.filler_label ?? "",
        gaze_score: Math.min(100, Math.max(0, components?.gaze_score ?? 0)),
        gaze_label: components?.gaze_label ?? "",
        gesture_score: Math.min(100, Math.max(0, components?.gesture_score ?? 0)),
        gesture_label: components?.gesture_label ?? components?.gesture_advice ?? "",
        gesture_advice: components?.gesture_advice ?? components?.gesture_label ?? "",
        tone_score: Math.min(100, Math.max(0, components?.tone_score ?? 0)),
        tone_label: components?.tone_label ?? "",
      },
    },
    speech_report: {
      summary: speechReport.summary ?? "",
      structure: speechReport.structure ?? "",
      mistakes: speechReport.mistakes ?? "",
      ideal_text: speechReport.ideal_text ?? "",
      persona_feedback: speechReport.persona_feedback ?? "",
      dynamic_fillers: speechReport.dynamic_fillers ?? [],
      useful_links:
        Array.isArray(speechReport.useful_links)
          ? speechReport.useful_links
          : typeof speechReport.useful_links === "string"
            ? speechReport.useful_links.split("\n").map((item: string) => item.trim()).filter(Boolean)
            : [],
      presentation_feedback: speechReport.presentation_feedback ?? "",
    },
    evaluation_criteria_report: {
      total_score: evaluationCriteriaReport.total_score ?? 0,
      max_score: evaluationCriteriaReport.max_score ?? 0,
      criteria: evaluationCriteriaReport.criteria ?? [],
    },
    analyze_provider: payload?.analyze_provider ?? "",
    analyze_model: payload?.analyze_model ?? "",
    transcribe_model: payload?.transcribe_model ?? payload?.transribe_model ?? "",
  };
}

export async function uploadVideo(
  file: File | null,
  videoUrl: string | null,
  persona?: string,
  analyzeProvider?: string,
  transcribeProvider?: string,
  presentationFile?: File | null,
  standardFile?: File | null,
  evaluationCriteriaId?: string
): Promise<{ task_id: string }> {
  const formData = new FormData();
  if (file) {
    formData.append("user_speech_file", file);
  }
  if (videoUrl) {
    formData.append("user_speech_url", videoUrl);
  }
  if (persona) {
    formData.append("persona", persona);
  }
  if (analyzeProvider) {
    formData.append("analyze_provider", analyzeProvider);
  }
  if (transcribeProvider) {
    formData.append("transcribe_provider", transcribeProvider);
  }
  if (presentationFile) {
    formData.append("user_presentation_file", presentationFile);
  }
  if (standardFile) {
    formData.append("evaluation_criteria_file", standardFile);
  }
  if (evaluationCriteriaId) {
    formData.append("evaluation_criteria_id", evaluationCriteriaId);
  }

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let errorMessage = text || response.statusText || "";

      try {
        const jsonData = JSON.parse(text);
        if (jsonData.detail || jsonData.error || jsonData.message) {
          errorMessage = jsonData.detail || jsonData.error || jsonData.message;
        }
      } catch {}

      if (response.status === 502 || response.status === 503) {
        const error = new ExpectedError(errorMessage || "Сервер недоступен. Проверьте, запущен ли backend.");
        (error as any).statusCode = response.status;
        throw error;
      }
      if (response.status === 413) {
        const error = new ExpectedError(errorMessage || "Файл слишком большой. Максимальный размер: 200MB.");
        (error as any).statusCode = response.status;
        throw error;
      }

      const error = new Error(errorMessage || "Ошибка сервера");
      (error as any).statusCode = response.status;
      throw error;
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
  const data = await checkResponse<TaskStatusResponse>(response);
  return { ...data, progress: data.progress ?? 0 };
}

export async function getAnalysis(taskId: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analysis/${taskId}`);
  const data = await checkResponse<any>(response);
  return normalizeAnalysisResult(data);
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

    if (status.state === "SUCCESS") {
      return getAnalysis(taskId);
    }
    if (status.state === "FAILURE") {
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
