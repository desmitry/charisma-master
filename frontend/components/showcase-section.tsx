"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ScrollReveal } from "./scroll-reveal";

const FloatingScene = dynamic(
  () => import("./floating-scene").then((m) => ({ default: m.FloatingScene })),
  { ssr: false }
);

interface ShowcaseSectionProps {
  onStartDemo: () => void;
}

export function ShowcaseSection({ onStartDemo }: ShowcaseSectionProps) {
  return (
    <section className="relative z-10 w-full py-24 sm:py-32">
      {/* 3D Scene background */}
      <div className="absolute inset-0 -z-10 opacity-60">
        <FloatingScene />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text content */}
          <div>
            <ScrollReveal direction="left" distance={50}>
              <p className="text-[11px] font-mono uppercase tracking-[0.4em] text-white/40 mb-3">
                Проверьте сами
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white leading-tight">
                Попробуйте
                <br />
                <span className="bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent">
                  прямо сейчас
                </span>
              </h2>
            </ScrollReveal>

            <ScrollReveal direction="left" delay={0.15} distance={40}>
              <p className="mt-5 text-base sm:text-lg text-white/50 max-w-lg leading-relaxed">
                Посмотрите как работает AI-анализ на демо-видео или загрузите своё
                выступление для персонального разбора.
              </p>
            </ScrollReveal>

            <ScrollReveal direction="left" delay={0.3} distance={30}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  onClick={onStartDemo}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-white px-8 py-4 text-black font-semibold shadow-[0_0_50px_-10px_rgba(255,255,255,0.4)] transition-all duration-500 hover:scale-105 hover:shadow-[0_0_70px_-10px_rgba(255,255,255,0.6)] active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  <svg
                    className="relative h-5 w-5 transition-transform duration-300 group-hover:scale-110"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                  <span className="relative">Смотреть демо</span>
                  <span className="relative rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    demo
                  </span>
                </button>

                <a
                  href="#upload"
                  className="group flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-medium text-white/80 backdrop-blur-md transition-all duration-500 hover:border-white/30 hover:bg-white/10 hover:text-white"
                >
                  Загрузить видео
                  <svg
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </a>
              </div>
            </ScrollReveal>
          </div>

          {/* Right: Dashboard preview */}
          <ScrollReveal direction="right" delay={0.2} distance={60} scale={0.95}>
            <div className="group/preview relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/40 p-2 shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-3xl transition-all duration-700 hover:border-white/20 hover:shadow-[0_40px_100px_rgba(255,255,255,0.05)]">
              <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />
              <div className="rounded-[2rem] border border-white/5 bg-black/60 p-5 backdrop-blur-2xl">
                <div className="flex items-center gap-2 border-b border-white/5 pb-4 px-2">
                  <div className="h-3 w-3 rounded-full bg-white/20" />
                  <div className="h-3 w-3 rounded-full bg-white/20" />
                  <div className="h-3 w-3 rounded-full bg-white/20" />
                  <span className="ml-3 text-[11px] font-mono tracking-widest text-white/40 uppercase">
                    charisma dashboard
                  </span>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="h-2 w-16 rounded bg-white/10" />
                    <div className="mt-3 h-16 rounded-xl bg-white/[0.03]" />
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="h-2 w-20 rounded bg-white/10" />
                    <div className="mt-3 flex items-end gap-1 h-16 px-2">
                      <div className="h-6 w-full rounded-t-sm bg-white/10" />
                      <div className="h-10 w-full rounded-t-sm bg-white/20" />
                      <div className="h-4 w-full rounded-t-sm bg-white/10" />
                      <div className="h-12 w-full rounded-t-sm bg-white/30" />
                      <div className="h-8 w-full rounded-t-sm bg-white/10" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="h-2 w-14 rounded bg-white/10" />
                    <div className="mt-3 flex items-center gap-4">
                      <div className="relative h-14 w-14 flex-shrink-0">
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeDasharray="78" strokeDashoffset="26" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="h-1.5 w-full rounded-full bg-white/10">
                          <div className="h-full w-[80%] rounded-full bg-white/30" />
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/10">
                          <div className="h-full w-[60%] rounded-full bg-white/20" />
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/10">
                          <div className="h-full w-[90%] rounded-full bg-white/40" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
