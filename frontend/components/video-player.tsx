"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { VideoErrorDisplay } from "./video-error-display";

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
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  function VideoPlayer({ src, error, errorDetails, onTimeUpdate, onError, className }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [internalError, setInternalError] = useState<string | null>(null);
    const [internalErrorDetails, setInternalErrorDetails] = useState<VideoErrorDetails | undefined>(undefined);

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
      getCurrentTime: () => {
        return videoRef.current?.currentTime ?? 0;
      },
    }));

    const handleTimeUpdate = () => {
      if (videoRef.current && onTimeUpdate) {
        onTimeUpdate(videoRef.current.currentTime);
      }
    };

    const handleError = () => {
      const video = videoRef.current;
      const err = video?.error;
      
      const details: VideoErrorDetails = {
        code: err?.code,
        message: err?.message || undefined,
        src: src,
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

      // Set internal state for self-contained error display
      setInternalError(errorMessage);
      setInternalErrorDetails(details);

      // Also call the external handler if provided
      if (onError) {
        onError(errorMessage, details);
      }
    };

    // Display error from props or internal state
    const displayError = error || internalError;
    const displayDetails = errorDetails || internalErrorDetails;

    if (displayError) {
      return <VideoErrorDisplay error={displayError} details={displayDetails} className={className} />;
    }

    if (!src) {
      const noSrcDetails: VideoErrorDetails = {
        message: "Source URL is empty or undefined",
        src: src || "undefined",
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      };
      return (
        <VideoErrorDisplay 
          error="Видео недоступно. Путь к видео не указан." 
          details={noSrcDetails}
          className={className} 
        />
      );
    }

    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        className={className}
        onTimeUpdate={handleTimeUpdate}
        onError={handleError}
      />
    );
  }
);

