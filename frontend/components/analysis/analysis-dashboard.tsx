"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisResult, TranscriptWord, LongPause } from "@/types/analysis";
import { resolveVideoUrl } from "@/lib/api";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { TempoChart } from "@/components/analysis/tempo-chart";
import { PdfExportDropdown } from "@/components/shared/pdf-export-modal";
import { VideoPlayer, VideoPlayerRef } from "@/components/shared/video-player";
import { IconBolt } from "@/components/ui/icons";
import { ActivityRingsCard } from "@/components/analysis/activity-rings-card";
import { StandardCriteriaTable } from "@/components/analysis/standard-criteria-table";

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

  useEffect(() => {
    const newSrc = resolveVideoUrl(result.video_path);
    setVideoSrc(newSrc);
    setVideoError(null);
  }, [result.video_path]);



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

 

  return (
    <div className="relative z-10 min-h-screen text-white w-full max-w-[100vw] bg-[#0A0A0A] selection:bg-white/20">

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
            <PdfExportDropdown result={result} />

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

            {/* Apple Health Activity Rings Style Score Block */}
            <ActivityRingsCard result={result} />
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
                  <div className="max-h-[400px] overflow-y-auto pr-4 -mr-4 transcript-scroll">
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
                <div className="p-6 max-h-[300px] overflow-y-auto transcript-scroll">
                  <p className="text-[14px] leading-relaxed text-white/70 whitespace-pre-line">{result.ideal_text}</p>
                </div>
              </motion.div>

              {/* Persona Feedback */}
              {result.persona_feedback && (
                <motion.div variants={fadeUpAnim} className="rounded-xl border border-amber-500/20 bg-[#111] overflow-hidden">
                  <div className="px-6 py-4 border-b border-amber-500/10 bg-amber-500/[0.02]">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-amber-500/60">Фидбек от эксперта</h3>
                  </div>
                  <div className="p-6 max-h-[300px] overflow-y-auto transcript-scroll">
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

              {/* Criteria Table */}
              <StandardCriteriaTable
                scores={result.standard_criteria_scores}
                max={result.standard_criteria_max}
                resultVal={result.standard_criteria_result}
              />

              <motion.div variants={fadeUpAnim} className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden p-6" ref={tempoChartRef}>
                <TempoChart data={result.tempo} currentTime={currentTime} />
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
