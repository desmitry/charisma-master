"use client";

import React, { useEffect, useRef, useState } from "react";
import { Hero } from "@/components/hero";
import { Leva } from "leva";
import { ProcessingOverlay } from "@/components/processing-overlay";
import { AnalysisDashboard } from "@/components/analysis-dashboard";
import { AnalysisResult } from "@/types/analysis";
import { pollForAnalysis, uploadVideo } from "@/lib/api";

import ColorBends from "@/components/ColorBends";
import Aurora from "@/components/Aurora";
import { cn } from "@/lib/utils";
import { ComingSoonNotification } from "@/components/coming-soon-notification";
import { getFastRequestsCount, decrementFastRequests, hasFastRequestsAvailable } from "@/lib/cookie-utils";
import { SmoothScroll } from "@/components/smooth-scroll";
import { FeaturesSection } from "@/components/features-section";
import { SpotlightCard } from "@/components/spotlight-card";
import { MagneticButton } from "@/components/magnetic-button";
import { ScrollReveal } from "@/components/scroll-reveal";

type Stage = "landing" | "processing" | "result";

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [selectedLlmProvider, setSelectedLlmProvider] = useState<string>("default");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [doSlides, setDoSlides] = useState<boolean>(false);
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
          doSlides
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

  const showLanding = stage === "landing";
  const showProcessing = stage === "processing";
  const shouldShowGL = showLanding && !showProcessing && !isUploading && !isExiting;

  return (
    <>
      {showLanding && <SmoothScroll />}

      {/* Global Aurora Background */}
      {shouldShowGL && (
        <div className="pointer-events-none fixed inset-0 -z-20 w-full h-full bg-black overflow-hidden opacity-40">
          <Aurora
            colorStops={["#ffffff", "#000000", "#ffffff"]}
            blend={1.0}
            amplitude={1.0}
            speed={1.0}
          />
        </div>
      )}

      {/* First Section Animated Background (ColorBends) */}
      {shouldShowGL && (
        <div 
          className="pointer-events-none absolute inset-x-0 top-0 h-[120svh] -z-10 w-full overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)',
          }}
        >
          <div className="absolute inset-0 bg-[#060010]">
            <ColorBends
              rotation={0}
              speed={0.2}
              colors={["#ffffff", "#000000"]}
              transparent
              autoRotate={0.45}
              scale={1.1}
              frequency={1}
              warpStrength={1}
              mouseInfluence={0}
              parallax={0}
              noise={0}
            />
          </div>
        </div>
      )}

      {showLanding && (
        <div
          className="transition-all duration-700 ease-[0.22,1,0.36,1]"
          style={{
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? "scale(0.97) translateY(-20px)" : "scale(1) translateY(0)",
          }}
        >
          <Hero />
          <FeaturesSection />

          {/* Demo Video Section */}
          <section className="relative z-10 w-full py-12 px-4 sm:px-6">
            <div className="mx-auto max-w-5xl">
              <ScrollReveal distance={30}>
                <div className="relative group overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/30 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
                  {/* Glow accent */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/[0.02] pointer-events-none" />

                  <div className="flex flex-col lg:flex-row items-center gap-8 p-8 sm:p-12">
                    {/* Left: Play button area */}
                    <div className="relative flex-shrink-0 flex items-center justify-center">
                      <div className="relative h-28 w-28 sm:h-36 sm:w-36">
                        {/* Outer ring */}
                        <div className="absolute inset-0 rounded-full border border-white/10 animate-[spin_20s_linear_infinite]" />
                        {/* Middle ring */}
                        <div className="absolute inset-3 rounded-full border border-white/[0.07] animate-[spin_15s_linear_infinite_reverse]" />
                        {/* Play button */}
                        <button
                          onClick={startMockFlow}
                          className="absolute inset-6 flex items-center justify-center rounded-full bg-white text-black shadow-[0_0_50px_rgba(255,255,255,0.25)] transition-all duration-500 hover:scale-110 hover:shadow-[0_0_80px_rgba(255,255,255,0.5)] active:scale-95"
                          aria-label="Запустить демо"
                        >
                          <svg className="h-7 w-7 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 4.75a.75.75 0 0 0-1.5 0v14.5a.75.75 0 0 0 1.5 0V4.75Zm13.25 7-7.5-4.75v9.5l7.5-4.75Z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Right: Text */}
                    <div className="flex-1 text-center lg:text-left">
                      <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.4em] text-white/40">
                        Live Preview
                      </p>
                      <h2 className="mb-4 text-2xl sm:text-3xl font-medium tracking-tight text-white">
                        Посмотрите, как это работает
                      </h2>
                      <p className="mb-6 text-sm sm:text-base text-white/50 leading-relaxed max-w-lg">
                        Запустите демо-режим и увидите полный AI-разбор: транскрипт,
                        темп речи, метрики уверенности и персональные рекомендации.
                      </p>
                      <button
                        onClick={startMockFlow}
                        className="group inline-flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/80 transition-all duration-300 hover:border-white/30 hover:bg-white/10 hover:text-white"
                      >
                        <svg className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4.75a.75.75 0 0 0-1.5 0v14.5a.75.75 0 0 0 1.5 0V4.75Zm13.25 7-7.5-4.75v9.5l7.5-4.75Z" />
                        </svg>
                        Запустить демо
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono text-white/50">DEMO</span>
                      </button>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* New Bento Upload Hub */}
          <section id="upload-hub" className="relative z-10 w-full py-16 px-4 sm:px-6 mb-32">
            <div className="mx-auto max-w-5xl">
              <SpotlightCard className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/40 shadow-2xl backdrop-blur-3xl">
                <div
                  className="flex flex-col lg:flex-row"
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  {/* Left: Drag & Drop Zone */}
                  <div
                    className={cn(
                      "relative flex flex-1 flex-col items-center justify-center p-12 transition-all duration-500",
                      isDragging ? "bg-white/5" : "hover:bg-white/[0.02]"
                    )}
                  >
                    <input
                      id="video-upload"
                      type="file"
                      className="hidden"
                      accept="video/mp4,.mp4"
                      onChange={handleFileChange}
                    />
                    <label
                      htmlFor="video-upload"
                      className="absolute inset-0 z-10 cursor-pointer"
                    />

                    <div
                      className={cn(
                        "relative z-0 mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border transition-all duration-500",
                        selectedFile
                          ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.2)] text-emerald-400"
                          : "border-white/10 bg-white/5 text-white/50 group-hover:scale-105"
                      )}
                    >
                      {selectedFile ? (
                        <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      )}
                    </div>
                    
                    <h3 className="mb-2 text-xl font-medium text-white text-center">
                      {selectedFile ? "Файл готов к анализу" : "Перетащите видео сюда"}
                    </h3>
                    <p className="text-center text-sm text-white/40 max-w-[250px]">
                      {selectedFile ? selectedFile.name : "Поддерживается только формат MP4. Максимум 5 минут."}
                    </p>

                    {selectedFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                        className="relative z-20 mt-6 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                      >
                        Заменить файл
                      </button>
                    )}
                  </div>

                  {/* Right: Settings & Actions */}
                  <div className="flex flex-1 flex-col justify-between border-t border-white/10 lg:border-l lg:border-t-0 bg-black/20 p-8 sm:p-12">
                    <div>
                      <div className="mb-8">
                        <label className="mb-3 block text-xs font-mono uppercase tracking-widest text-white/40">
                          Или ссылка на RuTube
                        </label>
                        <div className="flex items-center gap-3 border-b border-white/10 pb-2 transition-colors focus-within:border-white/40">
                          <svg className="h-5 w-5 text-white/30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 016.364 6.364l-4.5 4.5a4.5 4.5 0 01-7.244-1.242" />
                          </svg>
                          <input
                            type="text"
                            placeholder="rutube.ru/video/..."
                            className="w-full bg-transparent text-sm text-white placeholder-white/20 outline-none"
                            value={videoUrl}
                            onChange={handleUrlChange}
                          />
                        </div>
                      </div>

                      <div className="mb-8">
                        <label className="mb-3 block text-xs font-mono uppercase tracking-widest text-white/40">
                          Режим анализа
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "", label: "Классика" },
                            { id: "strict_critic", label: "Критик" },
                            { id: "kind_mentor", label: "Ментор" },
                            { id: "steve_jobs_style", label: "Инноватор" },
                          ].map((p) => (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPersona(p.id)}
                              className={cn(
                                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300",
                                selectedPersona === p.id
                                  ? "bg-white text-black shadow-sm"
                                  : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                              )}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mb-8">
                        <label className="mb-3 block text-xs font-mono uppercase tracking-widest text-white/40">
                          Нейросеть
                        </label>
                        <div className="flex gap-2">
                          {[
                            { id: "default", label: "Auto" },
                            { id: "gigachat", label: "GigaChat" },
                            { id: "openai", label: "OpenAI" },
                          ].map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setSelectedLlmProvider(m.id)}
                              className={cn(
                                "flex-1 rounded-lg py-2 text-center text-xs font-medium transition-all duration-300",
                                selectedLlmProvider === m.id
                                  ? "bg-white/10 text-white shadow-inner border border-white/20"
                                  : "border border-transparent text-white/40 hover:text-white"
                              )}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                        {selectedLlmProvider === "openai" && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => setSelectedModel("whisper_local")}
                              className={cn(
                                "flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs transition-colors",
                                selectedModel === "whisper_local" ? "bg-white/10 text-white" : "text-white/40"
                              )}
                            >
                              Long
                            </button>
                            <button
                              onClick={() => hasFastRequestsAvailable() && setSelectedModel("whisper_openai")}
                              className={cn(
                                "flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs transition-colors flex items-center justify-center gap-1.5",
                                selectedModel === "whisper_openai" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "text-white/40",
                                !hasFastRequestsAvailable() && "opacity-30 cursor-not-allowed"
                              )}
                            >
                              Fast <span className="rounded bg-white/10 px-1 text-[10px]">{fastRequestsCount}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {error && (
                        <p className="flex-1 text-xs font-medium text-rose-400">{error}</p>
                      )}
                      
                      <MagneticButton
                        onClick={handleAnalyze}
                        disabled={!selectedFile && (!videoUrl || !isValidRuTubeUrl)}
                        intensity={0.1}
                        className={cn(
                          "ml-auto shrink-0 rounded-2xl px-6 py-3 text-sm font-semibold transition-all duration-500",
                          (!selectedFile && (!videoUrl || !isValidRuTubeUrl))
                            ? "bg-white/5 text-white/30 cursor-not-allowed"
                            : "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)]"
                        )}
                      >
                        Запустить нейросеть
                      </MagneticButton>
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </div>
          </section>
        </div>
      )}

      {showProcessing && !error && (
        <ProcessingOverlay progress={progress} statusText={statusText} />
      )}

      {stage === "result" && result && (
        <div
          className="transition-all duration-700 ease-[0.22,1,0.36,1] relative z-10"
          style={{
            opacity: showResult ? 1 : 0,
            transform: showResult ? "translateY(0)" : "translateY(20px)",
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
        message={serverErrorText}
        icon={null}
      />
      <Leva hidden />
    </>
  );
}
