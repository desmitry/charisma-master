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

type DashboardTab = "overview" | "ai-report" | "criteria-report";

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
  show: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

const confidenceItemTone: Record<string, string> = {
  volume: "border-cyan-500/20 bg-cyan-500/[0.03]",
  filler: "border-rose-500/20 bg-rose-500/[0.03]",
  gaze: "border-emerald-500/20 bg-emerald-500/[0.03]",
  gesture: "border-amber-500/20 bg-amber-500/[0.03]",
  tone: "border-fuchsia-500/20 bg-fuchsia-500/[0.03]",
};

const tabConfig: { id: DashboardTab; label: string }[] = [
  { id: "overview", label: "Главное" },
  { id: "ai-report", label: "Отчет по выступлению от ИИ" },
  { id: "criteria-report", label: "Оценка по критериям от ИИ" },
];

export function AnalysisDashboard({ result, onBack }: Props) {
  const playerRef = useRef<VideoPlayerRef>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoSrc, setVideoSrc] = useState(() => resolveVideoUrl(result.video_path));
  const [videoError, setVideoError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  const speechReport = result.speech_report;
  const evaluationReport = result.evaluation_criteria_report;
  const confidence = result.confidence_index;

  useEffect(() => {
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

    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [result.transcript, speechReport.dynamic_fillers]);

  const groupedTranscript = useMemo(() => {
    type TimelineItem = { type: "word"; word: TranscriptWord } | { type: "pause"; pause: LongPause };
    const groups: { label: string; items: TimelineItem[] }[] = [];
    const chunkSize = 30;
    const allWords: TimelineItem[] = result.transcript.flatMap((segment) => (
      segment.words.map((word) => ({ type: "word" as const, word }))
    ));
    const allPauses: TimelineItem[] = result.long_pauses.map((pause) => ({ type: "pause" as const, pause }));

    const timeline = [...allWords, ...allPauses].sort((left, right) => {
      const startA = left.type === "word" ? left.word.start : left.pause.start;
      const startB = right.type === "word" ? right.word.start : right.pause.start;
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

  const metadataChips = [
    { label: "Analyze provider", value: result.analyze_provider },
    { label: "Analyze model", value: result.analyze_model },
    { label: "Transcribe model", value: result.transcribe_model },
  ].filter((item) => item.value);

  const confidenceDetails = [
    {
      key: "volume",
      title: "Volume",
      score: confidence.components.volume_score,
      label: confidence.components.volume_label,
      extra: confidence.components.volume_level,
    },
    {
      key: "filler",
      title: "Filler",
      score: confidence.components.filler_score,
      label: confidence.components.filler_label,
      extra: `${result.fillers_summary.count} слов · ${(result.fillers_summary.ratio * 100).toFixed(1)}%`,
    },
    {
      key: "gaze",
      title: "Gaze",
      score: confidence.components.gaze_score,
      label: confidence.components.gaze_label,
    },
    {
      key: "gesture",
      title: "Gesture",
      score: confidence.components.gesture_score,
      label: confidence.components.gesture_advice,
      extra: confidence.components.gesture_advice,
    },
    {
      key: "tone",
      title: "Tone",
      score: confidence.components.tone_score,
      label: confidence.components.tone_label,
    },
  ];

  const aiReportCards = [
    { title: "summary", heading: "Краткое резюме", text: speechReport.summary, tone: "border-white/[0.08] bg-[#111]" },
    { title: "structure", heading: "Структура", text: speechReport.structure, tone: "border-cyan-500/20 bg-cyan-500/[0.03]" },
    { title: "mistakes", heading: "Ошибки", text: speechReport.mistakes, tone: "border-rose-500/20 bg-rose-500/[0.03]" },
    { title: "ideal_text", heading: "Идеальный текст", text: speechReport.ideal_text, tone: "border-emerald-500/20 bg-emerald-500/[0.03]" },
    { title: "persona_feedback", heading: "Фидбэк персоны", text: speechReport.persona_feedback, tone: "border-amber-500/20 bg-amber-500/[0.03]" },
    { title: "presentation_feedback", heading: "Фидбэк по презентации", text: speechReport.presentation_feedback, tone: "border-sky-500/20 bg-sky-500/[0.03]" },
    { title: "useful_links", heading: "Полезные ссылки", text: speechReport.useful_links.join("\n"), tone: "border-violet-500/20 bg-violet-500/[0.03]" },
  ];

  const criteriaPercent =
    evaluationReport.max_score > 0
      ? Math.round((evaluationReport.total_score / evaluationReport.max_score) * 100)
      : 0;

  return (
    <div className="relative z-10 min-h-screen text-white w-full max-w-[100vw] bg-[#0A0A0A] selection:bg-white/20">
      <motion.header
        initial="hidden"
        animate="show"
        variants={fadeInAnim}
        className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0A0A0A]/80 backdrop-blur-md"
      >
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex flex-col gap-3">
            <h1 className="text-[15px] font-medium tracking-tight text-white/90">Разбор выступления</h1>
            <div className="flex flex-wrap items-center gap-2">
              {metadataChips.map((chip) => (
                <div key={chip.label} className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#111] border border-white/5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/35">{chip.label}</span>
                  <span className="text-[11px] font-mono text-white/70">{chip.value}</span>
                </div>
              ))}
            </div>
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
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-6">
          <motion.div variants={fadeUpAnim} className="flex flex-wrap items-center gap-2">
            {tabConfig.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-colors",
                  activeTab === tab.id
                    ? "border-white/20 bg-white text-black"
                    : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </motion.div>

          {activeTab === "overview" ? (
            <>
              <motion.div variants={fadeUpAnim} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                <div className="relative rounded-xl border border-white/[0.08] bg-black overflow-hidden aspect-video flex-grow shadow-[0_0_40px_rgba(0,0,0,0.5)] flex justify-center items-center">
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
                <ActivityRingsCard result={result} />
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">
                <div className="flex flex-col gap-6">
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
                        {groupedTranscript.map((group, groupIndex) => (
                          <div key={groupIndex} className="mb-6 last:mb-0">
                            <div className="text-[10px] font-mono text-white/20 mb-3">{group.label}</div>
                            <div className="text-[14.5px] leading-[1.8] text-white/70">
                              {group.items.map((item, itemIndex) => {
                                if (item.type === "pause") {
                                  const isActive = currentTime + 0.02 >= item.pause.start && currentTime < item.pause.end - 0.02;
                                  return (
                                    <span
                                      key={`pause-${item.pause.start}-${itemIndex}`}
                                      onClick={() => {
                                        if (!playerRef.current) return;
                                        playerRef.current.seek(item.pause.start);
                                        playerRef.current.play();
                                        setCurrentTime(item.pause.start);
                                      }}
                                      className={cn(
                                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer mx-1 transition-colors",
                                        isActive
                                          ? "bg-rose-500/20 text-rose-300"
                                          : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/80"
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
                                    key={`${item.word.start}-${display}-${itemIndex}`}
                                    onClick={() => handleWordClick(item.word)}
                                    className={cn(
                                      "cursor-pointer rounded px-0.5 transition-colors",
                                      item.word.is_filler
                                        ? "text-rose-400/80 hover:text-rose-300 border-b border-rose-500/20"
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
                    </div>
                  </motion.div>

                  <motion.div variants={fadeUpAnim} className="rounded-xl border border-rose-500/20 bg-[#111] overflow-hidden">
                    <div className="px-6 py-4 border-b border-rose-500/10 bg-rose-500/[0.02] flex items-center justify-between">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-rose-500/60">Слова-паразиты</h3>
                      <span className="text-[10px] font-mono text-rose-500/40 border border-rose-500/20 px-2 py-0.5 rounded">
                        {result.fillers_summary.count} total · {(result.fillers_summary.ratio * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-6 flex flex-wrap gap-2">
                      {fillerWordsList.length > 0 ? fillerWordsList.map(([word, count]) => (
                        <span key={word} className="inline-flex items-center gap-2 rounded bg-rose-500/10 border border-rose-500/20 px-2 py-1 text-xs text-rose-300">
                          {word}
                          <span className="opacity-50 text-[10px] font-mono">{count}</span>
                        </span>
                      )) : (
                        <span className="text-sm text-white/50">Слова-паразиты не обнаружены</span>
                      )}
                    </div>
                  </motion.div>
                </div>

                <div className="flex flex-col gap-6">
                  <StandardCriteriaTable report={evaluationReport} />

                  <motion.div variants={fadeUpAnim} className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden p-6">
                    <TempoChart data={result.tempo} currentTime={currentTime} />
                  </motion.div>

                  <motion.div variants={fadeUpAnim} className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/[0.04] bg-[#141414]">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-white/50">Индекс уверенности</h3>
                    </div>
                    <div className="p-6">
                      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/35">Total</div>
                        <div className="mt-2 flex items-end gap-3">
                          <span className="text-4xl font-semibold text-white">{Math.round(confidence.total)}</span>
                          <span className="pb-1 text-sm text-white/50">{confidence.total_label}</span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {confidenceDetails.map((item) => (
                          <div key={item.key} className={cn("rounded-xl border p-4", confidenceItemTone[item.key])}>
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/35">{item.title}</div>
                                <div className="mt-1 text-sm text-white/80">{item.label}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-semibold text-white">{Math.round(item.score)}</div>
                                <div className="text-[11px] text-white/40">score</div>
                              </div>
                            </div>
                            {item.extra && (
                              <div className="mt-3 text-xs leading-relaxed text-white/55 whitespace-pre-line">
                                {item.extra}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </>
          ) : activeTab === "ai-report" ? (
            <motion.div variants={fadeUpAnim} className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
              <div className="rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),linear-gradient(180deg,#111,#0d0d0d)] overflow-hidden">
                <div className="px-8 py-6 border-b border-white/[0.06]">
                  <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-white/35">SpeechReport</div>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Отчет по выступлению от ИИ</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                    Все текстовые выводы модели по выступлению собраны в одном месте: краткое резюме, структура, ошибки, улучшенный вариант текста, персональный фидбэк и замечания по презентации.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                  {aiReportCards.map((card) => (
                    <section key={card.title} className={cn("rounded-2xl border p-5", card.tone)}>
                      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">{card.title}</div>
                      <h3 className="mt-3 text-lg font-medium text-white">{card.heading}</h3>
                      <div className="mt-4 text-sm leading-7 text-white/72 whitespace-pre-line">
                        {card.text || "Нет данных"}
                      </div>
                    </section>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <section className="rounded-[28px] border border-amber-500/20 bg-amber-500/[0.04] overflow-hidden">
                  <div className="px-6 py-5 border-b border-amber-500/10">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-300/70">dynamic_fillers</div>
                    <h3 className="mt-2 text-xl font-medium text-white">Слова-паразиты, замеченные ИИ</h3>
                  </div>
                  <div className="p-6">
                    {speechReport.dynamic_fillers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {speechReport.dynamic_fillers.map((word, index) => (
                          <span
                            key={`${word}-${index}`}
                            className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-sm text-amber-200"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-white/55">ИИ не выделил отдельных слов-паразитов.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/[0.08] bg-[#111] overflow-hidden">
                  <div className="px-6 py-5 border-b border-white/[0.06]">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">overview</div>
                    <h3 className="mt-2 text-xl font-medium text-white">Быстрый контекст</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-6">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">summary</div>
                      <div className="mt-2 text-sm text-white/70 line-clamp-4">{speechReport.summary || "Нет данных"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">mistakes</div>
                      <div className="mt-2 text-sm text-white/70 line-clamp-4">{speechReport.mistakes || "Нет данных"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">presentation_feedback</div>
                      <div className="mt-2 text-sm text-white/70 line-clamp-4">{speechReport.presentation_feedback || "Нет данных"}</div>
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          ) : (
            <motion.div variants={fadeUpAnim} className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
              <div className="flex flex-col gap-6">
                <section className="rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),linear-gradient(180deg,#111,#0d0d0d)] overflow-hidden">
                  <div className="px-8 py-6 border-b border-white/[0.06]">
                    <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-white/35">EvaluationCriteriaReport</div>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Оценка с помощью выбранных критериев от ИИ</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                      Здесь собрана полная оценка по выбранным критериям: итоговые баллы, процент выполнения и рекомендации по каждому критерию.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">total_score</div>
                      <div className="mt-3 text-4xl font-semibold text-white">{evaluationReport.total_score}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">max_score</div>
                      <div className="mt-3 text-4xl font-semibold text-white">{evaluationReport.max_score}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">Процент</div>
                      <div className="mt-3 text-4xl font-semibold text-white">{criteriaPercent}%</div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/[0.08] bg-[#111] overflow-hidden">
                  <div className="px-6 py-5 border-b border-white/[0.06]">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">criteria</div>
                    <h3 className="mt-2 text-xl font-medium text-white">Критерии, которые учитывались</h3>
                  </div>
                  <div className="p-6">
                    {evaluationReport.criteria.length > 0 ? (
                      <div className="space-y-4">
                        {evaluationReport.criteria.map((criterion, index) => {
                          const currentValue = criterion.current_value ?? 0;
                          const criterionPercent =
                            criterion.max_value > 0 ? Math.round((currentValue / criterion.max_value) * 100) : 0;

                          return (
                            <div
                              key={`${criterion.name}-${index}`}
                              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="max-w-2xl">
                                  <div className="text-lg font-medium text-white">{criterion.name}</div>
                                  <div className="mt-2 text-sm leading-6 text-white/55">
                                    {criterion.description}
                                  </div>
                                </div>
                                <div className="min-w-[140px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">Баллы</div>
                                  <div className="mt-2 text-2xl font-semibold text-white">
                                    {currentValue}
                                    <span className="text-sm text-white/35"> / {criterion.max_value}</span>
                                  </div>
                                  <div className="mt-1 text-xs text-white/45">{criterionPercent}%</div>
                                </div>
                              </div>

                              <div className="mt-4 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    criterionPercent >= 70
                                      ? "bg-emerald-400"
                                      : criterionPercent >= 40
                                        ? "bg-amber-400"
                                        : "bg-rose-400"
                                  )}
                                  style={{ width: `${criterionPercent}%` }}
                                />
                              </div>

                              <div className="mt-4 rounded-2xl border border-sky-500/10 bg-sky-500/[0.03] p-4">
                                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-sky-200/55">Совет по исправлению</div>
                                <div className="mt-2 text-sm leading-6 text-white/70">
                                  {criterion.feedback || "Совет не указан"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">
                        Список критериев пуст.
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="flex flex-col gap-6">
                <section className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/[0.04] overflow-hidden">
                  <div className="px-6 py-5 border-b border-emerald-500/10">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-300/70">Итог</div>
                    <h3 className="mt-2 text-xl font-medium text-white">Сводка по выбранным критериям</h3>
                  </div>
                  <div className="p-6">
                    <div className="rounded-2xl border border-emerald-400/15 bg-black/20 p-5">
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-200/60">Формула</div>
                      <div className="mt-3 text-2xl font-semibold text-white">
                        {evaluationReport.total_score} / {evaluationReport.max_score}
                      </div>
                      <div className="mt-2 text-sm text-white/60">
                        Процент выполнения: {criteriaPercent}%
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-white/[0.08] bg-[#111] overflow-hidden">
                  <div className="px-6 py-5 border-b border-white/[0.06]">
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/35">Быстрый просмотр</div>
                    <h3 className="mt-2 text-xl font-medium text-white">Короткий список критериев</h3>
                  </div>
                  <div className="p-6 space-y-3">
                    {evaluationReport.criteria.length > 0 ? evaluationReport.criteria.map((criterion, index) => (
                      <div key={`${criterion.name}-short-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-white">{criterion.name}</div>
                          <div className="text-sm text-white/55">
                            {criterion.current_value ?? 0}/{criterion.max_value}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                        Нет критериев для отображения.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </motion.div>
          )}
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
