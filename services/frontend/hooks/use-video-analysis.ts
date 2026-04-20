import { useEffect, useState } from "react";

import { AnalysisResult } from "@/types/analysis";
import { normalizeAnalysisResult, pollForAnalysis, uploadVideo } from "@/lib/api";
import { decrementFastRequests, getFastRequestsCount, hasFastRequestsAvailable } from "@/lib/cookie-utils";

export type Stage = "landing" | "processing" | "result";
export type InputMode = "speech_text" | "speech_video" | null;
export type CriteriaMode = "none" | "preset" | "custom";
export type WizardStepId = "source" | "presentation" | "video" | "criteria" | "settings" | "review";

const DEMO_TASK_ID = "demo";

export function useVideoAnalysis() {
  const [stage, setStage] = useState<Stage>("landing");
  const [currentStep, setCurrentStep] = useState<WizardStepId>("source");

  const [inputMode, setInputMode] = useState<InputMode>(null);
  const [speechTextFile, setSpeechTextFile] = useState<File | null>(null);
  const [speechVideoFile, setSpeechVideoFile] = useState<File | null>(null);
  const [speechVideoUrl, setSpeechVideoUrl] = useState("");
  const [isValidRuTubeUrl, setIsValidRuTubeUrl] = useState(false);
  const [needTextFromVideo, setNeedTextFromVideo] = useState(true);
  const [needVideoAnalysis, setNeedVideoAnalysis] = useState(false);

  const [presentationFile, setPresentationFile] = useState<File | null>(null);
  const [criteriaMode, setCriteriaMode] = useState<CriteriaMode>("none");
  const [selectedEvaluationPreset, setSelectedEvaluationPreset] = useState<"default" | "urfu">("default");
  const [evaluationCriteriaFile, setEvaluationCriteriaFile] = useState<File | null>(null);

  const [selectedPersona, setSelectedPersona] = useState<string>("speech_review_specialist");
  const [selectedAnalyzeProvider, setSelectedAnalyzeProvider] = useState<string>("gigachat");
  const [selectedTranscribeProvider, setSelectedTranscribeProvider] = useState<string>("sber_gigachat");

  const [fastRequestsCount, setFastRequestsCount] = useState<number>(3);
  const [statusText, setStatusText] = useState("Готовим обработку...");
  const [progress, setProgress] = useState(0.15);
  const [error, setError] = useState<string | null>(null);
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

  const hasSpeechVideo = Boolean(speechVideoFile) || Boolean(speechVideoUrl && isValidRuTubeUrl);
  const hasRequiredSource =
    inputMode === "speech_text"
      ? Boolean(speechTextFile)
      : inputMode === "speech_video"
        ? hasSpeechVideo
        : false;

  const getSubmissionError = () => {
    if (!inputMode) {
      return "Сначала выберите, что отправляем на анализ: текст или видео";
    }

    if (inputMode === "speech_text" && !speechTextFile) {
      return "Загрузите текст выступления в формате TXT, MD, DOC или DOCX";
    }

    if (inputMode === "speech_video" && !hasSpeechVideo) {
      return "Добавьте видеофайл или корректную ссылку на RuTube";
    }

    if (speechVideoUrl && !isValidRuTubeUrl) {
      return "Введите корректную ссылку на RuTube";
    }

    if (inputMode === "speech_video" && !needTextFromVideo && !needVideoAnalysis) {
      return "Для видео выберите хотя бы один сценарий: получить текст или сделать видеоанализ";
    }

    if (needVideoAnalysis && !hasSpeechVideo) {
      return "Для видеоанализа нужно загрузить видео или указать ссылку на RuTube";
    }

    if (criteriaMode === "custom" && !evaluationCriteriaFile) {
      return "Загрузите файл со своими критериями или выберите другой вариант";
    }

    return null;
  };

  const selectInputMode = (mode: InputMode) => {
    setInputMode(mode);
    setError(null);

    if (mode === "speech_text") {
      setNeedTextFromVideo(false);
      setNeedVideoAnalysis(false);
    }

    if (mode === "speech_video") {
      setNeedTextFromVideo(true);
      setNeedVideoAnalysis(true);
    }
  };

  const handleSpeechTextFileChange = (file: File | null) => {
    setSpeechTextFile(file);
    setError(null);
  };

  const handleSpeechVideoFileChange = (file: File | null) => {
    setSpeechVideoFile(file);
    if (file) {
      setSpeechVideoUrl("");
      setIsValidRuTubeUrl(false);
    }
    setError(null);
  };

  const handlePresentationFileChange = (file: File | null) => {
    setPresentationFile(file);
    setError(null);
  };

  const handleCriteriaFileChange = (file: File | null) => {
    setEvaluationCriteriaFile(file);
    if (file) {
      setCriteriaMode("custom");
    }
    setError(null);
  };

  const handleSpeechVideoUrlChange = (value: string) => {
    setSpeechVideoUrl(value);
    const isValid = validateRuTubeUrl(value);
    setIsValidRuTubeUrl(isValid);

    if (value.trim()) {
      setSpeechVideoFile(null);
    }

    setError(null);
  };

  const openReviewStep = () => {
    const submissionError = getSubmissionError();
    if (submissionError) {
      setError(submissionError);
      return;
    }

    setError(null);
    setCurrentStep("review");
  };

  const loadMockResponse = async (): Promise<AnalysisResult> => {
    const res = await fetch(`/${DEMO_TASK_ID}.json`);
    if (!res.ok) {
      throw new Error("mock fetch failed");
    }

    const data = await res.json();
    data.video_path = `/api/proxy/media/${DEMO_TASK_ID}.mp4`;
    return normalizeAnalysisResult(data);
  };

  const startMockFlow = async () => {
    setIsMockMode(true);
    setIsExiting(true);
    setIsUploading(true);

    await new Promise((res) => setTimeout(res, 300));

    setStage("processing");
    setStatusText("Анализируем демо...");
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

  const handleAnalyze = async () => {
    const submissionError = getSubmissionError();
    if (submissionError) {
      setError(submissionError);
      return;
    }

    setError(null);
    setIsMockMode(false);
    setIsUploading(true);

    try {
      setIsExiting(true);
      setProgress(0.1);
      setStatusText("Отправляем материалы...");

      const userNeedTextFromVideo = inputMode === "speech_video" ? needTextFromVideo : false;
      const userNeedVideoAnalysis = needVideoAnalysis;
      const evaluationCriteriaId = criteriaMode === "preset" ? selectedEvaluationPreset : undefined;
      const criteriaFile = criteriaMode === "custom" ? evaluationCriteriaFile : null;

      if (userNeedTextFromVideo && selectedTranscribeProvider === "whisper_openai") {
        if (!hasFastRequestsAvailable()) {
          throw new Error("У вас закончились запросы для Fast модели");
        }

        decrementFastRequests();
        setFastRequestsCount(getFastRequestsCount());
      }

      const uploadResult = await uploadVideo({
        userSpeechTextFile: inputMode === "speech_text" ? speechTextFile : null,
        userSpeechVideoFile: speechVideoFile,
        userSpeechVideoUrl: speechVideoUrl || null,
        userNeedTextFromVideo,
        userNeedVideoAnalysis,
        userPresentationFile: presentationFile,
        evaluationCriteriaFile: criteriaFile,
        evaluationCriteriaId,
        persona: selectedPersona || undefined,
        analyzeProvider: selectedAnalyzeProvider || undefined,
        transcribeProvider: selectedTranscribeProvider || undefined,
      });

      if (!uploadResult?.task_id) {
        throw new Error("Не получен task_id от сервера");
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      setStage("processing");
      setProgress(0.25);
      setStatusText("Материалы приняты, ждём обработку...");

      const analysis = await pollForAnalysis(
        uploadResult.task_id,
        (status) => {
          if (status.state === "SUCCESS") {
            setProgress(1);
            setStatusText("Все готово");
            return;
          }

          if (status.state === "PENDING") {
            setProgress(status.progress ?? 0);
            setStatusText(status.hint || "Ожидание очереди...");
            return;
          }

          if (status.state === "PROCESSING") {
            setProgress(status.progress ?? 0);
            setStatusText(status.hint || "Обрабатываем материалы...");
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
      setCurrentStep("source");
      setInputMode(null);
      setSpeechTextFile(null);
      setSpeechVideoFile(null);
      setSpeechVideoUrl("");
      setIsValidRuTubeUrl(false);
      setNeedTextFromVideo(true);
      setNeedVideoAnalysis(false);
      setPresentationFile(null);
      setCriteriaMode("none");
      setSelectedEvaluationPreset("default");
      setEvaluationCriteriaFile(null);
      setSelectedPersona("speech_review_specialist");
      setSelectedAnalyzeProvider("gigachat");
      setSelectedTranscribeProvider("sber_gigachat");
      setResult(null);
      setError(null);
      setProgress(0.15);
      setIsUploading(false);
      setStatusText("Готовим обработку...");
      setIsMockMode(false);
      setIsExiting(false);
      setShowResult(false);
    }, 400);
  };

  return {
    state: {
      stage,
      currentStep,
      inputMode,
      speechTextFile,
      speechVideoFile,
      speechVideoUrl,
      isValidRuTubeUrl,
      needTextFromVideo,
      needVideoAnalysis,
      presentationFile,
      criteriaMode,
      selectedEvaluationPreset,
      evaluationCriteriaFile,
      selectedPersona,
      selectedAnalyzeProvider,
      selectedTranscribeProvider,
      fastRequestsCount,
      hasSpeechVideo,
      hasRequiredSource,
      statusText,
      progress,
      error,
      result,
      isMockMode,
      isExiting,
      showResult,
      isUploading,
      showErrorPopup,
      serverErrorText,
    },
    actions: {
      setCurrentStep,
      setSpeechTextFile,
      setSpeechVideoFile,
      setSpeechVideoUrl,
      setNeedTextFromVideo,
      setNeedVideoAnalysis,
      setPresentationFile,
      setCriteriaMode,
      setSelectedEvaluationPreset,
      setEvaluationCriteriaFile,
      setSelectedPersona,
      setSelectedAnalyzeProvider,
      setSelectedTranscribeProvider,
      setFastRequestsCount,
      setIsValidRuTubeUrl,
      setStatusText,
      setProgress,
      setError,
      setResult,
      setIsMockMode,
      setIsExiting,
      setShowResult,
      setIsUploading,
      setShowErrorPopup,
      setServerErrorText,
      validateRuTubeUrl,
      selectInputMode,
      handleSpeechTextFileChange,
      handleSpeechVideoFileChange,
      handlePresentationFileChange,
      handleCriteriaFileChange,
      handleSpeechVideoUrlChange,
      getSubmissionError,
      openReviewStep,
      loadMockResponse,
      startMockFlow,
      handleAnalyze,
      resetState,
    },
  };
}
