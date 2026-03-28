import { cn } from "@/lib/utils";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Field, Label, RadioGroup, Radio, Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import { hasFastRequestsAvailable } from "@/lib/cookie-utils";
import { useVideoAnalysis } from "@/hooks/use-video-analysis";
import { Fragment } from "react";
import { FileVideo, FileText, FileSpreadsheet, X, Settings2, UploadCloud, Link as LinkIcon } from "lucide-react";

type UploadHubProps = {
  videoAnalysis: ReturnType<typeof useVideoAnalysis>;
};

export function UploadHub({ videoAnalysis }: UploadHubProps) {
  const { state, actions } = videoAnalysis;

  const removeFile = (e: React.MouseEvent, type: "video" | "presentation" | "standard") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "video") actions.setSelectedFile(null);
    if (type === "presentation") actions.setPresentationFile(null);
    if (type === "standard") {
      actions.setStandardFile(null);
      actions.setStandardMode("preset");
    }
  };

  const hasAnyFile = state.selectedFile || state.presentationFile || state.standardFile;

  return (
    <section id="upload-hub" className="relative z-10 w-full py-16 px-4 sm:px-6 mb-32">
      <div className="mx-auto max-w-5xl">
        <SpotlightCard className="overflow-visible rounded-[2.5rem] border border-white/10 bg-black/40 shadow-2xl backdrop-blur-3xl">
          <div
            className="flex flex-col lg:flex-row relative"
            onDragEnter={actions.handleDragEnter}
            onDragLeave={actions.handleDragLeave}
            onDragOver={actions.handleDragOver}
            onDrop={actions.handleDrop}
          >
            {/* Left: Drag & Drop Zone */}
            <div
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center p-8 sm:p-12 transition-all duration-500 min-h-[400px]",
                state.isDragging ? "bg-white/5" : "hover:bg-white/[0.02]"
              )}
            >
              <input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                accept=".mp4,video/mp4,.ppt,.pptx,.pdf,.docx"
                onChange={actions.handleFileChange}
              />
              <label
                htmlFor="file-upload"
                className="absolute inset-0 z-10 cursor-pointer"
              />

              <div
                className={cn(
                  "relative z-0 mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border transition-all duration-500",
                  hasAnyFile
                    ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.2)] text-emerald-400"
                    : "border-white/10 bg-white/5 text-white/50 group-hover:scale-105"
                )}
              >
                <UploadCloud className="w-10 h-10" />
              </div>

              {!hasAnyFile ? (
                <>
                  <h3 className="mb-2 text-xl font-medium text-white text-center">
                    Перетащите файлы сюда
                  </h3>
                  <p className="text-center text-sm text-white/40 max-w-[280px]">
                    Поддерживаются форматы: MP4 (видео), PPTX/PDF (презентация), DOCX (критерии)
                  </p>
                </>
              ) : (
                <div className="w-full max-w-md flex flex-col gap-3 z-20">
                  <h3 className="mb-4 text-lg font-medium text-white text-center">
                    Загруженные файлы
                  </h3>
                  
                  {state.selectedFile && (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg shrink-0">
                          <FileVideo className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-medium text-white truncate">{state.selectedFile.name}</p>
                          <p className="text-xs text-white/40">Видео</p>
                        </div>
                      </div>
                      <button onClick={(e) => removeFile(e, "video")} className="p-2 text-white/40 hover:text-rose-400 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {state.presentationFile && (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-medium text-white truncate">{state.presentationFile.name}</p>
                          <p className="text-xs text-white/40">Презентация</p>
                        </div>
                      </div>
                      <button onClick={(e) => removeFile(e, "presentation")} className="p-2 text-white/40 hover:text-rose-400 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {state.standardFile && (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-medium text-white truncate">{state.standardFile.name}</p>
                          <p className="text-xs text-white/40">Критерии оценивания</p>
                        </div>
                      </div>
                      <button onClick={(e) => removeFile(e, "standard")} className="p-2 text-white/40 hover:text-rose-400 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Actions & Settings */}
            <div className="flex flex-col justify-end border-t border-white/10 lg:border-l lg:border-t-0 bg-black/20 p-8 sm:p-12 w-full lg:w-96 shrink-0 relative">
              <div className="flex flex-col gap-6">
                <div>
                  <label className="mb-3 block text-xs font-mono uppercase tracking-widest text-white/40">
                    Или ссылка на RuTube
                  </label>
                  <div className="flex items-center gap-3 border-b border-white/10 pb-2 transition-colors focus-within:border-white/40 relative z-20">
                    <LinkIcon className="w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      placeholder="rutube.ru/video/..."
                      className="w-full bg-transparent text-sm text-white placeholder-white/20 outline-none"
                      value={state.videoUrl}
                      onChange={actions.handleUrlChange}
                    />
                  </div>
                </div>

                {state.error && (
                  <p className="text-xs font-medium text-rose-400">{state.error}</p>
                )}

                <div className="flex items-center gap-3 mt-4">
                  {/* Settings Popover */}
                  <Popover className="relative z-50">
                    {({ open }) => (
                      <>
                        <PopoverButton
                          className={cn(
                            "flex items-center justify-center p-3 rounded-2xl border border-white/10 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer",
                            open ? "bg-white/10 text-white" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <Settings2 className="w-5 h-5" />
                        </PopoverButton>
                        <Transition
                          as={Fragment}
                          enter="transition ease-out duration-200"
                          enterFrom="opacity-0 translate-y-2 scale-95"
                          enterTo="opacity-100 translate-y-0 scale-100"
                          leave="transition ease-in duration-150"
                          leaveFrom="opacity-100 translate-y-0 scale-100"
                          leaveTo="opacity-0 translate-y-2 scale-95"
                        >
                          <PopoverPanel className="absolute bottom-full left-0 mb-4 w-[320px] origin-bottom-left rounded-3xl border border-white/10 bg-zinc-950/90 backdrop-blur-2xl p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] outline-none">
                            <div className="flex flex-col gap-6">
                              {/* Persona */}
                              <Field>
                                <Label className="mb-3 block text-[10px] font-mono uppercase tracking-widest text-white/40">
                                  Режим анализа
                                </Label>
                                <RadioGroup value={state.selectedPersona} onChange={actions.setSelectedPersona} className="flex flex-wrap gap-1.5">
                                  {[
                                    { id: "", label: "Классика" },
                                    { id: "strict_critic", label: "Критик" },
                                    { id: "kind_mentor", label: "Ментор" },
                                    { id: "steve_jobs_style", label: "Инноватор" },
                                  ].map((p) => (
                                    <Radio
                                      key={p.id}
                                      value={p.id}
                                      className="rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-300 border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white data-[checked]:bg-white data-[checked]:text-black data-[checked]:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
                                    >
                                      {p.label}
                                    </Radio>
                                  ))}
                                </RadioGroup>
                              </Field>

                              {/* Analyze provider */}
                              <Field>
                                <Label className="mb-3 block text-[10px] font-mono uppercase tracking-widest text-white/40">
                                  Провайдер анализа
                                </Label>
                                <RadioGroup value={state.selectedAnalyzeProvider} onChange={actions.setSelectedAnalyzeProvider} className="flex gap-1.5">
                                  {[
                                    { id: "gigachat", label: "GigaChat" },
                                    { id: "openai", label: "OpenAI" },
                                  ].map((m) => (
                                    <Radio
                                      key={m.id}
                                      value={m.id}
                                      className="flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-all duration-300 border border-transparent text-white/40 hover:text-white data-[checked]:bg-white/10 data-[checked]:text-white data-[checked]:shadow-inner data-[checked]:border-white/20 outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
                                    >
                                      {m.label}
                                    </Radio>
                                  ))}
                                </RadioGroup>
                              </Field>

                              {/* Transcribe provider */}
                              <Field>
                                <Label className="mb-3 block text-[10px] font-mono uppercase tracking-widest text-white/40">
                                  Провайдер транскрибации
                                </Label>
                                <RadioGroup value={state.selectedTranscribeProvider} onChange={actions.setSelectedTranscribeProvider} className="grid grid-cols-1 gap-1.5">
                                  {[
                                    { id: "sber_gigachat", label: "Sber GigaChat" },
                                    { id: "whisper_local", label: "Whisper (локально)" },
                                    { id: "whisper_openai", label: "Whisper OpenAI" },
                                  ].map((m) => (
                                    <Radio
                                      key={m.id}
                                      value={m.id}
                                      disabled={m.id === "whisper_openai" && !hasFastRequestsAvailable()}
                                      className="rounded-lg py-1.5 px-2 text-center text-xs font-medium transition-all duration-300 border border-transparent text-white/40 hover:text-white data-[checked]:bg-white/10 data-[checked]:text-white data-[checked]:shadow-inner data-[checked]:border-white/20 data-[disabled]:opacity-30 data-[disabled]:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
                                    >
                                      {m.label}
                                      {m.id === "whisper_openai" && (
                                        <span className="ml-1 rounded bg-white/10 px-1 text-[9px] text-white">{state.fastRequestsCount}</span>
                                      )}
                                    </Radio>
                                  ))}
                                </RadioGroup>
                              </Field>

                              {/* Standard Mode */}
                              <Field>
                                <Label className="mb-3 block text-[10px] font-mono uppercase tracking-widest text-white/40">
                                  Стандарт оценивания
                                </Label>
                                <RadioGroup
                                  value={state.standardMode}
                                  onChange={(v) => {
                                    actions.setStandardMode(v);
                                    if (v === "preset") actions.setStandardFile(null);
                                  }}
                                  className="flex gap-1 p-1 rounded-xl border border-white/10 bg-black/30"
                                >
                                  <Radio
                                    value="preset"
                                    className="flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-all duration-300 text-white/50 hover:text-white/80 data-[checked]:bg-white data-[checked]:text-black data-[checked]:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
                                  >
                                    Предустановленный
                                  </Radio>
                                  <Radio
                                    value="custom"
                                    className="flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition-all duration-300 text-white/50 hover:text-white/80 data-[checked]:bg-white data-[checked]:text-black data-[checked]:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
                                  >
                                    Свой файл
                                  </Radio>
                                </RadioGroup>
                                {state.standardMode === "preset" && (
                                  <RadioGroup
                                    value={state.selectedEvaluationPreset}
                                    onChange={actions.setSelectedEvaluationPreset}
                                    className="mt-2 grid grid-cols-1 gap-1.5"
                                  >
                                    {[
                                      { id: "default", label: "Базовый" },
                                      { id: "urfu", label: "От УрФУ" },
                                    ].map((preset) => (
                                      <Radio
                                        key={preset.id}
                                        value={preset.id}
                                        className="rounded-lg py-1.5 px-2 text-center text-xs font-medium transition-all duration-300 border border-transparent text-white/40 hover:text-white data-[checked]:bg-white/10 data-[checked]:text-white data-[checked]:shadow-inner data-[checked]:border-white/20 outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
                                      >
                                        {preset.label}
                                      </Radio>
                                    ))}
                                  </RadioGroup>
                                )}
                              </Field>
                            </div>
                          </PopoverPanel>
                        </Transition>
                      </>
                    )}
                  </Popover>

                  <MagneticButton
                    onClick={actions.handleAnalyze}
                    disabled={!state.selectedFile && (!state.videoUrl || !state.isValidRuTubeUrl)}
                    intensity={0.1}
                    className={cn(
                      "flex-1 rounded-2xl px-6 py-3 text-sm font-semibold transition-all duration-500",
                      (!state.selectedFile && (!state.videoUrl || !state.isValidRuTubeUrl))
                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                        : "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)] cursor-pointer"
                    )}
                  >
                    Запустить нейросеть
                  </MagneticButton>
                </div>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}
