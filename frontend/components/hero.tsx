"use client";

import { useCallback, useEffect, useState } from "react";

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

function seededRandom(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

interface LetterAnimProps {
  char: string;
  index: number;
  phase: "hidden" | "scattered" | "assembled";
  baseDelay: number;
  seed: number;
}

function AnimatedLetter({ char, index, phase, baseDelay, seed }: LetterAnimProps) {
  if (char === " ") {
    return <span>&nbsp;</span>;
  }

  const r1 = seededRandom(seed + index * 3);
  const r2 = seededRandom(seed + index * 3 + 1);
  const r3 = seededRandom(seed + index * 3 + 2);

  const x = Math.round((r1 - 0.5) * 160);
  const y = Math.round((r2 - 0.5) * 120 + 70);
  const rotation = Math.round((r3 - 0.5) * 140);

  const delay = baseDelay + index * 25;

  if (phase === "hidden") {
    return <span className="inline-block" style={{ opacity: 0 }}>{char}</span>;
  }

  if (phase === "scattered") {
    return (
      <span
        className="inline-block"
        style={{
          opacity: 0,
          transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
          filter: "blur(4px)",
        }}
      >
        {char}
      </span>
    );
  }

  return (
    <span
      className="inline-block"
      style={{
        opacity: 1,
        transform: "translate(0px, 0px) rotate(0deg)",
        filter: "blur(0px)",
        transition: `all 0.65s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
      }}
    >
      {char}
    </span>
  );
}

function AnimatedText({ 
  text, 
  phase,
  baseDelay,
  seed,
  className 
}: { 
  text: string; 
  phase: "hidden" | "scattered" | "assembled";
  baseDelay: number;
  seed: number;
  className?: string;
}) {
  return (
    <span className={className}>
      {text.split("").map((char, i) => (
        <AnimatedLetter
          key={i}
          char={char}
          index={i}
          phase={phase}
          baseDelay={baseDelay}
          seed={seed}
        />
      ))}
    </span>
  );
}

export function Hero() {
  const [phase, setPhase] = useState<"hidden" | "scattered" | "assembled">("hidden");
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [seed, setSeed] = useState(42);

  useEffect(() => {
    const newSeed = Math.floor(Math.random() * 10000);
    setSeed(newSeed);
    
    requestAnimationFrame(() => {
      setPhase("scattered");
      requestAnimationFrame(() => {
        setPhase("assembled");
      });
    });
    
    const t1 = setTimeout(() => setShowSubtitle(true), 600);
    const t2 = setTimeout(() => setShowButton(true), 800);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const scrollToUpload = useCallback(() => {
    const sections = document.querySelectorAll(".snap-section");
    if (sections.length >= 3) {
      const targetSection = sections[2] as HTMLElement;
      smoothScrollTo(targetSection.offsetTop, 1100);
    }
  }, []);

  return (
    <section className="snap-section relative flex min-h-svh w-full items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white sm:px-6">
        
        <h1 
          className="text-[2rem] font-bold sm:text-4xl md:text-5xl lg:text-6xl"
          style={{ lineHeight: 1.1 }}
        >
          <AnimatedText 
            text="Улучшай свою речь" 
            phase={phase}
            baseDelay={0}
            seed={seed}
          />
          <br />
          <AnimatedText 
            text="с нашей помощью" 
            phase={phase}
            baseDelay={180}
            seed={seed + 100}
            className="font-light italic"
          />
        </h1>
        
        <p 
          className="mt-4 max-w-xl font-mono text-xs text-foreground/60 sm:mt-5 sm:text-sm overflow-hidden"
          style={{
            opacity: showSubtitle ? 1 : 0,
            transform: showSubtitle ? "translateY(0)" : "translateY(15px)",
            transition: "all 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          Лучший AI-анализ на слова-паразиты и недочеты речи.
        </p>

        <div
          style={{
            opacity: showButton ? 1 : 0,
            transform: showButton ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
            transition: "all 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <button
            onClick={scrollToUpload}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="pointer-events-auto group relative mt-6 sm:mt-8 overflow-hidden rounded-full transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] cta-btn-glow"
          >
            <div
              className="absolute inset-0 rounded-full transition-all duration-500"
              style={{
                backgroundImage: "url('/icons/button_texture.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: isHovered ? 1 : 0.9,
              }}
            />
            
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.08) 75%, rgba(0,0,0,0.18) 100%)",
              }}
            />

            <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="absolute inset-x-6 top-[1px] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-black/40 to-transparent" />
            <div className="absolute inset-y-2 left-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
            <div className="absolute inset-y-2 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

            <div className="cta-btn-shimmer rounded-full" />

            <div 
              className="relative px-8 py-3.5 sm:px-10 sm:py-4 flex items-center gap-3"
              style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.6)" }}
            >
              <span className="text-sm sm:text-base font-semibold text-white tracking-wide transition-all duration-300 group-hover:text-white">
                Попробуй уже сейчас
              </span>
              
              <svg 
                className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 transition-all duration-300 group-hover:rotate-90 group-hover:text-white"
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>

            <div className="absolute -inset-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
              <div 
                className="absolute inset-0 rounded-full"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)",
                  padding: "1px",
                  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                }}
              />
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
