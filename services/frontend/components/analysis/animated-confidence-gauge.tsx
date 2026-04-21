"use client";

import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/types/analysis";

function MiniBar({
	label,
	value,
	delay,
	mounted,
}: {
	label: string;
	value: number;
	delay: number;
	mounted: boolean;
}) {
	const [animValue, setAnimValue] = useState(0);

	useEffect(() => {
		if (!mounted) return;
		const timer = setTimeout(() => {
			const start = Date.now();
			const duration = 800;
			const animate = () => {
				const elapsed = Date.now() - start;
				const progress = Math.min(elapsed / duration, 1);
				setAnimValue(value * (1 - (1 - progress) ** 3));
				if (progress < 1) requestAnimationFrame(animate);
			};
			animate();
		}, delay);
		return () => clearTimeout(timer);
	}, [mounted, value, delay]);

	return (
		<div>
			<div className="flex justify-between text-[11px] mb-1">
				<span className="text-white/40">{label}</span>
				<span className="text-white/70 tabular-nums">
					{Math.round(animValue)}
				</span>
			</div>
			<div className="h-1 rounded-full bg-white/5 overflow-hidden">
				<div
					className="h-full rounded-full bg-white/30 transition-all duration-100"
					style={{ width: `${Math.min(100, Math.max(0, animValue))}%` }}
				/>
			</div>
		</div>
	);
}

export function AnimatedConfidenceGauge({
	total,
	components,
	mounted,
}: {
	total: number;
	components: AnalysisResult["confidence_index"]["components"];
	mounted: boolean;
}) {
	const [animValue, setAnimValue] = useState(0);
	const normalizedTotal = Math.min(100, Math.max(0, total));

	useEffect(() => {
		if (!mounted) return;
		const start = Date.now();
		const duration = 1500;
		const animate = () => {
			const elapsed = Date.now() - start;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - (1 - progress) ** 4;
			setAnimValue(normalizedTotal * eased);
			if (progress < 1) requestAnimationFrame(animate);
		};
		const timer = setTimeout(animate, 600);
		return () => clearTimeout(timer);
	}, [mounted, normalizedTotal]);

	const radius = 45;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference * (1 - animValue / 100);

	return (
		<div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-500 hover:border-white/20">
			<div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
			<div className="relative z-10">
				<h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-5">
					Детали уверенности
				</h3>
				<div className="flex items-center gap-5">
					<div className="relative h-20 w-20 flex-shrink-0 drop-shadow-[0_0_15px_rgba(255,199,0,0.3)]">
						<svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
							<circle
								cx="50"
								cy="50"
								r={radius}
								stroke="rgba(255,255,255,0.06)"
								strokeWidth="6"
								fill="none"
							/>
							<circle
								cx="50"
								cy="50"
								r={radius}
								stroke="#FFC700"
								strokeWidth="6"
								strokeDasharray={circumference}
								strokeDashoffset={offset}
								strokeLinecap="round"
								fill="none"
								style={{ transition: "stroke-dashoffset 0.2s linear" }}
							/>
						</svg>
						<div className="absolute inset-0 flex items-center justify-center">
							<span className="text-2xl font-bold tabular-nums drop-shadow-md">
								{Math.round(animValue)}
							</span>
						</div>
					</div>
					<div className="flex-1 space-y-4">
						<MiniBar
							label="Громкость"
							value={Math.min(100, Math.max(0, components.volume_score))}
							delay={700}
							mounted={mounted}
						/>
						<MiniBar
							label="Чистота речи"
							value={Math.min(100, Math.max(0, components.filler_score))}
							delay={800}
							mounted={mounted}
						/>
						<MiniBar
							label="Взгляд"
							value={Math.min(100, Math.max(0, components.gaze_score))}
							delay={900}
							mounted={mounted}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
