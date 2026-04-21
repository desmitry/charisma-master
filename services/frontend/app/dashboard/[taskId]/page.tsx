"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAnalysis } from "@/lib/api";
import { AnalysisResult } from "@/types/analysis";
import { AnalysisDashboard } from "@/components/analysis/analysis-dashboard";
import SurveyButton from "@/components/shared/survey-button";

export default function DashboardPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.touchAction = "auto";
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, []);

  useEffect(() => {
    if (!taskId) return;

    (async () => {
      try {
        setLoading(true);
        const data = await getAnalysis(taskId);
        setAnalysis(data);
      } catch (err) {
        setError((err as Error).message ?? "Не удалось загрузить анализ");
      } finally {
        setLoading(false);
      }
    })();
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white/70">
          Загружаем результаты...
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white/70">
            {error ?? "Анализ не найден"}
          </div>
        </div>
        <SurveyButton />
      </>
    );
  }

  return (
    <>
      <AnalysisDashboard result={analysis} />
      <SurveyButton />
    </>
  );
}
