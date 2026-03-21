"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MagneticButton } from "./magnetic-button";

export function Hero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollToUpload = () => {
    const el = document.getElementById("upload-hub");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
    }
  };

  return (
    <section className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-hidden pt-20">
      <div className="pointer-events-none relative z-10 flex flex-col items-center justify-center px-4 text-center sm:px-6">

        <h1
          className="relative text-[3rem] font-medium tracking-tighter text-white sm:text-6xl md:text-7xl lg:text-8xl"
          style={{ lineHeight: 1.1 }}
        >
          <motion.span
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.2 }}
            className="block"
          >
            Идеальная речь.
          </motion.span>
          <motion.span
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.4 }}
            className="block h-auto"
          >
            <span className="bg-gradient-to-br from-white via-white/90 to-white/30 bg-clip-text text-transparent drop-shadow-sm">
              AI-Анализ выступлений.
            </span>
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="relative mt-8 font-light text-white/50 sm:text-xl max-w-2xl leading-relaxed"
        >
          Превратите страх публичных выступлений в свою главную силу.{" "}
          <br className="hidden sm:block" />
          Загрузите видео и получите детальный разбор от нейросети.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="pointer-events-auto relative mt-12"
        >
          <MagneticButton
            onClick={scrollToUpload}
            intensity={0.2}
            className="group overflow-hidden rounded-full bg-white px-8 py-4 text-black font-medium transition-transform duration-300 hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_80px_rgba(255,255,255,0.3)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,0,0,0.1),transparent_50%)] pointer-events-none" />
            <span className="relative flex items-center justify-center gap-2 text-[15px]">
              Начать анализ бесплатно
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </span>
          </MagneticButton>
        </motion.div>
      </div>
    </section>
  );
}
