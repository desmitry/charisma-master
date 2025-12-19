"use client";

import { AnalysisResult } from "@/types/analysis";

export function SummaryBlocks({ data }: { data: AnalysisResult }) {
  const cards: { title: string; text: string; accent?: string }[] = [
    { title: "Summary", text: data.summary },
    { title: "Structure", text: data.structure },
    { title: "Mistakes", text: data.mistakes, accent: "text-rose-300" },
    { title: "Advice", text: data.ideal_text, accent: "text-emerald-300" },
    data.persona_feedback
      ? { title: "Persona feedback", text: data.persona_feedback }
      : null,
    data.confidence_index?.components?.gesture_advice
      ? { title: "Советы по жестикуляции", text: data.confidence_index.components.gesture_advice, accent: "text-amber-300" }
      : null,
    data.slide_analysis
      ? { 
          title: "Анализ слайдов", 
          text: data.slide_analysis.has_slides === false 
            ? "Слайды не найдены в видео" 
            : data.slide_analysis.ocr_summary || "Анализ слайдов недоступен"
        }
      : null,
  ].filter(Boolean) as { title: string; text: string; accent?: string }[];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_15px_60px_rgba(0,0,0,0.35)]"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">
            {card.title}
          </p>
          <p className={`mt-2 text-sm leading-6 text-white/80 ${card.accent ?? ""}`}>
            {card.text}
          </p>
        </div>
      ))}
    </div>
  );
}

