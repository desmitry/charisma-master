"use client";


import { motion } from "framer-motion";
import { GetStartedButton } from "@/components/ui/get-started-button";

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
          className="pointer-events-auto relative mt-12"
        >
          <GetStartedButton onClick={scrollToUpload} />
        </motion.div>
      </div>
    </section>
  );
}
