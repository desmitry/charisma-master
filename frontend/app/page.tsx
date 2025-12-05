'use client'

import { Hero } from "@/components/hero";
import { Leva } from "leva";
import { useEffect, useRef, useState } from "react";

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function smoothScrollTo(target: number, duration: number = 1200) {
  const start = window.scrollY;
  const distance = target - start;
  let startTime: number | null = null;

  function animation(currentTime: number) {
    if (startTime === null) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    
    window.scrollTo(0, start + distance * eased);
    
    if (progress < 1) {
      requestAnimationFrame(animation);
    }
  }

  requestAnimationFrame(animation);
}

export default function Home() {
  const isScrolling = useRef(false);
  const currentSection = useRef(0);
  const sections = useRef<HTMLElement[]>([]);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const matcher = window.matchMedia("(pointer: coarse)");
    const updateDeviceState = (event?: MediaQueryListEvent) => {
      const matches = event ? event.matches : matcher.matches;
      setIsTouchDevice(matches);
    };

    updateDeviceState();
    matcher.addEventListener("change", updateDeviceState);

    return () => {
      matcher.removeEventListener("change", updateDeviceState);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflowY = isTouchDevice ? "auto" : "hidden";
    document.body.style.touchAction = isTouchDevice ? "pan-y" : "none";

    return () => {
      document.body.style.overflowY = "";
      document.body.style.touchAction = "";
    };
  }, [isTouchDevice]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isTouchDevice) return;

    sections.current = Array.from(
      document.querySelectorAll(".snap-section")
    );

    let scrollDelta = 0;
    let resetTimeout: NodeJS.Timeout;

    const goToSection = (direction: number) => {
      const nextSection = Math.max(
        0,
        Math.min(
          sections.current.length - 1,
          currentSection.current + direction
        )
      );

      if (nextSection === currentSection.current) return;

      isScrolling.current = true;
      currentSection.current = nextSection;

      const targetY = sections.current[nextSection].offsetTop;
      smoothScrollTo(targetY, 1100);

      setTimeout(() => {
        isScrolling.current = false;
      }, 1200);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (isScrolling.current) return;

      scrollDelta += e.deltaY;

      const threshold = 40;
      if (Math.abs(scrollDelta) >= threshold) {
        const direction = scrollDelta > 0 ? 1 : -1;
        scrollDelta = 0;
        goToSection(direction);
      } else {
        clearTimeout(resetTimeout);
        resetTimeout = setTimeout(() => {
          scrollDelta = 0;
        }, 140);
      }
    };

    const updateCurrentSection = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      
      sections.current.forEach((section, index) => {
        const sectionTop = section.offsetTop;
        if (scrollY >= sectionTop - windowHeight / 2) {
          currentSection.current = index;
        }
      });
    };

    updateCurrentSection();

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      clearTimeout(resetTimeout);
    };
  }, [isTouchDevice]);

  return (
    <>
      <Hero />

      <section className="snap-section relative z-10 w-full text-white lg:min-h-svh">
        <div className="flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:min-h-svh">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-center backdrop-blur-md sm:px-8 sm:py-12">
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
              Ну когда скинете мне тестовый результат, тогда тут и появится что-нибудь
              осмысленное — графики, замечания, вся вот эта красота.
            </p>
          </div>
        </div>
      </section>

      <section className="snap-section relative z-10 w-full text-white lg:min-h-svh">
        <div className="flex flex-col items-center justify-center px-4 py-16 sm:px-6 lg:min-h-svh">
          <div className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-black/35 px-6 py-12 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-8 sm:py-14">
            <p className="text-center text-[10px] font-mono uppercase tracking-[0.3em] text-white/60 sm:text-xs sm:tracking-[0.4em]">
              Загрузка материалов
            </p>
            <h2 className="mt-6 text-center text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
              Анализируй. Учись. Защищайся.
            </h2>
            <p className="mt-4 text-center text-sm text-white/70 sm:text-base">
              Перетащи или выбери видео которое ты хочешь проанализировать. Можешь попробовать вставить ссылку как альтернативный вариант.
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <label
                htmlFor="video-upload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/40 bg-white/5 px-6 py-10 text-center transition hover:border-white hover:bg-white/10"
              >
                <svg
                  className="mb-4 h-10 w-10 text-white/70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <p className="text-lg font-semibold text-white">
                  Перетащи файл сюда
                </p>
                <p className="mt-2 text-sm text-white/65">
                  Любые форматы. Длительностью до 05:00
                </p>
                <input id="video-upload" type="file" className="hidden" />
              </label>

              <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-8">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
                  Использовать ссылку
                </p>
                <input
                  type="text"
                  placeholder="https://youtu.be/..."
                  className="mt-3 w-full rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-white focus:outline-none"
                />
                <button className="mt-4 w-full rounded-2xl bg-white/20 py-3 text-sm font-semibold text-white transition hover:bg-white/35">
                  Анализируй
                </button>
                <p className="mt-3 text-xs text-white/50">
                  Прямая ссылка либо YouTube
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      <Leva hidden />
    </>
  );
}
