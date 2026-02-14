"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { cn } from "@/lib/utils";

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
}

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

interface VideoPlayerProps {
  src: string;
  error?: string | null;
  errorDetails?: VideoErrorDetails;
  onTimeUpdate?: (time: number) => void;
  onError?: (message: string, details?: VideoErrorDetails) => void;
  className?: string;
  compact?: boolean;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const PlayIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M8 5.14v14l11-7-11-7z" />
  </svg>
);

const PauseIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
  </svg>
);

const VolumeIcon = ({
  className,
  muted,
  level,
}: {
  className?: string;
  muted?: boolean;
  level?: number;
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    {muted || level === 0 ? (
      <line x1="23" y1="9" x2="17" y2="15" />
    ) : (
      <>
        {(level ?? 1) > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
        {(level ?? 1) > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
      </>
    )}
  </svg>
);

const ReplayIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M1 4v6h6" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  function VideoPlayer(
    {
      src,
      error: externalError,
      errorDetails: externalErrorDetails,
      onTimeUpdate,
      onError,
      className,
      compact = false,
    },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [internalError, setInternalError] = useState<string | null>(null);
    const [internalErrorDetails, setInternalErrorDetails] = useState<VideoErrorDetails | undefined>();
    const [showControls, setShowControls] = useState(true);
    const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

    const displayError = externalError || internalError;
    const displayErrorDetails = externalErrorDetails || internalErrorDetails;

    useImperativeHandle(ref, () => ({
      play: () => {
        videoRef.current?.play().catch(() => {});
      },
      pause: () => {
        videoRef.current?.pause();
      },
      seek: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    }));

    const scheduleHideControls = useCallback(() => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
      if (isPlaying && !isDragging) {
        hideControlsTimeout.current = setTimeout(() => {
          setShowControls(false);
        }, 2500);
      }
    }, [isPlaying, isDragging]);

    const showControlsTemporarily = useCallback(() => {
      setShowControls(true);
      scheduleHideControls();
    }, [scheduleHideControls]);

    useEffect(() => {
      if (isPlaying) {
        scheduleHideControls();
      } else {
        setShowControls(true);
      }
      return () => {
        if (hideControlsTimeout.current) {
          clearTimeout(hideControlsTimeout.current);
        }
      };
    }, [isPlaying, scheduleHideControls]);

    const handlePlayPause = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }, []);

    const handleTimeUpdate = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      setCurrentTime(video.currentTime);

      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }

      onTimeUpdate?.(video.currentTime);
    }, [onTimeUpdate]);

    const handleLoadedMetadata = useCallback(() => {
      const video = videoRef.current;
      if (video) {
        setDuration(video.duration);
        setVolume(video.volume);
        setIsMuted(video.muted);
      }
    }, []);

    const handlePlay = useCallback(() => setIsPlaying(true), []);
    const handlePause = useCallback(() => setIsPlaying(false), []);

    const handleSeek = useCallback(
      (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        const video = videoRef.current;
        const progress = progressRef.current;
        if (!video || !progress) return;

        const rect = progress.getBoundingClientRect();
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newTime = pos * duration;

        video.currentTime = newTime;
        setCurrentTime(newTime);
      },
      [duration]
    );

    const handleProgressMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        setIsDragging(true);
        handleSeek(e);
      },
      [handleSeek]
    );

    const handleProgressTouchStart = useCallback(
      (e: React.TouchEvent<HTMLDivElement>) => {
        setIsDragging(true);
        handleSeek(e);
      },
      [handleSeek]
    );

    useEffect(() => {
      if (!isDragging) return;

      const handleMouseMove = (e: MouseEvent) => {
        const video = videoRef.current;
        const progress = progressRef.current;
        if (!video || !progress) return;

        const rect = progress.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newTime = pos * duration;

        video.currentTime = newTime;
        setCurrentTime(newTime);
      };

      const handleMouseUp = () => setIsDragging(false);
      const handleTouchMove = (e: TouchEvent) => {
        const video = videoRef.current;
        const progress = progressRef.current;
        if (!video || !progress || !e.touches[0]) return;

        const rect = progress.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
        const newTime = pos * duration;

        video.currentTime = newTime;
        setCurrentTime(newTime);
      };
      const handleTouchEnd = () => setIsDragging(false);

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("touchmove", handleTouchMove);
        window.removeEventListener("touchend", handleTouchEnd);
      };
    }, [isDragging, duration]);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;

      const newVolume = parseFloat(e.target.value);
      video.volume = newVolume;
      video.muted = newVolume === 0;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }, []);

    const toggleMute = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      video.muted = !video.muted;
      setIsMuted(video.muted);
    }, []);

    const handleError = useCallback(() => {
      const video = videoRef.current;
      const err = video?.error;

      const details: VideoErrorDetails = {
        code: err?.code,
        message: err?.message || undefined,
        src,
        networkState: video?.networkState,
        readyState: video?.readyState,
        currentSrc: video?.currentSrc || undefined,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      };

      let errorMessage: string;

      if (!err) {
        errorMessage = "Неизвестная ошибка воспроизведения";
      } else {
        switch (err.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = "Загрузка видео была прервана";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = "Ошибка сети при загрузке видео";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = "Ошибка декодирования видео";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "Формат видео не поддерживается";
            break;
          default:
            errorMessage = `Ошибка воспроизведения (код: ${err.code})`;
        }
      }

      setInternalError(errorMessage);
      setInternalErrorDetails(details);
      onError?.(errorMessage, details);
    }, [src, onError]);

    const handleEnded = useCallback(() => {
      setIsPlaying(false);
      setShowControls(true);
    }, []);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

    if (displayError) {
      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center",
            compact ? "min-h-[180px]" : "min-h-[240px]",
            className
          )}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <svg
              width="24"
              height="24"
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
          <h3 className="mb-1 text-sm font-medium text-white">Ошибка воспроизведения</h3>
          <p className="max-w-xs text-xs text-white/60">{displayError}</p>
        </div>
      );
    }

    if (!src) {
      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-6 text-center",
            compact ? "min-h-[180px]" : "min-h-[240px]",
            className
          )}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mb-3 text-white/30"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M10 9l5 3-5 3V9z" />
          </svg>
          <p className="text-sm text-white/40">Видео недоступно</p>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={cn(
          "group relative rounded-xl overflow-hidden border border-white/10 bg-black shadow-lg",
          compact ? "max-w-sm" : "max-w-md",
          className
        )}
        onMouseEnter={() => {
          setIsHovering(true);
          showControlsTemporarily();
        }}
        onMouseLeave={() => {
          setIsHovering(false);
          if (isPlaying) scheduleHideControls();
        }}
        onMouseMove={showControlsTemporarily}
      >
        {/* Video element */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={src}
          playsInline
          className="w-full aspect-video bg-black cursor-pointer"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleError}
          onEnded={handleEnded}
          onClick={handlePlayPause}
        />

        {/* Big play button overlay (when paused) */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300",
            isPlaying ? "opacity-0" : "opacity-100"
          )}
        >
          <button
            onClick={handlePlayPause}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-black shadow-lg pointer-events-auto",
              "transition-transform duration-200 hover:scale-105 active:scale-95"
            )}
            aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
          >
            {isPlaying ? (
              <PauseIcon className="h-6 w-6" />
            ) : (
              <PlayIcon className="h-6 w-6 ml-1" />
            )}
          </button>
        </div>

        {/* Controls overlay */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent",
            "transition-opacity duration-300",
            showControls || isDragging ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="relative h-1 mx-3 mt-2 cursor-pointer group/progress"
            onMouseDown={handleProgressMouseDown}
            onTouchStart={handleProgressTouchStart}
          >
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 bg-white/20 rounded-full"
              style={{ width: `${bufferedProgress}%` }}
            />

            {/* Progress */}
            <div
              className="absolute inset-y-0 left-0 bg-white group-hover/progress:bg-primary rounded-full transition-colors"
              style={{ width: `${progress}%` }}
            />

            {/* Thumb */}
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg",
                "opacity-0 group-hover/progress:opacity-100 transition-opacity",
                "transform -translate-x-1/2"
              )}
              style={{ left: `${progress}%` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
            >
              {isPlaying ? (
                <PauseIcon className="h-4 w-4 text-white" />
              ) : (
                <PlayIcon className="h-4 w-4 text-white ml-0.5" />
              )}
            </button>

            {/* Time */}
            <span className="text-xs text-white/80 font-medium tabular-nums min-w-[70px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Volume */}
            <div className="hidden sm:flex items-center gap-1.5 group/volume">
              <button
                onClick={toggleMute}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                aria-label={isMuted ? "Включить звук" : "Выключить звук"}
              >
                <VolumeIcon
                  className="h-4 w-4 text-white/80"
                  muted={isMuted}
                  level={volume}
                />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-16 transition-all duration-200 h-1 appearance-none bg-white/20 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            {/* Replay button (when ended) */}
            {!isPlaying && currentTime > 0 && currentTime >= duration && (
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                aria-label="Повторить"
              >
                <ReplayIcon className="h-4 w-4 text-white/80" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
);
