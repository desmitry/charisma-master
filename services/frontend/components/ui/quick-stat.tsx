import React from "react";

export function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="group relative flex flex-col gap-2 rounded-3xl border border-card-border bg-card-bg backdrop-blur-2xl p-5 shadow-[0_8px_32px_0_var(--shadow-color)] transition-all duration-500 hover:border-foreground/20 hover:bg-surface">
      <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none rounded-3xl" />
      <div className="flex items-center gap-4 relative z-10 w-full overflow-hidden">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-inner border border-card-border transition-transform duration-500 group-hover:scale-110 group-hover:bg-surface-hover">
          <span className="drop-shadow-md">{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-foreground/45 tracking-widest uppercase truncate">{label}</p>
          <p className="text-[22px] font-medium tabular-nums tracking-tight mt-0.5 text-foreground drop-shadow-sm">{value}</p>
        </div>
      </div>
    </div>
  );
}
