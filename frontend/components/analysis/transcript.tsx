"use client";

import { TranscriptSegment } from "@/types/analysis";
import { cn } from "@/lib/utils";

export function Transcript({
  segments,
  currentTime,
  onSeek,
}: {
  segments: TranscriptSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
}) {
  const eps = 0.02;
  return (
    <div className="space-y-0.5">
      {segments.map((segment, idx) => (
        <div
          key={`${segment.start}-${idx}`}
          className="rounded-xl border border-white/10 bg-[#0f1016] p-4 text-sm leading-[1.35] text-white/80 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-white/45">
            <span>{segment.start.toFixed(1)}s</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <div className="mt-1.5 text-[14px] leading-[1.4] whitespace-normal break-words">
            {segment.words.map((word, wIdx) => {
              const display = word.text.trim();
              if (!display) return null;
              const isActive =
                currentTime + eps >= word.start && currentTime < word.end - eps;
              return (
                <span
                  key={`${display}-${wIdx}-${word.start}`}
                  onClick={() => onSeek(word.start)}
                  className={cn(
                    "cursor-pointer rounded px-[2px] py-[1px] transition-all duration-150",
                    word.is_filler
                      ? "text-rose-200 bg-rose-500/10 hover:bg-rose-400/20"
                      : "text-white/75 hover:bg-white/10",
                    isActive && "bg-white/15 text-white shadow-[0_8px_30px_rgba(255,255,255,0.08)]",
                    "hover:-translate-y-[1px]"
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
  );
}

