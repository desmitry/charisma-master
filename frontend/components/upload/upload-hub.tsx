import React from "react";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Field, Label, RadioGroup, Radio } from "@headlessui/react";
import { hasFastRequestsAvailable } from "@/lib/cookie-utils";
import { useVideoAnalysis } from "@/hooks/use-video-analysis";

type UploadHubProps = {
  videoAnalysis: ReturnType<typeof useVideoAnalysis>;
};

export function UploadHub({ videoAnalysis }: UploadHubProps) {
  const { state, actions } = videoAnalysis;

  return (
    <section id="upload-hub" className="relative z-10 w-full py-16 px-4 sm:px-6 mb-32">
      <div className="mx-auto max-w-5xl">
        <SpotlightCard className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/40 shadow-2xl backdrop-blur-3xl">
          <div
            className="flex flex-col lg:flex-row"
            onDragEnter={actions.handleDragEnter}
            onDragLeave={actions.handleDragLeave}
            onDragOver={actions.handleDragOver}
            onDrop={actions.handleDrop}
          >
            {/* Left: Drag & Drop Zone */}
            <div
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center p-12 transition-all duration-500",
                state.isDragging ? "bg-white/5" : "hover:bg-white/[0.02]"
              )}
            >
              <input
                id="video-upload"
                type="file"
                className="hidden"
                accept="video/mp4,.mp4"
                onChange={actions.handleFileChange}
              />
              <label
                htmlFor="video-upload"
                className="absolute inset-0 z-10 cursor-pointer"
              />

              <div
                className={cn(
                  "relative z-0 mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border transition-all duration-500",
                  state.selectedFile
                    ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.2)] text-emerald-400"
                    : "border-white/10 bg-white/5 text-white/50 group-hover:scale-105"
                )}
              >
                {state.selectedFile ? (
                  <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                )}
              </div>

              <h3 className="mb-2 text-xl font-medium text-white text-center">
                {state.selectedFile ? "Файл готов к анализу" : "Перетащите видео сюда"}
              </h3>
              <p className="text-center text-sm text-white/40 max-w-[250px]">
                {state.selectedFile ? state.selectedFile.name : "Поддерживается только формат MP4. Максимум 5 минут."}
              </p>

              {state.selectedFile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    actions.setSelectedFile(null);
                  }}
                  className="relative z-20 mt-6 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                >
                  Заменить файл
                </button>
              )}
            </div>

            {/* Right: Settings & Actions */}
            <div className="flex flex-1 flex-col justify-between border-t border-white/10 lg:border-l lg:border-t-0 bg-black/20 p-8 sm:p-12">
              <div>
                <div className="mb-8">
                  <label className="mb-3 block text-xs font-mono uppercase tracking-widest text-white/40">
                    Или ссылка на RuTube
                  </label>
                  <div className="flex items-center gap-3 border-b border-white/10 pb-2 transition-colors focus-within:border-white/40">
                    <svg className="h-5 w-5 text-white/30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 016.364 6.364l-4.5 4.5a4.5 4.5 0 01-7.244-1.242" />
                    </svg>
                    <input
                      type="text"
                      placeholder="rutube.ru/video/..."
                      className="w-full bg-transparent text-sm text-white placeholder-white/20 outline-none"
                      value={state.videoUrl}
                      onChange={actions.handleUrlChange}
                    />
                  </div>
                </div>

                {/* Presentation file upload */}
                <div className="mb-8">
                  <label className="mb-3 block text-xs font-mono uppercase tracking-widest text-white/40">
                    Файл презентации
                  </label>
                  <div className="relative">
                    <input
                      id="presentation-upload"
                      type="file"
                      className="hidden"
                      accept=".pptx,.ppt,.pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        actions.setPresentationFile(f || null);
                      }}
                    />
                    <label
                      htmlFor="presentation-upload"
                      className={cn(
                        "flex items-center gap-3 cursor-pointer rounded-xl border border-dashed px-4 py-3 transition-all duration-300",
                        state.presentationFile
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/[0.07]"
                      )}
                    >
                      {state.presentationFile ? (
                        <>
                          <svg className="h-5 w-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span className="text-sm text-emerald-400 truncate">{state.presentationFile.name}</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-5 w-5 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <span className="text-sm text-white/40">.pptx, .ppt, .pdf</span>
                        </>
                      )}
                    </label>
                    {state.presentationFile && (
                      <button
                        type="button"
                        onClick={() => actions.setPresentationFile(null)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <Field className="mb-8">
                  <Label className="mb-3 block text-xs font-mono uppercase tracking-widest text-white/40">
                    Режим анализа
                  </Label>
                  <RadioGroup value={state.selectedPersona} onChange={actions.setSelectedPersona} className="flex flex-wrap gap-2">
                    {[
                      { id: "", label: "Классика" },
                      { id: "strict_critic", label: "Критик" },
                      { id: "kind_mentor", label: "Ментор" },
                      { id: "steve_jobs_style", label: "Инноватор" },
                    ].map((p) => (
                      <Radio
                        key={p.id}
                        value={p.id}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300 border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white data-[checked]:bg-white data-[checked]:text-black data-[checked]:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
                      >
                        {p.label}
                      </Radio>
                    ))}
                  </RadioGroup>
                </Field>

                <Field className="mb-8">
                  <Label className="mb-3 block text-xs font-mono uppercase tracking-widest text-white/40">
                    Нейросеть
                  </Label>
                  <RadioGroup value={state.selectedLlmProvider} onChange={actions.setSelectedLlmProvider} className="flex gap-2">
                    {[
                      { id: "default", label: "Auto" },
                      { id: "gigachat", label: "GigaChat" },
                      { id: "openai", label: "OpenAI" },
                    ].map((m) => (
                      <Radio
                        key={m.id}
                        value={m.id}
                        className="flex-1 rounded-lg py-2 text-center text-xs font-medium transition-all duration-300 border border-transparent text-white/40 hover:text-white data-[checked]:bg-white/10 data-[checked]:text-white data-[checked]:shadow-inner data-[checked]:border-white/20 outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
                      >
                        {m.label}
                      </Radio>
                    ))}
                  </RadioGroup>
                  {state.selectedLlmProvider === "openai" && (
                    <RadioGroup value={state.selectedModel} onChange={actions.setSelectedModel} className="mt-3 flex gap-2">
                      <Radio
                        value="whisper_local"
                        className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-center transition-colors text-white/40 hover:bg-white/5 cursor-pointer data-[checked]:bg-white/10 data-[checked]:text-white outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                      >
                        Long
                      </Radio>
                      <Radio
                        value="whisper_openai"
                        disabled={!hasFastRequestsAvailable()}
                        className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs transition-colors flex items-center justify-center gap-1.5 text-white/40 data-[checked]:bg-emerald-500/10 data-[checked]:text-emerald-400 data-[checked]:border-emerald-500/20 data-[disabled]:opacity-30 data-[disabled]:cursor-not-allowed cursor-pointer hover:bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                      >
                        Fast <span className="rounded bg-white/10 px-1 text-[10px] text-white">{state.fastRequestsCount}</span>
                      </Radio>
                    </RadioGroup>
                  )}
                </Field>

                <Field className="mb-8">
                  <Label className="mb-3 block text-xs font-mono uppercase tracking-widest text-white/40">
                    Стандарт оценивания
                  </Label>
                  <RadioGroup
                    value={state.standardMode}
                    onChange={(v) => {
                      actions.setStandardMode(v);
                      if (v === "preset") actions.setStandardFile(null);
                    }}
                    className="flex gap-1 p-1 rounded-xl border border-white/10 bg-black/30 mb-3"
                  >
                    <Radio
                      value="preset"
                      className="flex-1 rounded-lg py-2 text-center text-xs font-medium transition-all duration-300 text-white/50 hover:text-white/80 data-[checked]:bg-white data-[checked]:text-black data-[checked]:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
                    >
                      Предустановленный (УрФУ)
                    </Radio>
                    <Radio
                      value="custom"
                      className="flex-1 rounded-lg py-2 text-center text-xs font-medium transition-all duration-300 text-white/50 hover:text-white/80 data-[checked]:bg-white data-[checked]:text-black data-[checked]:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
                    >
                      Загрузить свой (.docx)
                    </Radio>
                  </RadioGroup>

                  {state.standardMode === "custom" && (
                    <div className="relative">
                      <input
                        id="standard-upload"
                        type="file"
                        className="hidden"
                        accept=".docx"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          actions.setStandardFile(f || null);
                        }}
                      />
                      <label
                        htmlFor="standard-upload"
                        className={cn(
                          "flex items-center gap-3 cursor-pointer rounded-xl border border-dashed px-4 py-3 transition-all duration-300",
                          state.standardFile
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/[0.07]"
                        )}
                      >
                        {state.standardFile ? (
                          <>
                            <svg className="h-5 w-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <span className="text-sm text-emerald-400 truncate">{state.standardFile.name}</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-5 w-5 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            <span className="text-sm text-white/40">Выберите .docx файл стандарта</span>
                          </>
                        )}
                      </label>
                      {state.standardFile && (
                        <button
                          type="button"
                          onClick={() => actions.setStandardFile(null)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </Field>
              </div>

              <div className="flex items-center gap-4">
                {state.error && (
                  <p className="flex-1 text-xs font-medium text-rose-400">{state.error}</p>
                )}

                <MagneticButton
                  onClick={actions.handleAnalyze}
                  disabled={!state.selectedFile && (!state.videoUrl || !state.isValidRuTubeUrl)}
                  intensity={0.1}
                  className={cn(
                    "ml-auto shrink-0 rounded-2xl px-6 py-3 text-sm font-semibold transition-all duration-500",
                    (!state.selectedFile && (!state.videoUrl || !state.isValidRuTubeUrl))
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)]"
                  )}
                >
                  Запустить нейросеть
                </MagneticButton>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}
