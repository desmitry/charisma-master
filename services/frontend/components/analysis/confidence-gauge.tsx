"use client";

import type { ConfidenceIndex } from "@/types/analysis";

export function ConfidenceGauge({ data }: { data: ConfidenceIndex }) {
	const radius = 64;
	const stroke = 12;
	const norm = Math.min(100, Math.max(0, data.total));
	const circumference = 2 * Math.PI * radius;
	const offset = circumference * (1 - norm / 100);

	const metrics = [
		{
			label: "Volume",
			value: data.components.volume_score,
			meta: `${data.components.volume_level} · ${data.components.volume_label}`,
		},
		{
			label: "Filler",
			value: data.components.filler_score,
			meta: data.components.filler_label,
		},
		{
			label: "Gaze",
			value: data.components.gaze_score,
			meta: data.components.gaze_label,
		},
		{
			label: "Gesture",
			value: data.components.gesture_score,
			meta: data.components.gesture_advice,
		},
		{
			label: "Tone",
			value: data.components.tone_score,
			meta: data.components.tone_label,
		},
	];

	return (
		<div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
			<p className="text-sm text-white/70">Индекс уверенности</p>
			<div className="flex flex-col gap-6 xl:flex-row xl:items-center">
				<div className="relative h-36 w-36">
					<svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
						<circle
							cx="100"
							cy="100"
							r={radius}
							stroke="rgba(255,255,255,0.12)"
							strokeWidth={stroke}
							fill="none"
						/>
						<circle
							cx="100"
							cy="100"
							r={radius}
							stroke="url(#grad)"
							strokeWidth={stroke}
							fill="none"
							strokeDasharray={circumference}
							strokeDashoffset={offset}
							strokeLinecap="round"
						/>
						<defs>
							<linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
								<stop offset="0%" stopColor="#6dd5fa" />
								<stop offset="100%" stopColor="#c084fc" />
							</linearGradient>
						</defs>
					</svg>
					<div className="absolute inset-0 flex items-center justify-center rotate-90">
						<div className="text-center">
							<p className="text-3xl font-semibold text-white">{norm}%</p>
							<p className="text-xs text-white/60">{data.total_label}</p>
						</div>
					</div>
				</div>
				<div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{metrics.map((metric) => (
						<div
							key={metric.label}
							className="rounded-2xl border border-white/10 bg-white/5 p-3"
						>
							<p className="text-xs uppercase tracking-[0.2em] text-white/50">
								{metric.label}
							</p>
							<p className="mt-1 text-lg font-semibold text-white">
								{Math.round(metric.value)}%
							</p>
							<p className="mt-1 text-xs text-white/50">{metric.meta}</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
