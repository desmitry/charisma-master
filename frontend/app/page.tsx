"use client";

import React, { useEffect, useRef, useState } from "react";
import { Hero } from "@/components/hero";
import { Leva } from "leva";
import { ProcessingOverlay } from "@/components/processing-overlay";
import { AnalysisDashboard } from "@/components/analysis-dashboard";
import { AnalysisResult } from "@/types/analysis";
import { pollForAnalysis, uploadVideo } from "@/lib/api";
import { GL } from "@/components/gl";
import { cn } from "@/lib/utils";
import { ComingSoonNotification } from "@/components/coming-soon-notification";
import { getFastRequestsCount, decrementFastRequests, hasFastRequestsAvailable } from "@/lib/cookie-utils";

type Stage = "landing" | "processing" | "result";

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothScrollTo(target: number, duration: number = 1200) {
  const start = window.scrollY;
  const distance = target - start;
  let startTime: number | null = null;

  function animation(currentTime: number) {
    if (startTime === null) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);

    window.scrollTo(0, start + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(animation);
    }
  }

  requestAnimationFrame(animation);
}

export default function Home() {
  const isScrolling = useRef(false);
  const currentSection = useRef(0);
  const sections = useRef<HTMLElement[]>([]);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const [stage, setStage] = useState<Stage>("landing");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [selectedLlmProvider, setSelectedLlmProvider] = useState<string>("default");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [fastRequestsCount, setFastRequestsCount] = useState<number>(3);
  const [isValidRuTubeUrl, setIsValidRuTubeUrl] = useState(false);
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);
  const [personaOpenUp, setPersonaOpenUp] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [providerOpenUp, setProviderOpenUp] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [modelOpenUp, setModelOpenUp] = useState(false);
  const personaRef = useRef<HTMLDivElement>(null);
  const personaButtonRef = useRef<HTMLButtonElement>(null);
  const providerRef = useRef<HTMLDivElement>(null);
  const providerButtonRef = useRef<HTMLButtonElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
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
    const handleClickOutside = (event: MouseEvent) => {
      if (personaRef.current && !personaRef.current.contains(event.target as Node)) {
        setIsPersonaOpen(false);
      }
      if (providerRef.current && !providerRef.current.contains(event.target as Node)) {
        setIsProviderOpen(false);
      }
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) {
        setIsModelOpen(false);
      }
    };

    if (isPersonaOpen || isProviderOpen || isModelOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPersonaOpen, isProviderOpen, isModelOpen]);

  useEffect(() => {
    if (selectedLlmProvider === "default") {
      setSelectedModel("");
    }
  }, [selectedLlmProvider]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const matcher = window.matchMedia("(pointer: coarse)");
    const updateDeviceState = (event?: MediaQueryListEvent) => {
      const matches = event ? event.matches : matcher.matches;
      setIsTouchDevice(matches);
    };

    updateDeviceState();
    matcher.addEventListener("change", updateDeviceState);

    return () => {
      matcher.removeEventListener("change", updateDeviceState);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const shouldLock = stage === "landing" && !isTouchDevice;
    document.body.style.overflowY = shouldLock ? "hidden" : "auto";
    document.body.style.touchAction = shouldLock ? "none" : "auto";

    return () => {
      document.body.style.overflowY = "";
      document.body.style.touchAction = "";
    };
  }, [isTouchDevice, stage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isTouchDevice) return;
    if (stage !== "landing") return;

    sections.current = Array.from(document.querySelectorAll(".snap-section"));

    let scrollDelta = 0;
    let resetTimeout: NodeJS.Timeout;

    const goToSection = (direction: number) => {
      const nextSection = Math.max(
        0,
        Math.min(sections.current.length - 1, currentSection.current + direction)
      );

      if (nextSection === currentSection.current) return;

      isScrolling.current = true;
      currentSection.current = nextSection;

      const targetY = sections.current[nextSection].offsetTop;
      smoothScrollTo(targetY, 1100);

      setTimeout(() => {
        isScrolling.current = false;
      }, 1200);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (isScrolling.current) return;

      scrollDelta += e.deltaY;

      const threshold = 40;
      if (Math.abs(scrollDelta) >= threshold) {
        const direction = scrollDelta > 0 ? 1 : -1;
        scrollDelta = 0;
        goToSection(direction);
      } else {
        clearTimeout(resetTimeout);
        resetTimeout = setTimeout(() => {
          scrollDelta = 0;
        }, 140);
      }
    };

    const updateCurrentSection = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;

      sections.current.forEach((section, index) => {
        const sectionTop = section.offsetTop;
        if (scrollY >= sectionTop - windowHeight / 2) {
          currentSection.current = index;
        }
      });
    };

    const handleScroll = () => {
      if (!isScrolling.current) {
        updateCurrentSection();
      }
    };

    updateCurrentSection();

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(resetTimeout);
    };
  }, [isTouchDevice, stage]);

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
    e.stopPropagation();
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
    const res = await fetch("/response_1765796223493.json");
    if (!res.ok) throw new Error("mock fetch failed");
    const data = (await res.json()) as AnalysisResult;
    let videoPath = data.video_path;
    if (videoPath && !videoPath.startsWith("http")) {
      const filename = videoPath.split(/[/\\]/).pop() || "";
      videoPath = `/${filename}`;
    }
    return { ...data, video_path: videoPath || data.video_path };
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
    setStatusText("Обрабатываем аудиодорожку...");
    setProgress(0.45);
    await new Promise((res) => setTimeout(res, 800));
    setStatusText("Вычисляем метрики уверенности...");
    setProgress(0.7);
    await new Promise((res) => setTimeout(res, 800));
    setStatusText("Формируем отчёт...");
    setProgress(0.95);
    await new Promise((res) => setTimeout(res, 500));
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
      case "listening":
        return "Обрабатываем аудиодорожку...";
      case "gestures":
        return "Анализируем видео...";
      case "analyzing":
        return "Формируем отчёт...";
      default:
        return "Анализируем видео...";
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
          actualProvider || undefined,
          selectedModel || undefined
        );
        if (!uploadResult?.task_id) {
          throw new Error("Не получен task_id от сервера");
        }
        task_id = uploadResult.task_id;
      } catch (uploadErr) {
        throw uploadErr;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      setStage("processing");
      setProgress(0.3);
      setStatusText("Видео принято, начинаем анализ...");

      const analysis = await pollForAnalysis(
        task_id,
        (status) => {
          const p = status.progress ?? (status.state === "finished" ? 1 : 0.4);
          setProgress(Math.max(0.3, Math.min(1, p)));
          setStatusText(stageName(status.stage));
        },
        300_000
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
      const statusCode = (err as any)?.statusCode;
      
      let displayError = errorMessage && errorMessage.trim() 
        ? errorMessage 
        : "Непредвиденная ошибка";
      
      const isExpectedError = err instanceof Error && err.name === "ExpectedError";
      
      if (isExpectedError) {
        if (errorMessage.includes("Сервер недоступен") || errorMessage.includes("502") || errorMessage.includes("503")) {
          displayError = "Сервер недоступен. Проверьте, запущен ли backend.";
        }
      }
      
      setServerErrorText(displayError);
      setShowErrorPopup(true);
      
      setIsExiting(false);
      setIsUploading(false);
      setProgress(0);
      setStatusText("");
      setStage("landing");
      setIsMockMode(false);
      setShowResult(false);
      setError(null);
    }
  };

  const showLanding = stage === "landing";
  const showProcessing = stage === "processing";
  const shouldShowGL = showLanding && !showProcessing && !isUploading && !isExiting;

  return (
    <>
      {shouldShowGL && (
        <div className="pointer-events-none fixed inset-0 -z-10">
          <GL />
        </div>
      )}

      {showLanding && (
        <div
          className="transition-all duration-500 ease-out"
          style={{
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? "scale(0.96)" : "scale(1)",
          }}
        >
          <Hero />
        </div>
      )}

      {showLanding && (
        <section
          className="snap-section relative z-10 w-full text-white lg:min-h-svh transition-all duration-500 ease-out"
          style={{
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? "translateY(20px)" : "translateY(0)",
          }}
        >
          <div className="flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:min-h-svh lg:py-6">
            <div className="w-full max-w-5xl">
              <p className="text-center text-[10px] font-mono uppercase tracking-[0.4em] text-white/50 sm:text-xs">
                Как это работает
              </p>
              <h2 className="mt-3 text-center text-xl font-semibold text-white sm:text-2xl md:text-3xl lg:mt-2">
                AI-анализ вашего выступления
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-white/60 lg:mt-1">
                Загрузите видео — получите детальный разбор речи, жестов и структуры презентации
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:mt-5 lg:grid-cols-3 lg:gap-3">
                <div className="group rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10 lg:p-3">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 lg:mb-2 lg:h-8 lg:w-8">
                    <svg className="h-5 w-5 text-white/80 lg:h-4 lg:w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-white lg:text-sm">Транскрипция речи</h3>
                  <p className="mt-1 text-xs text-white/60 lg:text-[11px]">
                    Полная расшифровка с выделением слов-паразитов
                  </p>
                </div>

                <div className="group rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10 lg:p-3">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 lg:mb-2 lg:h-8 lg:w-8">
                    <svg className="h-5 w-5 text-white/80 lg:h-4 lg:w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-white lg:text-sm">Метрики уверенности</h3>
                  <p className="mt-1 text-xs text-white/60 lg:text-[11px]">
                    Оценка громкости и зрительного контакта
                  </p>
                </div>

                <div className="group rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10 sm:col-span-2 lg:col-span-1 lg:p-3">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 lg:mb-2 lg:h-8 lg:w-8">
                    <svg className="h-5 w-5 text-white/80 lg:h-4 lg:w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-white lg:text-sm">AI-рекомендации</h3>
                  <p className="mt-1 text-xs text-white/60 lg:text-[11px]">
                    Персонализированные советы по улучшению
                  </p>
                </div>
              </div>

              <div className="group/preview relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:shadow-[0_40px_100px_rgba(0,0,0,0.55)] lg:mt-5">
                <div className="rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur-2xl lg:p-2.5">
                  <div className="flex items-center gap-1.5 border-b border-white/10 pb-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                    <span className="ml-2 text-[10px] text-white/60">charisma — анализ выступления</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:mt-2 lg:gap-2">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2 backdrop-blur-lg">
                      <div className="h-1.5 w-12 rounded bg-white/25" />
                      <div className="mt-1.5 h-14 rounded-md bg-white/10 lg:h-12" />
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2 backdrop-blur-lg">
                      <div className="h-1.5 w-14 rounded bg-white/25" />
                      <div className="mt-1.5 flex items-end gap-0.5">
                        <div className="h-6 w-3 rounded bg-white/15" />
                        <div className="h-9 w-3 rounded bg-white/25" />
                        <div className="h-5 w-3 rounded bg-white/15" />
                        <div className="h-11 w-3 rounded bg-white/30" />
                        <div className="h-7 w-3 rounded bg-white/15" />
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-2 backdrop-blur-lg">
                      <div className="h-1.5 w-10 rounded bg-white/25" />
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="relative h-12 w-12 flex-shrink-0 lg:h-10 lg:w-10">
                          <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeDasharray="78" strokeDashoffset="9" strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-2 w-4 rounded bg-white/25" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1 w-6 rounded bg-white/15 lg:w-4" />
                            <div className="h-1.5 flex-1 rounded-full bg-white/10"><div className="h-full w-[91%] rounded-full bg-white/30" /></div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-1 w-6 rounded bg-white/15 lg:w-4" />
                            <div className="h-1.5 flex-1 rounded-full bg-white/10"><div className="h-full w-[85%] rounded-full bg-white/25" /></div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-1 w-6 rounded bg-white/15 lg:w-4" />
                            <div className="h-1.5 flex-1 rounded-full bg-white/10"><div className="h-full w-[90%] rounded-full bg-white/30" /></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={startMockFlow}
                    className="group/btn relative mt-3 w-full overflow-hidden rounded-xl border border-white/15 bg-gradient-to-r from-white/10 via-white/5 to-white/10 py-3 transition-all duration-300 hover:border-white/25 hover:from-white/15 hover:via-white/10 hover:to-white/15 lg:mt-2 lg:py-2.5"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_70%)]" />
                    <div className="relative flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 text-white/70 transition-transform duration-300 group-hover/btn:scale-110" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                      </svg>
                      <span className="text-xs font-medium text-white/90">Посмотреть пример</span>
                      <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">demo</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {showLanding && (
        <section
          className="snap-section relative z-10 w-full text-white lg:min-h-svh transition-all duration-500 ease-out"
          style={{
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? "translateY(20px)" : "translateY(0)",
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div
            className={cn(
              "pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300",
              isDragging ? "opacity-100" : "opacity-0"
            )}
          >
            <div className={cn(
              "flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-white/50 bg-white/10 px-16 py-12 transition-all duration-300",
              isDragging ? "scale-100" : "scale-90"
            )}>
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20">
                <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-xl font-semibold text-white">Отпусти для загрузки</p>
              <p className="text-sm text-white/60">Формат MP4</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:min-h-svh lg:py-4">
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-md">
              <div className="text-center mb-5">
                <h2 className="text-xl font-semibold text-white sm:text-2xl">
                  Загрузи видео для анализа
                </h2>
                <p className="mt-1 text-sm text-white/40">
                  Перетащи файл или вставь ссылку
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label
                  htmlFor="video-upload"
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl border-2 border-dashed p-4 transition-all duration-300",
                    selectedFile 
                      ? "border-emerald-500/50 bg-emerald-500/10" 
                      : "border-white/20 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.06]"
                  )}
                >
                  <div className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
                    selectedFile ? "bg-emerald-500/20" : "bg-white/10 group-hover:bg-white/15"
                  )}>
                    {selectedFile ? (
                      <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-white/50 transition-colors group-hover:text-white/70" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "text-sm font-medium",
                      selectedFile ? "text-emerald-300" : "text-white/80"
                    )}>
                      {selectedFile ? "Файл выбран" : "Загрузить файл"}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {selectedFile ? selectedFile.name : "MP4, до 5 минут"}
                    </p>
                  </div>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedFile(null);
                      }}
                      className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <input
                    id="video-upload"
                    type="file"
                    className="hidden"
                    accept="video/mp4,.mp4"
                    onChange={handleFileChange}
                  />
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm transition-all focus-within:border-white/30 focus-within:bg-white/[0.05]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <svg className="h-5 w-5 text-white/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 016.364 6.364l-4.5 4.5a4.5 4.5 0 01-7.244-1.242" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="rutube.ru/video/..."
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                    value={videoUrl}
                    onChange={handleUrlChange}
                  />
                </div>
              </div>

              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div ref={personaRef} className="relative">
                  <button
                    ref={personaButtonRef}
                    type="button"
                    onClick={() => {
                      if (!isPersonaOpen && personaButtonRef.current) {
                        const rect = personaButtonRef.current.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        setPersonaOpenUp(spaceBelow < 200);
                      }
                      setIsPersonaOpen(!isPersonaOpen);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm backdrop-blur-sm transition-all",
                      isPersonaOpen
                        ? "border-white/30 bg-white/15"
                        : "border-white/10 bg-white/[0.05] hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <svg className="h-4 w-4 text-white/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                    </svg>
                    <span className="text-white/80">
                      {selectedPersona === "strict_critic" ? "Критик" :
                       selectedPersona === "kind_mentor" ? "Наставник" :
                       selectedPersona === "steve_jobs_style" ? "Джобс" :
                       "Роль"}
                    </span>
                    <svg className={cn("h-3 w-3 text-white/40 transition-transform", isPersonaOpen && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  <div
                    className={cn(
                      "absolute z-50 min-w-[200px] rounded-xl border border-white/15 bg-black/95 backdrop-blur-xl overflow-hidden shadow-xl transition-all duration-200",
                      personaOpenUp ? "bottom-full mb-1" : "top-full mt-1",
                      isPersonaOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                    )}
                  >
                    {[
                      { value: "", label: "Без роли" },
                      { value: "strict_critic", label: "Строгий критик" },
                      { value: "kind_mentor", label: "Добрый наставник" },
                      { value: "steve_jobs_style", label: "Стив Джобс" }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSelectedPersona(option.value);
                          setIsPersonaOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2.5 text-left text-sm transition-colors",
                          selectedPersona === option.value
                            ? "bg-white/10 text-white"
                            : "text-white/60 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div ref={providerRef} className="relative">
                  <button
                    ref={providerButtonRef}
                    type="button"
                    onClick={() => {
                      if (!isProviderOpen && providerButtonRef.current) {
                        const rect = providerButtonRef.current.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        setProviderOpenUp(spaceBelow < 200);
                      }
                      setIsProviderOpen(!isProviderOpen);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm backdrop-blur-sm transition-all",
                      isProviderOpen
                        ? "border-white/30 bg-white/15"
                        : "border-white/10 bg-white/[0.05] hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    <img 
                      src={`/icons/${selectedLlmProvider === "default" ? "default" : selectedLlmProvider}.svg`} 
                      alt={selectedLlmProvider}
                      className="h-4 w-4"
                    />
                    <span className="text-white/80">
                      {selectedLlmProvider === "default" ? "По умолчанию" : 
                       selectedLlmProvider === "gigachat" ? "GigaChat" : "OpenAI"}
                    </span>
                    <svg className={cn("h-3 w-3 text-white/40 transition-transform", isProviderOpen && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  <div
                    className={cn(
                      "absolute z-50 min-w-[180px] rounded-xl border border-white/15 bg-black/95 backdrop-blur-xl overflow-hidden shadow-xl transition-all duration-200",
                      providerOpenUp ? "bottom-full mb-1" : "top-full mt-1",
                      isProviderOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                    )}
                  >
                    {[
                      { value: "default", label: "По умолчанию", icon: "default" },
                      { value: "gigachat", label: "GigaChat", icon: "gigachat" },
                      { value: "openai", label: "OpenAI", icon: "openai" }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSelectedLlmProvider(option.value);
                          setIsProviderOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                          selectedLlmProvider === option.value
                            ? "bg-white/10 text-white"
                            : "text-white/60 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <img src={`/icons/${option.icon}.svg`} alt={option.label} className="h-4 w-4" />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedLlmProvider !== "default" && (
                  <div 
                    ref={modelRef} 
                    className="relative"
                    style={{
                      animation: "fadeIn 0.3s ease-out"
                    }}
                  >
                    <button
                      ref={modelButtonRef}
                      type="button"
                      onClick={() => {
                        if (!isModelOpen && modelButtonRef.current) {
                          const rect = modelButtonRef.current.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          setModelOpenUp(spaceBelow < 200);
                        }
                        setIsModelOpen(!isModelOpen);
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm backdrop-blur-sm transition-all",
                        isModelOpen
                          ? "border-white/30 bg-white/15"
                          : "border-white/10 bg-white/[0.05] hover:border-white/20 hover:bg-white/10"
                      )}
                    >
                      <span className="text-white/80">
                        {selectedModel === "sber_gigachat" ? "Sber GigaChat" :
                         selectedModel === "whisper_local" ? "Whisper (Long)" :
                         selectedModel === "whisper_openai" ? "Whisper (Fast)" :
                         "Модель"}
                      </span>
                      <svg className={cn("h-3 w-3 text-white/40 transition-transform", isModelOpen && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    <div
                      className={cn(
                        "absolute z-50 min-w-[200px] rounded-xl border border-white/15 bg-black/95 backdrop-blur-xl overflow-hidden shadow-xl transition-all duration-200",
                        modelOpenUp ? "bottom-full mb-1" : "top-full mt-1",
                        isModelOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                      )}
                    >
                      {selectedLlmProvider === "gigachat" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModel("sber_gigachat");
                            setIsModelOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                            selectedModel === "sber_gigachat"
                              ? "bg-white/10 text-white"
                              : "text-white/60 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <img src="/icons/gigachat.svg" alt="Sber GigaChat" className="h-4 w-4" />
                          <span>Sber GigaChat</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedModel("whisper_local");
                              setIsModelOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                              selectedModel === "whisper_local"
                                ? "bg-white/10 text-white"
                                : "text-white/60 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <img src="/icons/openai.svg" alt="OpenAI" className="h-4 w-4" />
                            <span>Whisper (Long)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (hasFastRequestsAvailable()) {
                                setSelectedModel("whisper_openai");
                                setIsModelOpen(false);
                              }
                            }}
                            disabled={!hasFastRequestsAvailable()}
                            className={cn(
                              "w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                              selectedModel === "whisper_openai"
                                ? "bg-white/10 text-white"
                                : "text-white/60 hover:bg-white/5 hover:text-white",
                              !hasFastRequestsAvailable() && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <img src="/icons/openai.svg" alt="OpenAI" className="h-4 w-4" />
                              <span>Whisper (Fast)</span>
                            </div>
                            <span className="text-[10px] text-white/40">
                              {fastRequestsCount > 0 ? `осталось ${fastRequestsCount}` : "нет запросов"}
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex-1" />

                <button
                  className={cn(
                    "rounded-lg px-6 py-2.5 text-sm font-medium transition-all duration-300",
                    (!selectedFile && (!videoUrl || !isValidRuTubeUrl))
                      ? "bg-white/10 text-white/30 cursor-not-allowed"
                      : "bg-white text-black shadow-lg shadow-white/20 hover:shadow-white/30 hover:scale-[1.02] active:scale-[0.98]"
                  )}
                  onClick={handleAnalyze}
                  disabled={!selectedFile && (!videoUrl || !isValidRuTubeUrl)}
                >
                  Анализировать
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {showProcessing && !error && (
        <ProcessingOverlay progress={progress} statusText={statusText} />
      )}

      {stage === "result" && result && (
        <div
          className="transition-all duration-500 ease-out relative"
          style={{
            opacity: showResult ? 1 : 0,
            transform: showResult ? "translateY(0)" : "translateY(20px)",
            zIndex: 10,
          }}
        >
          <AnalysisDashboard
            result={result}
            onBack={() => {
              setShowResult(false);
              setTimeout(() => {
                setStage("landing");
                setResult(null);
                setProgress(0.15);
                setIsUploading(false);
                setStatusText("Готовим обработку...");
                setIsMockMode(false);
              }, 400);
            }}
          />
        </div>
      )}

      <ComingSoonNotification
        isOpen={showErrorPopup}
        onClose={() => {
          setShowErrorPopup(false);
          setServerErrorText("");
        }}
        title="Ошибка"
        message={serverErrorText || "Непредвиденная ошибка"}
        icon={
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/90"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        }
      />

      <Leva hidden />
    </>
  );
}
