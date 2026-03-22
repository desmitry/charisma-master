"use client";

import { useMemo, useState, useEffect } from "react";
import { TempoPoint } from "@/types/analysis";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine 
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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as TempoPoint;
    return (
      <div className="rounded-lg bg-black/90 border border-white/10 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap">
        <span className="font-medium tabular-nums text-white">{Math.round(data.wpm)}</span>
        <span className="text-white/50"> wpm · {formatTime(data.time)}</span>
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
    const wpmValues = data.map(p => p.wpm);
    return {
      min: Math.min(...wpmValues),
      max: Math.max(...wpmValues),
      avg: wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length,
    };
  }, [data]);

  const yRange = useMemo(() => {
    const range = (stats.max - stats.min) || 50;
    const pad = range * 0.1;
    return [Math.max(0, Math.floor(stats.min - pad)), Math.ceil(stats.max + pad)];
  }, [stats]);

  return (
    <div className="relative w-full h-[180px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-white">Темп речи</span>
        <span className="text-xs text-white/50">
          avg {Math.round(stats.avg)} wpm
        </span>
      </div>

      <div className="flex-1 w-full min-h-0">
        {mounted && (
          <ResponsiveContainer width="100%" height={130} minWidth={1} minHeight={1}>
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorWpm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgba(255,255,255,0.15)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="rgba(255,255,255,0.01)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatTime} 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                minTickGap={30}
              />
              <YAxis 
                domain={yRange}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                width={40}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '3 3' }}
                isAnimationActive={true}
              />
              {currentTime !== undefined && currentTime >= 0 && (
                <ReferenceLine 
                  x={currentTime > 0 ? currentTime : 0} 
                  stroke="rgba(255,255,255,0.4)" 
                  strokeDasharray="3 3" 
                />
              )}
              <Area 
                type="monotone" 
                dataKey="wpm" 
                stroke="rgba(255,255,255,0.6)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorWpm)" 
                isAnimationActive={true}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
