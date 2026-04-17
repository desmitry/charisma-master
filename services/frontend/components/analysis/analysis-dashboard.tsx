"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisResult, TranscriptWord, LongPause } from "@/types/analysis";
import { resolveVideoUrl } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ListTree, AlertTriangle, Wand2, User, Presentation, Link as LinkIcon } from "lucide-react";

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

type DashboardTab = "overview" | "ai-report" | "criteria-report";

// ─── animations ──────────────────────────────────────────────────────────────
const fadeUp: any = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 26 } },
};

const stagger: any = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const accordionContent: any = {
  hidden: { height: 0, opacity: 0 },
  show: { height: "auto", opacity: 1, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.24, ease: [0.4, 0, 0.2, 1] } },
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ScoreRing({ value, max, size = 56 }: { value: number; max: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;
  const dash = circ * (1 - pct);
  const color = pct >= 0.7 ? "#a3a3a3" : pct >= 0.4 ? "#737373" : "#404040";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ rotate: "-90deg" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={dash}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

// ─── Accordion block ──────────────────────────────────────────────────────────
function Accordion({
  title,
  badge,
  accent,
  defaultOpen = false,
  children,
  icon,
  className,
}: {
  title: string;
  badge?: React.ReactNode;
  accent?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div variants={fadeUp} className={cn("rounded-2xl border overflow-hidden flex flex-col", className, accent ?? "border-white/[0.07] bg-[#0f0f0f]")}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && <span className="flex-shrink-0 opacity-50">{icon}</span>}
          <span className="text-[13px] font-medium text-white/80 truncate">{title}</span>
          {badge && <span className="flex-shrink-0">{badge}</span>}
        </div>
        <ChevronIcon open={open} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial="hidden"
            animate="show"
            exit="exit"
            variants={accordionContent}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      className={cn("flex-shrink-0 text-white/30 transition-transform duration-300", open ? "rotate-180" : "rotate-0")}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Tab nav ─────────────────────────────────────────────────────────────────
const tabConfig: { id: DashboardTab; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "ai-report", label: "ИИ-отчёт" },
  { id: "criteria-report", label: "Критерии" },
];

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight text-white">{value}</span>
        {sub && <span className="text-xs text-white/40">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Confidence bar ───────────────────────────────────────────────────────────
function ConfidenceBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className="h-full rounded-full bg-white/40"
        style={{ width: `${pct}%`, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AnalysisDashboard({ result, onBack }: Props) {
  const playerRef = useRef<VideoPlayerRef>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoSrc, setVideoSrc] = useState(() => result.video_path ? resolveVideoUrl(result.video_path) : "");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  const hasVideo = !!result.video_path;
  const needVideoAnalysis = result.user_need_video_analysis;
  const needTranscript = result.user_need_text_from_video;

  const speechReport = result.speech_report;
  const evaluationReport = result.evaluation_criteria_report;
  const confidence = result.confidence_index;

  useEffect(() => {
    if (!result.video_path) return;
    const nextSrc = resolveVideoUrl(result.video_path);
    setVideoSrc(nextSrc);
    setVideoError(null);
  }, [result.video_path]);

  const handleWordClick = (word: TranscriptWord) => {
    if (!playerRef.current) return;
    playerRef.current.seek(word.start);
    playerRef.current.play();
    setCurrentTime(word.start);
  };

  const fillerWordsList = useMemo(() => {
    const counts = new Map<string, number>();
    result.transcript.forEach((segment) => {
      segment.words.forEach((word) => {
        if (!word.is_filler) return;
        const text = word.text.trim().toLowerCase();
        if (!text) return;
        counts.set(text, (counts.get(text) || 0) + 1);
      });
    });
    speechReport.dynamic_fillers.forEach((word) => {
      const text = word.trim().toLowerCase();
      if (!text) return;
      counts.set(text, (counts.get(text) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [result.transcript, speechReport.dynamic_fillers]);

  const groupedTranscript = useMemo(() => {
    type TimelineItem = { type: "word"; word: TranscriptWord } | { type: "pause"; pause: LongPause };
    const groups: { label: string; items: TimelineItem[] }[] = [];
    const chunkSize = 30;
    const allWords: TimelineItem[] = result.transcript.flatMap((s) =>
      s.words.map((word) => ({ type: "word" as const, word }))
    );
    const allPauses: TimelineItem[] = result.long_pauses.map((pause) => ({ type: "pause" as const, pause }));
    const timeline = [...allWords, ...allPauses].sort((a, b) => {
      const sA = a.type === "word" ? a.word.start : a.pause.start;
      const sB = b.type === "word" ? b.word.start : b.pause.start;
      return sA - sB;
    });
    timeline.forEach((item) => {
      const t = item.type === "word" ? item.word.start : item.pause.start;
      const idx = Math.floor(t / chunkSize);
      const label = `${formatTime(idx * chunkSize)} – ${formatTime((idx + 1) * chunkSize)}`;
      if (!groups[idx]) groups[idx] = { label, items: [] };
      groups[idx].items.push(item);
    });
    return groups.filter(Boolean);
  }, [result.transcript, result.long_pauses]);

  const criteriaPercent =
    evaluationReport.max_score > 0
      ? Math.round((evaluationReport.total_score / evaluationReport.max_score) * 100)
      : 0;

  const confidenceDetails = [
    ...(needVideoAnalysis ? [
      { key: "Громкость", score: confidence.components.volume_score, label: confidence.components.volume_label, extra: confidence.components.volume_level },
    ] : []),
    ...(needTranscript ? [
      { key: "Паразиты", score: confidence.components.filler_score, label: confidence.components.filler_label, extra: `${result.fillers_summary.count} шт. · ${(result.fillers_summary.ratio * 100).toFixed(1)}%` },
    ] : []),
    ...(needVideoAnalysis ? [
      { key: "Взгляд", score: confidence.components.gaze_score, label: confidence.components.gaze_label },
      { key: "Жесты", score: confidence.components.gesture_score, label: confidence.components.gesture_label, extra: confidence.components.gesture_advice },
      { key: "Интонация", score: confidence.components.tone_score, label: confidence.components.tone_label },
    ] : []),
  ];

  const aiCards = [
    { title: "Краткое резюме", text: speechReport.summary, icon: <FileText className="w-4 h-4 text-emerald-400" /> },
    { title: "Структура", text: speechReport.structure, icon: <ListTree className="w-4 h-4 text-amber-400" /> },
    { title: "Ошибки", text: speechReport.mistakes, icon: <AlertTriangle className="w-4 h-4 text-rose-400" /> },
    { title: "Идеальный текст", text: speechReport.ideal_text, icon: <Wand2 className="w-4 h-4 text-fuchsia-400" /> },
    { title: "Фидбэк персоны", text: speechReport.persona_feedback, icon: <User className="w-4 h-4 text-blue-400" /> },
    { title: "Фидбэк по презентации", text: speechReport.presentation_feedback, icon: <Presentation className="w-4 h-4 text-indigo-400" /> },
    ...(speechReport.useful_links.length > 0 ? [{ title: "Полезные ссылки", text: speechReport.useful_links.join("\n"), icon: <LinkIcon className="w-4 h-4 text-zinc-400" /> }] : []),
  ];

  const metadataChips = [
    { label: "Provider", value: result.analyze_provider },
    { label: "Model", value: result.analyze_model },
    { label: "Transcribe", value: result.transcribe_model },
  ].filter((c) => c.value);

  // avg wpm
  const avgWpm = needTranscript && result.tempo.length
    ? Math.round(result.tempo.reduce((s, p) => s + p.wpm, 0) / result.tempo.length)
    : 0;

  // dynamic stat pills
  const statPills = [
    ...(needVideoAnalysis ? [{ label: "Индекс уверенности", value: Math.round(confidence.total), sub: confidence.total_label }] : []),
    ...(needTranscript ? [
      { label: "Паразиты", value: result.fillers_summary.count, sub: `${(result.fillers_summary.ratio * 100).toFixed(1)}%` },
      { label: "Темп речи", value: avgWpm, sub: "WPM" },
    ] : []),
    { label: "Критерии ИИ", value: `${criteriaPercent}%`, sub: `${evaluationReport.total_score}/${evaluationReport.max_score}` },
  ];

  // columns for overview two-col layout
  const hasLeftCol = needTranscript;
  const hasRightCol = needTranscript || needVideoAnalysis || evaluationReport.criteria.length > 0;

  return (
    <div className="relative min-h-screen bg-[#080808] text-white w-full selection:bg-white/10" style={{ overscrollBehavior: "none" }}>
      {/* ── header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-3.5 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="text-[14px] font-semibold text-white/90 truncate">Разбор выступления</h1>
              {metadataChips.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                  {metadataChips.map((c) => (
                    <span key={c.label} className="text-[10px] font-mono text-white/30 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                      {c.label}: {c.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PdfExportDropdown result={result} />
            {onBack && (
              <button
                onClick={onBack}
                className="text-xs text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 rounded-lg border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]"
              >
                Назад
              </button>
            )}
          </div>
        </div>

        {/* tab bar */}
        <div className="border-t border-white/[0.04] mx-auto max-w-[1280px] px-5">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
            {tabConfig.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative px-4 py-2.5 text-sm transition-colors",
                  activeTab === tab.id
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-px bg-white/70"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── main ────────────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1280px] px-5 py-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div key="overview" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0 }} className="flex flex-col gap-4">

              {/* video + rings */}
              <motion.div variants={fadeUp} className={cn("grid gap-4", hasVideo ? "grid-cols-1 lg:grid-cols-[1fr_300px]" : "grid-cols-1")}>
                {hasVideo && (
                  <div className="rounded-2xl border border-white/[0.06] bg-black overflow-hidden aspect-video flex items-center justify-center">
                    <VideoPlayer
                      ref={playerRef}
                      src={videoSrc}
                      error={videoError}
                      onTimeUpdate={setCurrentTime}
                      onError={setVideoError}
                      fullWidth
                      className="w-full h-full border-none shadow-none rounded-none"
                    />
                  </div>
                )}
                <ActivityRingsCard result={result} needVideoAnalysis={needVideoAnalysis} needTranscript={needTranscript} />
              </motion.div>

              {/* quick stats strip */}
              {statPills.length > 0 && (
                <motion.div variants={fadeUp} className={cn(
                  "grid gap-2 sm:gap-3",
                  statPills.length === 1 ? "grid-cols-1" :
                  statPills.length === 2 ? "grid-cols-2" :
                  statPills.length === 3 ? "grid-cols-3" :
                  "grid-cols-2 sm:grid-cols-4"
                )}>
                  {statPills.map((pill) => (
                    <div key={pill.label} className="rounded-2xl border border-white/[0.06] bg-[#0f0f0f] p-3.5 sm:px-5 sm:py-4">
                      <StatPill label={pill.label} value={pill.value} sub={pill.sub} />
                    </div>
                  ))}
                </motion.div>
              )}

              {/* two column layout */}
              {(hasLeftCol || hasRightCol) && (
                <div className={cn("grid gap-4 items-start", hasLeftCol && hasRightCol ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                  {hasLeftCol && (
                    <motion.div variants={stagger} className="flex flex-col gap-4">

                      {/* transcript */}
                      <Accordion
                        title="Субтитры"
                        defaultOpen
                        icon={<IconBolt className="w-4 h-4" />}
                        badge={
                          hasVideo ? <span className="text-[10px] font-mono text-white/25 ml-1">нажмите на слово для перемотки</span> : undefined
                        }
                      >
                        <div className="max-h-[360px] overflow-y-auto transcript-scroll -mx-1 px-1">
                          {groupedTranscript.map((group, gi) => (
                            <div key={gi} className="mb-5 last:mb-0">
                              <div className="text-[10px] font-mono text-white/20 mb-2 flex items-center gap-2">
                                <span>{group.label}</span>
                                <div className="flex-1 h-px bg-white/[0.05]" />
                              </div>
                              <div className="text-[14px] leading-[1.9] text-white/65">
                                {group.items.map((item, ii) => {
                                  if (item.type === "pause") {
                                    const isActive = currentTime + 0.02 >= item.pause.start && currentTime < item.pause.end - 0.02;
                                    return (
                                      <span
                                        key={`p-${item.pause.start}-${ii}`}
                                        onClick={() => { if (!playerRef.current) return; playerRef.current.seek(item.pause.start); playerRef.current.play(); setCurrentTime(item.pause.start); }}
                                        className={cn(
                                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer mx-1 transition-colors",
                                          isActive ? "bg-white/10 text-white/80" : "bg-white/[0.04] text-white/30 hover:bg-white/[0.08] hover:text-white/60"
                                        )}
                                      >
                                        {item.pause.duration.toFixed(1)}s
                                      </span>
                                    );
                                  }
                                  const isActive = currentTime + 0.02 >= item.word.start && currentTime < item.word.end - 0.02;
                                  const display = item.word.text.trim();
                                  if (!display) return null;
                                  return (
                                    <span
                                      key={`${item.word.start}-${display}-${ii}`}
                                      onClick={() => handleWordClick(item.word)}
                                      className={cn(
                                        "cursor-pointer rounded-sm px-0.5 transition-colors",
                                        item.word.is_filler
                                          ? "text-white/40 underline underline-offset-2 decoration-white/20 hover:text-white/70"
                                          : "hover:text-white",
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
                      </Accordion>

                      {/* filler words */}
                      <Accordion
                        title="Слова-паразиты"
                        defaultOpen={fillerWordsList.length > 0}
                        badge={
                          <span className="text-[10px] font-mono text-white/30 border border-white/[0.08] px-2 py-0.5 rounded-full">
                            {result.fillers_summary.count} · {(result.fillers_summary.ratio * 100).toFixed(1)}%
                          </span>
                        }
                      >
                        {fillerWordsList.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {fillerWordsList.map(([word, count]) => (
                              <span key={word} className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] border border-white/[0.08] px-3 py-1 text-xs text-white/70">
                                {word}
                                <span className="text-[10px] font-mono text-white/30">{count}×</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-white/40">Слова-паразиты не обнаружены</p>
                        )}
                      </Accordion>

                    </motion.div>
                  )}

                  {hasRightCol && (
                    <motion.div variants={stagger} className="flex flex-col gap-4">

                      {/* criteria table */}
                      <StandardCriteriaTable report={evaluationReport} />

                      {/* tempo chart */}
                      {needTranscript && (
                        <Accordion title="Темп речи" defaultOpen>
                          <TempoChart data={result.tempo} currentTime={currentTime} />
                        </Accordion>
                      )}

                      {/* confidence index */}
                      {needVideoAnalysis && confidenceDetails.length > 0 && (
                        <Accordion title="Индекс уверенности" defaultOpen>
                          <div className="flex flex-col gap-2">
                            {/* total */}
                            <div className="mb-3 flex items-center justify-between">
                              <div>
                                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30">Итог</div>
                                <div className="mt-1 flex items-baseline gap-2">
                                  <span className="text-3xl font-semibold text-white">{Math.round(confidence.total)}</span>
                                  <span className="text-sm text-white/40">{confidence.total_label}</span>
                                </div>
                              </div>
                              <div className="relative">
                                <ScoreRing value={Math.round(confidence.total)} max={100} size={64} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-mono text-white/50">{Math.round(confidence.total)}</span>
                                </div>
                              </div>
                            </div>

                            {/* individual components */}
                            {confidenceDetails.map((item) => (
                              <div key={item.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-white/35">{item.key}</span>
                                  <span className="text-sm font-medium text-white/80">{Math.round(item.score)}<span className="text-white/25 text-xs">/100</span></span>
                                </div>
                                <ConfidenceBar score={item.score} />
                                {item.label && (
                                  <p className="mt-2 text-[12px] leading-relaxed text-white/50">{item.label}</p>
                                )}
                                {item.extra && item.extra !== item.label && (
                                  <p className="mt-1 text-[11px] leading-relaxed text-white/35">{item.extra}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </Accordion>
                      )}

                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "ai-report" && (
            <motion.div key="ai-report" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0 }} className="flex flex-col gap-4">

              {/* summary card */}
              {speechReport.summary && (
                <motion.div variants={fadeUp} className="rounded-2xl border border-white/[0.07] bg-[#0f0f0f] p-6">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-3">Краткое резюме</div>
                  <p className="text-[15px] leading-[1.8] text-white/75 whitespace-pre-line">{speechReport.summary}</p>
                </motion.div>
              )}

              {/* filler words from AI */}
              {needTranscript && speechReport.dynamic_fillers.length > 0 && (
                <motion.div variants={fadeUp} className="rounded-2xl border border-white/[0.07] bg-[#0f0f0f] p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-3">Слова-паразиты, замеченные ИИ</div>
                  <div className="flex flex-wrap gap-2">
                    {speechReport.dynamic_fillers.map((word, i) => (
                      <span key={`${word}-${i}`} className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-sm text-white/65">
                        {word}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* accordion cards */}
              {aiCards
                .filter((c) => c.text && c.title !== "Краткое резюме")
                .map((card) => (
                  <Accordion key={card.title} title={card.title} icon={card.icon} defaultOpen={false}>
                    <div className="text-[13.5px] leading-[1.85] text-white/65 whitespace-pre-line">
                      {card.text}
                    </div>
                  </Accordion>
                ))}
            </motion.div>
          )}

          {activeTab === "criteria-report" && (
            <motion.div key="criteria-report" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0 }} className="flex flex-col gap-4">

              {/* score summary */}
              <motion.div variants={fadeUp} className="rounded-2xl border border-white/[0.07] bg-[#0f0f0f] p-6">
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-5">Итоговый результат</div>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <div className="text-[10px] font-mono text-white/25 mb-1">Баллы</div>
                    <div className="text-3xl font-semibold text-white">{evaluationReport.total_score}<span className="text-lg text-white/30">/{evaluationReport.max_score}</span></div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-white/25 mb-1">Процент</div>
                    <div className="text-3xl font-semibold text-white">{criteriaPercent}<span className="text-lg text-white/30">%</span></div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-white/25 mb-2">Выполнение</div>
                    <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden mt-3">
                      <div
                        className="h-full rounded-full bg-white/50 transition-all duration-1000"
                        style={{ width: `${criteriaPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* criteria list */}
              {evaluationReport.criteria.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {evaluationReport.criteria.map((crit, i) => {
                    const val = crit.current_value ?? 0;
                    const pct = crit.max_value > 0 ? Math.round((val / crit.max_value) * 100) : 0;
                    return (
                      <Accordion
                        key={`${crit.name}-${i}`}
                        title={crit.name}
                        badge={
                          <span className="ml-auto text-[11px] font-mono text-white/40 flex-shrink-0">
                            {val}<span className="text-white/20">/{crit.max_value}</span>
                            <span className="ml-2 text-white/25">· {pct}%</span>
                          </span>
                        }
                      >
                        <div className="flex flex-col gap-3">
                          {/* progress */}
                          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-1000",
                                pct >= 70 ? "bg-white/60" : pct >= 40 ? "bg-white/35" : "bg-white/15"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {crit.description && (
                            <p className="text-[13px] leading-relaxed text-white/50">{crit.description}</p>
                          )}

                          {crit.feedback && (
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/25 mb-1.5">Совет</div>
                              <p className="text-[13px] leading-relaxed text-white/55">{crit.feedback}</p>
                            </div>
                          )}
                        </div>
                      </Accordion>
                    );
                  })}
                </div>
              ) : (
                <motion.div variants={fadeUp} className="rounded-2xl border border-white/[0.07] bg-[#0f0f0f] p-6 text-sm text-white/40">
                  Список критериев пуст.
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {globalStyles}
    </div>
  );
}

const globalStyles = (
  <style jsx global>{`
    .transcript-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
    }
    .transcript-scroll::-webkit-scrollbar { width: 3px; }
    .transcript-scroll::-webkit-scrollbar-track { background: transparent; }
    .transcript-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 4px; }
    .transcript-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }
  `}</style>
);
