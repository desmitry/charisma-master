"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface VideoErrorDetails {
  code?: number;
  message?: string;
  src?: string;
  networkState?: number;
  readyState?: number;
  currentSrc?: string;
  timestamp?: string;
  userAgent?: string;
}

interface VideoErrorDisplayProps {
  error: string;
  details?: VideoErrorDetails;
  className?: string;
}

export function VideoErrorDisplay({ error, details, className }: VideoErrorDisplayProps) {
  const [showRawLog, setShowRawLog] = useState(false);

  const getErrorMessage = (error: string): { title: string; description: string } => {
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes("network") || lowerError.includes("fetch") || lowerError.includes("failed to fetch")) {
      return {
        title: "Ошибка загрузки",
        description: "Не удалось загрузить видео. Проверьте подключение к интернету и попробуйте обновить страницу."
      };
    }
    
    if (lowerError.includes("404") || lowerError.includes("not found")) {
      return {
        title: "Видео не найдено",
        description: "Файл видео не найден на сервере. Возможно, он был удален или перемещен."
      };
    }
    
    if (lowerError.includes("403") || lowerError.includes("forbidden")) {
      return {
        title: "Доступ запрещен",
        description: "У вас нет доступа к этому видео. Проверьте права доступа."
      };
    }
    
    if (lowerError.includes("format") || lowerError.includes("codec") || lowerError.includes("unsupported")) {
      return {
        title: "Неподдерживаемый формат",
        description: "Браузер не может воспроизвести этот формат видео. Попробуйте использовать другой браузер."
      };
    }
    
    if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
      return {
        title: "Превышено время ожидания",
        description: "Загрузка видео заняла слишком много времени. Проверьте скорость интернета и попробуйте снова."
      };
    }
    
    if (lowerError.includes("cors") || lowerError.includes("cross-origin")) {
      return {
        title: "Ошибка CORS",
        description: "Проблема с политикой безопасности браузера. Обратитесь к администратору."
      };
    }
    
    return {
      title: "Ошибка воспроизведения",
      description: error || "Не удалось загрузить или воспроизвести видео. Попробуйте обновить страницу."
    };
  };

  const getNetworkStateLabel = (state?: number): string => {
    if (state === undefined) return "N/A";
    switch (state) {
      case 0: return "NETWORK_EMPTY";
      case 1: return "NETWORK_IDLE";
      case 2: return "NETWORK_LOADING";
      case 3: return "NETWORK_NO_SOURCE";
      default: return `UNKNOWN (${state})`;
    }
  };

  const getReadyStateLabel = (state?: number): string => {
    if (state === undefined) return "N/A";
    switch (state) {
      case 0: return "HAVE_NOTHING";
      case 1: return "HAVE_METADATA";
      case 2: return "HAVE_CURRENT_DATA";
      case 3: return "HAVE_FUTURE_DATA";
      case 4: return "HAVE_ENOUGH_DATA";
      default: return `UNKNOWN (${state})`;
    }
  };

  const getMediaErrorLabel = (code?: number): string => {
    if (code === undefined) return "N/A";
    switch (code) {
      case 1: return "MEDIA_ERR_ABORTED";
      case 2: return "MEDIA_ERR_NETWORK";
      case 3: return "MEDIA_ERR_DECODE";
      case 4: return "MEDIA_ERR_SRC_NOT_SUPPORTED";
      default: return `UNKNOWN_ERROR (${code})`;
    }
  };

  const { title, description } = getErrorMessage(error);

  const rawLogData = {
    error: {
      code: details?.code,
      codeLabel: getMediaErrorLabel(details?.code),
      message: details?.message || error,
    },
    video: {
      src: details?.src || "N/A",
      currentSrc: details?.currentSrc || "N/A",
      networkState: details?.networkState,
      networkStateLabel: getNetworkStateLabel(details?.networkState),
      readyState: details?.readyState,
      readyStateLabel: getReadyStateLabel(details?.readyState),
    },
    meta: {
      timestamp: details?.timestamp || new Date().toISOString(),
      userAgent: details?.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "N/A"),
    },
  };

  return (
    <div
      className={cn(
        "flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center overflow-hidden",
        className
      )}
    >
      {!showRawLog ? (
        <>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-red-400"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
          <p className="max-w-md text-sm text-white/70 leading-relaxed mb-4">{description}</p>
          <button
            onClick={() => setShowRawLog(true)}
            className="text-xs text-red-400/70 hover:text-red-400 underline underline-offset-2 transition-colors flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10,9 9,9 8,9" />
            </svg>
            Показать детали ошибки
          </button>
        </>
      ) : (
        <div className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-red-400 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4,17 10,11 4,5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              RAW ERROR LOG
            </span>
            <button
              onClick={() => setShowRawLog(false)}
              className="text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              ✕ Закрыть
            </button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg bg-black/50 border border-red-500/10 p-3 text-left">
            <pre className="text-[10px] leading-relaxed font-mono text-red-300/90 whitespace-pre-wrap break-all">
{`╔══════════════════════════════════════════════════════════════╗
║  VIDEO PLAYER ERROR - DIAGNOSTIC LOG                         ║
╚══════════════════════════════════════════════════════════════╝

▸ ERROR DETAILS
  ├─ code:      ${rawLogData.error.code ?? "undefined"}
  ├─ type:      ${rawLogData.error.codeLabel}
  └─ message:   ${rawLogData.error.message}

▸ VIDEO ELEMENT STATE
  ├─ src:           ${rawLogData.video.src}
  ├─ currentSrc:    ${rawLogData.video.currentSrc}
  ├─ networkState:  ${rawLogData.video.networkState} (${rawLogData.video.networkStateLabel})
  └─ readyState:    ${rawLogData.video.readyState} (${rawLogData.video.readyStateLabel})

▸ METADATA
  ├─ timestamp:  ${rawLogData.meta.timestamp}
  └─ userAgent:  ${rawLogData.meta.userAgent}

──────────────────────────────────────────────────────────────────
RAW JSON:
${JSON.stringify(rawLogData, null, 2)}`}
            </pre>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(rawLogData, null, 2));
            }}
            className="mt-2 self-end text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Копировать JSON
          </button>
        </div>
      )}
    </div>
  );
}

