import { useCallback, useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Effects } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useControls } from "leva";
import { Particles } from "./particles";
import { VignetteShader } from "./shaders/vignetteShader";
import { useEcoMode } from "@/lib/eco-mode-context";

function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return !!gl;
  } catch {
    return false;
  }
}

export const GL = () => {
  const { isEcoMode } = useEcoMode();
  const [contextLost, setContextLost] = useState(false);
  const [key, setKey] = useState(0);
  const [webglSupported, setWebglSupported] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    console.log("[GL] Component mounted");
    const supported = checkWebGLSupport();
    setWebglSupported(supported);
    console.log("[GL] WebGL supported:", supported);
    
    return () => {
      console.log("[GL] Component unmounting - forcing cleanup");
      if (cleanupRef.current) {
        console.log("[GL] Calling cleanup function from handleCreated");
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (rendererRef.current) {
        console.log("[GL] Force disposing renderer from useEffect cleanup");
        try {
          rendererRef.current.setAnimationLoop(null);
          rendererRef.current.dispose();
          const context = rendererRef.current.getContext();
          if (context) {
            const loseContext = (context as any).loseContext;
            if (loseContext) {
              console.log("[GL] Force losing context");
              loseContext.call(context);
            }
          }
          rendererRef.current = null;
        } catch (e) {
          console.error("[GL] Error in useEffect cleanup:", e);
        }
      }
    };
  }, []);

  useEffect(() => {
    console.log("[GL] Context lost state changed:", contextLost);
  }, [contextLost]);

  useEffect(() => {
    console.log("[GL] Key changed (Canvas recreated):", key);
  }, [key]);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    console.log("[GL] Canvas created, WebGL renderer initialized");
    rendererRef.current = gl;
    const canvas = gl.domElement;
    let isMounted = true;
    const startTime = Date.now();
    
    const handleContextLost = (event: Event) => {
      const elapsed = Date.now() - startTime;
      console.error("[GL] ⚠️ WebGL context lost!", {
        elapsed: `${elapsed}ms`,
        isMounted,
        timestamp: new Date().toISOString(),
        stack: new Error().stack
      });
      event.preventDefault();
      if (isMounted) {
        setContextLost(true);
        console.warn("[GL] Setting contextLost state to true");
      } else {
        console.warn("[GL] Context lost but component already unmounted - ignoring");
        return;
      }
    };
    
    const handleContextRestored = () => {
      const elapsed = Date.now() - startTime;
      console.log("[GL] ✅ WebGL context restored!", {
        elapsed: `${elapsed}ms`,
        isMounted,
        timestamp: new Date().toISOString()
      });
      if (isMounted) {
        setContextLost(false);
        setKey(prev => {
          console.log("[GL] Incrementing key for Canvas recreation:", prev + 1);
          return prev + 1;
        });
      } else {
        console.warn("[GL] Context restored but component already unmounted");
      }
    };
    
    console.log("[GL] Adding event listeners for context lost/restored");
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    
    const cleanup = () => {
      const elapsed = Date.now() - startTime;
      console.log("[GL] Canvas cleanup started", {
        elapsed: `${elapsed}ms`,
        isMounted,
        timestamp: new Date().toISOString()
      });
      isMounted = false;
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      try {
        console.log("[GL] Stopping animation loop");
        gl.setAnimationLoop(null);
        console.log("[GL] Disposing renderer");
        gl.dispose();
        const context = gl.getContext();
        if (context) {
          const loseContext = (context as any).loseContext;
          if (loseContext) {
            console.log("[GL] Forcing context loss");
            loseContext.call(context);
          }
        }
        rendererRef.current = null;
        console.log("[GL] ✅ Cleanup completed");
      } catch (e) {
        console.error("[GL] ❌ Error disposing WebGL:", e);
      }
    };
    
    cleanupRef.current = cleanup;
    return cleanup;
  }, []);
  const {
    speed,
    focus,
    aperture,
    size,
    noiseScale,
    noiseIntensity,
    timeScale,
    pointSize,
    opacity,
    planeScale,
    vignetteDarkness,
    vignetteOffset,
    useManualTime,
    manualTime,
  } = useControls("Particle System", {
    speed: { value: 1.0, min: 0, max: 2, step: 0.01 },
    noiseScale: { value: 0.6, min: 0.1, max: 5, step: 0.1 },
    noiseIntensity: { value: 0.52, min: 0, max: 2, step: 0.01 },
    timeScale: { value: 1, min: 0, max: 2, step: 0.01 },
    focus: { value: 3.8, min: 0.1, max: 20, step: 0.1 },
    aperture: { value: 1.79, min: 0, max: 2, step: 0.01 },
    pointSize: { value: 10.0, min: 0.1, max: 10, step: 0.1 },
    opacity: { value: 0.8, min: 0, max: 1, step: 0.01 },
    planeScale: { value: 10.0, min: 0.1, max: 10, step: 0.1 },
    size: {
      value: 512,
      options: [256, 512, 1024],
    },
    showDebugPlane: { value: false },
    vignetteDarkness: { value: 1.5, min: 0, max: 2, step: 0.1 },
    vignetteOffset: { value: 0.4, min: 0, max: 2, step: 0.1 },
    useManualTime: { value: false },
    manualTime: { value: 0, min: 0, max: 50, step: 0.01 },
  });
  const effectiveSize = isEcoMode ? Math.min(size, 256) : size;

  useEffect(() => {
    console.log("[GL] Render check:", {
      contextLost,
      webglSupported,
      effectiveSize,
      isEcoMode,
      key
    });
  }, [contextLost, webglSupported, effectiveSize, isEcoMode, key]);

  if (contextLost || !webglSupported) {
    console.log("[GL] Rendering fallback (contextLost or not supported)");
    return (
      <div id="webgl">
        <div className="eco-bg w-full h-full" />
      </div>
    );
  }

  console.log("[GL] Rendering Canvas");
  return (
    <div id="webgl" key={key}>
      <Canvas
        camera={{
          position: [
            1.2629783123314589, 2.664606471394044, -1.8178993743288914,
          ],
          fov: 50,
          near: 0.01,
          far: 300,
        }}
        dpr={isEcoMode ? [1, 1] : [1, 1.5]}
        gl={{ 
          powerPreference: "low-power",
          antialias: false,
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
          stencil: false,
          depth: true,
          alpha: false,
        }}
        onCreated={handleCreated}
        performance={{ min: 0.5, max: 1, debounce: 200 }}
        frameloop="always"
      >
        <color attach="background" args={["#000"]} />
        <Particles
          speed={speed}
          aperture={aperture}
          focus={focus}
          size={effectiveSize}
          noiseScale={noiseScale}
          noiseIntensity={noiseIntensity}
          timeScale={timeScale}
          pointSize={isEcoMode ? pointSize * 1.3 : pointSize}
          opacity={opacity}
          planeScale={planeScale}
          useManualTime={useManualTime}
          manualTime={manualTime}
          introspect={false}
          isEcoMode={isEcoMode}
        />
        <Effects multisamping={0} disableGamma>
          <shaderPass
            args={[VignetteShader]}
            uniforms-darkness-value={vignetteDarkness}
            uniforms-offset-value={vignetteOffset}
          />
        </Effects>
      </Canvas>
    </div>
  );
};
