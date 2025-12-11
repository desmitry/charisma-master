"use client";

import { TempoPoint } from "@/types/analysis";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useEcoMode } from "@/lib/eco-mode-context";

type Props = {
  data: TempoPoint[];
  currentTime?: number;
  onExpand?: () => void;
  expanded?: boolean;
  inModal?: boolean;
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export function TempoChart({ data, currentTime, onExpand, expanded, inModal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number; point: TempoPoint } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [displayedWpm, setDisplayedWpm] = useState<number>(0);
  const targetWpmRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const throttleTimerRef = useRef<number | null>(null);
  const lastHoverPointRef = useRef<TempoPoint | null>(null);
  const { isEcoMode } = useEcoMode();
  
  useEffect(() => {
    if (!hoverPoint) {
      targetWpmRef.current = 0;
      return;
    }
    const newTarget = Math.round(hoverPoint.point.wpm);
    targetWpmRef.current = newTarget;
    
    if (isEcoMode) {
      setDisplayedWpm(newTarget);
    }
  }, [hoverPoint, isEcoMode]);
  
  useEffect(() => {
    if (isEcoMode) return;

    const animate = () => {
      setDisplayedWpm((prev) => {
        const target = targetWpmRef.current || 0;
        const diff = target - prev;
        if (Math.abs(diff) < 0.5) {
          return target;
        }
        const step = diff * 0.15;
        return Math.round(prev + step);
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isEcoMode]);

  const padding = { top: 20, right: 16, bottom: 28, left: 36 };
  const height = expanded ? 320 : 140;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!data.length) return null;

  const width = containerWidth;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const stats = useMemo(() => {
    const wpmValues = data.map(p => p.wpm);
    return {
      min: Math.min(...wpmValues),
      max: Math.max(...wpmValues),
      avg: wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length,
    };
  }, [data]);

  const yRange = useMemo(() => {
    const range = stats.max - stats.min || 50;
    const pad = range * 0.1;
    return {
      min: Math.max(0, stats.min - pad),
      max: stats.max + pad,
    };
  }, [stats]);

  const points = useMemo(() => {
    const maxTime = Math.max(...data.map(p => p.time), 1);
    return data.map(p => {
      const x = padding.left + (p.time / maxTime) * chartWidth;
      const y = padding.top + chartHeight - ((p.wpm - yRange.min) / (yRange.max - yRange.min)) * chartHeight;
      return { ...p, x, y };
    });
  }, [data, chartWidth, chartHeight, padding, yRange]);

  const linePath = useMemo(() => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length < 2) return "";
    const bottomY = padding.top + chartHeight;
    return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  }, [linePath, points, chartHeight, padding.top]);

  const yLabels = useMemo(() => {
    const count = expanded ? 5 : 3;
    const step = (yRange.max - yRange.min) / count;
    return Array.from({ length: count + 1 }, (_, i) => {
      const value = yRange.min + step * i;
      const y = padding.top + chartHeight - (i / count) * chartHeight;
      return { value: Math.round(value), y };
    });
  }, [yRange, chartHeight, padding.top, expanded]);

  const xLabels = useMemo(() => {
    const maxTime = Math.max(...data.map(p => p.time), 1);
    const count = expanded ? 8 : 4;
    const step = maxTime / count;
    return Array.from({ length: count + 1 }, (_, i) => {
      const time = step * i;
      const x = padding.left + (i / count) * chartWidth;
      return { time, x, label: formatTime(time) };
    });
  }, [data, chartWidth, padding.left, expanded]);

  const currentVideoPoint = useMemo(() => {
    if (currentTime === undefined) return null;
    let best = null as (typeof points)[number] | null;
    let minDist = Infinity;
    for (const p of points) {
      const dist = Math.abs(p.time - currentTime);
      if (dist < minDist) {
        minDist = dist;
        best = p;
      }
    }
    return best;
  }, [currentTime, points]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    if (throttleTimerRef.current === null) {
      throttleTimerRef.current = requestAnimationFrame(() => {
        throttleTimerRef.current = null;
        
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

        setMousePos({ x: mouseX, y: mouseY });

        let closest = null as (typeof points)[number] | null;
        let minDist = Infinity;
        for (const p of points) {
          const dist = Math.abs(p.x - mouseX);
          if (dist < minDist && dist < 30) {
            minDist = dist;
            closest = p;
          }
        }
        
        if (closest) {
          if (!lastHoverPointRef.current || 
              lastHoverPointRef.current.time !== closest.time ||
              lastHoverPointRef.current.wpm !== closest.wpm) {
            lastHoverPointRef.current = closest;
            setHoverPoint({ x: closest.x, y: closest.y, point: closest });
          }
        } else {
          if (lastHoverPointRef.current !== null) {
            lastHoverPointRef.current = null;
            setHoverPoint(null);
          }
        }
      });
    }
  }, [points]);

  const handleMouseLeave = useCallback(() => {
    if (throttleTimerRef.current !== null) {
      cancelAnimationFrame(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    lastHoverPointRef.current = null;
    setHoverPoint(null);
    setMousePos(null);
  }, []);

  const containerClass = expanded 
    ? "relative w-full h-full" 
    : inModal 
      ? "relative p-4"
      : "relative rounded-2xl border border-white/10 bg-white/5 p-4";

  return (
    <div 
      ref={containerRef}
      className={containerClass}
    >
      {!expanded && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Темп речи</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50">
              avg {Math.round(stats.avg)} wpm
            </span>
            {onExpand && !inModal && (
              <button
                onClick={onExpand}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors"
              >
                Развернуть
              </button>
            )}
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {yLabels.map((label, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={label.y}
              x2={width - padding.right}
              y2={label.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <text
              x={padding.left - 6}
              y={label.y + 3}
              textAnchor="end"
              className="text-[9px] fill-white/30"
            >
              {label.value}
            </text>
          </g>
        ))}

        {xLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={height - 6}
            textAnchor="middle"
            className="text-[9px] fill-white/30"
          >
            {label.label}
          </text>
        ))}

        <path
          d={areaPath}
          fill="rgba(255,255,255,0.03)"
        />

        <path
          d={linePath}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {currentVideoPoint && (
          <g>
            <line
              x1={currentVideoPoint.x}
              y1={padding.top}
              x2={currentVideoPoint.x}
              y2={padding.top + chartHeight}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <circle
              cx={currentVideoPoint.x}
              cy={currentVideoPoint.y}
              r={4}
              fill="white"
            />
          </g>
        )}

        {hoverPoint && (
          <g>
            <line
              x1={hoverPoint.x}
              y1={padding.top}
              x2={hoverPoint.x}
              y2={padding.top + chartHeight}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
            <circle
              cx={hoverPoint.x}
              cy={hoverPoint.y}
              r={4}
              fill="white"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {hoverPoint && mousePos && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: `${Math.min(Math.max(mousePos.x + 16, 16), containerWidth - 100)}px`,
            top: `${mousePos.y + 56}px`,
          }}
        >
          <div className="rounded-lg bg-black/90 border border-white/10 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap">
            <span className="font-medium tabular-nums">{displayedWpm || Math.round(hoverPoint.point.wpm)}</span>
            <span className="text-white/50"> wpm · {formatTime(hoverPoint.point.time)}</span>
          </div>
        </div>
      )}

    </div>
  );
}
