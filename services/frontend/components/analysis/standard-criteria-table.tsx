"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AnalysisResult } from "@/types/analysis";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";

type Props = {
  report?: AnalysisResult["evaluation_criteria_report"] | null;
};

const fadeUpAnim: any = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 26 } },
};

const accordionContent: any = {
  hidden: { height: 0, opacity: 0 },
  show: { height: "auto", opacity: 1, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } },
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 16 16" fill="none"
      className={cn("flex-shrink-0 text-foreground/25 transition-transform duration-300", open ? "rotate-180" : "")}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CriterionRow({ criterion }: { criterion: AnalysisResult["evaluation_criteria_report"]["criteria"][0]; index: number }) {
  const [open, setOpen] = useState(false);
  const val = criterion.current_value ?? 0;
  const pct = criterion.max_value > 0 ? (val / criterion.max_value) * 100 : 0;

  return (
    <div className="border-b border-foreground/[0.04] last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-foreground/75 font-medium truncate">{criterion.name}</div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* mini bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-16 h-1 rounded-full bg-surface overflow-hidden">
              <div
                className={cn("h-full rounded-full", pct >= 70 ? "bg-foreground/55" : pct >= 40 ? "bg-foreground/35" : "bg-foreground/18")}
                style={{ width: `${pct}%`, transition: "width 0.8s ease" }}
              />
            </div>
          </div>
          <span className="text-[12px] font-mono text-foreground/40 whitespace-nowrap">
            {val}<span className="text-foreground/20">/{criterion.max_value}</span>
          </span>
          <ChevronIcon open={open} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial="hidden"
            animate="show"
            exit="exit"
            variants={accordionContent}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-3">
              {/* full bar */}
              <div className="h-1.5 w-full rounded-full bg-foreground/[0.05] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", pct >= 70 ? "bg-foreground/55" : pct >= 40 ? "bg-foreground/35" : "bg-foreground/18")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {criterion.description && (
                <p className="text-[12px] leading-relaxed text-foreground/40">{criterion.description}</p>
              )}
              {criterion.feedback && (
                <div className="rounded-xl border border-foreground/[0.05] bg-foreground/[0.02] px-3 py-2.5">
                  <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-foreground/20 mb-1">Совет</div>
                  <p className="text-[12px] leading-relaxed text-foreground/50">{criterion.feedback}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function StandardCriteriaTable({ report }: Props) {
  if (!report || report.criteria.length === 0) return null;

  const pct = report.max_score > 0 ? Math.round((report.total_score / report.max_score) * 100) : 0;

  return (
    <motion.div variants={fadeUpAnim} className="rounded-2xl border border-card-border bg-card-bg shadow-[0_12px_34px_var(--shadow-color)] overflow-hidden">
      {/* header */}
      <div className="px-4 py-3.5 border-b border-foreground/[0.04] flex flex-row items-center justify-between gap-3">
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-foreground/35">Оценки по критериям</span>
        <span className={cn(
          "text-[11px] font-mono px-2 py-0.5 rounded-full border",
          pct >= 70 ? "text-foreground/60 border-foreground/15 bg-foreground/[0.04]" : pct >= 40 ? "text-foreground/45 border-foreground/10 bg-foreground/[0.03]" : "text-foreground/25 border-foreground/[0.07] bg-foreground/[0.02]"
        )}>
          {report.total_score}/{report.max_score} · {pct}%
        </span>
      </div>

      {/* criteria list */}
      <div className="divide-y divide-foreground/[0.04]">
        {report.criteria.map((criterion, index) => (
          <CriterionRow key={`${criterion.name}-${index}`} criterion={criterion} index={index} />
        ))}
      </div>
    </motion.div>
  );
}
