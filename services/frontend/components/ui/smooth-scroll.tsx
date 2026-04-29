"use client";

import { useEffect } from "react";
import Lenis from "lenis";

const isTouchDevice = () => {
  if (typeof window === "undefined") return false;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  return (
    "ontouchstart" in window ||
    (nav?.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia?.("(pointer: coarse)").matches === true
  );
};

const prefersReducedMotion = () => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    if (isTouchDevice() || prefersReducedMotion()) {
      document.body.style.overflow = "auto";
      document.body.style.touchAction = "auto";
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
    });

    let rafId: number | null = null;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };

    const start = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(raf);
      }
    };
    const stop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("lenis:stop", lenis.stop.bind(lenis));
    window.addEventListener("lenis:start", lenis.start.bind(lenis));

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("lenis:stop", lenis.stop.bind(lenis));
      window.removeEventListener("lenis:start", lenis.start.bind(lenis));
      stop();
      lenis.destroy();
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  return null;
}
