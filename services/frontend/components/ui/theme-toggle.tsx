"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-[52px] h-[28px] rounded-full bg-white/10" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      className="theme-toggle group relative flex items-center justify-center"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Track */}
      <span
        className="relative flex h-[28px] w-[52px] items-center rounded-full border transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          background: isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.06)",
          borderColor: isDark
            ? "rgba(255,255,255,0.12)"
            : "rgba(0,0,0,0.10)",
          boxShadow: isDark
            ? "inset 0 1px 3px rgba(0,0,0,0.4)"
            : "inset 0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        {/* Sun rays (light mode icon, left side) */}
        <span
          className="absolute left-[5px] flex items-center justify-center transition-all duration-500"
          style={{
            opacity: isDark ? 0.3 : 0,
            transform: isDark ? "scale(0.7) rotate(-30deg)" : "scale(1) rotate(0deg)",
          }}
        >
          <SunIcon size={13} color={isDark ? "rgba(255,255,255,0.5)" : "#f59e0b"} />
        </span>

        {/* Moon icon (dark mode icon, right side) */}
        <span
          className="absolute right-[5px] flex items-center justify-center transition-all duration-500"
          style={{
            opacity: isDark ? 0 : 0.35,
            transform: isDark ? "scale(1) rotate(0deg)" : "scale(0.7) rotate(30deg)",
          }}
        >
          <MoonIcon size={12} color="rgba(0,0,0,0.5)" />
        </span>

        {/* Thumb */}
        <span
          className="absolute flex h-[20px] w-[20px] items-center justify-center rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{
            left: isDark ? "calc(100% - 24px)" : "4px",
            background: isDark
              ? "linear-gradient(135deg, #e2e8f0 0%, #ffffff 100%)"
              : "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            boxShadow: isDark
              ? "0 1px 4px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)"
              : "0 1px 4px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)",
          }}
        >
          {/* Icon inside thumb */}
          <span
            className="transition-all duration-500"
            style={{
              opacity: 1,
              transform: isDark ? "rotate(0deg)" : "rotate(-20deg)",
            }}
          >
            {isDark ? (
              <MoonIcon size={10} color="#1a1a2e" />
            ) : (
              <SunIcon size={11} color="#f8d56b" />
            )}
          </span>
        </span>
      </span>
    </button>
  );
}

function SunIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" fill={color} />
      <line x1="12" y1="2" x2="12" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="12" x2="5" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="19" y1="12" x2="22" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="19.78" y1="4.22" x2="17.66" y2="6.34" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="6.34" y1="17.66" x2="4.22" y2="19.78" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        fill={color}
      />
    </svg>
  );
}
