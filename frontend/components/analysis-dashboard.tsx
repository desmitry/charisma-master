"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { AnalysisResult, TempoPoint, TranscriptWord, LongPause } from "@/types/analysis";
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

const IconTarget = ({ className }: { className?: string }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" opacity="0.5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
);
const IconDoc = ({ className }: { className?: string }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v5h5" opacity="0.6" />
    <path d="M9 13h6M9 17h6" opacity="0.7" />
  </svg>
);
const IconBolt = ({ className }: { className?: string }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M13 2 6 13h5l-1 9 7-11h-5z" />
  </svg>
);
const IconClock = ({ className }: { className?: string }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6l4 2" />
  </svg>
);
const IconHand = ({ className }: { className?: string }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
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
    type TimelineItem = 
      | { type: "word"; word: TranscriptWord }
      | { type: "pause"; pause: LongPause };
    
    const groups: { label: string; items: TimelineItem[] }[] = [];
    const chunkSize = 30;
    const longPauses = result.long_pauses || [];
    
    // Collect all words
    const allWords: TimelineItem[] = result.transcript.flatMap((seg) => 
      seg.words.map((word) => ({ type: "word" as const, word }))
    );
    
    // Collect all pauses
    const allPauses: TimelineItem[] = longPauses.map((pause) => ({ 
      type: "pause" as const, 
      pause 
    }));
    
    // Combine and sort
    const timeline = [...allWords, ...allPauses].sort((a, b) => {
      const startA = a.type === "word" ? a.word.start : a.pause.start;
      const startB = b.type === "word" ? b.word.start : b.pause.start;
      return startA - startB;
    });
    
    // Group by time chunks
    timeline.forEach((item) => {
      const itemStart = item.type === "word" ? item.word.start : item.pause.start;
      const groupIdx = Math.floor(itemStart / chunkSize);
      const label = `${formatTime(groupIdx * chunkSize)} - ${formatTime((groupIdx + 1) * chunkSize)}`;
      
      if (!groups[groupIdx]) {
        groups[groupIdx] = { label, items: [] };
      }
      groups[groupIdx].items.push(item);
    });
    
    return groups.filter(Boolean);
  }, [result.transcript, result.long_pauses]);

  return (
    <div className="relative z-10 min-h-screen text-white overflow-x-hidden w-full max-w-[100vw] bg-transparent">
      <SmoothScroll />
      {/* We rely on the ColorBends background from the parent app/page.tsx */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-black/20 backdrop-blur-[2px]" />

      <header
        className={cn(
          "sticky top-0 z-40 border-b border-white/10 bg-black/40 shadow-[0_4px_30px_rgba(0,0,0,0.5)]",
          isEcoMode ? "backdrop-blur-md" : "backdrop-blur-2xl",
          isEcoMode ? "" : "transform transition-all duration-700",
          mounted ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
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

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 overflow-x-hidden">
        {/* Compact player + stats section */}
        <div
          className={cn(
            "flex flex-col lg:flex-row gap-4 lg:gap-6 items-start",
            "transform transition-all duration-700 delay-100",
            mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          )}
        >
          {/* Video player - compact, not full width */}
          <VideoPlayer
            ref={playerRef}
            src={videoSrc}
            error={videoError}
            onTimeUpdate={setCurrentTime}
            onError={setVideoError}
            compact
            className="mx-auto lg:mx-0"
          />

          {/* Stats panel - inline with player on desktop */}
          <div className="flex-1 w-full lg:w-auto">
            {/* Main confidence score - prominent */}
            <div
              className={cn(
                "group relative overflow-hidden rounded-[2rem] border mb-4 transition-all duration-500 hover:border-white/20 hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.05)] p-6 sm:p-8",
                isEcoMode ? "border-white/8 bg-black/60" : "border-white/10 bg-black/40 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-6 sm:gap-8">
                <div className="relative h-24 w-24 flex-shrink-0">
                  <svg className="h-full w-full -rotate-90 drop-shadow-[0_0_20px_rgba(255,199,0,0.4)]" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      stroke="#FFC700"
                      strokeWidth="6"
                      strokeDasharray={314}
                      strokeDashoffset={314 * (1 - Math.min(100, Math.max(0, result.confidence_index.total)) / 100)}
                      strokeLinecap="round"
                      fill="none"
                      style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold tabular-nums drop-shadow-lg">{Math.round(result.confidence_index.total)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-[0.2em] mb-1.5 shadow-sm">Общая оценка</p>
                  <p className="text-2xl sm:text-3xl font-medium tracking-tight mt-0.5 text-white/95">
                    {result.confidence_index.total >= 70 ? "Отлично" : result.confidence_index.total >= 50 ? "Хорошо" : "Нужно поработать"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 sm:gap-4">
              <QuickStat
                icon={<IconTarget className="w-5 h-5 text-emerald-400" />}
                label="Паразиты"
                value={`${(result.fillers_summary.ratio * 100).toFixed(1)}%`}
              />
              <QuickStat
                icon={<IconClock className="w-5 h-5 text-sky-400" />}
                label="Темп"
                value={`${Math.round(result.tempo.reduce((sum, p) => sum + p.wpm, 0) / result.tempo.length)} wpm`}
              />
              {result.slide_analysis?.has_slides !== false && (
                <QuickStat
                  icon={<IconDoc className="w-5 h-5 text-amber-400" />}
                  label="Слайды"
                  value={`${Math.round(result.slide_analysis?.text_density_score ?? result.slide_text_density ?? 0)}%`}
                />
              )}
              <QuickStat
                icon={<IconHand className="w-5 h-5 text-rose-400" />}
                label="Фрагментов"
                value={result.transcript.length.toString()}
              />
            </div>
          </div>
        </div>

        {/* Tabs - Glass Pill */}
        <div
          className={cn(
            "mt-8 flex gap-1 p-1.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-2xl w-fit shadow-xl",
            mounted ? "opacity-100" : "opacity-0"
          )}
        >
          <button
            onClick={() => setActiveTab("transcript")}
            className={cn(
              "px-6 py-2.5 text-sm rounded-full transition-all duration-300 font-medium",
              activeTab === "transcript"
                ? "bg-white text-black shadow-md scale-100"
                : "text-white/60 hover:text-white/90 hover:bg-white/5 scale-95"
            )}
          >
            Транскрипт
          </button>
          <button
            onClick={() => setActiveTab("insights")}
            className={cn(
              "px-6 py-2.5 text-sm rounded-full transition-all duration-300 font-medium",
              activeTab === "insights"
                ? "bg-white text-black shadow-md scale-100"
                : "text-white/60 hover:text-white/90 hover:bg-white/5 scale-95"
            )}
          >
            Инсайты
          </button>
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === "transcript" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
              {/* Transcript Panel - fluid design */}
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl p-6 shadow-xl w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  {/* Subtle hint */}
                  <div className="flex items-center gap-2 mb-5 text-white/40 bg-white/5 w-fit px-3 py-1.5 rounded-full border border-white/5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 16v-4M12 8h.01"/>
                    </svg>
                    <span className="text-[11px] uppercase tracking-wider font-medium">Нажми на слово чтобы перемотать видео</span>
                  </div>

                  {/* Transcript content */}
                  <div
                    className="max-h-[440px] overflow-y-auto pr-4 -mr-4 transcript-scroll relative"
                    data-lenis-prevent
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                  {groupedTranscript.map((group, gi) => (
                    <div key={gi} className="relative mb-6 last:mb-0">
                      {/* Time marker - subtle line */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[11px] font-mono text-white/30 tabular-nums">
                          {group.label.split(" - ")[0]}
                        </span>
                        <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                      </div>

                      {/* Words - flowing text */}
                      <div className="leading-relaxed text-[15px]">
                        {group.items.map((item, idx) => {
                          if (item.type === "pause") {
                            const isActive = currentTime + 0.02 >= item.pause.start && currentTime < item.pause.end - 0.02;
                            return (
                              <span
                                key={`pause-${item.pause.start}-${idx}`}
                                onClick={() => {
                                  if (playerRef.current) {
                                    playerRef.current.seek(item.pause.start);
                                    playerRef.current.play();
                                    setCurrentTime(item.pause.start);
                                  }
                                }}
                                className="inline-flex items-center cursor-pointer mx-1 align-middle group"
                              >
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all",
                                    isActive
                                      ? "bg-rose-500/20 text-rose-300"
                                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                                  )}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M10 12h4M12 10v4"/>
                                  </svg>
                                  {item.pause.duration.toFixed(1)}с
                                </span>
                              </span>
                            );
                          }

                          const isActive = currentTime + 0.02 >= item.word.start && currentTime < item.word.end - 0.02;
                          const display = item.word.text.trim();
                          if (!display) return null;

                          return (
                            <span
                              key={`${item.word.start}-${display}-${idx}`}
                              onClick={() => handleWordClick(item.word)}
                              className={cn(
                                "cursor-pointer transition-all duration-150 rounded px-0.5",
                                item.word.is_filler
                                  ? "text-rose-400/90 hover:text-rose-300"
                                  : "text-white/80 hover:text-white",
                                isActive && "bg-sky-500/25 text-white font-medium",
                                "relative"
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

                {/* Fade gradient at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none rounded-b-3xl" />
                </div>
              </div>

              {/* Right side charts */}
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
                    ? (result.mistakes as string[]).join("\n") 
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
              {result.confidence_index.components.gesture_advice && (
                <InsightCard
                  title="Советы по жестикуляции"
                  content={result.confidence_index.components.gesture_advice}
                  delay={500}
                  mounted={mounted}
                  accent="amber"
                />
              )}
              {result.slide_analysis && (
                <InsightCard
                  title="Анализ слайдов"
                  content={
                    result.slide_analysis.has_slides === false 
                      ? "Слайды не найдены в видео"
                      : result.slide_analysis.ocr_summary || "Анализ слайдов недоступен"
                  }
                  delay={600}
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

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="group relative flex flex-col gap-2 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl p-5 transition-all duration-500 hover:border-white/20 hover:bg-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(255,255,255,0.05)]">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-3xl" />
      <div className="flex items-center gap-4 relative z-10 w-full overflow-hidden">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 shadow-inner border border-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:bg-white/10">
          <span className="drop-shadow-md">{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-white/40 tracking-widest uppercase truncate">{label}</p>
          <p className="text-[22px] font-medium tabular-nums tracking-tight mt-0.5 text-white drop-shadow-sm">{value}</p>
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
        "relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl p-6 transition-all duration-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(255,255,255,0.05)] hover:border-white/20",
        mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
      style={{ transitionDelay: "500ms" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-white/90">Темп речи</h3>
            <p className="text-[11px] text-white/50 tracking-wide uppercase">Гладкая линия</p>
          </div>
          <span className="text-xs font-medium text-white/60 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 drop-shadow-sm">max {maxWpm.toFixed(0)} wpm</span>
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

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animValue / 100);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-500 hover:border-white/20">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="relative z-10">
        <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-5">Детали уверенности</h3>
        <div className="flex items-center gap-5">
          <div className="relative h-20 w-20 flex-shrink-0 drop-shadow-[0_0_15px_rgba(255,199,0,0.3)]">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#FFC700"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="none"
                style={{ transition: "stroke-dashoffset 0.2s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold tabular-nums drop-shadow-md">{Math.round(animValue)}</span>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <MiniBar label="Громкость" value={Math.min(100, Math.max(0, components.volume_score))} delay={700} mounted={mounted} />
            <MiniBar label="Чистота речи" value={Math.min(100, Math.max(0, components.filler_score))} delay={800} mounted={mounted} />
            <MiniBar label="Взгляд" value={Math.min(100, Math.max(0, components.gaze_score))} delay={900} mounted={mounted} />
          </div>
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
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-white/40">{label}</span>
        <span className="text-white/70 tabular-nums">{Math.round(animValue)}</span>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-white/30 transition-all duration-100"
          style={{ width: `${Math.min(100, Math.max(0, animValue))}%` }}
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
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border transition-all duration-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(255,255,255,0.05)]",
        accent === "red" ? "border-rose-500/20 bg-black/40 backdrop-blur-2xl hover:border-rose-500/40" : 
        accent === "amber" ? "border-amber-500/20 bg-black/40 backdrop-blur-2xl hover:border-amber-500/40" : 
        "border-white/10 bg-black/40 backdrop-blur-2xl hover:border-white/30",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="relative z-10 p-6">
        {/* Accent line */}
        {accent && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1",
              accent === "red" && "bg-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.5)]",
              accent === "amber" && "bg-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
            )}
          />
        )}

        <h3
          className={cn(
            "text-base font-semibold mb-3 tracking-tight drop-shadow-sm",
            accent === "amber" && "text-amber-200/90",
            accent === "red" && "text-rose-300/90",
            !accent && "text-white"
          )}
        >
          {title}
        </h3>
        <p className="text-[14px] leading-relaxed text-white/70 whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

const globalStyles = (
  <style jsx global>{`
    .transcript-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
    }
    .transcript-scroll::-webkit-scrollbar {
      width: 4px;
    }
    .transcript-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .transcript-scroll::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }
    .transcript-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.25);
    }
  `}</style>
);

