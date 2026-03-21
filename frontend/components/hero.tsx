"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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

function AnimatedText({ 
  text, 
  delay = 0,
  className = ""
}: { 
  text: string; 
  delay?: number;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <span 
      className={cn(
        "inline-block transition-all duration-1000 ease-out",
        mounted ? "opacity-100 translate-y-0 blur-none" : "opacity-0 translate-y-8 blur-sm",
        className
      )}
    >
      {text}
    </span>
  );
}

export function Hero() {
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowSubtitle(true), 800);
    const t2 = setTimeout(() => setShowButton(true), 1100);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const scrollToUpload = useCallback(() => {
    const sections = document.querySelectorAll(".snap-section");
    if (sections.length >= 2) {
      // Find the upload section which is typically the second snap-section
      const targetSection = sections[1] as HTMLElement;
      smoothScrollTo(targetSection.offsetTop, 1100);
    } else {
      // Fallback
      window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
    }
  }, []);

  return (
    <section className="snap-section relative flex min-h-svh w-full items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center sm:px-6">
        
        {/* Glow behind text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white/5 blur-[120px] rounded-[100%] pointer-events-none" />

        <h1 
          className="relative text-[2.5rem] font-medium tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ lineHeight: 1.15 }}
        >
          <AnimatedText 
            text="Идеальная речь." 
            delay={100}
            className="block mb-2"
          />
          <AnimatedText 
            text="AI-Анализ выступлений." 
            delay={300}
            className="block bg-gradient-to-r from-white via-white/80 to-white/40 bg-clip-text text-transparent"
          />
        </h1>
        
        <p 
          className="relative mt-6 max-w-2xl font-light text-base text-white/60 sm:mt-8 sm:text-lg overflow-hidden"
          style={{
            opacity: showSubtitle ? 1 : 0,
            transform: showSubtitle ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          Превратите страх публичных выступлений в свою главную силу. <br className="hidden sm:block" />
          Загрузите видео и получите детальный разбор от нейросети.
        </p>

        <div
          className="relative mt-10 sm:mt-12"
          style={{
            opacity: showButton ? 1 : 0,
            transform: showButton ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
            transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <button
            onClick={scrollToUpload}
            className="pointer-events-auto group relative flex items-center gap-3 rounded-full bg-white/10 px-8 py-4 backdrop-blur-xl border border-white/20 transition-all duration-500 hover:bg-white/20 hover:scale-105 hover:border-white/40 active:scale-95 overflow-hidden shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)]"
          >
            {/* Inner glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
            
            <span className="relative text-sm font-semibold tracking-wide text-white sm:text-base">
              Начать анализ бесплатно
            </span>
            
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform duration-500 group-hover:rotate-90">
              <svg 
                className="h-4 w-4" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </button>
        </div>
      </div>
      
      {/* Subtle bottom gradient to blend with the next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
    </section>
  );
}

