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
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);
  const [personaOpenUp, setPersonaOpenUp] = useState(false);
  const personaRef = useRef<HTMLDivElement>(null);
  const personaButtonRef = useRef<HTMLButtonElement>(null);
  const [statusText, setStatusText] = useState("Готовим обработку...");
  const [progress, setProgress] = useState(0.15);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (personaRef.current && !personaRef.current.contains(event.target as Node)) {
        setIsPersonaOpen(false);
      }
    };

    if (isPersonaOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPersonaOpen]);

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

    updateCurrentSection();

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      clearTimeout(resetTimeout);
    };
  }, [isTouchDevice, stage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
    if (file) {
      setError(null);
    }
  };

  const loadMockResponse = async (): Promise<AnalysisResult> => {
    const res = await fetch("/mock-response.json");
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

    if (isMockMode || (!selectedFile && !videoUrl)) {
      return startMockFlow();
    }

    try {
      setStage("processing");
      setProgress(0.15);
      setStatusText("Загружаем видео...");

      const { task_id } = await uploadVideo(selectedFile, videoUrl || null, selectedPersona || undefined);
      setStatusText("Видео принято, начинаем анализ...");
      setProgress(0.3);

      const analysis = await pollForAnalysis(
        task_id,
        (status) => {
          const p = status.progress ?? (status.state === "finished" ? 1 : 0.4);
          setProgress(Math.max(0.3, Math.min(1, p)));
          setStatusText(stageName(status.stage));
        },
        90_000
      );

      setResult(analysis);
      setStage("result");
      setProgress(1);
    } catch (err) {
      setError("Не удалось связаться с бэкендом. Можно запустить демо-режим.");
      setStage("landing");
      setIsMockMode(false);
    }
  };

  const showLanding = stage === "landing";
  const showProcessing = stage === "processing";

  return (
    <>
      {showLanding && stage !== "processing" && (
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
        >
          <div className="flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:min-h-svh">
            <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-black/35 px-6 py-12 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-8 sm:py-14">
              <p className="text-center text-[10px] font-mono uppercase tracking-[0.3em] text-white/60 sm:text-xs sm:tracking-[0.4em]">
                Загрузка материалов
              </p>
              <h2 className="mt-6 text-center text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
                Анализируй. Учись. Защищайся.
              </h2>
              <p className="mt-4 text-center text-sm text-white/70 sm:text-base">
                Перетащи или выбери видео, либо вставь ссылку.
              </p>

              <div className="mt-10 grid gap-6 md:grid-cols-2">
                <label
                  htmlFor="video-upload"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/40 bg-white/5 px-6 py-10 text-center transition hover:border-white hover:bg-white/10"
                >
                  <svg
                    className="mb-4 h-10 w-10 text-white/70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <p className="text-lg font-semibold text-white">
                    Перетащи файл сюда
                  </p>
                  <p className="mt-2 text-sm text-white/65">
                    Формат MP4. Длительность до ~5 минут
                  </p>
                  <input
                    id="video-upload"
                    type="file"
                    className="hidden"
                    accept="video/mp4,.mp4"
                    onChange={handleFileChange}
                  />
                  {selectedFile && (
                    <p className="mt-3 text-xs text-white/60">
                      Выбран: {selectedFile.name}
                    </p>
                  )}
                </label>

                <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-8">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
                    Использовать ссылку
                  </p>
                  <input
                    type="text"
                    placeholder="https://rutube.ru/video/... или https://vk.com/video..."
                    className="mt-3 w-full rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-white focus:outline-none"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                  
                  <button
                    className="mt-6 w-full rounded-2xl bg-white/20 py-3 text-sm font-semibold text-white transition hover:bg-white/35"
                    onClick={handleAnalyze}
                  >
                    Анализируй
                  </button>
                  <p className="mt-3 text-xs text-white/50">
                    Прямая ссылка, Rutube или ВК видео
                  </p>
                  {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/15 bg-white/5 px-6 py-6">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/50 mb-4">
                  Роль оценщика
                </p>
                <div ref={personaRef} className="relative">
                  <button
                    ref={personaButtonRef}
                    type="button"
                    onClick={() => {
                      if (!isPersonaOpen && personaButtonRef.current) {
                        const rect = personaButtonRef.current.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const spaceAbove = rect.top;
                        const dropdownHeight = 200; // примерная высота dropdown
                        setPersonaOpenUp(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
                      }
                      setIsPersonaOpen(!isPersonaOpen);
                    }}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left text-sm text-white transition-all duration-200 flex items-center justify-between",
                      isPersonaOpen
                        ? "border-white/40 bg-white/10"
                        : "border-white/20 bg-black/30 hover:border-white/30 hover:bg-black/40"
                    )}
                  >
                    <span className={selectedPersona ? "" : "text-white/50"}>
                      {selectedPersona === "strict_critic" ? "Строгий критик" :
                       selectedPersona === "kind_mentor" ? "Добрый наставник" :
                       selectedPersona === "steve_jobs_style" ? "Стив Джобс" :
                       "Не выбрано"}
                    </span>
                    <svg
                      className={cn(
                        "w-4 h-4 text-white/60 transition-transform duration-300 ease-in-out",
                        isPersonaOpen ? "rotate-180" : "rotate-0"
                      )}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  <div
                    className={cn(
                      "absolute z-50 w-full rounded-2xl border border-white/20 bg-black/40 backdrop-blur-xl overflow-hidden transition-all duration-300",
                      personaOpenUp ? "bottom-full mb-2" : "top-full mt-2",
                      isPersonaOpen
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : personaOpenUp
                        ? "opacity-0 translate-y-2 pointer-events-none"
                        : "opacity-0 -translate-y-2 pointer-events-none"
                    )}
                    style={{
                      maxHeight: isPersonaOpen ? "300px" : "0px",
                      transition: "opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1), max-height 300ms cubic-bezier(0.4, 0, 0.2, 1)"
                    }}
                  >
                    <div className="py-1">
                      {[
                        { value: "", label: "Не выбрано", desc: "" },
                        { value: "strict_critic", label: "Строгий критик", desc: "Жесткая оценка недостатков" },
                        { value: "kind_mentor", label: "Добрый наставник", desc: "Мягкие советы и поддержка" },
                        { value: "steve_jobs_style", label: "Стив Джобс", desc: "Минимализм и страсть" }
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setSelectedPersona(option.value);
                            setIsPersonaOpen(false);
                          }}
                          className={cn(
                            "w-full px-4 py-3 text-left text-sm transition-all duration-150",
                            selectedPersona === option.value
                              ? "bg-white/10 text-white"
                              : "text-white/70 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <div className="font-medium">{option.label}</div>
                          {option.desc && (
                            <div className="text-xs text-white/50 mt-0.5">{option.desc}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {selectedPersona && (
                  <p className="mt-3 text-xs text-white/50">
                    {
                      selectedPersona === "strict_critic" ? "Жесткая оценка недостатков" :
                      selectedPersona === "kind_mentor" ? "Мягкие советы и поддержка" :
                      "Минимализм и страсть"
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {showProcessing && (
        <ProcessingOverlay progress={progress} statusText={statusText} />
      )}

      {stage === "result" && result && (
        <div
          className="transition-all duration-500 ease-out"
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
                setStatusText("Готовим обработку...");
                setIsMockMode(false);
              }, 400);
            }}
          />
        </div>
      )}

      <Leva hidden />
    </>
  );
}
