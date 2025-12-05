"use client";

import { TempoPoint } from "@/types/analysis";

export function TempoChart({ data }: { data: TempoPoint[] }) {
  const width = 600;
  const height = 220;
  const padding = 32;

  if (!data.length) return null;

  const maxWpm = Math.max(...data.map((p) => p.wpm), 1);
  const maxTime = Math.max(...data.map((p) => p.time), 1);

  const points = data.map((p) => {
    const x = padding + (p.time / maxTime) * (width - padding * 2);
    const y = height - padding - (p.wpm / maxWpm) * (height - padding * 2);
    return { ...p, x, y };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between px-1 pb-2 text-sm text-white/70">
        <span>Темп речи (WPM)</span>
        <span className="text-white/50">X: время, Y: слова/мин</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="tempoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(109, 213, 250, 0.4)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.05)" />
          </linearGradient>
          <linearGradient id="tempoLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6dd5fa" />
            <stop offset="100%" stopColor="#b180ff" />
          </linearGradient>
        </defs>

        <path
          d={`${path} L ${points.at(-1)?.x ?? 0} ${height - padding} L ${
            points[0].x
          } ${height - padding} Z`}
          fill="url(#tempoFill)"
          opacity={0.6}
        />

        <path
          d={path}
          fill="none"
          stroke="url(#tempoLine)"
          strokeWidth={3}
          strokeLinecap="round"
        />

        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r={5} fill="white" opacity={0.9} />
            <circle
              cx={p.x}
              cy={p.y}
              r={10}
              fill={
                p.zone === "red"
                  ? "rgba(248,113,113,0.25)"
                  : p.zone === "yellow"
                    ? "rgba(250,204,21,0.2)"
                    : "rgba(74,222,128,0.2)"
              }
            />
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              className="text-[10px] fill-white/70"
            >
              {Math.round(p.wpm)}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line
          x1={padding}
          y1={padding / 2}
          x2={padding}
          y2={height - padding}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1.5}
        />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}

