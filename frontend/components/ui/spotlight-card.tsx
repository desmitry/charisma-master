"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.1)",
  spotlightSize = 400,
}: {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  spotlightSize?: number;
}) {
  const boundingBox = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 500, damping: 50 });
  const smoothY = useSpring(mouseY, { stiffness: 500, damping: 50 });

  function onMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    if (!boundingBox.current) return;
    const { left, top } = boundingBox.current.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      ref={boundingBox}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: useTransform(
            [smoothX, smoothY],
            ([x, y]) =>
              `radial-gradient(${spotlightSize}px circle at ${x}px ${y}px, ${spotlightColor}, transparent 80%)`
          ),
        }}
      />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
}
