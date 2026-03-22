"use client";

import React, { useEffect, useRef, useState } from "react";
import { Hero } from "@/components/landing/hero";
import { Leva } from "leva";
import { ProcessingOverlay } from "@/components/upload/processing-overlay";
import { AnalysisDashboard } from "@/components/analysis/analysis-dashboard";
import { AnalysisResult } from "@/types/analysis";
import { pollForAnalysis, uploadVideo } from "@/lib/api";

import ColorBends from "@/components/animations/color-bends";
import Aurora from "@/components/animations/aurora";
import { cn } from "@/lib/utils";
import { ComingSoonNotification } from "@/components/shared/coming-soon-notification";
import { getFastRequestsCount, decrementFastRequests, hasFastRequestsAvailable } from "@/lib/cookie-utils";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { FeaturesSection } from "@/components/landing/features-section";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { UploadHub } from "@/components/upload/upload-hub";
import { DemoVideoSection } from "@/components/landing/demo-video-section";
import { useVideoAnalysis } from "@/hooks/use-video-analysis";

type Stage = "landing" | "processing" | "result";

export default function Home() {
  const videoAnalysis = useVideoAnalysis();
  const { state, actions } = videoAnalysis;
  const { stage, progress, statusText, error, result, isExiting, showResult, isUploading, showErrorPopup, serverErrorText } = state;

  const showLanding = stage === "landing";
  const showProcessing = stage === "processing";
  const shouldShowGL = showLanding && !showProcessing && !isUploading && !isExiting;

  return (
    <>
      {showLanding && <SmoothScroll />}

      {/* Global Aurora Background */}
      {shouldShowGL && (
        <div className="pointer-events-none fixed inset-0 -z-20 w-full h-full bg-black overflow-hidden opacity-40">
          <Aurora
            colorStops={["#ffffff", "#000000", "#ffffff"]}
            blend={1.0}
            amplitude={1.0}
            speed={1.0}
          />
        </div>
      )}

      {/* First Section Animated Background (ColorBends) */}
      {shouldShowGL && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[120svh] -z-10 w-full overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)',
          }}
        >
          <div className="absolute inset-0 bg-[#020202]">
            <ColorBends
              rotation={0}
              speed={0.2}
              colors={["#ffffff", "#000000"]}
              transparent
              autoRotate={0.45}
              scale={1.1}
              frequency={1}
              warpStrength={1}
              mouseInfluence={0}
              parallax={0}
              noise={0}
            />
          </div>
        </div>
      )}

      {showLanding && (
        <div
          className="transition-all duration-700 ease-[0.22,1,0.36,1]"
          style={{
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? "scale(0.97) translateY(-20px)" : "scale(1) translateY(0)",
          }}
        >
          <Hero />
          <FeaturesSection />

          <DemoVideoSection onStartDemo={actions.startMockFlow} />

          <UploadHub videoAnalysis={videoAnalysis} />
        </div>
      )}

      {showProcessing && !error && (
        <ProcessingOverlay progress={progress} statusText={statusText} />
      )}

      {stage === "result" && result && (
        <div
          className="transition-all duration-700 ease-[0.22,1,0.36,1] relative z-10"
          style={{
            opacity: showResult ? 1 : 0,
            transform: showResult ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <AnalysisDashboard
            result={result}
            onBack={actions.resetState}
          />
        </div>
      )}

      <ComingSoonNotification
        isOpen={showErrorPopup}
        onClose={() => {
          actions.setShowErrorPopup(false);
          actions.setServerErrorText("");
        }}
        title="Ошибка"
        message={serverErrorText}
        icon={null}
      />
      <Leva hidden />
    </>
  );
}
