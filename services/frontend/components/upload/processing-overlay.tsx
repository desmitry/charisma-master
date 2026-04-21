"use client";

import { AnimatePresence, motion } from "framer-motion";

type Props = {
	progress: number;
	statusText?: string;
	onComplete?: () => void;
};

export function ProcessingOverlay({
	progress,
	statusText = "Обработка...",
}: Props) {
	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
			{/* Soft background overlay instead of solid heavy blur */}
			<div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-all duration-700 pointer-events-auto" />

			<motion.div
				initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
				animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
				exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
				transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
				className="relative pointer-events-auto flex w-[280px] sm:w-[320px] flex-col items-center justify-center gap-6 p-8 bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]"
			>
				{/* Soft internal glow */}
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

				{/* Minimal Spinner */}
				<div className="relative flex items-center justify-center w-12 h-12">
					<svg
						className="absolute w-full h-full text-white/10"
						viewBox="0 0 100 100"
					>
						<circle
							cx="50"
							cy="50"
							r="46"
							fill="none"
							stroke="currentColor"
							strokeWidth="4"
						/>
					</svg>
					<motion.svg
						className="absolute w-full h-full text-white/90"
						viewBox="0 0 100 100"
						animate={{ rotate: 360 }}
						transition={{ repeat: Infinity, ease: "linear", duration: 1.5 }}
					>
						<circle
							cx="50"
							cy="50"
							r="46"
							fill="none"
							stroke="currentColor"
							strokeWidth="4"
							strokeDasharray="289"
							strokeDashoffset="200"
							strokeLinecap="round"
						/>
					</motion.svg>
					{/* Inner dot pulsing */}
					<motion.div
						className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_white]"
						animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
						transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
					/>
				</div>

				{/* Real-time Text transition */}
				<div className="relative w-full h-6 flex items-center justify-center overflow-visible">
					<AnimatePresence mode="popLayout">
						<motion.p
							key={statusText}
							initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
							animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
							exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
							transition={{ duration: 0.4, ease: "easeOut" }}
							className="absolute text-sm font-medium tracking-wide text-white/90 text-center whitespace-nowrap"
						>
							{statusText}
						</motion.p>
					</AnimatePresence>
				</div>

				{/* Real Progress bar */}
				<div className="w-full relative mt-2">
					<div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
						<motion.div
							className="h-full bg-white rounded-full"
							initial={{ width: "0%" }}
							animate={{
								width: `${Math.max(0, Math.min(100, progress * 100))}%`,
							}}
							transition={{ duration: 0.5, ease: "easeInOut" }}
						/>
					</div>
					<div className="flex justify-between mt-1">
						<div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
							Анализ
						</div>
						<motion.div
							className="text-[10px] font-mono text-white/60"
							key={Math.round(progress * 100)}
						>
							{Math.round(progress * 100)}%
						</motion.div>
					</div>
				</div>
			</motion.div>
		</div>
	);
}
