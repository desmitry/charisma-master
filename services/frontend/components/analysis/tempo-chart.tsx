"use client";

import { useMemo, useState, useEffect } from "react";
import { TempoPoint } from "@/types/analysis";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

type Props = {
  data: TempoPoint[];
  currentTime?: number;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const zoneMeta: Record<string, { label: string; chip: string; color: string }> = {
  green: {
    label: "Оптимально",
    chip: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    color: "#34d399",
  },
  yellow: {
    label: "Есть отклонение",
    chip: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    color: "#f59e0b",
  },
  red: {
    label: "Нужна корректировка",
    chip: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    color: "#f43f5e",
  },
};

const fallbackZone = {
  label: "Без оценки",
  chip: "bg-white/5 text-white/70 border-white/10",
  color: "rgba(255,255,255,0.7)",
};

const getZoneMeta = (zone?: string) => zoneMeta[zone || ""] || fallbackZone;

const getTempoMeaning = (wpm: number) => {
  if (wpm === 0) return "Пауза или почти нет речи";
  if (wpm < 80) return "Слишком медленный темп";
  if (wpm < 100) return "Немного медленно";
  if (wpm <= 140) return "Комфортный темп для восприятия";
  if (wpm <= 160) return "Немного быстро";
  return "Слишком быстрый темп";
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const point = payload[0].payload as TempoPoint;
    const zone = getZoneMeta(point.zone);

    return (
      <div className="max-w-[260px] rounded-lg bg-black/95 border border-white/10 px-3 py-2 text-xs shadow-lg">
        <div className="font-medium tabular-nums text-white">
          {formatTime(point.time)} · {Math.round(point.wpm)} слов/мин
        </div>
        <div className="mt-1" style={{ color: zone.color }}>
          {zone.label}
        </div>
        <div className="mt-1 text-white/60">
          {getTempoMeaning(point.wpm)}
        </div>
      </div>
    );
  }
  return null;
};

export function TempoChart({ data, currentTime }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!data?.length) return null;

  const stats = useMemo(() => {
    const wpmValues = data.map((point) => point.wpm);
    return {
      min: Math.min(...wpmValues),
      max: Math.max(...wpmValues),
      avg: wpmValues.reduce((sum, point) => sum + point, 0) / wpmValues.length,
    };
  }, [data]);

  const yRange = useMemo(() => {
    const range = stats.max - stats.min || 50;
    const pad = range * 0.1;
    return [Math.max(0, Math.floor(stats.min - pad)), Math.ceil(stats.max + pad)];
  }, [stats]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Темп речи</span>
        <span className="text-xs text-white/50">
          В среднем {Math.round(stats.avg)} слов/мин
        </span>
      </div>

      <div className="h-[180px] w-full min-h-0">
        {mounted && (
          <ResponsiveContainer width="100%" height={160} minWidth={1} minHeight={1}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap={1}>
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatTime}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                minTickGap={30}
              />
              <YAxis
                domain={yRange}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                width={40}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                isAnimationActive
              />
              {currentTime !== undefined && currentTime >= 0 && (
                <ReferenceLine
                  x={currentTime > 0 ? currentTime : 0}
                  stroke="rgba(255,255,255,0.4)"
                  strokeDasharray="3 3"
                />
              )}
              <Bar dataKey="wpm" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={500}>
                {data.map((point) => (
                  <Cell key={`${point.time}-${point.wpm}`} fill={getZoneMeta(point.zone).color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}
