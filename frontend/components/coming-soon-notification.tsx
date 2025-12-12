"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  icon?: React.ReactNode;
};

export function ComingSoonNotification({ isOpen, onClose, title = "Coming soon...", message = "PDF отчет в разработке", icon }: Props) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const autoCloseRef = useRef<NodeJS.Timeout | null>(null);
  const showTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (isOpen) {
      setIsVisible(false);
      
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }
      
      showTimerRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 10);

      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
      }
      
      autoCloseRef.current = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          onClose();
        }, 500);
      }, 3000);

      return () => {
        if (autoCloseRef.current) {
          clearTimeout(autoCloseRef.current);
        }
        if (showTimerRef.current) {
          clearTimeout(showTimerRef.current);
        }
      };
    } else {
      setIsVisible(false);
      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
      }
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }
    }
  }, [isOpen, mounted, onClose]);

  if (!mounted || !isOpen) return null;

  return typeof document !== "undefined"
    ? createPortal(
        <div className="fixed top-0 left-0 right-0 z-[10000] flex justify-center pointer-events-none px-4 pt-4">
          <div
            className="pointer-events-auto flex items-center gap-3 rounded-lg border border-white/15 bg-black/90 backdrop-blur-xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              transform: isVisible 
                ? "translateY(0) scale(1)" 
                : "translateY(-120%) scale(0.95)",
              opacity: isVisible ? 1 : 0,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsVisible(false);
              setTimeout(() => {
                onClose();
              }, 500);
            }}
          >
            <div className="flex items-center justify-center bg-white/10 p-1.5 rounded">
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{title}</span>
              <span className="text-xs text-white/50">{message}</span>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
}

