"use client";

import { type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileCheck,
  FileStack,
  FileText,
  Link as LinkIcon,
  Mic,
  Play,
  Presentation,
  Sparkles,
  Upload,
  UserRound,
  Video,
  Wand2,
  X,
} from "lucide-react";

import { SpotlightCard } from "@/components/ui/spotlight-card";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { cn } from "@/lib/utils";
import { type WizardStepId, useVideoAnalysis } from "@/hooks/use-video-analysis";

type UploadHubProps = {
  videoAnalysis: ReturnType<typeof useVideoAnalysis>;
};

type StepDefinition = {
  id: WizardStepId;
  title: string;
  description: string;
  optional?: boolean;
};

const STEPS: StepDefinition[] = [
  {
    id: "source",
    title: "Текст выступления",
    description: "Загрузите файл с текстом речи или видеозапись выступления — текст будет извлечён автоматически.",
  },
  {
    id: "presentation",
    title: "Презентация",
    description: "При необходимости добавьте презентацию, чтобы анализировать речь вместе со слайдами.",
    optional: true,
  },
  {
    id: "video",
    title: "Видеоанализ",
    description: "Решите, нужен ли анализ невербальной подачи. Если видео ещё не добавлено, можно загрузить его здесь.",
    optional: true,
  },
  {
    id: "criteria",
    title: "Критерии",
    description: "Можно загрузить свои критерии оценивания, выбрать готовый пресет или пропустить шаг.",
    optional: true,
  },
  {
    id: "settings",
    title: "Оценщик и провайдеры",
    description: "Выберите персону, которая будет оценивать выступление, и сервисы для анализа и транскрибации.",
    optional: true,
  },
  {
    id: "review",
    title: "Сводка отправки",
    description: "Проверьте, что именно уйдёт на бэкенд, и подтвердите запуск анализа.",
  },
];

const PERSONAS = [
  { id: "speech_review_specialist", label: "Специалист", description: "Нейтральная базовая оценка выступления." },
  { id: "strict_critic", label: "Строгий критик", description: "Жёстче подсвечивает недочёты и упущения." },
  { id: "kind_mentor", label: "Поддерживающий ментор", description: "Даёт мягкий и развивающий фидбэк." },
  { id: "steve_jobs_style", label: "Визионер", description: "Смотрит на подачу через призму харизмы и вовлечения." },
];

const ANALYZE_PROVIDERS = [
  { id: "gigachat", label: "GigaChat" },
  { id: "openai", label: "OpenAI" },
];

const TRANSCRIBE_PROVIDERS = [
  { id: "sber_gigachat", label: "Sber GigaChat" },
  { id: "whisper_local", label: "Whisper локально" },
  { id: "whisper_openai", label: "Whisper Fast" },
];

const PRESETS = [
  { id: "default", label: "Базовые критерии" },
  { id: "urfu", label: "Критерии УрФУ" },
];

function StepBadge({
  status,
  index,
}: {
  status: "current" | "complete" | "empty";
  index: number;
}) {
  if (status === "complete") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.1] text-emerald-300/80">
        <Check className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold transition-all",
        status === "current"
          ? "border-white/30 bg-white/[0.1] text-white shadow-[0_0_28px_rgba(255,255,255,0.06)]"
          : "border-white/[0.08] bg-white/[0.04] text-white/35"
      )}
    >
      {index + 1}
    </div>
  );
}

function FileField({
  id,
  title,
  description,
  accept,
  icon,
  file,
  onChange,
  onRemove,
  compact,
}: {
  id: string;
  title: string;
  description: string;
  accept: string;
  icon: ReactNode;
  file: File | null;
  onChange: (file: File | null) => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) onChange(droppedFile);
  };

  return (
    <div className="group/field rounded-[1.5rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-colors hover:border-white/[0.14]">
      <div className={cn("flex items-start gap-3", file ? "mb-3" : "mb-4")}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-white/60 transition-colors group-hover/field:border-white/[0.14] group-hover/field:text-white/80">
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-white/90">{title}</h4>
          {!compact && <p className="mt-0.5 text-[13px] leading-5 text-white/40">{description}</p>}
        </div>
      </div>

      {file ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3">
          <FileCheck className="h-4 w-4 shrink-0 text-emerald-300/70" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white/90">{file.name}</p>
            <p className="text-xs text-white/35">{Math.max(1, Math.round(file.size / 1024))} КБ</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-white/40 transition hover:border-rose-400/25 hover:bg-rose-400/10 hover:text-rose-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="group/drop flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.1] bg-black/20 px-5 py-6 text-center transition-all hover:border-white/25 hover:bg-white/[0.03]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-white/30 transition group-hover/drop:border-white/20 group-hover/drop:text-white/60">
            <Upload className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/70 transition group-hover/drop:text-white/90">
              Перетащите файл сюда или нажмите
            </p>
            <p className="mt-1 text-xs text-white/30">{accept.replaceAll(",", ", ")}</p>
          </div>
          <input
            id={id}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}

function ToggleCard({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/toggle relative flex w-full items-start gap-3.5 rounded-[1.35rem] border px-5 py-5 text-left transition-all",
        active
          ? "border-white/25 bg-gradient-to-br from-white/[0.1] to-white/[0.04] text-white shadow-[0_0_32px_rgba(255,255,255,0.06)]"
          : "border-white/[0.07] bg-white/[0.02] text-white/60 hover:border-white/[0.15] hover:bg-white/[0.04]"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all",
          active
            ? "border-white/20 bg-white/[0.1] text-white"
            : "border-white/[0.08] bg-black/20 text-white/50 group-hover/toggle:border-white/[0.15] group-hover/toggle:text-white/70"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold transition-colors", active ? "text-white" : "text-white/80")}>{title}</p>
        <p className="mt-1 text-[13px] leading-5 text-white/40">{description}</p>
      </div>
      {active && (
        <div className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.12]">
          <Check className="h-3 w-3 text-white/80" />
        </div>
      )}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/30">{label}</span>
      <span className="text-sm text-white/80">{value}</span>
    </div>
  );
}

export function UploadHub({ videoAnalysis }: UploadHubProps) {
  const { state, actions } = videoAnalysis;

  const currentStepIndex = STEPS.findIndex((step) => step.id === state.currentStep);
  const currentStep = STEPS[currentStepIndex] ?? STEPS[0];

  const sourceComplete = state.hasRequiredSource;
  const presentationComplete = Boolean(state.presentationFile);
  const videoStepComplete = state.needVideoAnalysis ? state.hasSpeechVideo : false;
  const criteriaComplete =
    state.criteriaMode === "preset" || (state.criteriaMode === "custom" && Boolean(state.evaluationCriteriaFile));
  const settingsComplete = Boolean(
    state.selectedPersona && state.selectedAnalyzeProvider && state.selectedTranscribeProvider
  );

  const reviewPayload = [
    state.inputMode === "speech_text" && state.speechTextFile
      ? { key: "user_speech_text_file", value: state.speechTextFile.name }
      : null,
    state.speechVideoFile ? { key: "user_speech_video_file", value: state.speechVideoFile.name } : null,
    state.speechVideoUrl ? { key: "user_speech_video_url", value: state.speechVideoUrl } : null,
    { key: "user_need_text_from_video", value: String(state.inputMode === "speech_video" ? state.needTextFromVideo : false) },
    { key: "user_need_video_analysis", value: String(state.needVideoAnalysis) },
    state.presentationFile ? { key: "user_presentation_file", value: state.presentationFile.name } : null,
    state.criteriaMode === "custom" && state.evaluationCriteriaFile
      ? { key: "evaluation_criteria_file", value: state.evaluationCriteriaFile.name }
      : null,
    state.criteriaMode === "preset" ? { key: "evaluation_criteria_id", value: state.selectedEvaluationPreset } : null,
    { key: "persona", value: state.selectedPersona },
    { key: "analyze_provider", value: state.selectedAnalyzeProvider },
    { key: "transcribe_provider", value: state.selectedTranscribeProvider },
  ].filter((item): item is { key: string; value: string } => Boolean(item));

  const stepStatus = (stepId: WizardStepId): "current" | "complete" | "empty" => {
    if (stepId === state.currentStep) {
      return "current";
    }

    const completed =
      (stepId === "source" && sourceComplete) ||
      (stepId === "presentation" && presentationComplete) ||
      (stepId === "video" && videoStepComplete) ||
      (stepId === "criteria" && criteriaComplete) ||
      (stepId === "settings" && settingsComplete) ||
      (stepId === "review" && state.currentStep === "review");

    return completed ? "complete" : "empty";
  };

  const goToStep = (stepId: WizardStepId) => {
    if (stepId === "review") {
      actions.openReviewStep();
      return;
    }

    actions.setError(null);
    actions.setCurrentStep(stepId);
  };

  const goNext = () => {
    const nextStep = STEPS[currentStepIndex + 1];
    if (!nextStep) {
      return;
    }

    actions.setError(null);
    actions.setCurrentStep(nextStep.id);
  };

  const goBack = () => {
    const previousStep = STEPS[currentStepIndex - 1];
    if (!previousStep) {
      return;
    }

    actions.setError(null);
    actions.setCurrentStep(previousStep.id);
  };

  const renderSourceStep = () => (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <ToggleCard
          active={state.inputMode === "speech_text"}
          title="Файл с текстом"
          description="Загрузите готовый текст речи в формате TXT, MD, DOC или DOCX."
          icon={<FileText className="h-5 w-5 text-white/80" />}
          onClick={() => actions.selectInputMode("speech_text")}
        />
        <ToggleCard
          active={state.inputMode === "speech_video"}
          title="Видеозапись выступления"
          description="Загрузите видео — текст будет извлечён из записи автоматически (транскрибация)."
          icon={<Video className="h-5 w-5 text-white/80" />}
          onClick={() => actions.selectInputMode("speech_video")}
        />
      </div>

      {state.inputMode === "speech_text" && (
        <FileField
          id="speech-text-file"
          title="Файл с текстом выступления"
          description="Подойдут текстовые файлы, markdown и документы Word."
          accept=".txt,.md,.doc,.docx"
          icon={<FileText className="h-5 w-5" />}
          file={state.speechTextFile}
          onChange={actions.handleSpeechTextFileChange}
          onRemove={() => actions.handleSpeechTextFileChange(null)}
        />
      )}

      {state.inputMode === "speech_video" && (
        <div className="space-y-4">
          <FileField
            id="speech-video-file"
            title="Видео выступления"
            description="Загрузите видеофайл — он будет использован для транскрибации речи и, при необходимости, видеоанализа."
            accept=".mp4,.mov,.avi,.mkv,.webm,.m4v"
            icon={<Video className="h-5 w-5" />}
            file={state.speechVideoFile}
            onChange={actions.handleSpeechVideoFileChange}
            onRemove={() => actions.handleSpeechVideoFileChange(null)}
          />

          <div className="group/field rounded-[1.5rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-colors hover:border-white/[0.14]">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-white/60">
                <LinkIcon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white/90">Или ссылка на RuTube</h4>
                <p className="mt-0.5 text-[13px] leading-5 text-white/40">Формат: rutube.ru/video/...</p>
              </div>
            </div>

            <input
              type="text"
              value={state.speechVideoUrl}
              onChange={(event) => actions.handleSpeechVideoUrlChange(event.target.value)}
              placeholder="https://rutube.ru/video/..."
              className="w-full rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25 focus:bg-black/30"
            />
            {state.speechVideoUrl && !state.isValidRuTubeUrl && (
              <p className="mt-2 text-xs text-amber-300/80">Пока ссылка не похожа на корректную ссылку RuTube.</p>
            )}
          </div>

          {state.hasSpeechVideo && (
            <div className="flex items-center gap-3 rounded-[1.35rem] border border-sky-400/15 bg-sky-400/[0.06] px-5 py-4">
              <Mic className="h-4 w-4 shrink-0 text-sky-300/70" />
              <p className="text-[13px] leading-5 text-sky-100/80">
                Транскрибация включена автоматически — текст выступления будет извлечён из видео.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <MagneticButton
          disabled={!sourceComplete}
          onClick={actions.openReviewStep}
          className={cn(
            "inline-flex h-14 items-center justify-center gap-2 rounded-2xl border px-6 text-sm font-semibold transition",
            sourceComplete
              ? "border-white/20 bg-white text-black"
              : "cursor-not-allowed border-white/10 bg-white/5 text-white/30"
          )}
        >
          <Play className="h-4 w-4" />
          Начать разбор
        </MagneticButton>

        <button
          type="button"
          disabled={!sourceComplete}
          onClick={goNext}
          className={cn(
            "inline-flex h-14 items-center justify-center gap-2 rounded-2xl border px-6 text-sm font-semibold transition",
            sourceComplete
              ? "border-white/[0.08] bg-white/[0.04] text-white hover:border-white/20 hover:bg-white/[0.07]"
              : "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-white/30"
          )}
        >
          Продолжить настройку
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const renderPresentationStep = () => (
    <div className="space-y-6">
      <FileField
        id="presentation-file"
        title="Файл презентации"
        description="Поддерживаются PPT, PPTX и PDF. Шаг можно пропустить."
        accept=".ppt,.pptx,.pdf"
        icon={<Presentation className="h-5 w-5" />}
        file={state.presentationFile}
        onChange={actions.handlePresentationFileChange}
        onRemove={() => actions.handlePresentationFileChange(null)}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-white/70 transition hover:border-white/[0.15] hover:bg-white/[0.06]"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </button>
        <button
          type="button"
          onClick={goNext}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-white transition hover:border-white/[0.15] hover:bg-white/[0.06]"
        >
          {state.presentationFile ? "Дальше" : "Пропустить шаг"}
          <ChevronRight className="h-4 w-4" />
        </button>
        <MagneticButton
          onClick={actions.openReviewStep}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white text-sm font-semibold text-black px-6"
        >
          <Play className="h-4 w-4" />
          К сводке
        </MagneticButton>
      </div>
    </div>
  );

  const renderVideoStep = () => {
    const uploadedTextNotVideo = state.inputMode === "speech_text" && !state.hasSpeechVideo;

    return (
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleCard
            active={state.needVideoAnalysis}
            title="Анализировать видео"
            description="Включим невербальный анализ подачи: жесты, мимика, контакт с аудиторией."
            icon={<Video className="h-5 w-5 text-white/80" />}
            onClick={() => actions.setNeedVideoAnalysis(true)}
          />
          <ToggleCard
            active={!state.needVideoAnalysis}
            title="Пропустить видеоанализ"
            description="Анализ будет проведён только по тексту и другим загруженным материалам."
            icon={<CircleDashed className="h-5 w-5 text-white/80" />}
            onClick={() => actions.setNeedVideoAnalysis(false)}
          />
        </div>

        {state.needVideoAnalysis && (
          <>
            {state.hasSpeechVideo ? (
              <div className="flex items-center gap-3 rounded-[1.35rem] border border-emerald-400/15 bg-emerald-400/[0.06] px-5 py-4">
                <Check className="h-4 w-4 shrink-0 text-emerald-300/70" />
                <p className="text-[13px] leading-5 text-emerald-100/80">
                  Для видеоанализа будет использовано уже добавленное видео. При желании можно заменить его ниже.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-[1.35rem] border border-amber-400/15 bg-amber-400/[0.06] px-5 py-4">
                <Video className="h-4 w-4 shrink-0 text-amber-300/70" />
                <p className="text-[13px] leading-5 text-amber-100/80">
                  Видео ещё не добавлено. Загрузите файл или вставьте ссылку на RuTube.
                </p>
              </div>
            )}

            <FileField
              id="video-analysis-file"
              title="Видео для анализа"
              description="Если на первом шаге был только текст, здесь можно приложить отдельное видео."
              accept=".mp4,.mov,.avi,.mkv,.webm,.m4v"
              icon={<Video className="h-5 w-5" />}
              file={state.speechVideoFile}
              onChange={actions.handleSpeechVideoFileChange}
              onRemove={() => actions.handleSpeechVideoFileChange(null)}
            />

            <div className="group/field rounded-[1.5rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-colors hover:border-white/[0.14]">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-white/60">
                  <LinkIcon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white/90">Ссылка на RuTube</h4>
                  <p className="mt-0.5 text-[13px] leading-5 text-white/40">Формат: rutube.ru/video/...</p>
                </div>
              </div>
              <input
                type="text"
                value={state.speechVideoUrl}
                onChange={(event) => actions.handleSpeechVideoUrlChange(event.target.value)}
                placeholder="https://rutube.ru/video/..."
                className="w-full rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/25 focus:bg-black/30"
              />
            </div>

            {uploadedTextNotVideo && state.hasSpeechVideo && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-[1.35rem] border border-violet-400/15 bg-violet-400/[0.06] px-5 py-4">
                  <Wand2 className="h-4 w-4 shrink-0 text-violet-300/70" />
                  <p className="text-[13px] leading-5 text-violet-100/80">
                    Вы загрузили текст на первом шаге, но теперь добавили и видео. Хотите также получить текст из видео (транскрибация)?
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleCard
                    active={state.needTextFromVideo}
                    title="Извлечь текст из видео"
                    description="Бэкенд выполнит транскрибацию и добавит текст к анализу."
                    icon={<Wand2 className="h-5 w-5 text-white/80" />}
                    onClick={() => actions.setNeedTextFromVideo(true)}
                  />
                  <ToggleCard
                    active={!state.needTextFromVideo}
                    title="Не нужно"
                    description="Используем только текст, загруженный ранее."
                    icon={<CircleDashed className="h-5 w-5 text-white/80" />}
                    onClick={() => actions.setNeedTextFromVideo(false)}
                  />
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-white/70 transition hover:border-white/[0.15] hover:bg-white/[0.06]"
          >
            <ChevronLeft className="h-4 w-4" />
            Назад
          </button>
          <button
            type="button"
            onClick={goNext}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-white transition hover:border-white/[0.15] hover:bg-white/[0.06]"
          >
            Дальше
            <ChevronRight className="h-4 w-4" />
          </button>
          <MagneticButton
            onClick={actions.openReviewStep}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white text-sm font-semibold text-black px-6"
          >
            <Play className="h-4 w-4" />
            К сводке
          </MagneticButton>
        </div>
      </div>
    );
  };

  const renderCriteriaStep = () => (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <ToggleCard
          active={state.criteriaMode === "none"}
          title="Без критериев"
          description="Пропускаем — критерии не будут включены в анализ."
          icon={<CircleDashed className="h-5 w-5 text-white/80" />}
          onClick={() => {
            actions.setCriteriaMode("none");
            actions.setEvaluationCriteriaFile(null);
          }}
        />
        <ToggleCard
          active={state.criteriaMode === "preset"}
          title="Готовый пресет"
          description="Выберите один из предустановленных наборов критериев."
          icon={<FileCheck className="h-5 w-5 text-white/80" />}
          onClick={() => {
            actions.setCriteriaMode("preset");
            actions.setEvaluationCriteriaFile(null);
          }}
        />
        <ToggleCard
          active={state.criteriaMode === "custom"}
          title="Свой файл"
          description="Загрузите документ с собственными критериями оценивания."
          icon={<FileStack className="h-5 w-5 text-white/80" />}
          onClick={() => actions.setCriteriaMode("custom")}
        />
      </div>

      {state.criteriaMode === "preset" && (
        <div className="group/field rounded-[1.5rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5">
          <label className="mb-2 block text-sm font-semibold text-white/90">Пресет критериев</label>
          <select
            value={state.selectedEvaluationPreset}
            onChange={(event) => actions.setSelectedEvaluationPreset(event.target.value as "default" | "urfu")}
            className="w-full rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
          >
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {state.criteriaMode === "custom" && (
        <FileField
          id="criteria-file"
          title="Файл с критериями"
          description="Можно приложить документ с собственной шкалой оценивания."
          accept=".txt,.md,.doc,.docx,.pdf"
          icon={<FileCheck className="h-5 w-5" />}
          file={state.evaluationCriteriaFile}
          onChange={actions.handleCriteriaFileChange}
          onRemove={() => actions.handleCriteriaFileChange(null)}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-white/70 transition hover:border-white/[0.15] hover:bg-white/[0.06]"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </button>
        <button
          type="button"
          onClick={goNext}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-white transition hover:border-white/[0.15] hover:bg-white/[0.06]"
        >
          Дальше
          <ChevronRight className="h-4 w-4" />
        </button>
        <MagneticButton
          onClick={actions.openReviewStep}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white text-sm font-semibold text-black px-6"
        >
          <Play className="h-4 w-4" />
          К сводке
        </MagneticButton>
      </div>
    </div>
  );

  const renderSettingsStep = () => (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="group/field rounded-[1.5rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-colors hover:border-white/[0.14]">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
            <UserRound className="h-4 w-4 text-white/50" />
            Персона
          </label>
          <select
            value={state.selectedPersona}
            onChange={(event) => actions.setSelectedPersona(event.target.value)}
            className="w-full rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
          >
            {PERSONAS.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.label}
              </option>
            ))}
          </select>
          <p className="mt-3 text-[13px] leading-5 text-white/40">
            {PERSONAS.find((persona) => persona.id === state.selectedPersona)?.description}
          </p>
        </div>

        <div className="group/field rounded-[1.5rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-colors hover:border-white/[0.14]">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
            <Sparkles className="h-4 w-4 text-white/50" />
            Провайдер анализа
          </label>
          <select
            value={state.selectedAnalyzeProvider}
            onChange={(event) => actions.setSelectedAnalyzeProvider(event.target.value)}
            className="w-full rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
          >
            {ANALYZE_PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </div>

        <div className="group/field rounded-[1.5rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-colors hover:border-white/[0.14]">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
            <Wand2 className="h-4 w-4 text-white/50" />
            Провайдер транскрибации
          </label>
          <select
            value={state.selectedTranscribeProvider}
            onChange={(event) => actions.setSelectedTranscribeProvider(event.target.value)}
            className="w-full rounded-2xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-white/25"
          >
            {TRANSCRIBE_PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
          {state.selectedTranscribeProvider === "whisper_openai" && (
            <p className="mt-3 text-[13px] text-amber-200/80">Осталось быстрых запросов: {state.fastRequestsCount}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-white/70 transition hover:border-white/[0.15] hover:bg-white/[0.06]"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </button>
        <MagneticButton
          onClick={actions.openReviewStep}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white text-sm font-semibold text-black px-6"
        >
          <Play className="h-4 w-4" />
          Перейти к сводке
        </MagneticButton>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryRow
          label="Основа анализа"
          value={
            state.inputMode === "speech_text"
              ? `Текст: ${state.speechTextFile?.name ?? "не выбран"}`
              : `Видео: ${state.speechVideoFile?.name ?? state.speechVideoUrl ?? "не выбрано"}`
          }
        />
        <SummaryRow
          label="Транскрибация"
          value={state.inputMode === "speech_video" && state.needTextFromVideo ? "Да (текст из видео)" : "Нет"}
        />
        <SummaryRow
          label="Презентация"
          value={state.presentationFile ? state.presentationFile.name : "Не отправляется"}
        />
        <SummaryRow
          label="Видеоанализ"
          value={state.needVideoAnalysis ? "Да" : "Нет"}
        />
        <SummaryRow
          label="Критерии"
          value={
            state.criteriaMode === "custom"
              ? state.evaluationCriteriaFile?.name ?? "Файл не выбран"
              : state.criteriaMode === "preset"
                ? `Пресет: ${PRESETS.find((preset) => preset.id === state.selectedEvaluationPreset)?.label ?? state.selectedEvaluationPreset}`
                : "Не отправляются"
          }
        />
        <SummaryRow
          label="Персона"
          value={PERSONAS.find((persona) => persona.id === state.selectedPersona)?.label ?? state.selectedPersona}
        />
        <SummaryRow
          label="Провайдеры"
          value={`${ANALYZE_PROVIDERS.find((provider) => provider.id === state.selectedAnalyzeProvider)?.label ?? state.selectedAnalyzeProvider} / ${
            TRANSCRIBE_PROVIDERS.find((provider) => provider.id === state.selectedTranscribeProvider)?.label ??
            state.selectedTranscribeProvider
          }`}
        />
      </div>

      <div className="rounded-[1.75rem] border border-white/[0.08] bg-black/20 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/60">
            <FileCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white/90">Что уйдёт на бэкенд</h4>
            <p className="mt-0.5 text-[13px] leading-5 text-white/40">Если нужно что-то поправить, кликните по шагу в дорожной карте слева.</p>
          </div>
        </div>

        <div className="space-y-2">
          {reviewPayload.map((item) => (
            <div
              key={item.key}
              className="flex flex-col gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <code className="text-xs text-white/40">{item.key}</code>
              <span className="text-sm text-white/85">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-white/70 transition hover:border-white/[0.15] hover:bg-white/[0.06]"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к настройке
        </button>
        <MagneticButton
          onClick={actions.handleAnalyze}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white px-6 text-sm font-semibold text-black"
        >
          <Play className="h-4 w-4" />
          Подтвердить и отправить
        </MagneticButton>
      </div>
    </div>
  );

  return (
    <section id="upload-hub" className="relative z-10 mb-32 w-full px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SpotlightCard className="overflow-hidden rounded-[2.5rem] border border-white/[0.08] bg-black/50 shadow-2xl backdrop-blur-3xl">
          <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="border-b border-white/[0.07] bg-white/[0.015] p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="mb-8">
                <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-white/25">Roadmap</p>
                <h3 className="mt-3 text-2xl font-semibold text-white">Настройка анализа</h3>
                <p className="mt-3 max-w-xs text-[13px] leading-6 text-white/40">
                  После первого шага уже можно стартовать разбор, а остальные блоки можно дополнять или пропускать.
                </p>
              </div>

              <div className="space-y-2">
                {STEPS.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => goToStep(step.id)}
                    className={cn(
                      "flex w-full items-start gap-4 rounded-[1.5rem] border px-4 py-4 text-left transition-all",
                      step.id === state.currentStep
                        ? "border-white/[0.15] bg-white/[0.05]"
                        : "border-transparent bg-transparent hover:border-white/[0.08] hover:bg-white/[0.02]"
                    )}
                  >
                    <StepBadge status={stepStatus(step.id)} index={index} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm font-semibold", step.id === state.currentStep ? "text-white" : "text-white/80")}>{step.title}</p>
                        {step.optional && (
                          <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
                            optional
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] leading-5 text-white/35">{step.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <div className="p-6 sm:p-8 lg:p-10">
              <div className="mb-8 flex flex-col gap-4 border-b border-white/[0.07] pb-6">
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-white/35">
                    Шаг {currentStepIndex + 1} из {STEPS.length}
                  </span>
                  {currentStep.optional && (
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-white/25">
                      Можно пропустить
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-white">{currentStep.title}</h2>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-white/45">{currentStep.description}</p>
                </div>
              </div>

              {state.error && (
                <div className="mb-6 rounded-[1.35rem] border border-rose-400/15 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-100/90">
                  {state.error}
                </div>
              )}

              {state.currentStep === "source" && renderSourceStep()}
              {state.currentStep === "presentation" && renderPresentationStep()}
              {state.currentStep === "video" && renderVideoStep()}
              {state.currentStep === "criteria" && renderCriteriaStep()}
              {state.currentStep === "settings" && renderSettingsStep()}
              {state.currentStep === "review" && renderReviewStep()}
            </div>
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}
