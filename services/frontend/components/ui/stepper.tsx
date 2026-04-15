"use client";

import React, {
  useState,
  useRef,
  useLayoutEffect,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "motion/react";

import "./stepper.css";

/* ─── Slide animation variants ─── */
const stepVariants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? "80%" : "-80%",
    opacity: 0,
    filter: "blur(4px)",
  }),
  center: {
    x: "0%",
    opacity: 1,
    filter: "blur(0px)",
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? "-40%" : "40%",
    opacity: 0,
    filter: "blur(4px)",
  }),
};

/* ─── StepIndicator (single circle) ─── */
function StepIndicator({
  step,
  currentStep,
  onClickStep,
  disableStepIndicators,
}: {
  step: number;
  currentStep: number;
  onClickStep: (step: number) => void;
  disableStepIndicators: boolean;
}) {
  const status =
    currentStep === step
      ? "active"
      : currentStep < step
        ? "inactive"
        : "complete";

  return (
    <motion.div
      onClick={() => {
        if (step !== currentStep && !disableStepIndicators) onClickStep(step);
      }}
      className="stepper-indicator"
      style={disableStepIndicators ? { pointerEvents: "none", opacity: 0.45 } : {}}
      animate={status}
      initial={false}
    >
      <motion.div
        variants={{
          inactive: {
            scale: 1,
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.3)",
            borderColor: "rgba(255,255,255,0.06)",
          },
          active: {
            scale: 1,
            backgroundColor: "rgba(255,255,255,0.12)",
            color: "#ffffff",
            borderColor: "rgba(255,255,255,0.3)",
          },
          complete: {
            scale: 1,
            backgroundColor: "rgba(255,255,255,0.08)",
            color: "#ffffff",
            borderColor: "rgba(255,255,255,0.12)",
          },
        }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="stepper-indicator-inner"
      >
        {status === "complete" ? (
          <CheckIcon className="stepper-check-icon" />
        ) : status === "active" ? (
          <div className="stepper-active-dot" />
        ) : (
          <span className="stepper-step-number">{step}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── StepConnector (line between circles) ─── */
function StepConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <div className="stepper-connector">
      <motion.div
        className="stepper-connector-fill"
        initial={false}
        animate={
          isComplete
            ? { width: "100%", backgroundColor: "rgba(255,255,255,0.22)" }
            : { width: "0%", backgroundColor: "rgba(255,255,255,0)" }
        }
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ─── CheckIcon (animated checkmark SVG) ─── */
function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.1, type: "tween", ease: "easeOut", duration: 0.3 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/* ─── SlideTransition (measures height + slides content) ─── */
function SlideTransition({
  children,
  direction,
  onHeightReady,
}: {
  children: ReactNode;
  direction: number;
  onHeightReady: (h: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (ref.current) onHeightReady(ref.current.offsetHeight);
  }, [children, onHeightReady]);

  return (
    <motion.div
      ref={ref}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ position: "absolute", left: 0, right: 0, top: 0 }}
    >
      {children}
    </motion.div>
  );
}

/* ─── StepContentWrapper (animated height + slide) ─── */
function StepContentWrapper({
  isCompleted,
  currentStep,
  direction,
  children,
  className,
}: {
  isCompleted: boolean;
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
}) {
  const [parentHeight, setParentHeight] = useState(0);

  return (
    <motion.div
      className={className}
      style={{ position: "relative", overflow: "hidden" }}
      animate={{ height: isCompleted ? 0 : parentHeight }}
      transition={{ type: "spring", stiffness: 280, damping: 32 }}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition
            key={currentStep}
            direction={direction}
            onHeightReady={(h) => setParentHeight(h)}
          >
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════ */

/**
 * Animated step indicator row.
 * Renders circles + connectors. Controlled externally.
 */
export function StepperIndicatorRow({
  totalSteps,
  currentStep,
  onStepClick,
  disableStepIndicators = false,
  className = "",
}: {
  totalSteps: number;
  currentStep: number;
  onStepClick?: (step: number) => void;
  disableStepIndicators?: boolean;
  className?: string;
}) {
  return (
    <div className={`stepper-indicator-row ${className}`}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        return (
          <React.Fragment key={stepNum}>
            <StepIndicator
              step={stepNum}
              currentStep={currentStep}
              disableStepIndicators={disableStepIndicators || !onStepClick}
              onClickStep={(s) => onStepClick?.(s)}
            />
            {i < totalSteps - 1 && (
              <StepConnector isComplete={currentStep > stepNum} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Animated content wrapper that slides step content
 * in/out with height animation. Controlled externally.
 */
export function StepperContent({
  currentStep,
  direction,
  children,
  className = "",
}: {
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <StepContentWrapper
      isCompleted={false}
      currentStep={currentStep}
      direction={direction}
      className={`stepper-content-area ${className}`}
    >
      <div className="stepper-step-content">{children}</div>
    </StepContentWrapper>
  );
}
