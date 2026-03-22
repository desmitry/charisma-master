import { useState, useRef, useEffect } from "react";
import { AnalysisResult } from "@/types/analysis";
import { pollForAnalysis, uploadVideo } from "@/lib/api";
import { getFastRequestsCount, decrementFastRequests, hasFastRequestsAvailable } from "@/lib/cookie-utils";

export type Stage = "landing" | "processing" | "result";

export function useVideoAnalysis() {
  const [stage, setStage] = useState<Stage>("landing");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [selectedLlmProvider, setSelectedLlmProvider] = useState<string>("default");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [presentationFile, setPresentationFile] = useState<File | null>(null);
  const [standardMode, setStandardMode] = useState<"preset" | "custom">("preset");
  const [standardFile, setStandardFile] = useState<File | null>(null);
  const [fastRequestsCount, setFastRequestsCount] = useState<number>(3);
  const [isValidRuTubeUrl, setIsValidRuTubeUrl] = useState(false);

  const [statusText, setStatusText] = useState("Готовим обработку...");
  const [progress, setProgress] = useState(0.15);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [serverErrorText, setServerErrorText] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setFastRequestsCount(getFastRequestsCount());
    }
  }, []);

  useEffect(() => {
    if (selectedLlmProvider === "default") {
      setSelectedModel("");
    }
  }, [selectedLlmProvider]);

  const validateRuTubeUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      return hostname.includes('rutube.ru') && urlObj.pathname.includes('/video/');
    } catch {
      return false;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
    if (file) {
      setError(null);
      setVideoUrl("");
      setIsValidRuTubeUrl(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "video/mp4" || file.name.endsWith(".mp4")) {
        setSelectedFile(file);
        setError(null);
        setVideoUrl("");
        setIsValidRuTubeUrl(false);
      } else {
        setError("Только файлы MP4");
      }
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setVideoUrl(url);
    const isValid = validateRuTubeUrl(url);
    setIsValidRuTubeUrl(isValid);
    if (url && !isValid) {
      setError(null);
    } else {
      setError(null);
    }
    if (url && isValid) {
      setSelectedFile(null);
    }
  };

  const loadMockResponse = async (): Promise<AnalysisResult> => {
    const res = await fetch("/62a26154-2d3e-408d-8737-2dbe5255eac6.json");
    if (!res.ok) throw new Error("mock fetch failed");
    const data = (await res.json()) as any;
    return data;
  };

  const startMockFlow = async () => {
    setIsMockMode(true);
    setIsExiting(true);
    setIsUploading(true);

    await new Promise((res) => setTimeout(res, 300));

    setStage("processing");
    setStatusText("Анализируем видео...");
    setProgress(0.2);
    await new Promise((res) => setTimeout(res, 800));
    const mock = await loadMockResponse();
    setResult(mock);
    setProgress(1);

    await new Promise((res) => setTimeout(res, 400));
    setStage("result");
    setShowResult(true);
    setIsExiting(false);
    setIsUploading(false);
  };

  const stageName = (value?: string | null) => {
    if (!value) return "Анализируем видео...";
    switch (value) {
      case "listening": return "Обрабатываем аудиодорожку...";
      case "gestures": return "Анализируем видео...";
      case "analyzing": return "Формируем отчёт...";
      default: return "Анализируем видео...";
    }
  };

  const handleAnalyze = async () => {
    setError(null);
    setIsMockMode(false);
    setIsUploading(true);

    if (!selectedFile && videoUrl && !isValidRuTubeUrl) {
      setError("Введите корректную ссылку на RuTube видео");
      setIsUploading(false);
      return;
    }

    if (isMockMode || (!selectedFile && !videoUrl)) {
      return startMockFlow();
    }

    try {
      setIsExiting(true);
      let task_id: string;
      try {
        setProgress(0.1);
        setStatusText("Загружаем видео...");
        const actualProvider = selectedLlmProvider === "default" ? "gigachat" : selectedLlmProvider;

        if (selectedModel === "whisper_openai") {
          if (!hasFastRequestsAvailable()) throw new Error("У вас закончились запросы для Fast модели");
          decrementFastRequests();
          setFastRequestsCount(getFastRequestsCount());
        }

        const uploadResult = await uploadVideo(
          selectedFile,
          videoUrl || null,
          selectedPersona || undefined,
          actualProvider || undefined,
          selectedModel || undefined,
          presentationFile,
          standardMode === "custom" ? standardFile : null
        );
        if (!uploadResult?.task_id) throw new Error("Не получен task_id от сервера");
        task_id = uploadResult.task_id;
      } catch (uploadErr) {
        throw uploadErr;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      setStage("processing");
      setProgress(0.3);
      setStatusText("Видео принято, начинаем анализ...");

      const analysis = await pollForAnalysis(task_id, (status) => {
        const p = status.progress ?? (status.state === "finished" ? 1 : 0.4);
        setProgress(Math.max(0.3, Math.min(1, p)));
        setStatusText(stageName(status.stage));
      }, 900_000);

      if (!analysis) throw new Error("Анализ не получен");

      setResult(analysis);
      setProgress(1);
      setIsUploading(false);
      setIsExiting(false);
      await new Promise((res) => setTimeout(res, 400));
      setStage("result");
      setShowResult(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "";
      setServerErrorText(errorMessage.includes("502") ? "Сервер недоступен." : errorMessage || "Ошибка");
      setShowErrorPopup(true);
      setIsExiting(false);
      setIsUploading(false);
      setStage("landing");
    }
  };

  const resetState = () => {
    setShowResult(false);
    setTimeout(() => {
      setStage("landing");
      setResult(null);
      setProgress(0.15);
      setIsUploading(false);
      setStatusText("Готовим обработку...");
      setIsMockMode(false);
    }, 400);
  };

  return {
    state: {
      stage,
      selectedFile,
      videoUrl,
      selectedPersona,
      selectedLlmProvider,
      selectedModel,
      presentationFile,
      standardMode,
      standardFile,
      fastRequestsCount,
      isValidRuTubeUrl,
      statusText,
      progress,
      error,
      isDragging,
      result,
      isMockMode,
      isExiting,
      showResult,
      isUploading,
      showErrorPopup,
      serverErrorText,
    },
    actions: {
      setStage,
      setSelectedFile,
      setVideoUrl,
      setSelectedPersona,
      setSelectedLlmProvider,
      setSelectedModel,
      setPresentationFile,
      setStandardMode,
      setStandardFile,
      setFastRequestsCount,
      setIsValidRuTubeUrl,
      setStatusText,
      setProgress,
      setError,
      setIsDragging,
      setResult,
      setIsMockMode,
      setIsExiting,
      setShowResult,
      setIsUploading,
      setShowErrorPopup,
      setServerErrorText,
      validateRuTubeUrl,
      handleFileChange,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleUrlChange,
      loadMockResponse,
      startMockFlow,
      stageName,
      handleAnalyze,
      resetState,
    },
  };
}
