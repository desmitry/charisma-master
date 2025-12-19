"use client";

import { cn } from "@/lib/utils";

interface VideoErrorDisplayProps {
  error: string;
  className?: string;
}

export function VideoErrorDisplay({ error, className }: VideoErrorDisplayProps) {
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

  const { title, description } = getErrorMessage(error);

  return (
    <div
      className={cn(
        "flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center",
        className
      )}
    >
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
      <p className="max-w-md text-sm text-white/70 leading-relaxed">{description}</p>
    </div>
  );
}

