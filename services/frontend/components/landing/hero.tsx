"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GetStartedButton } from "@/components/ui/get-started-button";
import { ArrowUpRight, Github } from "lucide-react";

export function Hero() {
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
              ИИ-анализ выступлений.
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
          className="pointer-events-auto relative mt-12 flex flex-col items-center gap-4 sm:flex-row"
        >
          <GetStartedButton onClick={scrollToUpload} />
          <Link
            href="https://github.com/desmitry/charisma-master"
            target="_blank"
            rel="noreferrer"
            className="group relative inline-flex h-12 items-center gap-3 overflow-hidden rounded-full border border-white/12 bg-white/6 px-5 text-sm font-medium text-white/92 shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Открыть GitHub-репозиторий Charisma Master"
          >
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_55%)] opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 transition-colors duration-300 group-hover:bg-white/14">
              <Github size={17} strokeWidth={2.1} />
            </span>
            <span className="relative">Наш GitHub</span>
            <ArrowUpRight
              size={16}
              strokeWidth={2.2}
              className="relative transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
