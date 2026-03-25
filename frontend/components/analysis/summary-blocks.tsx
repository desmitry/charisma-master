"use client";

import { AnalysisResult } from "@/types/analysis";

export function SummaryBlocks({ data }: { data: AnalysisResult }) {
  const speechReport = data.speech_report;
  const cards = [
    { title: "Summary", text: speechReport.summary },
    { title: "Structure", text: speechReport.structure },
    { title: "Mistakes", text: speechReport.mistakes, accent: "text-rose-300" },
    { title: "Ideal text", text: speechReport.ideal_text, accent: "text-emerald-300" },
    { title: "Persona feedback", text: speechReport.persona_feedback },
    { title: "Presentation feedback", text: speechReport.presentation_feedback, accent: "text-sky-300" },
    data.confidence_index.components.gesture_advice
      ? { title: "Gesture advice", text: data.confidence_index.components.gesture_advice, accent: "text-amber-300" }
      : null,
  ].filter(Boolean) as { title: string; text: string; accent?: string }[];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_15px_60px_rgba(0,0,0,0.35)]"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">{card.title}</p>
          <p className={`mt-2 text-sm leading-6 text-white/80 ${card.accent ?? ""}`}>{card.text}</p>
        </div>
      ))}
    </div>
  );
}
