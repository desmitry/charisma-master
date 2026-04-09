import { useCallback, useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Effects } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useControls } from "leva";
import { Particles } from "@/components/animations/gl/particles";
import { VignetteShader } from "@/components/animations/gl/shaders/vignetteShader";

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
  const [contextLost, setContextLost] = useState(false);
  const [key, setKey] = useState(0);
  const [webglSupported, setWebglSupported] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const supported = checkWebGLSupport();
    setWebglSupported(supported);
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (rendererRef.current) {
        try {
          rendererRef.current.setAnimationLoop(null);
          rendererRef.current.dispose();
          const context = rendererRef.current.getContext();
          if (context) {
            const loseContext = (context as any).loseContext;
            if (loseContext) {
              loseContext.call(context);
            }
          }
          rendererRef.current = null;
        } catch {}
      }
    };
  }, []);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    rendererRef.current = gl;
    const canvas = gl.domElement;
    let isMounted = true;
    
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (isMounted) {
        setContextLost(true);
      }
    };
    
    const handleContextRestored = () => {
      if (isMounted) {
        setContextLost(false);
        setKey(prev => prev + 1);
      }
    };
    
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    
    const cleanup = () => {
      isMounted = false;
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      try {
        gl.setAnimationLoop(null);
        gl.dispose();
        const context = gl.getContext();
        if (context) {
          const loseContext = (context as any).loseContext;
          if (loseContext) {
            loseContext.call(context);
          }
        }
        rendererRef.current = null;
      } catch {}
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

  if (contextLost || !webglSupported) {
    return (
      <div id="webgl">
        <div className="w-full h-full bg-black" />
      </div>
    );
  }

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
        dpr={[1, 1.5]}
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
          size={size}
          noiseScale={noiseScale}
          noiseIntensity={noiseIntensity}
          timeScale={timeScale}
          pointSize={pointSize}
          opacity={opacity}
          planeScale={planeScale}
          useManualTime={useManualTime}
          manualTime={manualTime}
          introspect={false}
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
