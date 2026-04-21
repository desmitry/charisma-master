import type React from "react";

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
		<div className="group relative flex flex-col gap-2 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl p-5 transition-all duration-500 hover:border-white/20 hover:bg-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(255,255,255,0.05)]">
			<div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-3xl" />
			<div className="flex items-center gap-4 relative z-10 w-full overflow-hidden">
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 shadow-inner border border-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:bg-white/10">
					<span className="drop-shadow-md">{icon}</span>
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-[10px] font-semibold text-white/40 tracking-widest uppercase truncate">
						{label}
					</p>
					<p className="text-[22px] font-medium tabular-nums tracking-tight mt-0.5 text-white drop-shadow-sm">
						{value}
					</p>
				</div>
			</div>
		</div>
	);
}
