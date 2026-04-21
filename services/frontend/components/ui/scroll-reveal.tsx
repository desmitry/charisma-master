"use client";

import { motion, useInView } from "framer-motion";
import type React from "react";
import { useRef } from "react";

type Direction = "up" | "down" | "left" | "right";

interface ScrollRevealProps {
	children: React.ReactNode;
	direction?: Direction;
	delay?: number;
	duration?: number;
	distance?: number;
	once?: boolean;
	className?: string;
	scale?: number;
}

const directionOffsets: Record<Direction, { x: number; y: number }> = {
	up: { x: 0, y: 1 },
	down: { x: 0, y: -1 },
	left: { x: 1, y: 0 },
	right: { x: -1, y: 0 },
};

export function ScrollReveal({
	children,
	direction = "up",
	delay = 0,
	duration = 0.7,
	distance = 60,
	once = true,
	className = "",
	scale = 1,
}: ScrollRevealProps) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once, margin: "-80px" });

	const offset = directionOffsets[direction];

	return (
		<motion.div
			ref={ref}
			className={className}
			initial={{
				opacity: 0,
				x: offset.x * distance,
				y: offset.y * distance,
				scale: scale < 1 ? scale : 1,
			}}
			animate={
				isInView
					? { opacity: 1, x: 0, y: 0, scale: 1 }
					: {
							opacity: 0,
							x: offset.x * distance,
							y: offset.y * distance,
							scale: scale < 1 ? scale : 1,
						}
			}
			transition={{
				duration,
				delay,
				ease: [0.22, 1, 0.36, 1],
			}}
		>
			{children}
		</motion.div>
	);
}
