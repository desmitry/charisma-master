"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AnalysisResult } from "@/types/analysis";

type Props = {
  report?: AnalysisResult["evaluation_criteria_report"] | null;
};

const fadeUpAnim: any = {
  hidden: { opacity: 0, y: 30, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

export function StandardCriteriaTable({ report }: Props) {
  if (!report || report.criteria.length === 0) return null;

  const criteriaPercentage =
    report.max_score > 0 ? Math.round((report.total_score / report.max_score) * 100) : 0;

  return (
    <motion.div variants={fadeUpAnim} className="rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-white/[0.04] bg-[#141414]">
        <h3 className="text-xs font-mono uppercase tracking-widest text-white/50">
          Оценка по выбранным критериям от ИИ
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-white/30 font-normal">Критерий</th>
              <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-white/30 font-normal text-right">Баллы</th>
              <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-white/30 font-normal">Совет</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {report.criteria.map((criterion, index) => {
              const currentValue = criterion.current_value ?? 0;
              const pct = criterion.max_value > 0 ? (currentValue / criterion.max_value) * 100 : 0;

              return (
                <tr key={`${criterion.name}-${index}`} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-4 py-4 align-top w-[40%]">
                    <div className="text-[13px] text-white/90 font-medium mb-1">{criterion.name}</div>
                    <div className="text-[11px] text-white/40 leading-relaxed">{criterion.description}</div>
                  </td>
                  <td className="px-4 py-4 align-top w-[110px] text-right">
                    <div className="text-[14px] font-mono text-white/90">
                      {currentValue}
                      <span className="text-white/30">/{criterion.max_value}</span>
                    </div>
                    <div className="mt-2 w-full h-[3px] bg-white/10 rounded-full overflow-hidden flex">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-rose-400"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="text-[12px] leading-relaxed text-white/60">
                      {criterion.feedback || "Совет не указан"}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 border-t border-white/[0.04] bg-[#141414] flex justify-between items-center">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Итоговый результат</span>
        <div className="flex items-center gap-3">
          <span className="text-lg font-mono text-white">
            {report.total_score}
            <span className="text-white/30 text-sm"> / {report.max_score}</span>
          </span>
          <span
            className={cn(
              "text-[11px] font-mono px-2 py-0.5 rounded border",
              criteriaPercentage >= 70
                ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
                : criteriaPercentage >= 40
                  ? "text-amber-400 border-amber-400/20 bg-amber-400/10"
                  : "text-rose-400 border-rose-400/20 bg-rose-400/10"
            )}
          >
            {criteriaPercentage}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}
