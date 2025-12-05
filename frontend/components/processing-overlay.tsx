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
  const percent = Math.max(5, Math.round(clamped * 100));

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Trigger exit animation when complete
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

    const size = 300;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const sphereRadius = 70;

    // Sphere particles
    const spherePoints: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < 1000; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      spherePoints.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi),
      });
    }

    // Spiral lines
    const spirals: { x: number; y: number; z: number }[][] = [];
    for (let s = 0; s < 5; s++) {
      const spiral: { x: number; y: number; z: number }[] = [];
      const phaseOffset = (s / 5) * Math.PI * 2;
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const angle = t * Math.PI * 2 * 2.5 + phaseOffset;
        const y = (t - 0.5) * 2 * 1.25 * 0.85;
        const r = 1.25 * Math.sqrt(Math.max(0, 1 - Math.pow(y / 1.25, 2) * 0.6));
        spiral.push({ x: Math.cos(angle) * r, y, z: Math.sin(angle) * r });
      }
      spirals.push(spiral);
    }

    // Orbit particles
    const orbitParticles: { x: number; y: number; z: number; speed: number }[] = [];
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 2;
      const r = 1.3 + Math.random() * 0.2;
      orbitParticles.push({
        x: Math.cos(angle) * r,
        y,
        z: Math.sin(angle) * r,
        speed: 0.3 + Math.random() * 0.4,
      });
    }

    let time = 0;

    const rotate3D = (p: { x: number; y: number; z: number }, ay: number, ax: number) => {
      let x = p.x * Math.cos(ay) - p.z * Math.sin(ay);
      let z = p.x * Math.sin(ay) + p.z * Math.cos(ay);
      const newY = p.y * Math.cos(ax) - z * Math.sin(ax);
      const newZ = p.y * Math.sin(ax) + z * Math.cos(ax);
      return { x, y: newY, z: newZ };
    };

    const project = (p: { x: number; y: number; z: number }) => {
      const perspective = 3;
      const scale = perspective / (perspective + p.z);
      return {
        x: centerX + p.x * sphereRadius * scale,
        y: centerY + p.y * sphereRadius * scale,
        scale,
        z: p.z,
      };
    };

    const animate = () => {
      time += 0.016;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, size, size);

      const rotY = time * 0.35;
      const rotX = Math.sin(time * 0.25) * 0.12;

      // Draw spirals
      ctx.lineCap = "round";
      for (const spiral of spirals) {
        ctx.beginPath();
        for (let i = 0; i < spiral.length; i++) {
          const p = rotate3D(spiral[i], rotY * 0.6, rotX * 0.5);
          const proj = project(p);
          if (i === 0) ctx.moveTo(proj.x, proj.y);
          else ctx.lineTo(proj.x, proj.y);
        }
        ctx.strokeStyle = `rgba(255,255,255,0.2)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw sphere particles
      for (const p of spherePoints) {
        const rot = rotate3D(p, rotY, rotX);
        const proj = project(rot);
        const depth = (rot.z + 1) / 2;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 1.5 * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.25 + depth * 0.55})`;
        ctx.fill();
      }

      // Draw orbit particles
      for (const p of orbitParticles) {
        const angle = time * p.speed;
        const rotP = {
          x: p.x * Math.cos(angle) - p.z * Math.sin(angle),
          y: p.y,
          z: p.x * Math.sin(angle) + p.z * Math.cos(angle),
        };
        const rot = rotate3D(rotP, rotY * 0.4, rotX * 0.3);
        const proj = project(rot);
        const depth = (rot.z + 1.5) / 3;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 1.2 * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.15 + depth * 0.35})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.5s ease-out",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 300,
          height: 300,
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: "#000",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.95)",
          transform: isVisible && !isExiting ? "scale(1)" : "scale(0.9)",
          opacity: isVisible && !isExiting ? 1 : 0,
          transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease-out",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />

        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "28px 24px 24px",
            background: "linear-gradient(to top, rgba(0,0,0,0.95) 60%, transparent)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            opacity: isVisible ? 1 : 0,
            transition: "transform 0.6s ease 0.2s, opacity 0.5s ease 0.2s",
          }}
        >
          <div
            style={{
              width: "100%",
              height: 4,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${percent}%`,
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.8)",
                transition: "width 0.5s ease-out",
              }}
            />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 500,
              color: "rgba(255,255,255,0.75)",
              textAlign: "center",
              letterSpacing: "0.02em",
            }}
          >
            {percent}% • {statusText || "Обрабатываем видео..."}
          </p>
        </div>
      </div>
    </div>
  );
}
