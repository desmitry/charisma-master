import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function DemoVideoSection({ onStartDemo }: { onStartDemo: () => void }) {
  return (
    <section className="relative z-10 w-full py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <ScrollReveal distance={30}>
          <div className="relative group overflow-hidden rounded-[2.5rem] border border-card-border bg-card-bg backdrop-blur-2xl shadow-[0_30px_80px_var(--shadow-color)]">
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 via-transparent to-foreground/[0.02] pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-center gap-8 p-8 sm:p-12">
              <div className="relative flex-shrink-0 flex items-center justify-center">
                <div className="relative h-28 w-28 sm:h-36 sm:w-36">
                  <div className="absolute inset-0 rounded-full border border-foreground/10 animate-[spin_20s_linear_infinite]" />
                  <div className="absolute inset-3 rounded-full border border-foreground/[0.07] animate-[spin_15s_linear_infinite_reverse]" />
                  <button
                    onClick={onStartDemo}
                    className="absolute inset-6 flex items-center justify-center rounded-full bg-foreground text-background shadow-[0_0_50px_var(--shadow-color)] transition-all duration-500 hover:scale-110 hover:shadow-[0_0_80px_var(--shadow-color)] active:scale-95"
                    aria-label="Запустить демо"
                  >
                    <svg className="h-7 w-7 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4.75a.75.75 0 0 0-1.5 0v14.5a.75.75 0 0 0 1.5 0V4.75Zm13.25 7-7.5-4.75v9.5l7.5-4.75Z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 text-center lg:text-left">
                <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.4em] text-foreground/40">
                  Live Preview
                </p>
                <h2 className="mb-4 text-2xl sm:text-3xl font-medium tracking-tight text-foreground">
                  Посмотрите, как это работает
                </h2>
                <p className="mb-6 text-sm sm:text-base text-foreground/50 leading-relaxed max-w-lg">
                  Запустите демо-режим и увидите полный AI-разбор: транскрипт,
                  темп речи, метрики уверенности и персональные рекомендации.
                </p>
                <button
                  onClick={onStartDemo}
                  className="group inline-flex items-center gap-2.5 rounded-2xl border border-card-border bg-surface px-6 py-3 text-sm font-medium text-foreground/80 transition-all duration-300 hover:border-foreground/30 hover:bg-surface-hover hover:text-foreground"
                >
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4.75a.75.75 0 0 0-1.5 0v14.5a.75.75 0 0 0 1.5 0V4.75Zm13.25 7-7.5-4.75v9.5l7.5-4.75Z" />
                  </svg>
                  Запустить демо
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-mono text-foreground/50">DEMO</span>
                </button>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
