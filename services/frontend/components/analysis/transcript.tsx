"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { LongPause, TranscriptSegment } from "@/types/analysis";

interface TranscriptItem {
	type: "word";
	word: {
		start: number;
		end: number;
		text: string;
		is_filler?: boolean;
	};
	segmentIdx: number;
}

interface PauseItem {
	type: "pause";
	pause: LongPause;
}

type TimelineItem = TranscriptItem | PauseItem;

export function Transcript({
	segments,
	currentTime,
	onSeek,
	longPauses = [],
}: {
	segments: TranscriptSegment[];
	currentTime: number;
	onSeek: (time: number) => void;
	longPauses?: LongPause[];
}) {
	const eps = 0.02;

	// Combine words and pauses into a single timeline
	const timeline = useMemo(() => {
		const items: TimelineItem[] = [];

		// Add all words
		segments.forEach((segment, segIdx) => {
			segment.words.forEach((word) => {
				items.push({
					type: "word",
					word,
					segmentIdx: segIdx,
				});
			});
		});

		// Add pauses
		longPauses.forEach((pause) => {
			items.push({
				type: "pause",
				pause,
			});
		});

		// Sort by start time
		items.sort((a, b) => {
			const startA = a.type === "word" ? a.word.start : a.pause.start;
			const startB = b.type === "word" ? b.word.start : b.pause.start;
			return startA - startB;
		});

		return items;
	}, [segments, longPauses]);

	// Group items by segment time ranges for display
	const groupedItems = useMemo(() => {
		const groups: {
			label: string;
			segmentStart: number;
			items: TimelineItem[];
		}[] = [];
		const chunkSize = 30;

		timeline.forEach((item) => {
			const itemStart =
				item.type === "word" ? item.word.start : item.pause.start;
			const groupIdx = Math.floor(itemStart / chunkSize);
			const label = `${formatTime(groupIdx * chunkSize)} - ${formatTime((groupIdx + 1) * chunkSize)}`;

			if (!groups[groupIdx]) {
				groups[groupIdx] = {
					label,
					segmentStart: groupIdx * chunkSize,
					items: [],
				};
			}
			groups[groupIdx].items.push(item);
		});

		return groups.filter(Boolean);
	}, [timeline]);

	return (
		<div className="space-y-0.5 w-full overflow-hidden">
			{groupedItems.map((group, gIdx) => (
				<div
					key={`group-${gIdx}-${group.segmentStart}`}
					className="rounded-xl border border-white/10 bg-[#0f1016] p-3 sm:p-4 text-sm leading-[1.35] text-white/80 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
				>
					<div className="flex items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-[0.28em] text-white/45">
						<span className="shrink-0">{group.label}</span>
						<div className="h-px flex-1 bg-white/10 min-w-0" />
					</div>
					<div className="mt-1.5 text-[13px] sm:text-[14px] leading-[1.5] sm:leading-[1.4] break-words overflow-wrap-anywhere">
						{group.items.map((item, idx) => {
							if (item.type === "pause") {
								const isActive =
									currentTime + eps >= item.pause.start &&
									currentTime < item.pause.end - eps;
								return (
									<span
										key={`pause-${item.pause.start}-${idx}`}
										onClick={() => onSeek(item.pause.start)}
										className={cn(
											"inline-flex items-center cursor-pointer mx-1 align-middle",
											"group relative",
										)}
										title={`Пауза: ${item.pause.duration.toFixed(1)}с`}
									>
										<span
											className={cn(
												"inline-block w-8 sm:w-12 h-4 sm:h-5 rounded border-2 border-dashed transition-all duration-150",
												"border-rose-500/60 bg-rose-500/10",
												isActive &&
													"border-rose-400 bg-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.3)]",
												"hover:border-rose-400 hover:bg-rose-500/20",
											)}
										/>
										<span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] sm:text-[10px] text-rose-300 bg-black/80 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
											{item.pause.duration.toFixed(1)}с
										</span>
									</span>
								);
							}

							const display = item.word.text.trim();
							if (!display) return null;
							const isActive =
								currentTime + eps >= item.word.start &&
								currentTime < item.word.end - eps;
							return (
								<span
									key={`word-${display}-${idx}-${item.word.start}`}
									onClick={() => onSeek(item.word.start)}
									className={cn(
										"cursor-pointer rounded px-[2px] py-[1px] transition-all duration-150 inline",
										item.word.is_filler
											? "text-rose-300 bg-rose-500/18 hover:bg-rose-500/28"
											: "text-white/75 hover:bg-white/10",
										isActive &&
											"bg-white/15 text-white shadow-[0_8px_30px_rgba(255,255,255,0.08)]",
										"hover:-translate-y-[1px]",
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

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}
