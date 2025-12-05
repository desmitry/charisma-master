"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisResult, TempoPoint, TranscriptWord } from "@/types/analysis";
import { resolveVideoUrl, getPdfUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SmoothScroll } from "./smooth-scroll";

type Props = {
  result: AnalysisResult;
  onBack?: () => void;
};

// Easing helpers для плавных анимаций
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

// Лаконичные монохромные SVG-иконки
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

export function AnalysisDashboard({ result, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"transcript" | "insights">("transcript");

  const videoSrc = resolveVideoUrl(result.video_path);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleWordClick = (word: TranscriptWord) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = word.start;
    void videoRef.current.play().catch(() => undefined);
    setCurrentTime(word.start);
  };

  const onTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  // Group transcript by time chunks for better navigation
  const groupedTranscript = useMemo(() => {
    const groups: { label: string; segments: typeof result.transcript }[] = [];
    const chunkSize = 30; // 30 seconds per group
    
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
      {/* Мягкие фоновые свечения */}
      <div className="pointer-events-none fixed inset-0 blur-3xl opacity-20">
        <div className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-white/15" />
        <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-white/10" />
      </div>

      {/* Header */}
      <header
        className={cn(
          "sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl",
          "transform transition-all duration-700",
          mounted ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg font-bold sm:flex">
              C
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Анализ</p>
              <h1 className="text-base font-semibold sm:text-lg">Разбор выступления</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <StatBadge label="Паразиты" value={`${(result.fillers_summary.ratio * 100).toFixed(1)}%`} />
            <StatBadge label="Уверенность" value={`${result.confidence_index.total.toFixed(0)}`} accent />
            
            <button
              onClick={() => window.open(getPdfUrl(result.task_id), "_blank")}
              className="hidden rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium transition hover:bg-white/15 sm:block sm:px-4 sm:py-2"
            >
              PDF Отчет
            </button>

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
        {/* Top section: Video + Quick stats */}
        <div
          className={cn(
            "grid gap-4 lg:grid-cols-[1fr_320px]",
            "transform transition-all duration-700 delay-100",
            mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          )}
        >
          {/* Video player */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-20 bg-gradient-to-tr from-white/30 via-white/10 to-transparent" />
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              className="aspect-video w-full bg-black object-contain"
              onTimeUpdate={onTimeUpdate}
            />
          </div>

          {/* Quick stats panel */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <GlassStat
              icon={<IconTarget />}
              label="Слова-паразиты"
              value={result.fillers_summary.count}
              suffix="шт"
              delay={200}
              mounted={mounted}
            />
            <GlassStat
              icon={<IconDoc />}
              label="Плотность слайдов"
              value={result.slide_text_density}
              suffix="%"
              delay={300}
              mounted={mounted}
            />
            <GlassStat
              icon={<IconBolt />}
              label="Уверенность"
              value={result.confidence_index.total}
              suffix="/100"
              delay={400}
              mounted={mounted}
            />
            <GlassStat
              icon={<IconClock />}
              label="Сегментов"
              value={result.transcript.length}
              suffix="шт"
              delay={500}
              mounted={mounted}
            />
          </div>
        </div>

        {/* Tab navigation */}
        <div
          className={cn(
            "mt-6 flex gap-2",
            "transform transition-all duration-700 delay-200",
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

        {/* Content area */}
        <div
          className={cn(
            "mt-4",
            "transform transition-all duration-700 delay-300",
            mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          )}
        >
          {activeTab === "transcript" && (
            <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
              {/* Transcript */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Полный транскрипт</h2>
                  <span className="text-xs text-white/50">
                    Клик по слову → перемотка
                  </span>
                </div>
                <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2 scroll-elegant" data-lenis-prevent>
                  {groupedTranscript.map((group, gi) => (
                    <div key={gi} className="rounded-xl border border-white/5 bg-white/5 p-3 transition hover:border-white/15 hover:bg-white/10">
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40">
                        {group.label}
                      </p>
                      <div className="space-y-2">
                        {group.segments.map((seg) => (
                          <div key={`${seg.start}-${seg.end}`} className="flex flex-wrap gap-1">
                            {seg.words.map((word) => {
                              const isActive = currentTime >= word.start && currentTime <= word.end;
                              return (
                                <button
                                  key={`${word.start}-${word.text}`}
                                  onClick={() => handleWordClick(word)}
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-xs transition-all duration-200",
                                    word.is_filler
                                      ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                                      : "bg-white/10 text-white/80 hover:bg-white/20",
                                    isActive && "ring-2 ring-white/60 scale-105"
                                  )}
                                >
                                  {word.text}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Charts sidebar */}
              <div className="space-y-4">
                <AnimatedTempoChart data={result.tempo} mounted={mounted} />
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
                content={result.mistakes}
                delay={100}
                mounted={mounted}
                accent="red"
              />
              <InsightCard
                title="Структура"
                content={result.structure}
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
            </div>
          )}
        </div>
      </main>
      {globalStyles}
    </div>
  );
}

// Helper components

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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
  delay: number;
  mounted: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!mounted) return;
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
  }, [mounted, value, delay]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3",
        "transition-all duration-500",
        mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        hovered && "border-white/20 shadow-[0_20px_60px_rgba(255,255,255,0.08)]"
      )}
      style={{ transitionDelay: `${delay}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/0 to-white/10 opacity-0 transition-opacity duration-500" style={{ opacity: hovered ? 0.2 : 0 }} />
      <div className="relative z-10 flex items-start gap-3">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{label}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tabular-nums">{displayValue.toFixed(suffix === "%" ? 1 : 0)}</span>
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

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid
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

    // Сглаженная линия + заливка под ней
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

    // Основная линия с подсветкой
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

    // Лёгкое свечение
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 6;
    ctx.filter = "blur(6px)";
    ctx.stroke();
    ctx.restore();

    // Точки
    for (let i = 0; i <= visibleCount; i++) {
      const d = data[i];
      if (!d) continue;
      const { x, y } = toPoint(d);
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = d.zone === "red" ? "#f87171" : d.zone === "yellow" ? "#fbbf24" : "#fff";
      ctx.fill();
    }

    // Labels
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

  useEffect(() => {
    if (!mounted) return;
    let start = Date.now();
    const duration = 1500;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setAnimValue(total * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    const timer = setTimeout(animate, 600);
    return () => clearTimeout(timer);
  }, [mounted, total]);

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
          <MiniBar label="Громкость" value={components.volume_score} delay={700} mounted={mounted} />
          <MiniBar label="Паразиты" value={components.filler_score} delay={800} mounted={mounted} />
          <MiniBar label="Взгляд" value={components.gaze_score} delay={900} mounted={mounted} />
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
          style={{ width: `${animValue}%`, transition: "width 0.1s linear" }}
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

// Глобальные стили для кастомного скролла транскрипта
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

