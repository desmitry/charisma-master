"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { AnalysisResult, TempoPoint, TranscriptWord } from "@/types/analysis";
import { resolveVideoUrl, getPdfUrl } from "@/lib/api";
import { useEcoMode } from "@/lib/eco-mode-context";
import { cn } from "@/lib/utils";
import { SmoothScroll } from "./smooth-scroll";
import { TempoChart } from "./analysis/tempo-chart";
import { ComingSoonNotification } from "./coming-soon-notification";
import { PdfExportDropdown } from "./pdf-export-modal";
import { VideoPlayer, VideoPlayerRef } from "./video-player";

type Props = {
  result: AnalysisResult;
  onBack?: () => void;
};

type ViewportRect = {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
};

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

const IconTarget = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" opacity="0.5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
);
const IconDoc = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v5h5" opacity="0.6" />
    <path d="M9 13h6M9 17h6" opacity="0.7" />
  </svg>
);
const IconBolt = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M13 2 6 13h5l-1 9 7-11h-5z" />
  </svg>
);
const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6l4 2" />
  </svg>
);
const IconHand = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M18 11v-1a2 2 0 0 0-2-2h-1" />
    <path d="M14 10V9a2 2 0 0 0-2-2h-1" />
    <path d="M10 9.5V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v7" />
    <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-1a8 8 0 0 1-8-8 2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-3z" />
  </svg>
);

export function AnalysisDashboard({ result, onBack }: Props) {
  const playerRef = useRef<VideoPlayerRef>(null);
  const tempoChartRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"transcript" | "insights">("transcript");
  const [videoSrc, setVideoSrc] = useState(() => {
    return resolveVideoUrl(result.video_path);
  });
  const [videoError, setVideoError] = useState<string | null>(null);
  const { isEcoMode } = useEcoMode();
  
  const [tempoModal, setTempoModal] = useState<{
    open: boolean;
    phase: "closed" | "opening" | "open" | "closing";
    originRect: DOMRect | null;
  }>({ open: false, phase: "closed", originRect: null });

  const [showComingSoon, setShowComingSoon] = useState(false);
  const [showPdfDropdown, setShowPdfDropdown] = useState(false);
  const pdfButtonRef = useRef<HTMLButtonElement>(null);

  const openTempoModal = useCallback(() => {
    if (!tempoChartRef.current) return;
    const rect = tempoChartRef.current.getBoundingClientRect();
    setTempoModal({ open: true, phase: "opening", originRect: rect });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTempoModal(prev => ({ ...prev, phase: "open" }));
      });
    });
  }, []);

  const closeTempoModal = useCallback(() => {
    setTempoModal(prev => ({ ...prev, phase: "closing" }));
    setTimeout(() => {
      setTempoModal({ open: false, phase: "closed", originRect: null });
    }, 350);
  }, []);

  useEffect(() => {
    const newSrc = resolveVideoUrl(result.video_path);
    setVideoSrc(newSrc);
    setVideoError(null);
  }, [result.video_path]);

  useEffect(() => {
    if (!tempoModal.open) {
      return;
    }
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTempoModal();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [tempoModal.open, closeTempoModal]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleWordClick = (word: TranscriptWord) => {
    if (!playerRef.current) return;
    playerRef.current.seek(word.start);
    playerRef.current.play();
    setCurrentTime(word.start);
  };

  const groupedTranscript = useMemo(() => {
    const groups: { label: string; segments: typeof result.transcript }[] = [];
    const chunkSize = 30;
    
    result.transcript.forEach((seg) => {
      const groupIdx = Math.floor(seg.start / chunkSize);
      const label = `${formatTime(groupIdx * chunkSize)} - ${formatTime((groupIdx + 1) * chunkSize)}`;
      
      if (!groups[groupIdx]) {
        groups[groupIdx] = { label, segments: [] };
      }
      groups[groupIdx].segments.push(seg);
    });
    
    return groups.filter(Boolean);
  }, [result.transcript]);

  return (
    <div className="relative z-10 min-h-screen bg-[#050505] text-white overflow-hidden">
      <SmoothScroll />
      {!isEcoMode ? (
        <div className="pointer-events-none fixed inset-0 blur-3xl opacity-20">
          <div className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-white/15" />
          <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-white/10" />
        </div>
      ) : (
        <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-black via-[#0a0a0a] to-[#050505]" />
      )}

      <header
        className={cn(
          "sticky top-0 z-40 border-b border-white/10 bg-black/80",
          isEcoMode ? "backdrop-blur-sm" : "backdrop-blur-xl",
          isEcoMode ? "" : "transform transition-all duration-700",
          mounted ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg font-bold sm:flex">
              C
            </div>
            <div>
              <h1 className="text-base font-semibold sm:text-lg">Разбор выступления</h1>
              {(result.analyze_provider || result.analyze_model) && (
                <p className="text-[9px] text-white/30 mt-0.5 flex items-center gap-1">
                  {result.analyze_provider && (
                    <img 
                      src={`/icons/${result.analyze_provider}.svg`} 
                      alt={result.analyze_provider}
                      className="w-3 h-3 inline"
                    />
                  )}
                  {result.analyze_provider && result.analyze_model 
                    ? `${result.analyze_provider}/${result.analyze_model}`
                    : result.analyze_provider || result.analyze_model}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <StatBadge label="Паразиты" value={`${(result.fillers_summary.ratio * 100).toFixed(1)}%`} />
            <StatBadge label="Уверенность" value={`${Math.min(100, Math.max(0, result.confidence_index.total)).toFixed(0)}`} accent />
            
            {(result.analyze_provider || result.analyze_model) && (
              <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
                {result.analyze_provider && (
                  <img 
                    src={`/icons/${result.analyze_provider}.svg`} 
                    alt={result.analyze_provider}
                    className="w-4 h-4"
                  />
                )}
                <span className="text-white/70">
                  {result.analyze_provider && result.analyze_model 
                    ? `${result.analyze_provider}/${result.analyze_model}`
                    : result.analyze_provider || result.analyze_model}
                </span>
              </div>
            )}

            <div className="relative hidden sm:block">
              <button
                ref={pdfButtonRef}
                onClick={() => setShowPdfDropdown(!showPdfDropdown)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium transition hover:bg-white/15 sm:px-4 sm:py-2"
              >
                PDF Отчет
              </button>
              <PdfExportDropdown 
                isOpen={showPdfDropdown} 
                onClose={() => setShowPdfDropdown(false)} 
                result={result}
                buttonRef={pdfButtonRef}
              />
            </div>

            {onBack && (
              <button
                onClick={onBack}
                className="ml-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium transition hover:bg-white/15 sm:px-4 sm:py-2"
              >
                Назад
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div
          className={cn(
            "grid gap-4 lg:grid-cols-[1fr_320px]",
            "transform transition-all duration-700 delay-100",
            mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          )}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border",
              isEcoMode ? "border-white/8 bg-black" : "group border-white/10 bg-white/5"
            )}
          >
            {!isEcoMode && !videoError && (
              <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-20 bg-gradient-to-tr from-white/30 via-white/10 to-transparent pointer-events-none" />
            )}
            <VideoPlayer
              ref={playerRef}
              src={videoSrc}
              error={videoError}
              onTimeUpdate={setCurrentTime}
              onError={setVideoError}
              className="aspect-video w-full object-contain bg-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <GlassStat
              icon={<IconTarget />}
              label="Слова-паразиты"
              value={result.fillers_summary.count}
              suffix="шт"
              delay={200}
              mounted={mounted}
              ecoMode={isEcoMode}
            />
            <GlassStat
              icon={<IconDoc />}
              label="Плотность слайдов"
              value={Math.min(100, Math.max(0, result.slide_analysis?.text_density_score ?? result.slide_text_density ?? 0))}
              suffix="%"
              delay={300}
              mounted={mounted}
              ecoMode={isEcoMode}
            />
            <GlassStat
              icon={<IconBolt />}
              label="Уверенность"
              value={Math.min(100, Math.max(0, result.confidence_index.total))}
              suffix="/100"
              delay={400}
              mounted={mounted}
              ecoMode={isEcoMode}
            />
            <GlassStat
              icon={<IconClock />}
              label="Аудиофрагментов"
              value={result.transcript.length}
              suffix="шт"
              delay={500}
              mounted={mounted}
              ecoMode={isEcoMode}
            />
            <GlassStat
              icon={<IconHand />}
              label="Жестикуляция"
              value={Math.min(100, Math.max(0, result.confidence_index.components.gesture_score || 0))}
              suffix="/100"
              delay={600}
              mounted={mounted}
              ecoMode={isEcoMode}
            />
          </div>
        </div>

        <div
          className={cn(
            "mt-6 flex gap-2",
            isEcoMode ? "" : "transform transition-all duration-700 delay-200",
            mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          )}
        >
          <TabButton active={activeTab === "transcript"} onClick={() => setActiveTab("transcript")}>
            Транскрипт
          </TabButton>
          <TabButton active={activeTab === "insights"} onClick={() => setActiveTab("insights")}>
            Инсайты
          </TabButton>
        </div>

        <div
          className={cn(
            "mt-4",
            isEcoMode ? "" : "transform transition-all duration-700 delay-300",
            mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          )}
        >
          {activeTab === "transcript" && (
            <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Полный транскрипт</h2>
                  <span className="text-xs text-white/50">Клик по слову → перемотка</span>
                </div>
                <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2 scroll-elegant" data-lenis-prevent>
                  {groupedTranscript.map((group, gi) => (
                    <div key={gi} className="rounded-xl border border-white/5 bg-white/5 p-3 transition hover:border-white/15 hover:bg-white/10">
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                        {group.label}
                      </p>
                      <div className="leading-[1.5] text-sm">
                        {group.segments.flatMap((seg) => seg.words).map((word, idx) => {
                          const isActive = currentTime + 0.02 >= word.start && currentTime < word.end - 0.02;
                          const display = word.text.trim();
                          if (!display) return null;
                          return (
                            <span
                              key={`${word.start}-${display}-${idx}`}
                              onClick={() => handleWordClick(word)}
                              className={cn(
                                "cursor-pointer rounded px-[2px] py-0.5 transition-all duration-150",
                                word.is_filler
                                  ? "text-rose-300 bg-rose-500/18 hover:bg-rose-500/28"
                                  : "text-white/75 hover:bg-white/10",
                                isActive && "bg-white/15 text-white shadow-[0_8px_30px_rgba(255,255,255,0.08)]",
                                "hover:-translate-y-[1px]"
                              )}
                            >
                              {display}{" "}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div 
                  ref={tempoChartRef}
                  style={{ 
                    opacity: tempoModal.open ? 0 : 1,
                    transition: "opacity 100ms ease-out",
                  }}
                >
                  <TempoChart
                    data={result.tempo}
                    currentTime={currentTime}
                    onExpand={openTempoModal}
                  />
                </div>
                <AnimatedConfidenceGauge
                  total={result.confidence_index.total}
                  components={result.confidence_index.components}
                  mounted={mounted}
                />
              </div>
            </div>
          )}

          {activeTab === "insights" && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InsightCard
                title="Summary"
                content={result.summary}
                delay={0}
                mounted={mounted}
              />
              <InsightCard
                title="Ошибки"
                content={typeof result.mistakes === "string" 
                  ? result.mistakes 
                  : Array.isArray(result.mistakes) 
                    ? result.mistakes.join("\n") 
                    : String(result.mistakes || "")}
                delay={100}
                mounted={mounted}
                accent="red"
              />
              <InsightCard
                title="Структура"
                content={typeof result.structure === "string"
                  ? result.structure
                  : typeof result.structure === "object" && result.structure !== null
                    ? Object.entries(result.structure)
                        .map(([key, value]) => `**${key}**: ${value}`)
                        .join("\n\n")
                    : String(result.structure || "")}
                delay={200}
                mounted={mounted}
              />
              <InsightCard
                title="Идеальный текст"
                content={result.ideal_text}
                delay={300}
                mounted={mounted}
                className="md:col-span-2 xl:col-span-2"
              />
              <InsightCard
                title="Персона"
                content={result.persona_feedback || "Персональный фидбэк не задан"}
                delay={400}
                mounted={mounted}
                accent="amber"
              />
              {result.slide_analysis && (result.slide_analysis.acr_summary || result.slide_analysis.ocr_summary) && (
                <InsightCard
                  title="Анализ презентации"
                  content={result.slide_analysis.acr_summary || result.slide_analysis.ocr_summary || ""}
                  delay={500}
                  mounted={mounted}
                />
              )}
            </div>
          )}
        </div>
      </main>
      {globalStyles}

      <ComingSoonNotification isOpen={showComingSoon} onClose={() => setShowComingSoon(false)} />

      {tempoModal.open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999]"
          style={{
            backgroundColor: tempoModal.phase === "open" ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0)",
            backdropFilter: tempoModal.phase === "open" ? "blur(12px)" : "blur(0px)",
            transition: "background-color 400ms ease-out, backdrop-filter 400ms ease-out",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeTempoModal();
          }}
        >
          {(() => {
            const origin = tempoModal.originRect;
            const isExpanded = tempoModal.phase === "open";
            
            const finalWidth = Math.min(window.innerWidth - 32, 1100);
            const finalHeight = Math.min(window.innerHeight - 80, 640);
            const finalLeft = (window.innerWidth - finalWidth) / 2;
            const finalTop = (window.innerHeight - finalHeight) / 2;
            
            const startLeft = origin?.left ?? finalLeft;
            const startTop = origin?.top ?? finalTop;
            const startWidth = origin?.width ?? finalWidth;
            const startHeight = origin?.height ?? finalHeight;
            
            const style: CSSProperties = {
              position: "fixed",
              left: isExpanded ? finalLeft : startLeft,
              top: isExpanded ? finalTop : startTop,
              width: isExpanded ? finalWidth : startWidth,
              height: isExpanded ? finalHeight : startHeight,
              transition: "all 400ms cubic-bezier(0.16, 1, 0.3, 1)",
            };
            
            return (
              <div
                className={isExpanded 
                  ? "rounded-2xl border border-white/10 bg-[#0a0a0c]/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
                  : "rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
                }
                style={{
                  ...style,
                  backgroundColor: isExpanded ? "rgba(10,10,12,0.95)" : "rgba(255,255,255,0.05)",
                  transition: "all 400ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {isExpanded && (
                  <div 
                    className="flex items-center justify-between text-white px-5 pt-4 pb-2"
                    style={{
                      opacity: 1,
                      transition: "opacity 150ms ease-out",
                    }}
                  >
                    <div className="text-sm font-semibold">Темп речи — все данные</div>
                    <button
                      onClick={closeTempoModal}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors flex items-center gap-1.5"
                    >
                      <span>✕</span>
                      <span>Закрыть</span>
                    </button>
                  </div>
                )}

                <div className={isExpanded ? "flex-1 px-4 pb-4 overflow-hidden" : "h-full"}>
                  <TempoChart
                    data={result.tempo}
                    currentTime={currentTime}
                    expanded={isExpanded}
                    inModal={true}
                  />
                </div>
              </div>
            );
          })()}
        </div>,
        document.body
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatBadge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "hidden rounded-full px-3 py-1.5 text-xs sm:block",
        accent ? "bg-white/15 font-medium" : "bg-white/5"
      )}
    >
      <span className="text-white/50">{label}:</span>{" "}
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
        active
          ? "bg-white text-black"
          : "bg-white/5 text-white/70 hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}

function GlassStat({
  icon,
  label,
  value,
  suffix,
  delay,
  mounted,
  ecoMode = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
  delay: number;
  mounted: boolean;
  ecoMode?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    if (ecoMode) {
      setDisplayValue(value);
      return;
    }
    const timer = setTimeout(() => {
      const start = Date.now();
      const duration = 1400;
      const animate = () => {
        const progress = Math.min((Date.now() - start) / duration, 1);
        setDisplayValue(value * easeOutExpo(progress));
        if (progress < 1) requestAnimationFrame(animate);
      };
      animate();
    }, delay);
    return () => clearTimeout(timer);
  }, [mounted, value, delay, ecoMode]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white/5 p-3",
        ecoMode ? "border-white/8" : "border-white/10",
        ecoMode ? "" : "transition-all duration-500",
        mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        !ecoMode && hovered && "border-white/20 shadow-[0_20px_60px_rgba(255,255,255,0.08)]"
      )}
      style={{ transitionDelay: ecoMode ? undefined : `${delay}ms` }}
      onMouseEnter={() => !ecoMode && setHovered(true)}
      onMouseLeave={() => !ecoMode && setHovered(false)}
    >
      {!ecoMode && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/0 to-white/10 opacity-0 transition-opacity duration-500"
          style={{ opacity: hovered ? 0.2 : 0 }}
        />
      )}
      <div className="relative z-10 flex items-start gap-3">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tabular-nums">{(displayValue || 0).toFixed(suffix === "%" ? 1 : 0)}</span>
            <span className="text-xs text-white/50">{suffix}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimatedTempoChart({ data, mounted }: { data: TempoPoint[]; mounted: boolean }) {
  const [animProgress, setAnimProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<TempoPoint | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const maxWpm = useMemo(() => Math.max(...data.map((d) => d.wpm), 1), [data]);
  const maxTime = useMemo(() => Math.max(...data.map((d) => d.time), 1), [data]);

  useEffect(() => {
    if (!mounted) return;
    let start = Date.now();
    const duration = 1200;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setAnimProgress(1 - Math.pow(1 - progress, 3));
      if (progress < 1) requestAnimationFrame(animate);
    };
    const timer = setTimeout(animate, 400);
    return () => clearTimeout(timer);
  }, [mounted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 360;
    const h = 200;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const pad = 30;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad + ((h - pad * 2) / 5) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();
    }

    const visibleCount = Math.floor(data.length * animProgress);
    const toPoint = (d: TempoPoint) => {
      const x = pad + (d.time / maxTime) * (w - pad * 2);
      const y = h - pad - (d.wpm / maxWpm) * (h - pad * 2);
      return { x, y };
    };

    if (visibleCount > 0) {
      ctx.beginPath();
      for (let i = 0; i <= visibleCount; i++) {
        const d = data[i];
        if (!d) continue;
        const { x, y } = toPoint(d);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prev = data[i - 1];
          const { x: px, y: py } = toPoint(prev);
          const cx = (px + x) / 2;
          ctx.quadraticCurveTo(cx, py, x, y);
        }
      }
      const last = data[Math.min(visibleCount, data.length - 1)];
      if (last) {
        const { x } = toPoint(last);
        ctx.lineTo(x, h - pad);
        ctx.lineTo(pad, h - pad);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, pad, 0, h - pad);
        grad.addColorStop(0, "rgba(255,255,255,0.18)");
        grad.addColorStop(1, "rgba(255,255,255,0.02)");
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    ctx.beginPath();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i <= visibleCount; i++) {
      const d = data[i];
      if (!d) continue;
      const { x, y } = toPoint(d);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prev = data[i - 1];
        const { x: px, y: py } = toPoint(prev);
        const cx = (px + x) / 2;
        ctx.quadraticCurveTo(cx, py, x, y);
      }
    }
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 6;
    ctx.filter = "blur(6px)";
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i <= visibleCount; i++) {
      const d = data[i];
      if (!d) continue;
      const { x, y } = toPoint(d);
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = d.zone === "red" ? "#f87171" : d.zone === "yellow" ? "#fbbf24" : "#fff";
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "10px sans-serif";
    ctx.fillText("0", pad - 12, h - pad + 14);
    ctx.fillText(formatTime(maxTime), w - pad - 16, h - pad + 14);
    ctx.fillText(`${maxWpm.toFixed(0)} wpm`, pad - 12, pad + 4);
  }, [data, maxWpm, maxTime, animProgress]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-500",
        mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
      style={{ transitionDelay: "500ms" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">Темп речи</h3>
          <p className="text-[11px] text-white/50">Гладкая линия + заливка</p>
        </div>
        <span className="text-xs text-white/40">max {maxWpm.toFixed(0)} wpm</span>
      </div>
      <div
        className="relative"
        onMouseLeave={() => setHovered(null)}
        onMouseMove={(e) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const pad = 30;
          const rel = (x - pad) / (rect.width - pad * 2);
          const time = Math.max(0, Math.min(1, rel)) * maxTime;
          let best: TempoPoint | null = null;
          let min = Infinity;
          for (const d of data) {
            const dist = Math.abs(d.time - time);
            if (dist < min) {
              min = dist;
              best = d;
            }
          }
          if (best) {
            setHovered(best);
            setHoverPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10 });
          }
        }}
      >
        <canvas ref={canvasRef} style={{ width: "100%", height: 200 }} />
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-[11px] shadow-xl backdrop-blur-md"
            style={{ left: hoverPos.x, top: hoverPos.y }}
          >
            <div className="font-semibold">t = {hovered.time.toFixed(1)}s</div>
            <div className="text-white/70">WPM: {hovered.wpm.toFixed(1)}</div>
            <div
              className={cn(
                "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px]",
                hovered.zone === "red" && "bg-red-500/20 text-red-200",
                hovered.zone === "yellow" && "bg-amber-500/20 text-amber-200",
                hovered.zone !== "red" && hovered.zone !== "yellow" && "bg-white/10 text-white/70"
              )}
            >
              {hovered.zone}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnimatedConfidenceGauge({
  total,
  components,
  mounted,
}: {
  total: number;
  components: AnalysisResult["confidence_index"]["components"];
  mounted: boolean;
}) {
  const [animValue, setAnimValue] = useState(0);
  const normalizedTotal = Math.min(100, Math.max(0, total));

  useEffect(() => {
    if (!mounted) return;
    let start = Date.now();
    const duration = 1500;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setAnimValue(normalizedTotal * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    const timer = setTimeout(animate, 600);
    return () => clearTimeout(timer);
  }, [mounted, normalizedTotal]);

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animValue / 100);

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-500",
        mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
      style={{ transitionDelay: "600ms" }}
    >
      <h3 className="mb-3 text-sm font-semibold">Уверенность</h3>
      <div className="flex items-center gap-4">
        <div className="relative h-28 w-28">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="confidenceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="70%" stopColor="#d1d5db" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#a3a3a3" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="url(#confidenceGradient)"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              fill="none"
              style={{ transition: "stroke-dashoffset 0.2s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold tabular-nums">{Math.round(animValue)}</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <MiniBar label="Громкость" value={Math.min(100, Math.max(0, components.volume_score))} delay={700} mounted={mounted} />
          <MiniBar label="Чистота речи" value={Math.min(100, Math.max(0, components.filler_score))} delay={800} mounted={mounted} />
          <MiniBar label="Взгляд" value={Math.min(100, Math.max(0, components.gaze_score))} delay={900} mounted={mounted} />
        </div>
      </div>
    </div>
  );
}

function MiniBar({
  label,
  value,
  delay,
  mounted,
}: {
  label: string;
  value: number;
  delay: number;
  mounted: boolean;
}) {
  const [animValue, setAnimValue] = useState(0);

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      let start = Date.now();
      const duration = 800;
      const animate = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        setAnimValue(value * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(animate);
      };
      animate();
    }, delay);
    return () => clearTimeout(timer);
  }, [mounted, value, delay]);

  return (
    <div>
      <div className="flex justify-between text-[10px] text-white/50">
        <span>{label}</span>
        <span>{Math.round(animValue)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/80"
          style={{ width: `${Math.min(100, Math.max(0, animValue))}%`, transition: "width 0.1s linear" }}
        />
      </div>
    </div>
  );
}

function InsightCard({
  title,
  content,
  delay,
  mounted,
  accent,
  className,
}: {
  title: string;
  content: string;
  delay: number;
  mounted: boolean;
  accent?: "red" | "amber";
  className?: string;
}) {
  const accentStyles = {
    red: "border-red-500/30 bg-red-500/10",
    amber: "border-amber-500/30 bg-amber-500/10",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-all duration-500",
        accent ? accentStyles[accent] : "border-white/10 bg-white/5",
        mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className
      )}
      style={{ transitionDelay: `${delay + 400}ms` }}
    >
      <h3 className={cn("text-sm font-semibold", accent === "amber" && "text-amber-200", accent === "red" && "text-red-300")}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{content}</p>
    </div>
  );
}

const globalStyles = (
  <style jsx global>{`
    .scroll-elegant::-webkit-scrollbar {
      width: 8px;
    }
    .scroll-elegant::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.04);
      border-radius: 999px;
    }
    .scroll-elegant::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.15));
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .scroll-elegant::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.25));
    }
    .scroll-elegant {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.35) rgba(255, 255, 255, 0.05);
    }
  `}</style>
);

