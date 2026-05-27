"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { TempoPoint } from "@/types/analysis";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

const zoneMeta: Record<string, { label: string; color: string }> = {
  green: {
    label: "Оптимально",
    color: "var(--chart-green)",
  },
  yellow: {
    label: "Есть отклонение",
    color: "var(--chart-yellow)",
  },
  red: {
    label: "Нужна корректировка",
    color: "var(--chart-red)",
  },
};

const fallbackZone = {
  label: "Без оценки",
  color: "var(--muted-strong)",
};

const getZoneMeta = (zone?: string) => zoneMeta[zone || ""] || fallbackZone;

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const point = payload[0].payload as TempoPoint;
    const zone = getZoneMeta(point.zone);

    return (
      <div className="max-w-[220px] rounded-xl border border-card-border bg-card-bg/95 px-3 py-2 text-xs shadow-sm backdrop-blur-xl">
        <div className="font-medium tabular-nums text-foreground">
          {Math.round(point.wpm)} слов/мин
        </div>
        <div className="mt-1 text-[11px] text-foreground/45">{formatTime(point.time)}</div>
        <div className="mt-1 text-[11px]" style={{ color: zone.color }}>
          {zone.label}
        </div>
      </div>
    );
  }
  return null;
};

export function TempoChart({ data, currentTime }: Props) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 350);
    return () => clearTimeout(timer);
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
    const range = stats.max - stats.min || 40;
    const pad = Math.max(12, range * 0.18);
    const lower = Math.max(0, Math.floor(stats.min - pad));
    const upper = Math.ceil(stats.max + pad);
    return [lower, upper];
  }, [stats]);

  return (
    <div className="relative flex w-full flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-foreground">Темп речи</div>
          <div className="mt-1 text-[13px] text-foreground/45">
            В среднем {Math.round(stats.avg)} слов/мин
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="h-[220px] w-full min-h-0 overflow-hidden rounded-[20px] border border-foreground/[0.06] px-2 py-3 md:px-3"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--foreground) 2.5%, transparent), color-mix(in srgb, var(--foreground) 0.5%, transparent))",
        }}
      >
        {mounted && (
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <LineChart accessibilityLayer data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid
                vertical={false}
                stroke="var(--chart-grid)"
                strokeDasharray="3 6"
              />

              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatTime}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                tickMargin={10}
                minTickGap={36}
              />

              <YAxis
                domain={yRange}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                width={34}
                tickCount={4}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "var(--chart-reference)", strokeDasharray: "3 6" }}
                isAnimationActive
              />

              <ReferenceLine
                y={stats.avg}
                stroke="var(--chart-reference)"
                strokeDasharray="4 6"
                strokeOpacity={0.45}
              />

              {currentTime !== undefined && currentTime >= 0 && (
                <ReferenceLine
                  x={currentTime > 0 ? currentTime : 0}
                  stroke="var(--chart-reference)"
                  strokeDasharray="3 6"
                  strokeOpacity={0.55}
                />
              )}

              <Line
                type="monotone"
                dataKey="wpm"
                stroke="var(--foreground)"
                strokeOpacity={0.88}
                strokeWidth={2}
                activeDot={{
                  r: 3.5,
                  strokeWidth: 2,
                  stroke: "var(--background)",
                  fill: "var(--foreground)",
                }}
                dot={false}
                isAnimationActive
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
