"use client";

import { AnalysisResult } from "@/types/analysis";

export function SummaryBlocks({ data }: { data: AnalysisResult }) {
  const speechReport = data.speech_report;
  const cards = [
    { title: "Summary", text: speechReport.summary },
    { title: "Structure", text: speechReport.structure },
    { title: "Mistakes", text: speechReport.mistakes, accent: "[color:var(--accent-rose)]" },
    { title: "Ideal text", text: speechReport.ideal_text, accent: "[color:var(--accent-emerald)]" },
    { title: "Persona feedback", text: speechReport.persona_feedback },
    { title: "Presentation feedback", text: speechReport.presentation_feedback, accent: "[color:var(--accent-sky)]" },
    speechReport.competition_analysis
      ? { title: "Competition analysis", text: speechReport.competition_analysis, accent: "[color:var(--accent-cyan)]" }
      : null,
    data.confidence_index.components.gesture_advice
      ? { title: "Gesture advice", text: data.confidence_index.components.gesture_advice, accent: "[color:var(--accent-amber)]" }
      : null,
  ].filter(Boolean) as { title: string; text: string; accent?: string }[];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-3xl border border-foreground/10 bg-foreground/5 p-5 shadow-[0_15px_60px_var(--shadow-color)]"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/60">{card.title}</p>
          <p className={`mt-2 text-sm leading-6 text-foreground/80 ${card.accent ?? ""}`}>{card.text}</p>
        </div>
      ))}
    </div>
  );
}
