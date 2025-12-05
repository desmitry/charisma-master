"use client";

import React, { useEffect, useRef, useState } from "react";
import { Hero } from "@/components/hero";
import { Leva } from "leva";
import { ProcessingOverlay } from "@/components/processing-overlay";
import { AnalysisDashboard } from "@/components/analysis-dashboard";
import { mockAnalysis } from "@/lib/mock-data";
import { AnalysisResult } from "@/types/analysis";
import { pollForAnalysis, uploadVideo } from "@/lib/api";

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
  const [persona, setPersona] = useState("strict_critic");
  const [statusText, setStatusText] = useState("Готовим обработку...");
  const [progress, setProgress] = useState(0.15);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showResult, setShowResult] = useState(false);

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

  const startMockFlow = async () => {
    setIsMockMode(true);
    setIsExiting(true);
    
    // Wait for exit animation
    await new Promise((res) => setTimeout(res, 500));
    
    setStage("processing");
    setStatusText("Запускаем демо-анализ без бэкенда");
    setProgress(0.15);
    await new Promise((res) => setTimeout(res, 2000));
    setStatusText("Расшифровываем речь...");
    setProgress(0.4);
    await new Promise((res) => setTimeout(res, 2000));
    setStatusText("Генерируем метрики, строим графики...");
    setProgress(0.7);
    await new Promise((res) => setTimeout(res, 2000));
    setStatusText("Готовим финальный отчёт...");
    setProgress(0.95);
    await new Promise((res) => setTimeout(res, 1000));
    setResult(mockAnalysis);
    setProgress(1);
    
    // Wait for exit animation of processing overlay
    await new Promise((res) => setTimeout(res, 600));
    setStage("result");
    setShowResult(true);
    setIsExiting(false);
  };

  const stageName = (value?: string | null) => {
    if (!value) return "Анализируем...";
    switch (value) {
      case "listening":
        return "Расшифровываем речь";
      case "gestures":
        return "Анализируем видео";
      case "analyzing":
        return "Готовим финальный отчет";
      default:
        return "Анализируем...";
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
      setStatusText("Загружаем видео на сервер...");

      const { task_id } = await uploadVideo(selectedFile, videoUrl || null, persona);
      setStatusText("Видео принято, ставим в очередь...");
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
          <div className="flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:min-h-svh">
            <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-black/35 px-6 py-12 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-8 sm:py-14">
              <p className="text-center text-[10px] font-mono uppercase tracking-[0.3em] text-white/60 sm:text-xs sm:tracking-[0.4em]">
                Загрузка материалов
              </p>
              <h2 className="mt-6 text-center text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
                Анализируй. Учись. Защищайся.
              </h2>
              <p className="mt-4 text-center text-sm text-white/70 sm:text-base">
                Перетащи или выбери видео, либо вставь ссылку. Можно сразу запустить демо без бэкенда.
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
                    Любые форматы. Длительность до ~5 минут
                  </p>
                  <input
                    id="video-upload"
                    type="file"
                    className="hidden"
                    accept="video/*"
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
                    placeholder="https://youtu.be/..."
                    className="mt-3 w-full rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-white focus:outline-none"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                  
                  <div className="mt-4">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/50 mb-2">
                      Персона
                    </p>
                    <div className="relative">
                      <select
                        value={persona}
                        onChange={(e) => setPersona(e.target.value)}
                        className="w-full rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white focus:border-white focus:outline-none appearance-none cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <option value="strict_critic">Строгий критик</option>
                        <option value="kind_mentor">Добрый ментор</option>
                        <option value="steve_jobs_style">Стиль Стива Джобса</option>
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/50">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <button
                    className="mt-6 w-full rounded-2xl bg-white/20 py-3 text-sm font-semibold text-white transition hover:bg-white/35"
                    onClick={handleAnalyze}
                  >
                    Анализируй
                  </button>
                  <p className="mt-3 text-xs text-white/50">
                    Прямая ссылка либо YouTube
                  </p>
                  <button
                    className="mt-4 w-full rounded-2xl border border-amber-300/40 bg-amber-500/20 py-3 text-sm font-semibold text-amber-50 transition hover:bg-amber-500/30"
                    onClick={startMockFlow}
                  >
                    Демо без бэкенда
                  </button>
                  {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
                </div>
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
