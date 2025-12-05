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
  return (
    <div className="space-y-3">
      {segments.map((segment, idx) => (
        <div
          key={`${segment.start}-${idx}`}
          className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/80"
        >
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span>{segment.start.toFixed(1)}s</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {segment.words.map((word, wIdx) => {
              const isActive =
                currentTime >= word.start && currentTime <= word.end;
              return (
                <button
                  key={`${word.text}-${wIdx}-${word.start}`}
                  onClick={() => onSeek(word.start)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-sm transition",
                    "hover:-translate-y-0.5 hover:bg-white/15",
                    word.is_filler
                      ? "text-rose-300"
                      : "text-white/80",
                    isActive && "bg-white/15 text-white shadow-[0_10px_40px_rgba(255,255,255,0.08)]"
                  )}
                >
                  {word.text}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

