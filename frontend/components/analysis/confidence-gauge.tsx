"use client";

import { ConfidenceIndex } from "@/types/analysis";

export function ConfidenceGauge({ data }: { data: ConfidenceIndex }) {
  const radius = 64;
  const stroke = 12;
  const norm = Math.min(100, Math.max(0, data.total));
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - norm / 100);

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-white/70">Индекс уверенности</p>
      <div className="flex items-center gap-6">
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
            <circle
              cx="100"
              cy="100"
              r={radius}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={stroke}
              fill="none"
            />
            <circle
              cx="100"
              cy="100"
              r={radius}
              stroke="url(#grad)"
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6dd5fa" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center rotate-90">
            <div className="text-center">
              <p className="text-3xl font-semibold text-white">{norm}%</p>
              <p className="text-xs text-white/60">готовность</p>
            </div>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <MetricCard label="Громкость" value={Math.min(100, Math.max(0, data.components.volume_score))} />
          <MetricCard label="Чистота речи" value={Math.min(100, Math.max(0, data.components.filler_score))} />
          <MetricCard label="Взгляд" value={Math.min(100, Math.max(0, data.components.gaze_score))} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-white/50">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-white">{value}%</p>
    </div>
  );
}

