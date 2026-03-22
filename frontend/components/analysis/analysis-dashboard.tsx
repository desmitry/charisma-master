"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { AnalysisResult, TranscriptWord, LongPause } from "@/types/analysis";
import { resolveVideoUrl } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { TempoChart } from "@/components/analysis/tempo-chart";
import { ComingSoonNotification } from "@/components/shared/coming-soon-notification";
import { PdfExportDropdown } from "@/components/shared/pdf-export-modal";
import { VideoPlayer, VideoPlayerRef } from "@/components/shared/video-player";
import { IconTarget, IconClock, IconHand, IconBolt } from "@/components/ui/icons";

type Props = {
  result: AnalysisResult;
  onBack?: () => void;
};

// Animation Variants
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const fadeUpAnim: any = {
  hidden: { opacity: 0, y: 30, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

const fadeInAnim: any = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }
};

export function AnalysisDashboard({ result, onBack }: Props) {
  const playerRef = useRef<VideoPlayerRef>(null);
  const tempoChartRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoSrc, setVideoSrc] = useState(() => resolveVideoUrl(result.video_path));
  const [videoError, setVideoError] = useState<string | null>(null);

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
    if (!tempoModal.open) return;
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

  const handleWordClick = (word: TranscriptWord) => {
    if (!playerRef.current) return;
    playerRef.current.seek(word.start);
    playerRef.current.play();
    setCurrentTime(word.start);
  };

  // Compute filler words
  const fillerWordsList = useMemo(() => {
    const map = new Map<string, number>();
    result.transcript.forEach(seg => {
      seg.words.forEach(w => {
        if (w.is_filler) {
          const text = w.text.trim().toLowerCase();
          if (text) map.set(text, (map.get(text) || 0) + 1);
        }
      });
    });
    if (result.dynamic_fillers) {
      result.dynamic_fillers.forEach(f => {
        const text = f.trim().toLowerCase();
        if (text && !map.has(text)) map.set(text, 0);
      });
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [result.transcript, result.dynamic_fillers]);

  const groupedTranscript = useMemo(() => {
    type TimelineItem = { type: "word"; word: TranscriptWord } | { type: "pause"; pause: LongPause };
    const groups: { label: string; items: TimelineItem[] }[] = [];
    const chunkSize = 30;
    const longPauses = result.long_pauses || [];
    const allWords: TimelineItem[] = result.transcript.flatMap(seg => seg.words.map(word => ({ type: "word", word })));
    const allPauses: TimelineItem[] = longPauses.map(pause => ({ type: "pause", pause }));
    
    const timeline = [...allWords, ...allPauses].sort((a, b) => {
      const startA = a.type === "word" ? a.word.start : a.pause.start;
      const startB = b.type === "word" ? b.word.start : b.pause.start;
      return startA - startB;
    });

    timeline.forEach((item) => {
      const itemStart = item.type === "word" ? item.word.start : item.pause.start;
      const groupIdx = Math.floor(itemStart / chunkSize);
      const label = `${formatTime(groupIdx * chunkSize)} - ${formatTime((groupIdx + 1) * chunkSize)}`;
      if (!groups[groupIdx]) groups[groupIdx] = { label, items: [] };
      groups[groupIdx].items.push(item);
    });
    return groups.filter(Boolean);
  }, [result.transcript, result.long_pauses]);

  const criteriaPercentage = result.standard_criteria_max && result.standard_criteria_max > 0
    ? Math.round((result.standard_criteria_result ?? 0) / result.standard_criteria_max * 100)
    : null;

  return (
    <div className="relative z-10 min-h-screen text-white w-full max-w-[100vw] bg-[#0A0A0A] selection:bg-white/20">
      <SmoothScroll />

      {/* Extreme Minimal Header */}
      <motion.header 
        initial="hidden" animate="show" variants={fadeInAnim}
        className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0A0A0A]/80 backdrop-blur-md"
      >
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-white/40 font-mono text-xs uppercase tracking-widest hidden sm:inline-block border border-white/10 rounded px-2 py-1">v0</span>
              <h1 className="text-[15px] font-medium tracking-tight text-white/90">Разбор выступления</h1>
            </div>
            {(result.analyze_provider || result.analyze_model) && (
              <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-[#111] border border-white/5">
                {result.analyze_provider && <img src={`/icons/${result.analyze_provider}.svg`} alt="" className="w-3.5 h-3.5 opacity-60" />}
                <span className="text-[11px] font-mono text-white/50">
                  {result.analyze_provider && result.analyze_model ? `${result.analyze_provider}/${result.analyze_model}` : result.analyze_provider || result.analyze_model}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                ref={pdfButtonRef}
                onClick={() => setShowPdfDropdown(!showPdfDropdown)}
                className="rounded-md border border-white/[0.08] bg-[#111] hover:bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors"
              >
                Экспорт PDF
              </button>
              <PdfExportDropdown isOpen={showPdfDropdown} onClose={() => setShowPdfDropdown(false)} result={result} buttonRef={pdfButtonRef} />
            </div>

            {onBack && (
              <button
                onClick={onBack}
                className="rounded-md border border-transparent hover:bg-white/5 px-4 py-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors"
              >
                Назад
              </button>
            )}
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-[1600px] px-6 py-6 pb-24">
        <motion.div 
          variants={staggerContainer} 
          initial="hidden" 
          animate="show"
          className="flex flex-col gap-6"
        >
          {/* HERO SECTION - MASSIVE VIDEO */}
          <motion.div variants={fadeUpAnim} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            
            {/* Primary Video Canvas */}
            <div className="relative rounded-xl border border-white/[0.08] bg-black overflow-hidden aspect-video flex-grow shadow-[0_0_40px_rgba(0,0,0,0.5)] flex justify-center items-center">
              <VideoPlayer
                ref={playerRef}
                src={videoSrc}
                error={videoError}
                onTimeUpdate={setCurrentTime}
                onError={setVideoError}
                fullWidth={true}
                className="w-full h-full border-none shadow-none rounded-none"
              />
            </div>

            {/* Top Level Summary Stats beside Video */}
            <div className="flex flex-col gap-3 min-w-[320px]">
              {/* Total Score Card */}
              <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none translate-x-4 -translate-y-4">
                  <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">Общая оценка</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-7xl font-semibold tracking-tighter text-white drop-shadow-md">
                      {Math.round(result.confidence_index.total)}
                    </span>
                    <span className="text-white/20 text-2xl font-light">/ 100</span>
                  </div>
                  <div className="mt-5 flex items-center gap-2.5">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      result.confidence_index.total >= 70 ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" : 
                      result.confidence_index.total >= 50 ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]" : 
                      "bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.8)]"
                    )} />
                    <span className={cn(
                      "text-sm font-medium tracking-wide",
                      result.confidence_index.total >= 70 ? "text-emerald-400" : 
                      result.confidence_index.total >= 50 ? "text-amber-400" : 
                      "text-rose-400"
                    )}>
                      {result.confidence_index.total >= 70 ? "Отличный результат" : result.confidence_index.total >= 50 ? "Хороший результат" : "Требует доработки"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Minimal Quick Stats Stack */}
              <div className="flex flex-col gap-3 mt-1">
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                      <IconTarget className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-0.5">Слова-паразиты</div>
                      <div className="text-xl font-semibold text-white tracking-tight">{Number(result.fillers_summary.ratio * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
                
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-500/10 text-sky-400 group-hover:scale-110 transition-transform">
                      <IconClock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-0.5">Темп речи</div>
                      <div className="text-xl font-semibold text-white tracking-tight">{Math.round(result.tempo.reduce((sum, p) => sum + p.wpm, 0) / result.tempo.length)} <span className="text-white/30 text-[12px] font-normal uppercase tracking-widest">wpm</span></div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform">
                      <IconHand className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-0.5">Фрагменты речи</div>
                      <div className="text-xl font-semibold text-white tracking-tight">{result.transcript.length}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* MAIN CONTENT GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">
            
            {/* LEFT COLUMN: Transcript & Content Texts */}
            <div className="flex flex-col gap-6">
              
              {/* Transcript Block */}
              <motion.div variants={fadeUpAnim} className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between bg-[#141414]">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-white/50">Субтитры</h3>
                  <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-mono">
                    <IconBolt className="w-3 h-3" />
                    <span>Нажмите на слово для перемотки</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="max-h-[400px] overflow-y-auto pr-4 -mr-4 transcript-scroll" data-lenis-prevent onWheel={e => e.stopPropagation()}>
                    {groupedTranscript.map((group, gi) => (
                      <div key={gi} className="mb-6 last:mb-0">
                        <div className="text-[10px] font-mono text-white/20 mb-3">{group.label}</div>
                        <div className="text-[14.5px] leading-[1.8] text-white/70">
                          {group.items.map((item, idx) => {
                            if (item.type === "pause") {
                              const isActive = currentTime + 0.02 >= item.pause.start && currentTime < item.pause.end - 0.02;
                              return (
                                <span
                                  key={`pause-${item.pause.start}-${idx}`}
                                  onClick={() => {
                                    if (playerRef.current) { playerRef.current.seek(item.pause.start); playerRef.current.play(); setCurrentTime(item.pause.start); }
                                  }}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer mx-1 transition-colors",
                                    isActive ? "bg-rose-500/20 text-rose-300" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/80"
                                  )}
                                >
                                  {(item.pause.duration).toFixed(1)}s pause
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
                                  "cursor-pointer rounded px-0.5 transition-colors",
                                  item.word.is_filler ? "text-rose-400/80 hover:text-rose-300 border-b border-rose-500/20" : "hover:text-white",
                                  isActive && "bg-white/10 text-white"
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
              </motion.div>

              {/* Ideal Text */}
              <motion.div variants={fadeUpAnim} className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.04] bg-[#141414]">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-white/50">Идеальный текст</h3>
                </div>
                <div className="p-6 max-h-[300px] overflow-y-auto transcript-scroll" data-lenis-prevent onWheel={e => e.stopPropagation()}>
                  <p className="text-[14px] leading-relaxed text-white/70 whitespace-pre-line">{result.ideal_text}</p>
                </div>
              </motion.div>

              {/* Persona Feedback */}
              {result.persona_feedback && (
                <motion.div variants={fadeUpAnim} className="rounded-xl border border-amber-500/20 bg-[#111] overflow-hidden">
                  <div className="px-6 py-4 border-b border-amber-500/10 bg-amber-500/[0.02]">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-amber-500/60">Фидбек от эксперта</h3>
                  </div>
                  <div className="p-6 max-h-[300px] overflow-y-auto transcript-scroll" data-lenis-prevent onWheel={e => e.stopPropagation()}>
                    <p className="text-[14px] leading-relaxed text-amber-500/80 whitespace-pre-line">{result.persona_feedback}</p>
                  </div>
                </motion.div>
              )}

              {/* Parasite words list */}
              {fillerWordsList.length > 0 && (
                <motion.div variants={fadeUpAnim} className="rounded-xl border border-rose-500/20 bg-[#111] overflow-hidden">
                  <div className="px-6 py-4 border-b border-rose-500/10 bg-rose-500/[0.02] flex items-center justify-between">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-rose-500/60">Слова-паразиты</h3>
                    <span className="text-[10px] font-mono text-rose-500/40 border border-rose-500/20 px-2 py-0.5 rounded">{result.fillers_summary.count} total</span>
                  </div>
                  <div className="p-6 flex flex-wrap gap-2">
                    {fillerWordsList.map(([word, count]) => (
                      <span key={word} className="inline-flex items-center gap-2 rounded bg-rose-500/10 border border-rose-500/20 px-2 py-1 text-xs text-rose-300">
                        {word}
                        {count > 0 && <span className="opacity-50 text-[10px] font-mono">{count}</span>}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}

            </div>

            {/* RIGHT COLUMN: Criteria Table & Other Insights */}
            <div className="flex flex-col gap-6">

              {/* Strict Data Table for Criteria */}
              {result.standard_criteria_scores && result.standard_criteria_scores.length > 0 && (
                <motion.div variants={fadeUpAnim} className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-white/[0.04] bg-[#141414]">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-white/50">Соответствие стандарту</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.04]">
                          <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-white/30 font-normal">Критерий</th>
                          <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-white/30 font-normal text-right">Балл</th>
                          <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-white/30 font-normal">Анализ ИИ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {result.standard_criteria_scores.map((c, i) => {
                           const pct = c.criterion_max_value > 0 ? (c.criterion_current_value / c.criterion_max_value) * 100 : 0;
                           return (
                             <tr key={i} className="hover:bg-white/[0.01] transition-colors group">
                               <td className="px-4 py-4 align-top w-1/3">
                                 <div className="text-[13px] text-white/90 font-medium mb-1">{c.criterion_name}</div>
                                 <div className="text-[11px] text-white/40 leading-relaxed">{c.criterion_description}</div>
                               </td>
                               <td className="px-4 py-4 align-top w-[90px] text-right">
                                 <div className="text-[14px] font-mono text-white/90">
                                   {c.criterion_current_value}<span className="text-white/30">/{c.criterion_max_value}</span>
                                 </div>
                                 <div className="mt-2 w-full h-[3px] bg-white/10 rounded-full overflow-hidden flex">
                                   <div 
                                      className={cn("h-full rounded-full transition-all duration-1000", pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-rose-400")}
                                      style={{ width: `${pct}%` }}
                                    />
                                 </div>
                               </td>
                               <td className="px-4 py-4 align-top">
                                 <div className="text-[12px] leading-relaxed text-white/60">
                                   {c.criterion_feetback}
                                 </div>
                               </td>
                             </tr>
                           );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Summary Footer */}
                  <div className="px-6 py-4 border-t border-white/[0.04] bg-[#141414] flex justify-between items-center">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Итоговый результат</span>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-mono text-white">
                        {result.standard_criteria_result ?? 0}<span className="text-white/30 text-sm"> / {result.standard_criteria_max ?? 0}</span>
                      </span>
                      {criteriaPercentage !== null && (
                        <span className={cn(
                          "text-[11px] font-mono px-2 py-0.5 rounded border",
                          criteriaPercentage >= 70 ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10" : 
                          criteriaPercentage >= 40 ? "text-amber-400 border-amber-400/20 bg-amber-400/10" : 
                          "text-rose-400 border-rose-400/20 bg-rose-400/10"
                        )}>
                          {criteriaPercentage}%
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tempo Chart Minimalist Card */}
              <motion.div variants={fadeUpAnim} className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden p-6" ref={tempoChartRef}>
                 <TempoChart data={result.tempo} currentTime={currentTime} onExpand={openTempoModal} />
              </motion.div>

              {/* Presentation Summary Minimalist Card */}
              {result.presentation_summary && (
                <motion.div variants={fadeUpAnim} className="rounded-xl border border-sky-500/20 bg-[#111] overflow-hidden">
                  <div className="px-6 py-4 border-b border-sky-500/10 bg-sky-500/[0.02]">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-sky-500/60">Резюме слайдов</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-[13px] leading-relaxed text-sky-500/80 whitespace-pre-line">{result.presentation_summary}</p>
                  </div>
                </motion.div>
              )}

              {/* Summary Map Structure Minimalist Card */}
              <motion.div variants={fadeUpAnim} className="grid grid-cols-1 gap-6">
                <div className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/[0.04] bg-[#141414]">
                     <h3 className="text-xs font-mono uppercase tracking-widest text-white/50">Краткое содержание</h3>
                  </div>
                  <div className="p-6 text-[13px] leading-relaxed text-white/60 whitespace-pre-line px-6 py-5">
                    {result.summary}
                  </div>
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-[#111] overflow-hidden">
                  <div className="px-6 py-4 border-b border-rose-500/10 bg-rose-500/[0.02]">
                     <h3 className="text-xs font-mono uppercase tracking-widest text-rose-500/60">Ключевые ошибки</h3>
                  </div>
                  <div className="p-6 text-[13px] leading-relaxed text-rose-400/80 whitespace-pre-line">
                    {typeof result.mistakes === "string" ? result.mistakes : Array.isArray(result.mistakes) ? (result.mistakes as string[]).join("\n") : String(result.mistakes || "")}
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </motion.div>
      </main>

      {tempoModal.open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999]"
          style={{
            backgroundColor: tempoModal.phase === "open" ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0)",
            backdropFilter: tempoModal.phase === "open" ? "blur(8px)" : "blur(0px)",
            transition: "all 300ms ease",
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
            
            return (
              <div
                className={cn("border border-white/10 overflow-hidden flex flex-col", isExpanded ? "bg-[#0A0A0C] shadow-2xl rounded-2xl" : "bg-transparent")}
                style={{
                  position: "fixed",
                  left: isExpanded ? finalLeft : startLeft,
                  top: isExpanded ? finalTop : startTop,
                  width: isExpanded ? finalWidth : startWidth,
                  height: isExpanded ? finalHeight : startHeight,
                  transition: "all 400ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {isExpanded && (
                  <div className="flex items-center justify-between text-white px-5 pt-4 pb-2">
                    <div className="text-[12px] font-mono uppercase tracking-widest text-white/50">Темп речи</div>
                    <button onClick={closeTempoModal} className="text-[10px] font-mono text-white/40 hover:text-white px-2 py-1 uppercase tracking-widest">✕ Закрыть</button>
                  </div>
                )}
                <div className={isExpanded ? "flex-1 px-4 pb-4 overflow-hidden" : "h-full"}>
                  <TempoChart data={result.tempo} currentTime={currentTime} expanded={isExpanded} inModal={true} />
                </div>
              </div>
            );
          })()}
        </div>,
        document.body
      )}

      {globalStyles}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const globalStyles = (
  <style jsx global>{`
    .transcript-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
    }
    .transcript-scroll::-webkit-scrollbar { width: 4px; }
    .transcript-scroll::-webkit-scrollbar-track { background: transparent; }
    .transcript-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
    .transcript-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
  `}</style>
);
