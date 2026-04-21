"use client";

import {
	Checkbox,
	Popover,
	PopoverButton,
	PopoverPanel,
} from "@headlessui/react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/types/analysis";

type PdfExportDropdownProps = {
	result: AnalysisResult;
};

type ExportOptions = {
	summary: boolean;
	transcript: boolean;
	tempo: boolean;
	confidence: boolean;
	mistakes: boolean;
	structure: boolean;
	idealText: boolean;
	personaFeedback: boolean;
	presentationFeedback: boolean;
	criteria: boolean;
	longPauses: boolean;
	dynamicFillers: boolean;
};

type Html2CanvasOptions = Parameters<typeof html2canvas>[1];

function formatPdfTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

function zoneColor(zone?: string) {
	if (zone === "red") return "#f43f5e";
	if (zone === "yellow") return "#f59e0b";
	if (zone === "green") return "#34d399";
	return "rgba(255,255,255,0.5)";
}

export function PdfExportDropdown({ result }: PdfExportDropdownProps) {
	const [options, setOptions] = useState<ExportOptions>({
		summary: true,
		transcript: true,
		tempo: true,
		confidence: true,
		mistakes: true,
		structure: true,
		idealText: true,
		personaFeedback: true,
		presentationFeedback: true,
		criteria: true,
		longPauses: result.long_pauses.length > 0,
		dynamicFillers: result.speech_report.dynamic_fillers.length > 0,
	});
	const [isGenerating, setIsGenerating] = useState(false);
	const pdfContentRef = useRef<HTMLDivElement>(null);

	const transcriptChunks = useMemo(() => {
		const words = result.transcript?.flatMap((segment) => segment.words) ?? [];
		const chunkSize = 600;
		const chunks: (typeof words)[] = [];
		for (let index = 0; index < words.length; index += chunkSize) {
			chunks.push(words.slice(index, index + chunkSize));
		}
		return chunks;
	}, [result.transcript]);

	const toggleOption = (key: keyof ExportOptions) => {
		setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const generatePdf = async (close: () => void) => {
		if (!pdfContentRef.current) return;
		setIsGenerating(true);

		try {
			const pdf = new jsPDF({
				orientation: "portrait",
				unit: "mm",
				format: "a4",
			});

			const pageWidth = pdf.internal.pageSize.getWidth();
			const pageHeight = pdf.internal.pageSize.getHeight();
			const margin = 10;
			const contentWidth = pageWidth - margin * 2;
			let cursorY = margin;

			const ensureBackground = () => {
				pdf.setFillColor(10, 10, 10);
				pdf.rect(0, 0, pageWidth, pageHeight, "F");
			};

			ensureBackground();

			const blocks = Array.from(
				pdfContentRef.current.querySelectorAll<HTMLElement>("[data-pdf-block]"),
			);

			for (const block of blocks) {
				const canvasOptions = {
					scale: 2,
					backgroundColor: "#0a0a0a",
					logging: false,
					useCORS: true,
				} as Html2CanvasOptions;
				const canvas = await html2canvas(block, canvasOptions);
				const isSliceable = block.getAttribute("data-pdf-slice") === "true";
				const imgData = canvas.toDataURL("image/png");
				const drawWidth = contentWidth;
				const drawHeight = (canvas.height * contentWidth) / canvas.width;
				const offsetX = margin;

				if (isSliceable) {
					let used = 0;
					while (used < drawHeight - 0.1) {
						const available = pageHeight - margin - cursorY;
						if (available <= 2) {
							pdf.addPage();
							ensureBackground();
							cursorY = margin;
							continue;
						}

						pdf.addImage(
							imgData,
							"PNG",
							offsetX,
							cursorY - used,
							drawWidth,
							drawHeight,
						);
						used += available;

						if (used < drawHeight - 0.1) {
							pdf.addPage();
							ensureBackground();
							cursorY = margin;
						} else {
							cursorY += drawHeight - (used - available) + 6;
						}
					}
				} else {
					const maxBlockHeight = pageHeight - margin * 2;
					let finalWidth = drawWidth;
					let finalHeight = drawHeight;

					if (finalHeight > maxBlockHeight) {
						const scaleFactor = maxBlockHeight / finalHeight;
						finalHeight = maxBlockHeight;
						finalWidth = finalWidth * scaleFactor;
					}

					if (cursorY + finalHeight > pageHeight - margin) {
						pdf.addPage();
						ensureBackground();
						cursorY = margin;
					}

					const centeredX = margin + (contentWidth - finalWidth) / 2;
					pdf.addImage(
						imgData,
						"PNG",
						centeredX,
						cursorY,
						finalWidth,
						finalHeight,
					);
					cursorY += finalHeight + 6;
				}
			}

			pdf.save(`charisma-report-${result.task_id.slice(0, 8)}.pdf`);
			close();
		} finally {
			setIsGenerating(false);
		}
	};

	const optionsList = [
		{ key: "summary" as const, label: "Статистика" },
		{ key: "confidence" as const, label: "Уверенность" },
		{ key: "tempo" as const, label: "Темп речи" },
		{ key: "criteria" as const, label: "Критерии ИИ" },
		{ key: "transcript" as const, label: "Транскрипция" },
		{ key: "mistakes" as const, label: "Ошибки" },
		{ key: "structure" as const, label: "Структура" },
		{ key: "idealText" as const, label: "Идеальный текст" },
		{ key: "personaFeedback" as const, label: "Фидбэк персоны" },
		{ key: "presentationFeedback" as const, label: "Фидбэк по презентации" },
		{
			key: "longPauses" as const,
			label: "Долгие паузы",
			disabled: result.long_pauses.length === 0,
		},
		{
			key: "dynamicFillers" as const,
			label: "Слова-паразиты",
			disabled: result.speech_report.dynamic_fillers.length === 0,
		},
	];

	return (
		<Popover className="relative z-50">
			<PopoverButton className="rounded-md border border-white/[0.08] bg-[#111] hover:bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20">
				Экспорт PDF
			</PopoverButton>

			<PopoverPanel
				transition
				className="absolute right-0 top-full mt-2 w-[260px] rounded-xl border border-white/15 bg-[#0c0c0c]/95 backdrop-blur-xl shadow-2xl overflow-hidden transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
			>
				{({ close }) => (
					<>
						<div className="p-3 space-y-1">
							{optionsList.map((opt) => (
								<div
									key={opt.key}
									onClick={() => !opt.disabled && toggleOption(opt.key)}
									className={cn(
										"w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all select-none",
										opt.disabled
											? "opacity-30 cursor-not-allowed"
											: "cursor-pointer hover:bg-white/5",
										options[opt.key] && !opt.disabled
											? "bg-white/10 text-white"
											: "text-white/60 hover:text-white/80",
									)}
								>
									<span>{opt.label}</span>
									<Checkbox
										checked={options[opt.key]}
										disabled={opt.disabled}
										onChange={() => {}}
										className="group block h-4 w-4 rounded border border-white/30 bg-transparent transition-all data-[checked]:bg-white data-[checked]:border-white"
									>
										<svg
											className="h-3 w-3 stroke-black opacity-0 group-data-[checked]:opacity-100 mx-auto mt-0.5"
											fill="none"
											viewBox="0 0 14 14"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={3}
												d="M3 8L6 11L11 3.5"
											/>
										</svg>
									</Checkbox>
								</div>
							))}
						</div>

						<div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/[0.02]">
							<span className="text-xs text-white/40">
								{Object.values(options).filter(Boolean).length} из{" "}
								{optionsList.length} выбрано
							</span>
							<button
								onClick={() => generatePdf(close)}
								disabled={
									isGenerating ||
									Object.values(options).every((value) => !value)
								}
								className={cn(
									"flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
									isGenerating ||
										Object.values(options).every((value) => !value)
										? "bg-white/10 text-white/30 cursor-not-allowed"
										: "bg-white text-black hover:bg-white/90 shadow-lg",
								)}
							>
								{isGenerating ? "Генерация..." : "Скачать PDF"}
							</button>
						</div>
					</>
				)}
			</PopoverPanel>

			<div className="fixed left-[-9999px] top-0">
				<div
					ref={pdfContentRef}
					style={{
						width: "750px",
						fontFamily: "Arial, Helvetica, sans-serif",
						backgroundColor: "#0a0a0a",
						color: "#ffffff",
						padding: "0",
					}}
				>
					<div
						data-pdf-block
						style={{ padding: "16px 20px", backgroundColor: "#0a0a0a" }}
					>
						<table style={{ width: "100%", borderCollapse: "collapse" }}>
							<tbody>
								<tr>
									<td style={{ verticalAlign: "top" }}>
										<h1
											style={{
												fontSize: "28px",
												fontWeight: "bold",
												margin: 0,
												color: "#fff",
											}}
										>
											Charisma
										</h1>
										<p
											style={{
												color: "rgba(255,255,255,0.5)",
												fontSize: "14px",
												margin: "4px 0 0 0",
											}}
										>
											Отчет по анализу выступления
										</p>
									</td>
									<td
										style={{
											verticalAlign: "top",
											textAlign: "right",
											fontSize: "12px",
											color: "rgba(255,255,255,0.4)",
										}}
									>
										<p style={{ margin: 0 }}>
											ID: {result.task_id.slice(0, 8)}
										</p>
										<p style={{ margin: "2px 0 0 0" }}>
											{new Date().toLocaleDateString("ru-RU")}
										</p>
										<p
											style={{
												margin: "4px 0 0 0",
												color: "rgba(255,255,255,0.6)",
											}}
										>
											{result.analyze_provider} / {result.analyze_model}
										</p>
										<p
											style={{
												margin: "2px 0 0 0",
												color: "rgba(255,255,255,0.45)",
											}}
										>
											transcribe: {result.transcribe_model}
										</p>
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					{options.summary && (
						<div
							data-pdf-block
							style={{ padding: "12px 20px", backgroundColor: "#0a0a0a" }}
						>
							<h2
								style={{
									fontSize: "16px",
									fontWeight: "600",
									marginBottom: "10px",
									color: "#fff",
								}}
							>
								Общая статистика
							</h2>
							<div>
								{[
									{
										label: "Паразиты",
										value: result.fillers_summary.count,
										sub: `${(result.fillers_summary.ratio * 100).toFixed(1)}%`,
									},
									{
										label: "Уверенность",
										value: Math.min(
											100,
											Math.max(0, result.confidence_index.total),
										).toFixed(0),
										sub: result.confidence_index.total_label,
									},
									{
										label: "Критерии ИИ",
										value: result.evaluation_criteria_report.total_score,
										sub: `из ${result.evaluation_criteria_report.max_score}`,
									},
									{
										label: "Фрагментов",
										value: result.transcript.length,
										sub: "",
									},
								].map((item, index) => (
									<div
										key={item.label}
										style={{
											display: "inline-block",
											width: "168px",
											marginRight: index < 3 ? "10px" : 0,
											verticalAlign: "top",
											borderRadius: "12px",
											backgroundColor: "rgba(255,255,255,0.05)",
											padding: "14px",
											border: "1px solid rgba(255,255,255,0.1)",
											boxSizing: "border-box",
										}}
									>
										<p
											style={{
												fontSize: "11px",
												color: "rgba(255,255,255,0.5)",
												textTransform: "uppercase",
												margin: 0,
											}}
										>
											{item.label}
										</p>
										<p
											style={{
												fontSize: "22px",
												fontWeight: "bold",
												margin: "6px 0 2px 0",
												color: "#fff",
											}}
										>
											{item.value}
										</p>
										<p
											style={{
												fontSize: "11px",
												color: "rgba(255,255,255,0.4)",
												margin: 0,
												minHeight: "14px",
											}}
										>
											{item.sub}
										</p>
									</div>
								))}
							</div>
						</div>
					)}

					{options.confidence && (
						<div
							data-pdf-block
							style={{ padding: "12px 20px", backgroundColor: "#0a0a0a" }}
						>
							<h2
								style={{
									fontSize: "16px",
									fontWeight: "600",
									marginBottom: "10px",
									color: "#fff",
								}}
							>
								Индекс уверенности:{" "}
								{Math.min(
									100,
									Math.max(0, result.confidence_index.total),
								).toFixed(0)}
								/100
							</h2>
							<div
								style={{
									borderRadius: "12px",
									backgroundColor: "rgba(255,255,255,0.05)",
									padding: "16px",
									border: "1px solid rgba(255,255,255,0.1)",
								}}
							>
								{[
									{
										label: "Громкость",
										value: result.confidence_index.components.volume_score,
										sub: `${result.confidence_index.components.volume_level} · ${result.confidence_index.components.volume_label}`,
									},
									{
										label: "Паразиты",
										value: result.confidence_index.components.filler_score,
										sub: result.confidence_index.components.filler_label,
									},
									{
										label: "Взгляд",
										value: result.confidence_index.components.gaze_score,
										sub: result.confidence_index.components.gaze_label,
									},
									{
										label: "Жесты",
										value: result.confidence_index.components.gesture_score,
										sub: result.confidence_index.components.gesture_advice,
									},
									{
										label: "Тон",
										value: result.confidence_index.components.tone_score,
										sub: result.confidence_index.components.tone_label,
									},
								].map((item, index) => (
									<div
										key={item.label}
										style={{ marginBottom: index < 4 ? "10px" : 0 }}
									>
										<table
											style={{
												width: "100%",
												borderCollapse: "collapse",
												fontSize: "13px",
												marginBottom: "6px",
											}}
										>
											<tbody>
												<tr>
													<td style={{ color: "rgba(255,255,255,0.6)" }}>
														{item.label}
														<div
															style={{
																fontSize: "11px",
																color: "rgba(255,255,255,0.35)",
																marginTop: "2px",
															}}
														>
															{item.sub}
														</div>
													</td>
													<td style={{ textAlign: "right", color: "#fff" }}>
														{Math.round(item.value)}%
													</td>
												</tr>
											</tbody>
										</table>
										<div
											style={{
												position: "relative",
												height: "8px",
												backgroundColor: "rgba(255,255,255,0.1)",
												borderRadius: "4px",
												overflow: "hidden",
											}}
										>
											<div
												style={{
													position: "absolute",
													left: 0,
													top: 0,
													height: "8px",
													width: `${item.value}%`,
													backgroundColor: "#fff",
													borderRadius: "4px",
												}}
											/>
										</div>
									</div>
								))}
								{result.confidence_index.components.gesture_advice && (
									<div
										style={{
											marginTop: "14px",
											fontSize: "12px",
											lineHeight: "1.6",
											color: "rgba(255,255,255,0.7)",
										}}
									>
										Совет по жестам:{" "}
										{result.confidence_index.components.gesture_advice}
									</div>
								)}
							</div>
						</div>
					)}

					{options.tempo && result.tempo.length > 0 && (
						<div
							data-pdf-block
							style={{ padding: "12px 20px", backgroundColor: "#0a0a0a" }}
						>
							<h2
								style={{
									fontSize: "16px",
									fontWeight: "600",
									marginBottom: "10px",
									color: "#fff",
								}}
							>
								Темп речи (среднее:{" "}
								{(
									result.tempo.reduce((sum, point) => sum + point.wpm, 0) /
									result.tempo.length
								).toFixed(0)}{" "}
								WPM)
							</h2>
							<div
								style={{
									borderRadius: "12px",
									backgroundColor: "rgba(255,255,255,0.05)",
									padding: "16px",
									border: "1px solid rgba(255,255,255,0.1)",
								}}
							>
								<div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
									{result.tempo.map((point) => (
										<div
											key={`${point.time}-${point.wpm}`}
											style={{
												padding: "8px 10px",
												borderRadius: "10px",
												border: `1px solid ${zoneColor(point.zone)}33`,
												backgroundColor: `${zoneColor(point.zone)}16`,
												minWidth: "110px",
											}}
										>
											<div
												style={{
													fontSize: "10px",
													color: "rgba(255,255,255,0.5)",
													textTransform: "uppercase",
												}}
											>
												{formatPdfTime(point.time)}
											</div>
											<div
												style={{
													marginTop: "4px",
													fontSize: "14px",
													color: "#fff",
													fontWeight: "bold",
												}}
											>
												{Math.round(point.wpm)} WPM
											</div>
											<div
												style={{
													fontSize: "10px",
													color: zoneColor(point.zone),
													textTransform: "uppercase",
													marginTop: "2px",
												}}
											>
												{point.zone}
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					)}

					{options.criteria && (
						<div
							data-pdf-block
							style={{ padding: "12px 20px", backgroundColor: "#0a0a0a" }}
						>
							<h2
								style={{
									fontSize: "16px",
									fontWeight: "600",
									marginBottom: "10px",
									color: "#fff",
								}}
							>
								Оценка по выбранным критериям:{" "}
								{result.evaluation_criteria_report.total_score}/
								{result.evaluation_criteria_report.max_score}
							</h2>
							<div
								style={{
									borderRadius: "12px",
									backgroundColor: "rgba(255,255,255,0.05)",
									padding: "16px",
									border: "1px solid rgba(255,255,255,0.1)",
								}}
							>
								{result.evaluation_criteria_report.criteria.map(
									(criterion, index) => (
										<div
											key={`${criterion.name}-${index}`}
											style={{
												paddingBottom:
													index <
													result.evaluation_criteria_report.criteria.length - 1
														? "12px"
														: 0,
												marginBottom:
													index <
													result.evaluation_criteria_report.criteria.length - 1
														? "12px"
														: 0,
												borderBottom:
													index <
													result.evaluation_criteria_report.criteria.length - 1
														? "1px solid rgba(255,255,255,0.06)"
														: "none",
											}}
										>
											<div
												style={{
													fontSize: "13px",
													color: "#fff",
													fontWeight: "bold",
												}}
											>
												{criterion.name}
											</div>
											<div
												style={{
													fontSize: "11px",
													color: "rgba(255,255,255,0.45)",
													marginTop: "4px",
												}}
											>
												{criterion.description}
											</div>
											<div
												style={{
													fontSize: "12px",
													color: "rgba(255,255,255,0.8)",
													marginTop: "6px",
												}}
											>
												Баллы: {criterion.current_value ?? 0}/
												{criterion.max_value}
											</div>
											<div
												style={{
													fontSize: "12px",
													color: "rgba(255,255,255,0.65)",
													marginTop: "4px",
													lineHeight: "1.6",
												}}
											>
												Совет: {criterion.feedback || "не указан"}
											</div>
										</div>
									),
								)}
							</div>
						</div>
					)}

					{options.transcript &&
						transcriptChunks.map((chunk, index) => (
							<div
								key={`transcript-${index}`}
								data-pdf-block
								data-pdf-slice="true"
								style={{
									padding: index === 0 ? "12px 20px" : "0 20px 12px 20px",
									backgroundColor: "#0a0a0a",
								}}
							>
								{index === 0 && (
									<h2
										style={{
											fontSize: "16px",
											fontWeight: "600",
											marginBottom: "10px",
											color: "#fff",
										}}
									>
										Транскрипция
									</h2>
								)}
								<div
									style={{
										backgroundColor: "rgba(255,255,255,0.03)",
										padding: "16px",
										border: "1px solid rgba(255,255,255,0.1)",
										fontSize: "12px",
										lineHeight: "1.7",
									}}
								>
									{chunk.map((word, wordIndex) => (
										<span
											key={`${index}-${wordIndex}-${word.text}-${word.start}`}
											style={
												word.is_filler
													? {
															color: "#fb7185",
															textDecoration: "underline",
															textDecorationColor: "rgba(251,113,133,0.6)",
														}
													: { color: "rgba(255,255,255,0.8)" }
											}
										>
											{word.text}{" "}
										</span>
									))}
								</div>
							</div>
						))}

					{options.mistakes && result.speech_report.mistakes && (
						<TextBlock
							title="Ошибки"
							text={result.speech_report.mistakes}
							borderColor="rgba(239,68,68,0.25)"
							backgroundColor="rgba(239,68,68,0.08)"
						/>
					)}

					{options.structure && result.speech_report.structure && (
						<TextBlock
							title="Структура"
							text={result.speech_report.structure}
						/>
					)}

					{options.idealText && result.speech_report.ideal_text && (
						<TextBlock
							title="Идеальный текст"
							text={result.speech_report.ideal_text}
							borderColor="rgba(16,185,129,0.25)"
							backgroundColor="rgba(16,185,129,0.08)"
						/>
					)}

					{options.personaFeedback && result.speech_report.persona_feedback && (
						<TextBlock
							title="Фидбэк персоны"
							text={result.speech_report.persona_feedback}
							borderColor="rgba(245,158,11,0.25)"
							backgroundColor="rgba(245,158,11,0.08)"
						/>
					)}

					{options.presentationFeedback &&
						result.speech_report.presentation_feedback && (
							<TextBlock
								title="Отчет по выступлению от ИИ"
								text={result.speech_report.presentation_feedback}
								borderColor="rgba(14,165,233,0.25)"
								backgroundColor="rgba(14,165,233,0.08)"
							/>
						)}

					{options.longPauses && result.long_pauses.length > 0 && (
						<div
							data-pdf-block
							style={{ padding: "12px 20px", backgroundColor: "#0a0a0a" }}
						>
							<h2
								style={{
									fontSize: "16px",
									fontWeight: "600",
									marginBottom: "10px",
									color: "#fff",
								}}
							>
								Долгие паузы ({result.long_pauses.length})
							</h2>
							<div
								style={{
									borderRadius: "12px",
									backgroundColor: "rgba(239,68,68,0.08)",
									padding: "16px",
									border: "1px solid rgba(239,68,68,0.25)",
								}}
							>
								<div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
									{result.long_pauses.map((pause, index) => (
										<div
											key={`${pause.start}-${index}`}
											style={{
												padding: "8px 12px",
												borderRadius: "8px",
												backgroundColor: "rgba(239,68,68,0.1)",
												border: "1px solid rgba(239,68,68,0.2)",
											}}
										>
											<span
												style={{
													fontSize: "12px",
													color: "rgba(255,255,255,0.6)",
												}}
											>
												{formatPdfTime(pause.start)} -{" "}
												{formatPdfTime(pause.end)}
											</span>
											<span
												style={{
													fontSize: "11px",
													color: "#fb7185",
													marginLeft: "8px",
												}}
											>
												{pause.duration.toFixed(1)}с
											</span>
										</div>
									))}
								</div>
							</div>
						</div>
					)}

					{options.dynamicFillers &&
						result.speech_report.dynamic_fillers.length > 0 && (
							<div
								data-pdf-block
								style={{ padding: "12px 20px", backgroundColor: "#0a0a0a" }}
							>
								<h2
									style={{
										fontSize: "16px",
										fontWeight: "600",
										marginBottom: "10px",
										color: "#fff",
									}}
								>
									Обнаруженные слова-паразиты
								</h2>
								<div
									style={{
										borderRadius: "12px",
										backgroundColor: "rgba(245,158,11,0.08)",
										padding: "16px",
										border: "1px solid rgba(245,158,11,0.25)",
									}}
								>
									<div
										style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
									>
										{result.speech_report.dynamic_fillers.map(
											(filler, index) => (
												<span
													key={`${filler}-${index}`}
													style={{
														padding: "6px 12px",
														borderRadius: "6px",
														backgroundColor: "rgba(245,158,11,0.15)",
														color: "#fcd34d",
														fontSize: "13px",
														fontWeight: "500",
													}}
												>
													{filler}
												</span>
											),
										)}
									</div>
								</div>
							</div>
						)}
				</div>
			</div>
		</Popover>
	);
}

function TextBlock({
	title,
	text,
	borderColor = "rgba(255,255,255,0.1)",
	backgroundColor = "rgba(255,255,255,0.05)",
}: {
	title: string;
	text: string;
	borderColor?: string;
	backgroundColor?: string;
}) {
	return (
		<div
			data-pdf-block
			style={{ padding: "12px 20px", backgroundColor: "#0a0a0a" }}
		>
			<h2
				style={{
					fontSize: "16px",
					fontWeight: "600",
					marginBottom: "10px",
					color: "#fff",
				}}
			>
				{title}
			</h2>
			<div
				style={{
					borderRadius: "12px",
					backgroundColor,
					padding: "20px",
					border: `1px solid ${borderColor}`,
					fontSize: "13px",
					lineHeight: "1.7",
					color: "rgba(255,255,255,0.85)",
					whiteSpace: "pre-line",
				}}
			>
				{text}
			</div>
		</div>
	);
}
