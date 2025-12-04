"use client";

import { useEcoMode } from "@/lib/eco-mode-context";
import { useEffect, useState } from "react";

export function EcoModeToggle() {
  const { isEcoMode, toggleEcoMode } = useEcoMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:bg-black/80 hover:text-white"
        aria-label="Включить эко-режим"
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 transition-all duration-300 text-white/60"
          >
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
          </svg>
        </span>
        <span className="hidden sm:inline">
          Эко: Выкл
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleEcoMode}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-md transition-all duration-300 hover:border-white/40 hover:bg-black/80 hover:text-white"
      aria-label={isEcoMode ? "Выключить эко-режим" : "Включить эко-режим"}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 transition-all duration-300 ${
            isEcoMode ? "text-green-400" : "text-white/60"
          }`}
        >
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </svg>
        {isEcoMode && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
        )}
      </span>
      <span className="hidden sm:inline">
        {isEcoMode ? "Эко: Вкл" : "Эко: Выкл"}
      </span>
    </button>
  );
}

