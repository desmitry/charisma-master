"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Hero } from "@/components/landing/hero";
import { Leva } from "leva";
import { ProcessingOverlay } from "@/components/upload/processing-overlay";
import { AnalysisDashboard } from "@/components/analysis/analysis-dashboard";
import SurveyButton from "@/components/shared/survey-button";

import ColorBends from "@/components/animations/color-bends";
import Aurora from "@/components/animations/aurora";
import { ComingSoonNotification } from "@/components/shared/coming-soon-notification";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { FeaturesSection } from "@/components/landing/features-section";
import { UploadHub } from "@/components/upload/upload-hub";
import { useVideoAnalysis } from "@/hooks/use-video-analysis";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const AURORA_DARK = ["#ffffff", "#000000", "#ffffff"];
const AURORA_LIGHT = ["#000000", "#1a1a1a", "#000000"];
const COLORBENDS_DARK = ["#ffffff", "#000000"];
const COLORBENDS_LIGHT = ["#17130f", "#b78300", "#efe1c4"];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isMobile;
}

export default function Home() {
  const isMobile = useIsMobile();
  const [themeMounted, setThemeMounted] = useState(false);
  const videoAnalysis = useVideoAnalysis();
  const { state, actions } = videoAnalysis;
  const {
    stage,
    progress,
    statusText,
    error,
    result,
    isExiting,
    showResult,
    isUploading,
    showErrorPopup,
    serverErrorText,
    isMockMode,
  } = state;

  const { resolvedTheme } = useTheme();
  const isDark = themeMounted ? resolvedTheme !== "light" : true;

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const auroraColors = isDark ? AURORA_DARK : AURORA_LIGHT;
  const colorBendsColors = isDark ? COLORBENDS_DARK : COLORBENDS_LIGHT;

  const showLanding = stage === "landing";
  const showProcessing = stage === "processing";
  const shouldShowGL =
    showLanding && !showProcessing && !isUploading && !isExiting;

  return (
    <>
      {stage !== "result" && <AuthPanel />}

      {/* Theme toggle — fixed top-left */}
      <div className="fixed top-4 left-4 z-50 sm:top-6 sm:left-6">
        <ThemeToggle />
      </div>

      {showLanding && <SmoothScroll />}

      {/* Global Aurora Background */}
      {shouldShowGL && (
        <>
          {/* Desktop Aurora */}
          {!isMobile && (
            <div
              className="pointer-events-none fixed inset-0 -z-20 w-full h-full overflow-hidden transition-colors duration-500"
              style={{
                background: "var(--page-aurora-bg)",
                opacity: "var(--page-aurora-opacity)",
              }}
            >
              <Aurora
                colorStops={auroraColors}
                blend={1.0}
                amplitude={1.0}
                speed={1.0}
              />
            </div>
          )}
        </>
      )}

      {/* First Section Animated Background (ColorBends) */}
      {shouldShowGL && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[120svh] -z-10 w-full overflow-hidden"
          style={{
            maskImage: "linear-gradient(to bottom, black 40%, transparent 90%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 40%, transparent 90%)",
          }}
        >
          <div
            className="absolute inset-0 transition-colors duration-500"
            style={{ background: "var(--page-bends-bg)" }}
          >
            <ColorBends
              rotation={0}
              speed={0.2}
              colors={colorBendsColors}
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
        <>
          <div
            className="transition-all duration-700 ease-[0.22,1,0.36,1] relative"
            style={{
              opacity: isExiting ? 0 : 1,
              transform: isExiting
                ? "scale(0.97) translateY(-20px)"
                : "scale(1) translateY(0)",
            }}
          >
            {/* Mobile Aurora Pieces (Absolute to scroll with content, completely avoiding Hero) */}
            {isMobile && (
              <>
                {/* Top Left Horizontal Piece (Starts below Hero) */}
                <div className="pointer-events-none absolute top-[110vh] left-0 w-full h-[60vh] -z-20 overflow-hidden">
                  <div
                    className="absolute top-0 left-[-20%] w-[140%] h-[100%] opacity-100 -rotate-12"
                    style={{
                      maskImage:
                        "radial-gradient(ellipse at center, black 0%, black 40%, transparent 80%)",
                      WebkitMaskImage:
                        "radial-gradient(ellipse at center, black 0%, black 40%, transparent 80%)",
                    }}
                  >
                    <Aurora
                      colorStops={auroraColors}
                      blend={0.8}
                      amplitude={1.5}
                      speed={1.0}
                    />
                  </div>
                </div>

                {/* Bottom Right Horizontal Piece */}
                <div className="pointer-events-none absolute bottom-[5vh] right-0 w-full h-[60vh] -z-20 overflow-hidden">
                  <div
                    className="absolute bottom-0 right-[-20%] w-[140%] h-[100%] opacity-100 rotate-12"
                    style={{
                      maskImage:
                        "radial-gradient(ellipse at center, black 0%, black 40%, transparent 80%)",
                      WebkitMaskImage:
                        "radial-gradient(ellipse at center, black 0%, black 40%, transparent 80%)",
                    }}
                  >
                    <Aurora
                      colorStops={auroraColors}
                      blend={0.8}
                      amplitude={1.5}
                      speed={0.8}
                    />
                  </div>
                </div>
              </>
            )}

            <Hero />
            <div className="cv-auto">
              <FeaturesSection onStartDemo={actions.startMockFlow} />
            </div>

            <div className="cv-auto">
              <UploadHub videoAnalysis={videoAnalysis} />
            </div>
          </div>
        </>
      )}

      {showProcessing && !error && (
        <ProcessingOverlay progress={progress} statusText={statusText} />
      )}

      {stage === "result" && result && (
        <>
          <div
            className="transition-all duration-700 ease-[0.22,1,0.36,1] relative z-10"
            style={{
              opacity: showResult ? 1 : 0,
              transform: showResult ? "translateY(0)" : "translateY(20px)",
            }}
          >
            <AnalysisDashboard result={result} onBack={actions.resetState} />
          </div>
          {!isMockMode && <SurveyButton />}
        </>
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
