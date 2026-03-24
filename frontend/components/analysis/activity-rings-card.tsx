"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { AnalysisResult } from "@/types/analysis";

const RING_DURATION = 1400; // ms

function AnimatedRing({
  cx, cy, r, color, trackColor, progress, strokeWidth = 10, delay = 0, icon,
}: {
  cx: number; cy: number; r: number; color: string; trackColor: string;
  progress: number; strokeWidth?: number; delay?: number; icon?: React.ReactNode;
}) {
  const circumference = 2 * Math.PI * r;
  const targetProgress = Math.min(progress, 1);
  const [offset, setOffset] = useState(circumference);
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    // Only update once on mount (with a tiny tick to ensure CSS transition fires)
    const timer = setTimeout(() => {
      setOffset(circumference * (1 - targetProgress));
      setAngle(targetProgress * 360);
    }, 50); // 50ms tick to allow initial render of offset=circumference
    return () => clearTimeout(timer);
  }, [circumference, targetProgress]);

  const showCap = progress > 0.005;
  const transitionStr = `${RING_DURATION}ms cubic-bezier(0.075, 0.82, 0.165, 1) ${delay}ms`;

  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: `stroke-dashoffset ${transitionStr}` }}
      />
      {showCap && (
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${angle}deg)`,
            transition: `transform ${transitionStr}`
          }}
        >
          {/* Cap dot at the top (angle 0 corresponds to -90deg starting point) */}
          <circle cx={cx} cy={cy - r} r={strokeWidth / 2 - 0.5} fill={color} />
          {icon && (
            <foreignObject
              x={cx - 7} y={cy - r - 7}
              width={14} height={14}
              style={{ pointerEvents: 'none' }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14,
                  transform: `rotate(-${angle}deg)`,
                  transition: `transform ${transitionStr}`
                }}
              >
                {icon}
              </div>
            </foreignObject>
          )}
        </g>
      )}
    </>
  );
}



function WpmTooltip() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: boolean }>({ left: false });

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ left: rect.right + 260 > window.innerWidth });
    }
    setVisible(true);
  };

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setVisible(false)}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="cursor-pointer text-white/30 hover:text-white/60 transition-colors flex-shrink-0">
        <circle cx="7" cy="7" r="6.5" stroke="currentColor"/>
        <text x="7" y="10.5" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="600">i</text>
      </svg>
      {visible && (
        <span
          className="absolute top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-[#2a2a2e] border border-white/10 text-[11px] text-white/70 px-3 py-1.5 shadow-xl"
          style={{ pointerEvents: 'none', ...(pos.left ? { right: '20px' } : { left: '20px' }) }}
        >
          Считается, что 130 WPM — идеальное значение
        </span>
      )}
    </span>
  );
}

export function ActivityRingsCard({ result }: { result: AnalysisResult }) {
  const score = Math.round(result.confidence_index.total);
  const fillerRatio = result.fillers_summary.ratio * 100;
  const purityRatio = Math.max(0, 100 - fillerRatio);
  const avgWpm = Math.round(result.tempo.reduce((sum, p) => sum + p.wpm, 0) / result.tempo.length);

  const scoreProgress = score / 100;
  const purityProgress = purityRatio / 100;
  const wpmIdeal = 130;
  const wpmDeviation = Math.abs(avgWpm - wpmIdeal);
  const wpmProgress = Math.max(0, 1 - wpmDeviation / wpmIdeal);

  const size = 184;
  const cx = size / 2;
  const cy = size / 2;
  const sw = 18;
  const gap = 1.5;
  const r1 = cx - sw / 2 - 2;
  const r2 = r1 - sw - gap;
  const r3 = r2 - sw - gap;

  const colorOuter  = "rgba(255,255,255,0.92)";
  const trackOuter  = "rgba(255,255,255,0.07)";
  const colorMiddle = "rgba(255,255,255,0.65)";
  const trackMiddle = "rgba(255,255,255,0.06)";
  const colorInner  = "rgba(255,255,255,0.40)";
  const trackInner  = "rgba(255,255,255,0.05)";

  return (
    <div className="rounded-[24px] bg-[#111] border border-white/[0.06] text-white flex flex-col min-w-[300px] max-w-[340px]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="px-6 pt-5 pb-0">
        <p className="text-[11px] font-mono text-white/35 uppercase tracking-[0.18em]">Общая статистика</p>
      </div>
      <div className="flex items-center justify-center pt-8 pb-5 px-5">
        <div className="relative">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <AnimatedRing
              cx={cx} cy={cy} r={r1} color={colorOuter} trackColor={trackOuter}
              progress={scoreProgress} strokeWidth={sw} delay={0}
              icon={
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            />
            <AnimatedRing
              cx={cx} cy={cy} r={r2} color={colorMiddle} trackColor={trackMiddle}
              progress={purityProgress} strokeWidth={sw} delay={150}
              icon={
                <svg width="8" height="8" viewBox="0 0 24 24" fill="#000" stroke="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                </svg>
              }
            />
            <AnimatedRing
              cx={cx} cy={cy} r={r3} color={colorInner} trackColor={trackInner}
              progress={wpmProgress} strokeWidth={sw} delay={300}
              icon={
                <svg width="8" height="8" viewBox="0 0 24 24" fill="#000" stroke="none">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              }
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none">
            <motion.span
              className="text-[32px] font-bold tracking-tight text-white leading-none"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ease: "circOut", duration: 1, delay: 0.2 }}
            >
              {score}
            </motion.span>
          </div>
        </div>
      </div>

      <div className="flex flex-col px-6 pb-6 gap-5">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span className="text-[11px] font-mono text-white/35 uppercase tracking-widest">Оценка</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[24px] font-bold tracking-tight leading-none text-white">{score}</span>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="rgba(255,255,255,0.35)" stroke="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            <span className="text-[11px] font-mono text-white/35 uppercase tracking-widest">Чистота речи</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[24px] font-bold tracking-tight leading-none text-white">{purityRatio.toFixed(1)}</span>
            <span className="text-[13px] font-semibold text-white/40">%</span>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="rgba(255,255,255,0.35)" stroke="none">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            <span className="text-[11px] font-mono text-white/35 uppercase tracking-widest">Темп речи</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[24px] font-bold tracking-tight leading-none text-white">{avgWpm}</span>
              <span className="text-[13px] font-semibold text-white/40">WPM</span>
            </div>
            <WpmTooltip />
          </div>
        </div>
      </div>
    </div>
  );
}
