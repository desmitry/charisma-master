"use client";

import { RefObject, useEffect, useState } from "react";

export function useInViewport<T extends Element>(
  ref: RefObject<T | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0, rootMargin: "200px", ...options },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, options?.threshold, options?.rootMargin, options?.root]);

  return inView;
}

export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function useModalOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const check = () => setOpen(document.body.hasAttribute("data-modal-open"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-modal-open"] });
    return () => observer.disconnect();
  }, []);

  return open;
}

export function useShouldAnimate<T extends Element>(
  ref: RefObject<T | null>,
  options?: IntersectionObserverInit,
): boolean {
  const inView = useInViewport(ref, options);
  const documentVisible = useDocumentVisible();
  const prefersReduced = usePrefersReducedMotion();
  const modalOpen = useModalOpen();
  return inView && documentVisible && !prefersReduced && !modalOpen;
}
