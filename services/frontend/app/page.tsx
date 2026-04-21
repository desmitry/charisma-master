"use client";

import { useEffect, useState } from "react";
import { Hero } from "@/components/landing/hero";
import { Leva } from "leva";
import { ProcessingOverlay } from "@/components/upload/processing-overlay";
import { AnalysisDashboard } from "@/components/analysis/analysis-dashboard";

import ColorBends from "@/components/animations/color-bends";
import Aurora from "@/components/animations/aurora";
import { ComingSoonNotification } from "@/components/shared/coming-soon-notification";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { FeaturesSection } from "@/components/landing/features-section";
import { UploadHub } from "@/components/upload/upload-hub";
import { useVideoAnalysis } from "@/hooks/use-video-analysis";
import GradualBlur from "@/components/GradualBlur";

const AURORA_DESKTOP_COLORS = ["#ffffff", "#000000", "#ffffff"];
const AURORA_MOBILE_COLORS = ["#ffffff", "#000000", "#ffffff"];
const COLORBENDS_COLORS = ["#ffffff", "#000000"];

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
  } = state;

  const showLanding = stage === "landing";
  const showProcessing = stage === "processing";
  const shouldShowGL =
    showLanding && !showProcessing && !isUploading && !isExiting;

  return (
    <>
      {showLanding && <SmoothScroll />}

      {/* Global Aurora Background */}
      {shouldShowGL && (
        <>
          {/* Desktop Aurora */}
          {!isMobile && (
            <div className="pointer-events-none fixed inset-0 -z-20 w-full h-full bg-black overflow-hidden opacity-40">
              <Aurora
                colorStops={AURORA_DESKTOP_COLORS}
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
          <div className="absolute inset-0 bg-[#020202]">
            <ColorBends
              rotation={0}
              speed={0.2}
              colors={COLORBENDS_COLORS}
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
          {!isMobile && (
            <>
              <GradualBlur
                target="page"
                position="top"
                height="7rem"
                strength={1.5}
                divCount={2}
                curve="bezier"
                exponential
                opacity={1}
              />
              <GradualBlur
                target="page"
                position="bottom"
                height="7rem"
                strength={1.5}
                divCount={2}
                curve="bezier"
                exponential
                opacity={1}
              />
            </>
          )}

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
                      colorStops={AURORA_MOBILE_COLORS}
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
                      colorStops={AURORA_MOBILE_COLORS}
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
        <div
          className="transition-all duration-700 ease-[0.22,1,0.36,1] relative z-10"
          style={{
            opacity: showResult ? 1 : 0,
            transform: showResult ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <AnalysisDashboard result={result} onBack={actions.resetState} />
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
