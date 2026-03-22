import React from "react";
import { cn } from "@/lib/utils";

export function InsightCard({
  title,
  content,
  delay,
  mounted,
  accent,
  className,
}: {
  title: string;
  content: string;
  delay: number;
  mounted: boolean;
  accent?: "red" | "amber";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border transition-all duration-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(255,255,255,0.05)]",
        accent === "red" ? "border-rose-500/20 bg-black/40 backdrop-blur-2xl hover:border-rose-500/40" : 
        accent === "amber" ? "border-amber-500/20 bg-black/40 backdrop-blur-2xl hover:border-amber-500/40" : 
        "border-white/10 bg-black/40 backdrop-blur-2xl hover:border-white/30",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="relative z-10 p-6">
        {/* Accent line */}
        {accent && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1",
              accent === "red" && "bg-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.5)]",
              accent === "amber" && "bg-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
            )}
          />
        )}

        <h3
          className={cn(
            "text-base font-semibold mb-3 tracking-tight drop-shadow-sm",
            accent === "amber" && "text-amber-200/90",
            accent === "red" && "text-rose-300/90",
            !accent && "text-white"
          )}
        >
          {title}
        </h3>
        <p className="text-[14px] leading-relaxed text-white/70 whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
