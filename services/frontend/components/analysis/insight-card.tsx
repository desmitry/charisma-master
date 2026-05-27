
import { cn } from "@/lib/utils";

export function InsightCard({
  title,
  content,
  mounted,
  accent,
  className,
}: {
  title: string;
  content: string;
  mounted: boolean;
  accent?: "red" | "amber";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border transition-all duration-500 shadow-[0_8px_32px_0_var(--shadow-color)]",
        accent === "red" ? "border-rose-500/20 bg-background/40 backdrop-blur-2xl hover:border-rose-500/40" :
        accent === "amber" ? "border-amber-500/20 bg-background/40 backdrop-blur-2xl hover:border-amber-500/40" :
        "border-foreground/10 bg-background/40 backdrop-blur-2xl hover:border-foreground/30",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none" />
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
            accent === "amber" && "[color:var(--accent-amber)]",
            accent === "red" && "[color:var(--accent-rose)]",
            !accent && "text-foreground"
          )}
        >
          {title}
        </h3>
        <p className="text-[14px] leading-relaxed text-foreground/70 whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
