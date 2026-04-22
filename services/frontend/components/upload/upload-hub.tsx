"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { motion, AnimatePresence } from "motion/react";

import { MagneticButton } from "@/components/ui/magnetic-button";
import { StepperIndicatorRow, StepperContent } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import { type WizardStepId, useVideoAnalysis } from "@/hooks/use-video-analysis";

/* ═══════════════════════════════════════════════════════
   TYPES & CONFIG
   ═══════════════════════════════════════════════════════ */

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
    description: "Загрузите файл с текстом речи или видеозапись — текст будет извлечён автоматически.",
  },
  {
    id: "presentation",
    title: "Презентация",
    description: "Добавьте презентацию, чтобы анализировать речь вместе со слайдами.",
    optional: true,
  },
  {
    id: "video",
    title: "Видеоанализ",
    description: "Нужен ли анализ невербальной подачи? Если видео ещё не добавлено, загрузите его здесь.",
    optional: true,
  },
  {
    id: "criteria",
    title: "Критерии",
    description: "Загрузите свои критерии, выберите готовый пресет или пропустите шаг.",
    optional: true,
  },
  {
    id: "settings",
    title: "Оценщик и провайдеры",
    description: "Выберите персону оценки и сервисы для анализа и транскрибации.",
    optional: true,
  },
  {
    id: "review",
    title: "Запуск",
    description: "Проверьте параметры и подтвердите запуск анализа.",
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
  { id: "openai", label: "OpenAI", disabled: true },
];

const TRANSCRIBE_PROVIDERS = [
  { id: "sber_gigachat", label: "Sber GigaChat" },
  { id: "whisper_local", label: "Whisper локально" },
  { id: "whisper_openai", label: "Whisper Fast", disabled: true },
];

const PRESETS = [
  { id: "default", label: "Базовые критерии" },
  { id: "urfu", label: "Критерии УрФУ" },
];

/* ═══════════════════════════════════════════════════════
   SMALL REUSABLE PIECES
   ═══════════════════════════════════════════════════════ */

function FileField({
  id,
  title,
  description,
  accept,
  icon,
  file,
  onChange,
  onRemove,
}: {
  id: string;
  title: string;
  description: string;
  accept: string;
  icon: ReactNode;
  file: File | null;
  onChange: (file: File | null) => void;
  onRemove: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) onChange(droppedFile);
  };

  return (
    <div className="group/field rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] p-5 transition-colors hover:border-white/[0.14]">
      <div className={cn("flex items-start gap-3", file ? "mb-3" : "mb-4")}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-white/50 transition-colors group-hover/field:text-white/70">
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-white/90">{title}</h4>
          <p className="mt-0.5 text-[13px] leading-5 text-white/35">{description}</p>
        </div>
      </div>

      {file ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-3"
        >
          <FileCheck className="h-4 w-4 shrink-0 text-emerald-300/70" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white/90">{file.name}</p>
            <p className="text-xs text-white/30">{Math.max(1, Math.round(file.size / 1024))} КБ</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/35 transition hover:border-rose-400/25 hover:bg-rose-400/10 hover:text-rose-300"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "group/drop flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed px-5 py-5 text-center transition-all",
            isDragging
              ? "border-white/30 bg-white/[0.06]"
              : "border-white/[0.1] bg-black/20 hover:border-white/20 hover:bg-white/[0.03]"
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-white/25 transition group-hover/drop:text-white/50">
            <Upload className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/60 transition group-hover/drop:text-white/80">
              Перетащите файл или нажмите
            </p>
            <p className="mt-0.5 text-xs text-white/25">{accept.replaceAll(",", ", ")}</p>
          </div>
          <input
            id={id}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
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
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group/toggle relative flex w-full items-start gap-3 rounded-xl border px-4 py-4 text-left transition-all",
        active
          ? "border-white/20 bg-gradient-to-br from-white/[0.1] to-white/[0.03] text-white shadow-[0_0_24px_rgba(255,255,255,0.04)]"
          : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:border-white/[0.12] hover:bg-white/[0.04]"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all",
          active
            ? "border-white/15 bg-white/[0.1] text-white"
            : "border-white/[0.06] bg-black/20 text-white/40 group-hover/toggle:text-white/60"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold transition-colors", active ? "text-white" : "text-white/75")}>{title}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-white/35">{description}</p>
      </div>
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.12]"
          >
            <Check className="h-3 w-3 text-white/80" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-white/25">{label}</span>
      <span className="text-sm text-white/80">{value}</span>
    </div>
  );
}

function NavFooter({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="flex flex-col gap-3 pt-4 sm:flex-row"
    >
      {children}
    </motion.div>
  );
}

function BackButton({ onClick, label = "Назад" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-white/60 transition hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white/80"
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </button>
  );
}

function NextButton({ onClick, label, disabled = false }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled ?? false}
      suppressHydrationWarning
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold transition",
        disabled
          ? "cursor-not-allowed border-white/[0.05] bg-white/[0.02] text-white/25"
          : "border-white/[0.08] bg-white/[0.04] text-white hover:border-white/[0.18] hover:bg-white/[0.07]"
      )}
    >
      {label}
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

function PrimaryButton({
  onClick,
  label,
  disabled = false,
  icon,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <MagneticButton
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-6 text-sm font-semibold transition",
        disabled
          ? "cursor-not-allowed border-white/[0.08] bg-white/5 text-white/25"
          : "border-white/15 bg-white text-black"
      )}
    >
      {icon ?? <Play className="h-4 w-4" />}
      {label}
    </MagneticButton>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

function ProviderSelect({
  providers,
  value,
  onChange,
}: {
  providers: { id: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const TW = tooltipRef.current?.offsetWidth ?? 160;
    const TH = tooltipRef.current?.offsetHeight ?? 32;
    const MARGIN = 12;
    let x = e.clientX + 14;
    let y = e.clientY - TH / 2;
    if (x + TW + MARGIN > window.innerWidth) x = e.clientX - TW - 14;
    if (y < MARGIN) y = MARGIN;
    if (y + TH + MARGIN > window.innerHeight) y = window.innerHeight - TH - MARGIN;
    setMouse({ x, y });
  };

  const tooltip = mounted && typeof document !== "undefined" ? createPortal(
    <div
      ref={tooltipRef}
      className="fixed z-[9999] pointer-events-none whitespace-nowrap rounded-lg bg-[#1e1e22] border border-white/10 text-[11px] text-white/70 px-3 py-1.5 shadow-xl"
      style={{
        left: mouse?.x ?? 0,
        top: mouse?.y ?? 0,
        opacity: visible && mouse ? 1 : 0,
        transform: visible && mouse ? "scale(1)" : "scale(0.92)",
        transition: "opacity 0.15s ease, transform 0.15s ease",
      }}
    >
      Временно недоступно
    </div>,
    document.body
  ) : null;

  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) =>
        p.disabled ? (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/10 px-4 py-3 opacity-40 cursor-not-allowed select-none"
            onMouseEnter={(e) => { handleMouseMove(e); setVisible(true); }}
            onMouseLeave={() => setVisible(false)}
            onMouseMove={handleMouseMove}
          >
            <span className="text-sm text-white/60">{p.label}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        ) : (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition text-left ${
              value === p.id
                ? "border-white/20 bg-white/[0.08] text-white"
                : "border-white/[0.06] bg-black/10 text-white/60 hover:border-white/10 hover:text-white/80"
            }`}
          >
            <span>{p.label}</span>
            {value === p.id && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        )
      )}
      {tooltip}
    </div>
  );
}

export function UploadHub({ videoAnalysis }: UploadHubProps) {
  const { state, actions } = videoAnalysis;
  const [direction, setDirection] = useState(0);

  const currentStepIndex = STEPS.findIndex((s) => s.id === state.currentStep);
  const currentStep = STEPS[currentStepIndex] ?? STEPS[0];

  const sourceComplete = state.hasRequiredSource;

  /* ─── Step completion for the indicator ─── */
  const stepCompletionMap: Record<WizardStepId, boolean> = {
    source: sourceComplete,
    presentation: Boolean(state.presentationFile),
    video: state.needVideoAnalysis ? state.hasSpeechVideo : false,
    criteria: state.criteriaMode === "preset" || (state.criteriaMode === "custom" && Boolean(state.evaluationCriteriaFile)),
    settings: Boolean(state.selectedPersona && state.selectedAnalyzeProvider && state.selectedTranscribeProvider),
    review: false,
  };

  const getIndicatorStep = () => {
    let indicatorCurrent = currentStepIndex + 1;
    for (let i = 0; i < currentStepIndex; i++) {
      if (!stepCompletionMap[STEPS[i].id]) break;
      if (i === currentStepIndex - 1) indicatorCurrent = currentStepIndex + 1;
    }
    return indicatorCurrent;
  };

  const indicatorCurrentStep = getIndicatorStep();

  /* ─── Navigation ─── */
  const goToStep = (stepId: WizardStepId) => {
    const targetIndex = STEPS.findIndex((s) => s.id === stepId);
    setDirection(targetIndex > currentStepIndex ? 1 : -1);

    if (stepId === "review") {
      actions.openReviewStep();
    } else {
      actions.setError(null);
      actions.setCurrentStep(stepId);
    }
  };

  const goNext = () => {
    const next = STEPS[currentStepIndex + 1];
    if (!next) return;
    setDirection(1);
    actions.setError(null);
    actions.setCurrentStep(next.id);
  };

  const goBack = () => {
    const prev = STEPS[currentStepIndex - 1];
    if (!prev) return;
    setDirection(-1);
    actions.setError(null);
    actions.setCurrentStep(prev.id);
  };

  /* ─── Review payload ─── */
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

  /* ═══ STEP RENDERERS ═══ */

  const renderSourceStep = () => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleCard
          active={state.inputMode === "speech_text"}
          title="Файл с текстом"
          description="Готовый текст речи — TXT, MD, DOC, DOCX."
          icon={<FileText className="h-4.5 w-4.5" />}
          onClick={() => actions.selectInputMode("speech_text")}
        />
        <ToggleCard
          active={state.inputMode === "speech_video"}
          title="Видеозапись"
          description="Текст будет извлечён автоматически."
          icon={<Video className="h-4.5 w-4.5" />}
          onClick={() => actions.selectInputMode("speech_video")}
        />
      </div>

      <AnimatePresence mode="wait">
        {state.inputMode === "speech_text" && (
          <motion.div key="text" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <FileField
              id="speech-text-file"
              title="Файл с текстом выступления"
              description="Текстовые файлы, markdown, документы Word."
              accept=".txt,.md,.doc,.docx"
              icon={<FileText className="h-4.5 w-4.5" />}
              file={state.speechTextFile}
              onChange={actions.handleSpeechTextFileChange}
              onRemove={() => actions.handleSpeechTextFileChange(null)}
            />
          </motion.div>
        )}

        {state.inputMode === "speech_video" && (
          <motion.div key="video" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
            <FileField
              id="speech-video-file"
              title="Видео выступления"
              description="Видеофайл для транскрибации и анализа."
              accept=".mp4,.mov,.avi,.mkv,.webm,.m4v"
              icon={<Video className="h-4.5 w-4.5" />}
              file={state.speechVideoFile}
              onChange={actions.handleSpeechVideoFileChange}
              onRemove={() => actions.handleSpeechVideoFileChange(null)}
            />

            <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] p-5">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-white/50">
                  <LinkIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white/90">Или ссылка на RuTube</h4>
                  <p className="mt-0.5 text-[13px] leading-5 text-white/35">rutube.ru/video/...</p>
                </div>
              </div>
              <input
                type="text"
                value={state.speechVideoUrl}
                onChange={(e) => actions.handleSpeechVideoUrlChange(e.target.value)}
                placeholder="https://rutube.ru/video/..."
                className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/20 focus:bg-black/30"
              />
              {state.speechVideoUrl && !state.isValidRuTubeUrl && (
                <p className="mt-2 text-xs text-amber-300/70">Ссылка не похожа на корректную ссылку RuTube.</p>
              )}
            </div>

            {state.hasSpeechVideo && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-xl border border-sky-400/15 bg-sky-400/[0.05] px-4 py-3"
              >
                <Mic className="h-4 w-4 shrink-0 text-sky-300/60" />
                <p className="text-[13px] leading-5 text-sky-100/70">
                  Транскрибация включена — текст будет извлечён из видео.
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <NavFooter>
        <PrimaryButton onClick={actions.openReviewStep} label="Начать разбор" disabled={!sourceComplete} />
        <NextButton onClick={goNext} label="Настроить" disabled={!sourceComplete} />
      </NavFooter>
    </div>
  );

  const renderPresentationStep = () => (
    <div className="space-y-5">
      <FileField
        id="presentation-file"
        title="Файл презентации"
        description="PPT, PPTX или PDF. Шаг можно пропустить."
        accept=".ppt,.pptx,.pdf"
        icon={<Presentation className="h-4.5 w-4.5" />}
        file={state.presentationFile}
        onChange={actions.handlePresentationFileChange}
        onRemove={() => actions.handlePresentationFileChange(null)}
      />
      <NavFooter>
        <BackButton onClick={goBack} />
        <NextButton onClick={goNext} label={state.presentationFile ? "Дальше" : "Пропустить"} />
        <PrimaryButton onClick={() => { setDirection(1); actions.openReviewStep(); }} label="К сводке" />
      </NavFooter>
    </div>
  );

  const renderVideoStep = () => {
    const uploadedTextNotVideo = state.inputMode === "speech_text" && !state.hasSpeechVideo;

    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard
            active={state.needVideoAnalysis}
            title="Анализировать видео"
            description="Невербальный анализ: жесты, мимика, контакт."
            icon={<Video className="h-4.5 w-4.5" />}
            onClick={() => actions.setNeedVideoAnalysis(true)}
          />
          <ToggleCard
            active={!state.needVideoAnalysis}
            title="Пропустить"
            description="Только текст и загруженные материалы."
            icon={<CircleDashed className="h-4.5 w-4.5" />}
            onClick={() => actions.setNeedVideoAnalysis(false)}
          />
        </div>

        <AnimatePresence mode="wait">
          {state.needVideoAnalysis && (
            <motion.div key="va" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
              {state.hasSpeechVideo ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-3">
                  <Check className="h-4 w-4 shrink-0 text-emerald-300/60" />
                  <p className="text-[13px] leading-5 text-emerald-100/70">Видео уже добавлено. Можно заменить ниже.</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3">
                  <Video className="h-4 w-4 shrink-0 text-amber-300/60" />
                  <p className="text-[13px] leading-5 text-amber-100/70">Видео не добавлено. Загрузите файл или ссылку.</p>
                </div>
              )}

              <FileField
                id="video-analysis-file"
                title="Видео для анализа"
                description="Отдельное видео, если на первом шаге был только текст."
                accept=".mp4,.mov,.avi,.mkv,.webm,.m4v"
                icon={<Video className="h-4.5 w-4.5" />}
                file={state.speechVideoFile}
                onChange={actions.handleSpeechVideoFileChange}
                onRemove={() => actions.handleSpeechVideoFileChange(null)}
              />

              <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] p-5">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-white/50">
                    <LinkIcon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white/90">Ссылка на RuTube</h4>
                    <p className="mt-0.5 text-[13px] leading-5 text-white/35">rutube.ru/video/...</p>
                  </div>
                </div>
                <input
                  type="text"
                  value={state.speechVideoUrl}
                  onChange={(e) => actions.handleSpeechVideoUrlChange(e.target.value)}
                  placeholder="https://rutube.ru/video/..."
                  className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-white/20 focus:bg-black/30"
                />
              </div>

              {uploadedTextNotVideo && state.hasSpeechVideo && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-violet-400/15 bg-violet-400/[0.05] px-4 py-3">
                    <Wand2 className="h-4 w-4 shrink-0 text-violet-300/60" />
                    <p className="text-[13px] leading-5 text-violet-100/70">
                      Хотите также извлечь текст из видео?
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleCard
                      active={state.needTextFromVideo}
                      title="Извлечь текст"
                      description="Транскрибация + текст к анализу."
                      icon={<Wand2 className="h-4.5 w-4.5" />}
                      onClick={() => actions.setNeedTextFromVideo(true)}
                    />
                    <ToggleCard
                      active={!state.needTextFromVideo}
                      title="Не нужно"
                      description="Только загруженный текст."
                      icon={<CircleDashed className="h-4.5 w-4.5" />}
                      onClick={() => actions.setNeedTextFromVideo(false)}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <NavFooter>
          <BackButton onClick={goBack} />
          <NextButton onClick={goNext} label="Дальше" />
          <PrimaryButton onClick={() => { setDirection(1); actions.openReviewStep(); }} label="К сводке" />
        </NavFooter>
      </div>
    );
  };

  const renderCriteriaStep = () => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <ToggleCard
          active={state.criteriaMode === "none"}
          title="Без критериев"
          description="Пропустить этот шаг."
          icon={<CircleDashed className="h-4.5 w-4.5" />}
          onClick={() => { actions.setCriteriaMode("none"); actions.setEvaluationCriteriaFile(null); }}
        />
        <ToggleCard
          active={state.criteriaMode === "preset"}
          title="Пресет"
          description="Готовый набор критериев."
          icon={<FileCheck className="h-4.5 w-4.5" />}
          onClick={() => { actions.setCriteriaMode("preset"); actions.setEvaluationCriteriaFile(null); }}
        />
        <ToggleCard
          active={state.criteriaMode === "custom"}
          title="Свой файл"
          description="Собственные критерии."
          icon={<FileStack className="h-4.5 w-4.5" />}
          onClick={() => actions.setCriteriaMode("custom")}
        />
      </div>

      <AnimatePresence mode="wait">
        {state.criteriaMode === "preset" && (
          <motion.div key="preset" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] p-5">
              <label className="mb-2 block text-sm font-semibold text-white/90">Пресет критериев</label>
              <select
                value={state.selectedEvaluationPreset}
                onChange={(e) => actions.setSelectedEvaluationPreset(e.target.value as "default" | "urfu")}
                className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
        {state.criteriaMode === "custom" && (
          <motion.div key="custom" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <FileField
              id="criteria-file"
              title="Файл с критериями"
              description="Документ с собственной шкалой оценивания."
              accept=".txt,.md,.doc,.docx,.pdf"
              icon={<FileCheck className="h-4.5 w-4.5" />}
              file={state.evaluationCriteriaFile}
              onChange={actions.handleCriteriaFileChange}
              onRemove={() => actions.handleCriteriaFileChange(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <NavFooter>
        <BackButton onClick={goBack} />
        <NextButton onClick={goNext} label="Дальше" />
        <PrimaryButton onClick={() => { setDirection(1); actions.openReviewStep(); }} label="К сводке" />
      </NavFooter>
    </div>
  );

  const renderSettingsStep = () => (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] p-5 transition-colors hover:border-white/[0.12]">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
            <UserRound className="h-4 w-4 text-white/40" />
            Персона
          </label>
          <select
            value={state.selectedPersona}
            onChange={(e) => actions.setSelectedPersona(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
          >
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <p className="mt-2 text-[13px] leading-5 text-white/35">
            {PERSONAS.find((p) => p.id === state.selectedPersona)?.description}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] p-5 transition-colors hover:border-white/[0.12]">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
            <Sparkles className="h-4 w-4 text-white/40" />
            Провайдер анализа
          </label>
          <ProviderSelect
            providers={ANALYZE_PROVIDERS}
            value={state.selectedAnalyzeProvider}
            onChange={actions.setSelectedAnalyzeProvider}
          />
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] p-5 transition-colors hover:border-white/[0.12]">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/90">
            <Wand2 className="h-4 w-4 text-white/40" />
            Транскрибация
          </label>
          <ProviderSelect
            providers={TRANSCRIBE_PROVIDERS}
            value={state.selectedTranscribeProvider}
            onChange={actions.setSelectedTranscribeProvider}
          />
        </div>
      </div>

      <NavFooter>
        <BackButton onClick={goBack} />
        <PrimaryButton onClick={() => { setDirection(1); actions.openReviewStep(); }} label="Перейти к сводке" />
      </NavFooter>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
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
          value={state.inputMode === "speech_video" && state.needTextFromVideo ? "Да" : "Нет"}
        />
        <SummaryRow label="Презентация" value={state.presentationFile ? state.presentationFile.name : "—"} />
        <SummaryRow label="Видеоанализ" value={state.needVideoAnalysis ? "Да" : "Нет"} />
        <SummaryRow
          label="Критерии"
          value={
            state.criteriaMode === "custom"
              ? state.evaluationCriteriaFile?.name ?? "Файл не выбран"
              : state.criteriaMode === "preset"
                ? PRESETS.find((p) => p.id === state.selectedEvaluationPreset)?.label ?? state.selectedEvaluationPreset
                : "—"
          }
        />
        <SummaryRow
          label="Персона"
          value={PERSONAS.find((p) => p.id === state.selectedPersona)?.label ?? state.selectedPersona}
        />
        <SummaryRow
          label="Провайдеры"
          value={`${ANALYZE_PROVIDERS.find((p) => p.id === state.selectedAnalyzeProvider)?.label ?? state.selectedAnalyzeProvider} / ${TRANSCRIBE_PROVIDERS.find((p) => p.id === state.selectedTranscribeProvider)?.label ?? state.selectedTranscribeProvider}`}
        />
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/50">
            <FileCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white/90">Payload</h4>
            <p className="text-[13px] text-white/35">Что уйдёт на бэкенд</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {reviewPayload.map((item) => (
            <div
              key={item.key}
              className="flex flex-col gap-0.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <code className="text-xs text-white/35 font-mono">{item.key}</code>
              <span className="text-sm text-white/80">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <NavFooter>
        <BackButton onClick={goBack} label="Назад к настройке" />
        <PrimaryButton onClick={actions.handleAnalyze} label="Подтвердить и отправить" />
      </NavFooter>
    </div>
  );

  /* ═══ STEP CONTENT MAP ═══ */
  const stepRenderers: Record<WizardStepId, () => ReactNode> = {
    source: renderSourceStep,
    presentation: renderPresentationStep,
    video: renderVideoStep,
    criteria: renderCriteriaStep,
    settings: renderSettingsStep,
    review: renderReviewStep,
  };

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */

  return (
    <section id="upload-hub" className="relative z-10 mb-32 w-full px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-black/50 shadow-2xl backdrop-blur-3xl">
          <div className="p-6 sm:p-8 lg:p-10">

            {/* ─── Step indicator row ─── */}
            <StepperIndicatorRow
              totalSteps={STEPS.length}
              currentStep={indicatorCurrentStep}
              onStepClick={(step) => goToStep(STEPS[step - 1].id)}
            />

            {/* ─── Step header ─── */}
            <div className="mt-6 mb-8">
              <div className="flex items-center gap-3 mb-3">
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-[0.18em] text-white/30">
                  {currentStepIndex + 1}/{STEPS.length}
                </span>
                {currentStep.optional && (
                  <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-white/20">
                    optional
                  </span>
                )}
              </div>
              <motion.h2
                key={currentStep.id + "-title"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
              >
                {currentStep.title}
              </motion.h2>
              <motion.p
                key={currentStep.id + "-desc"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="mt-2 text-[15px] leading-6 text-white/40"
              >
                {currentStep.description}
              </motion.p>
            </div>

            {/* ─── Error ─── */}
            <AnimatePresence>
              {state.error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-100/80"
                >
                  {state.error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Animated step content ─── */}
            <StepperContent
              currentStep={currentStepIndex + 1}
              direction={direction}
            >
              {stepRenderers[state.currentStep]()}
            </StepperContent>

          </div>
        </div>
      </div>
    </section>
  );
}
