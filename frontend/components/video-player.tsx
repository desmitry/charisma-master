"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { VideoErrorDisplay } from "./video-error-display";

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  src: string;
  error?: string | null;
  onTimeUpdate?: (time: number) => void;
  onError?: (message: string) => void;
  className?: string;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  function VideoPlayer({ src, error, onTimeUpdate, onError, className }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);

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
      if (!onError) return;
      const video = videoRef.current;
      const err = video?.error;
      
      if (!err) {
        onError("Неизвестная ошибка воспроизведения");
        return;
      }

      switch (err.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          onError("Загрузка видео была прервана");
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          onError("Ошибка сети при загрузке видео");
          break;
        case MediaError.MEDIA_ERR_DECODE:
          onError("Ошибка декодирования видео");
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          onError("Формат видео не поддерживается");
          break;
        default:
          onError(`Ошибка воспроизведения (код: ${err.code})`);
      }
    };

    if (error) {
      return <VideoErrorDisplay error={error} className={className} />;
    }

    if (!src) {
      return (
        <VideoErrorDisplay 
          error="Видео недоступно. Путь к видео не указан." 
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

