"use client";

import { Safari } from "@/components/ui/safari-browser";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function FeaturesSection({ onStartDemo }: { onStartDemo?: () => void }) {
	return (
		<section className="relative z-10 w-full pt-20 pb-12 sm:pt-36 sm:pb-20 px-0">
			<div className="mx-auto w-full max-w-[100vw]">
				<ScrollReveal distance={40}>
					{/* Outer glow wrapper */}
					<div className="relative mx-auto w-full max-w-7xl px-2 sm:px-4">
						{/* Ambient glow behind browser */}
						<div
							className="absolute -inset-8 sm:-inset-16 rounded-[40px] opacity-40 blur-3xl pointer-events-none"
							style={{
								background:
									"radial-gradient(ellipse 70% 50% at 50% 30%, rgba(56,189,248,0.12) 0%, rgba(56,189,248,0) 70%), radial-gradient(ellipse 50% 60% at 50% 50%, rgba(168,85,247,0.08) 0%, transparent 70%)",
							}}
						/>

						{/* Browser window */}
						<div className="relative">
							{/* Safari SVG frame */}
							<Safari
								url="charisma-master"
								src="/macview.png"
								className="w-full h-auto drop-shadow-[0_40px_100px_rgba(0,0,0,0.7)]"
							/>

							{/* Bottom CTA overlay */}
							<div className="absolute bottom-[6%] sm:bottom-[10%] left-0 right-0 flex flex-col items-center gap-5 sm:gap-8 px-4">
								<div className="flex flex-col items-center gap-2">
									<p className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] text-white/50 uppercase">
										Инструмент для уверенной речи
									</p>
									<h3 className="text-center text-2xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white/95">
										Посмотри, как это будет выглядеть
									</h3>
								</div>

								{/* Demo button */}
								<DemoButton onClick={onStartDemo} />
							</div>
						</div>
					</div>
				</ScrollReveal>
			</div>
		</section>
	);
}

function DemoButton({ onClick }: { onClick?: () => void }) {
	return (
		<button
			onClick={onClick}
			className="bg-slate-800 no-underline group cursor-pointer relative shadow-3xl shadow-zinc-900 rounded-full p-px text-xs font-semibold leading-6 text-white inline-block"
		>
			<span className="absolute inset-0 overflow-hidden rounded-full">
				<span className="absolute inset-0 rounded-full bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(56,189,248,0.6)_0%,rgba(56,189,248,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
			</span>
			<div className="relative flex space-x-3 items-center z-10 rounded-full bg-zinc-950 py-1 px-10 ring-1 ring-white/10 transition-colors group-hover:bg-zinc-900">
				<span className="text-base sm:text-lg tracking-tight">Демо версия</span>
				<svg
					fill="none"
					height="20"
					viewBox="0 0 24 24"
					width="20"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M10.75 8.75L14.25 12L10.75 15.25"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
					/>
				</svg>
			</div>
			<span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-emerald-400/0 via-emerald-400/90 to-emerald-400/0 transition-opacity duration-500 group-hover:opacity-40" />
		</button>
	);
}
