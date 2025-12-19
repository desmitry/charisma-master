"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getAnalysis } from "@/lib/api";
import { AnalysisResult } from "@/types/analysis";
import { TempoChart } from "@/components/analysis/tempo-chart";
import { ConfidenceGauge } from "@/components/analysis/confidence-gauge";
import { Transcript } from "@/components/analysis/transcript";
import { SummaryBlocks } from "@/components/analysis/summary-blocks";
import { SmoothScroll } from "@/components/smooth-scroll";
import { VideoErrorDisplay } from "@/components/video-error-display";

export default function DashboardPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouch = document.body.style.touchAction;
    document.body.style.overflow = "auto";
    document.body.style.touchAction = "auto";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouch;
    };
  }, []);

  useEffect(() => {
    if (!taskId) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getAnalysis(taskId);
        setAnalysis(data);
      } catch (err) {
        setError((err as Error).message ?? "Не удалось загрузить анализ");
      } finally {
        setLoading(false);
      }
    })();
  }, [taskId]);

  const videoSrc = useMemo(() => {
    if (!analysis) return "";
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";
    if (analysis.video_path?.startsWith("http")) return analysis.video_path;
    if (useMock) {
      return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
    }
    return `${apiBase}${analysis.video_path}`;
  }, [analysis]);

  useEffect(() => {
    setVideoError(null); // Сбрасываем ошибку при изменении источника
  }, [videoSrc]);

  const onSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    void videoRef.current.play();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white/70">
          Загружаем результаты...
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white/70">
          {error ?? "Анализ не найден"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0a0c16] to-black text-white">
      <SmoothScroll />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              Результаты анализа
            </p>
            <h1 className="text-2xl font-semibold mt-1">Task {analysis.task_id}</h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            На главную
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60">
              {videoError ? (
                <VideoErrorDisplay error={videoError} />
              ) : (
                <video
                  ref={videoRef}
                  src={videoSrc}
                  controls
                  className="h-full w-full object-contain"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onError={(e) => {
                    const video = e.currentTarget;
                    const error = video.error;
                    let errorMessage = "Неизвестная ошибка";
                    
                    if (error) {
                      switch (error.code) {
                        case MediaError.MEDIA_ERR_ABORTED:
                          errorMessage = "Загрузка видео была прервана";
                          break;
                        case MediaError.MEDIA_ERR_NETWORK:
                          errorMessage = "Ошибка сети при загрузке видео";
                          break;
                        case MediaError.MEDIA_ERR_DECODE:
                          errorMessage = "Ошибка декодирования видео";
                          break;
                        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                          errorMessage = "Формат видео не поддерживается";
                          break;
                        default:
                          errorMessage = `Ошибка воспроизведения (код: ${error.code})`;
                      }
                    }
                    
                    setVideoError(errorMessage);
                  }}
                />
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm text-white/70">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                  Паразиты
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {analysis.fillers_summary.count}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                  Ratio
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {(analysis.fillers_summary.ratio * 100).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                  Плотность слайдов
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {(analysis.slide_analysis?.text_density_score ?? analysis.slide_text_density) !== undefined 
                    ? Math.min(100, Math.max(0, analysis.slide_analysis?.text_density_score ?? analysis.slide_text_density ?? 0)).toFixed(1) 
                    : "-"}%
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <h2 className="text-lg font-semibold">Транскрипция</h2>
            <p className="text-sm text-white/60">
              Кликни по слову, чтобы перемотать на момент в плеере
            </p>
            <div className="mt-4 max-h-[520px] overflow-y-auto pr-2" data-lenis-prevent>
              <Transcript
                segments={analysis.transcript}
                currentTime={currentTime}
                onSeek={onSeek}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <TempoChart data={analysis.tempo} />
          <ConfidenceGauge data={analysis.confidence_index} />
        </div>

        <SummaryBlocks data={analysis} />
      </div>
    </div>
  );
}

