"use client";

import { MultiStepLoader as Loader } from "@/components/ui/multi-step-loader";

const loadingStates = [
  { text: "Загрузка видео..." },
  { text: "Распознавание речи..." },
  { text: "Анализ уверенности и харизмы..." },
  { text: "Формирование рекомендаций..." },
  { text: "Подготовка результатов" },
];

type Props = {
  progress: number;
  statusText?: string;
  onComplete?: () => void;
};

export function ProcessingOverlay(_props: Props) {
  // We use the Aceternity Loader component. Since this overlay is only mounted during "processing",
  // we can permanently set loading={true}. The loader handles its own progress through the states.
  // Each state takes 1000ms, total 5 states = 5000ms (5 seconds).
  // We disable loop so it stops at the last text when the real processing takes longer.
  return (
    <div className="fixed inset-0 z-[100] w-full h-full">
      <Loader loadingStates={loadingStates} loading={true} duration={1000} loop={false} />
    </div>
  );
}
