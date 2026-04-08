"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Transition } from "@headlessui/react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  icon?: React.ReactNode;
};

export function ComingSoonNotification({ isOpen, onClose, title = "Coming soon...", message = "PDF отчет в разработке", icon }: Props) {
  const [mounted, setMounted] = useState(false);
  const autoCloseRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
      autoCloseRef.current = setTimeout(() => {
        onClose();
      }, 3000);
    } else {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    }
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return typeof document !== "undefined"
    ? createPortal(
        <div className="fixed top-0 left-0 right-0 z-[10000] flex justify-center pointer-events-none px-4 pt-4">
          <Transition show={isOpen}>
            <div
              className="pointer-events-auto flex items-center gap-3 rounded-lg border border-white/15 bg-black/90 backdrop-blur-xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] max-w-md w-full data-[closed]:opacity-0 data-[closed]:scale-95 data-[closed]:-translate-y-[120%]"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <div className="flex items-center justify-center bg-white/10 p-1.5 rounded flex-shrink-0">
                {icon || (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white/90"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-sm font-medium text-white">{title}</span>
                <span className="text-xs text-white/50 break-words leading-relaxed">{message}</span>
              </div>
            </div>
          </Transition>
        </div>,
        document.body
      )
    : null;
}

