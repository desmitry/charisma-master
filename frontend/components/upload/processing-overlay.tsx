"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  progress: number;
  statusText?: string;
  onComplete?: () => void;
};

export function ProcessingOverlay({ progress, statusText }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const clamped = Math.min(1, Math.max(0, progress || 0));
  const percent = Math.max(0, Math.round(clamped * 100));

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (progress >= 1) {
      setIsExiting(true);
    }
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;

    interface Dot {
      angle: number;
      radius: number;
      baseRadius: number;
      size: number;
      opacity: number;
      speed: number;
      phase: number;
    }

    interface Ring {
      radius: number;
      rotation: number;
      speed: number;
      opacity: number;
      dashArray: number[];
    }

    const dots: Dot[] = [];
    const rings: Ring[] = [];

    const dotLayers = [
      { count: 8, radius: 85, speed: 0.4, size: 2 },
      { count: 12, radius: 110, speed: -0.3, size: 1.5 },
      { count: 16, radius: 140, speed: 0.2, size: 1 },
      { count: 24, radius: 165, speed: -0.15, size: 0.8 },
    ];

    dotLayers.forEach((layer) => {
      for (let i = 0; i < layer.count; i++) {
        dots.push({
          angle: (i / layer.count) * Math.PI * 2,
          radius: layer.radius,
          baseRadius: layer.radius,
          size: layer.size,
          opacity: 0.2 + Math.random() * 0.4,
          speed: layer.speed,
          phase: Math.random() * Math.PI * 2,
        });
      }
    });

    const ringConfigs = [
      { radius: 70, speed: 0.2, opacity: 0.15, dash: [2, 8] },
      { radius: 100, speed: -0.15, opacity: 0.1, dash: [1, 12] },
      { radius: 130, speed: 0.1, opacity: 0.08, dash: [3, 15] },
      { radius: 160, speed: -0.08, opacity: 0.05, dash: [1, 20] },
    ];

    ringConfigs.forEach((config) => {
      rings.push({
        radius: config.radius,
        rotation: 0,
        speed: config.speed,
        opacity: config.opacity,
        dashArray: config.dash,
      });
    });

    const floatingParticles: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];

    const spawnParticle = () => {
      if (floatingParticles.length > 30) return;
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 80;
      floatingParticles.push({
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3 - 0.2,
        life: 1,
        size: 0.5 + Math.random() * 1,
      });
    };

    let time = 0;

    const animate = () => {
      time += 0.016;

      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fillRect(0, 0, size, size);

      if (Math.random() > 0.92) spawnParticle();

      for (let i = floatingParticles.length - 1; i >= 0; i--) {
        const p = floatingParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.008;

        if (p.life <= 0) {
          floatingParticles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.3})`;
        ctx.fill();
      }

      ctx.save();
      ctx.translate(centerX, centerY);

      for (const ring of rings) {
        ring.rotation += ring.speed * 0.016;
        ctx.save();
        ctx.rotate(ring.rotation);

        ctx.beginPath();
        ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
        ctx.setLineDash(ring.dashArray);
        ctx.strokeStyle = `rgba(255, 255, 255, ${ring.opacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
      }

      const breathe = Math.sin(time * 1.2) * 5;
      const pulseRadius = 60 + breathe;

      const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, pulseRadius);
      coreGradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
      coreGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.03)");
      coreGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.beginPath();
      ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
      ctx.fillStyle = coreGradient;
      ctx.fill();

      for (const dot of dots) {
        dot.angle += dot.speed * 0.016;

        const wobble = Math.sin(time * 2 + dot.phase) * 3;
        const r = dot.baseRadius + wobble;

        const x = Math.cos(dot.angle) * r;
        const y = Math.sin(dot.angle) * r;

        const flicker = 0.7 + Math.sin(time * 3 + dot.phase) * 0.3;

        ctx.beginPath();
        ctx.arc(x, y, dot.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${dot.opacity * flicker})`;
        ctx.fill();
      }

      const waveDots = 32;
      for (let i = 0; i < waveDots; i++) {
        const angle = (i / waveDots) * Math.PI * 2;
        const wave = Math.sin(time * 2 + angle * 4) * 8;
        const r = 85 + wave;

        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;

        const alpha = 0.15 + Math.sin(time * 3 + i * 0.3) * 0.1;

        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }

      ctx.restore();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - clamped * circumference;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(24px)",
        opacity: isVisible && !isExiting ? 1 : 0,
        pointerEvents: isVisible && !isExiting ? "auto" : "none",
        transition: "opacity 0.5s ease-out",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48,
          transform: isVisible && !isExiting ? "scale(1)" : "scale(0.95)",
          opacity: isVisible && !isExiting ? 1 : 0,
          transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease-out",
        }}
      >
        <div style={{ position: "relative", width: 400, height: 400 }}>
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />

          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              transform: "rotate(-90deg)",
            }}
            viewBox="0 0 400 400"
          >
            <circle
              cx="200"
              cy="200"
              r="70"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1"
            />
            <circle
              cx="200"
              cy="200"
              r="70"
              fill="none"
              stroke="rgba(255, 255, 255, 0.8)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: "stroke-dashoffset 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                filter: "drop-shadow(0 0 8px rgba(255, 255, 255, 0.4))",
              }}
            />
          </svg>

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 56,
                fontWeight: 200,
                color: "rgba(255, 255, 255, 0.95)",
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
                textShadow: "0 0 20px rgba(255, 255, 255, 0.3)",
              }}
            >
              {percent}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.4)",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              percent
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  backgroundColor: "rgba(255, 255, 255, 0.6)",
                  boxShadow: "0 0 10px rgba(255,255,255,0.4)",
                  animation: `pulse-dot 1.4s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.6)",
              textAlign: "center",
              letterSpacing: "0.02em",
              maxWidth: 280,
            }}
          >
            {statusText || "Анализ видео..."}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.4);
          }
        }
      `}</style>
    </div>
  );
}
