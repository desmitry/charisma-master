import { useState, useRef, useEffect } from "react";
import { AnalysisResult, TaskStage } from "@/types/analysis";
import { normalizeAnalysisResult, pollForAnalysis, uploadVideo } from "@/lib/api";
import { getFastRequestsCount, decrementFastRequests, hasFastRequestsAvailable } from "@/lib/cookie-utils";

export type Stage = "landing" | "processing" | "result";

export function useVideoAnalysis() {
  const [stage, setStage] = useState<Stage>("landing");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [selectedAnalyzeProvider, setSelectedAnalyzeProvider] = useState<string>("gigachat");
  const [selectedTranscribeProvider, setSelectedTranscribeProvider] = useState<string>("sber_gigachat");
  const [presentationFile, setPresentationFile] = useState<File | null>(null);
  const [standardMode, setStandardMode] = useState<"preset" | "custom">("preset");
  const [selectedEvaluationPreset, setSelectedEvaluationPreset] = useState<"default" | "urfu">("default");
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

  const validateRuTubeUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      return hostname.includes("rutube.ru") && urlObj.pathname.includes("/video/");
    } catch {
      return false;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      let isVideoSet = false;
      Array.from(files).forEach((file) => {
        const name = file.name.toLowerCase();
        if (file.type === "video/mp4" || name.endsWith(".mp4")) {
          setSelectedFile(file);
          setError(null);
          setVideoUrl("");
          setIsValidRuTubeUrl(false);
          isVideoSet = true;
        } else if (
          name.endsWith(".pptx") ||
          name.endsWith(".ppt") ||
          name.endsWith(".pdf") ||
          file.type.includes("presentation") ||
          file.type.includes("pdf")
        ) {
          setPresentationFile(file);
        } else if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
          setStandardFile(file);
          setStandardMode("custom");
        }
      });
      if (!isVideoSet && !selectedFile) {
        // no-op: allow adding supporting files after a video is already selected
      }
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
      let isVideoSet = false;
      Array.from(files).forEach((file) => {
        const name = file.name.toLowerCase();
        if (file.type === "video/mp4" || name.endsWith(".mp4")) {
          setSelectedFile(file);
          setError(null);
          setVideoUrl("");
          setIsValidRuTubeUrl(false);
          isVideoSet = true;
        } else if (
          name.endsWith(".pptx") ||
          name.endsWith(".ppt") ||
          name.endsWith(".pdf") ||
          file.type.includes("presentation") ||
          file.type.includes("pdf")
        ) {
          setPresentationFile(file);
        } else if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
          setStandardFile(file);
          setStandardMode("custom");
        }
      });
      if (!isVideoSet && !selectedFile) {
        setError("Пожалуйста, добавьте видео в формате MP4");
      }
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setVideoUrl(url);
    const isValid = validateRuTubeUrl(url);
    setIsValidRuTubeUrl(isValid);
    setError(null);
    if (url && isValid) {
      setSelectedFile(null);
    }
  };

  const loadMockResponse = async (): Promise<AnalysisResult> => {
    const res = await fetch("/62a26154-2d3e-408d-8737-2dbe5255eac6.json");
    if (!res.ok) throw new Error("mock fetch failed");
    return normalizeAnalysisResult(await res.json());
  };

  const startMockFlow = async () => {
    setIsMockMode(true);
    setIsExiting(true);
    setIsUploading(true);

    await new Promise((res) => setTimeout(res, 300));

    setStage("processing");
    setStatusText("Анализируем видео...");
    setProgress(0.2);
    await new Promise((res) => setTimeout(res, 5000));
    const mock = await loadMockResponse();
    setResult(mock);
    setProgress(1);

    await new Promise((res) => setTimeout(res, 400));
    setStage("result");
    setShowResult(true);
    setIsExiting(false);
    setIsUploading(false);
  };

  const stageName = (value?: TaskStage | null) => {
    if (!value) return "Анализируем видео...";
    return value[2] || "Анализируем видео...";
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
      let taskId: string;

      setProgress(0.1);
      setStatusText("Загружаем видео...");

      const analyzeProvider = selectedAnalyzeProvider;
      const transcribeProvider = selectedTranscribeProvider;
      const evaluationCriteriaId = standardMode === "preset" ? selectedEvaluationPreset : undefined;

      if (selectedTranscribeProvider === "whisper_openai") {
        if (!hasFastRequestsAvailable()) {
          throw new Error("У вас закончились запросы для Fast модели");
        }
        decrementFastRequests();
        setFastRequestsCount(getFastRequestsCount());
      }

      const uploadResult = await uploadVideo(
        selectedFile,
        videoUrl || null,
        selectedPersona || undefined,
        analyzeProvider || undefined,
        transcribeProvider,
        presentationFile,
        standardMode === "custom" ? standardFile : null,
        evaluationCriteriaId
      );

      if (!uploadResult?.task_id) {
        throw new Error("Не получен task_id от сервера");
      }
      taskId = uploadResult.task_id;

      await new Promise((resolve) => setTimeout(resolve, 100));
      setStage("processing");
      setProgress(0.3);
      setStatusText("Видео принято, начинаем анализ...");

      const analysis = await pollForAnalysis(
        taskId,
        (status) => {
          if (status.state === "SUCCESS") {
            setProgress(1);
            setStatusText("Все готово");
          } else if (status.state === "PENDING") {
            setProgress(status.progress ?? 0);
            setStatusText("Ожидание очереди...");
          } else if (status.state === "PROCESSING") {
            setProgress(status.progress ?? 0);
            if (status.hint) {
              setStatusText(status.hint);
            }
          }
        },
        900_000
      );

      if (!analysis) {
        throw new Error("Анализ не получен");
      }

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
      selectedAnalyzeProvider,
      selectedTranscribeProvider,
      presentationFile,
      standardMode,
      selectedEvaluationPreset,
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
      setSelectedAnalyzeProvider,
      setSelectedTranscribeProvider,
      setPresentationFile,
      setStandardMode,
      setSelectedEvaluationPreset,
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
